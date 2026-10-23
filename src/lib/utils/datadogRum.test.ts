import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, test } from 'vitest';

// The Datadog RUM init is an inline script in src/app.html (it must run before the app);
// these tests run that script with a stand-in DD_RUM and check what it configures.

const ORIGIN = 'https://polychat.co';

type RumConfig = Record<string, unknown> & { beforeSend: (event: RumEvent) => boolean };
type RumEvent = Record<string, any>;

function rumInitScript(): string {
	const html = readFileSync(new URL('../../app.html', import.meta.url), 'utf8');
	const start = html.indexOf('<!-- datadog -->');
	const match = html.slice(start).match(/<script>([\s\S]*?)<\/script>/);
	if (start < 0 || !match) throw new Error('Datadog RUM script not found in app.html');
	return match[1];
}

type RumInit = {
	config: RumConfig;
	loaderSrc: string;
	location: { href: string; origin: string; search: string; hash: string };
	replayStarts: () => number;
	runTimers: () => void;
};

function runRumInit(search = '', hash = ''): RumInit {
	let config: RumConfig | undefined;
	let replayStarts = 0;
	let timers: (() => void)[] = [];
	const loader: { src?: string; async?: number } = {};
	const location = { href: `${ORIGIN}/c/abc${search}${hash}`, origin: ORIGIN, search, hash };
	const window: Record<string, any> = {
		location,
		DD_RUM: {
			onReady: (callback: () => void) => callback(),
			init: (c: RumConfig) => (config = c),
			startSessionReplayRecording: () => (replayStarts += 1)
		}
	};
	const document = {
		createElement: () => loader,
		getElementsByTagName: () => [{ parentNode: { insertBefore: () => undefined } }]
	};
	const setTimeout = (callback: () => void) => timers.push(callback);
	runInNewContext(rumInitScript(), { window, document, URL, setTimeout });
	if (!config) throw new Error('DD_RUM.init was not called');
	const runTimers = () => {
		const due = timers;
		timers = [];
		due.forEach((callback) => callback());
	};
	return {
		config,
		loaderSrc: loader.src ?? '',
		location,
		replayStarts: () => replayStarts,
		runTimers
	};
}

describe('Datadog RUM init', () => {
	test('session replay masks all text and action names', () => {
		const { config, loaderSrc } = runRumInit();
		expect(config.defaultPrivacyLevel).toBe('mask');
		expect(config.enablePrivacyForActionName).toBe(true);
		expect(config.sessionReplaySampleRate).toBe(20);
		expect(config.site).toBe('us5.datadoghq.com');
		expect(loaderSrc).toBe('https://www.datadoghq-browser-agent.com/us5/v6/datadog-rum.js');
	});

	test('replay starts at once on a URL with no query or fragment', () => {
		const rum = runRumInit();
		expect(rum.config.startSessionReplayRecordingManually).toBe(true);
		expect(rum.replayStarts()).toBe(1);
		rum.runTimers();
		expect(rum.replayStarts()).toBe(1);
	});

	test('replay, which records the full URL, waits until ?q= or a fragment is gone', () => {
		for (const [search, hash] of [
			['?q=my%20secret', ''],
			['', '#secret']
		]) {
			const rum = runRumInit(search, hash);
			rum.runTimers();
			expect(rum.replayStarts()).toBe(0);
			rum.location.search = '';
			rum.location.hash = '';
			rum.runTimers();
			expect(rum.replayStarts()).toBe(1);
			rum.runTimers();
			expect(rum.replayStarts()).toBe(1);
		}
	});

	test('URLs lose their query and fragment; other sites keep only their origin', () => {
		const { beforeSend } = runRumInit().config;
		const event: RumEvent = {
			view: {
				url: `${ORIGIN}/?q=my%20secret%20prompt#x`,
				referrer: `${ORIGIN}/c/1?q=hi`,
				performance: { lcp: { resource_url: 'https://img.example.com/private.png?x=1' } }
			},
			resource: { url: `${ORIGIN}/api/v1/chats/search?text=private+words&page=1` }
		};
		expect(beforeSend(event)).toBe(true);
		expect(event.view.url).toBe(`${ORIGIN}/`);
		expect(event.view.referrer).toBe(`${ORIGIN}/c/1`);
		expect(event.view.performance.lcp.resource_url).toBe('https://img.example.com/');
		expect(event.resource.url).toBe(`${ORIGIN}/api/v1/chats/search`);

		const external: RumEvent = { resource: { url: 'https://img.example.com/my/private/pic.png' } };
		beforeSend(external);
		expect(external.resource.url).toBe('https://img.example.com/');

		const data: RumEvent = { resource: { url: 'data:image/png;base64,AAAA' } };
		beforeSend(data);
		expect(data.resource.url).toBe('data:');
	});

	test("long animation frames lose script URLs' queries; other invokers stay", () => {
		const { beforeSend } = runRumInit().config;
		const event: RumEvent = {
			long_task: {
				scripts: [
					{ source_url: `${ORIGIN}/?q=secret`, invoker: `${ORIGIN}/?q=secret` },
					{ source_url: `${ORIGIN}/_app/x.js`, invoker: 'DIV.onclick' },
					{ source_url: '', invoker: 'Window.requestAnimationFrame' }
				]
			}
		};
		beforeSend(event);
		expect(event.long_task.scripts).toEqual([
			{ source_url: `${ORIGIN}/`, invoker: `${ORIGIN}/` },
			{ source_url: `${ORIGIN}/_app/x.js`, invoker: 'DIV.onclick' },
			{ source_url: '', invoker: 'Window.requestAnimationFrame' }
		]);
	});

	test('an empty referrer stays empty', () => {
		const { beforeSend } = runRumInit().config;
		const event: RumEvent = { view: { url: `${ORIGIN}/`, referrer: '' } };
		beforeSend(event);
		expect(event.view.referrer).toBe('');
	});

	test('error messages, which can quote chat text, are dropped; stack frames stay', () => {
		const { beforeSend } = runRumInit().config;
		const stack = [
			`SyntaxError: Unexpected token 'H', "Hello my private chat" is not valid JSON`,
			'second line of the message',
			`    at JSON.parse (<anonymous>)`,
			`    at generateTitle (${ORIGIN}/_app/immutable/chunks/abc.js:1:2345)`,
			`fn@${ORIGIN}/_app/immutable/chunks/abc.js:3:4`
		].join('\n');
		const event: RumEvent = {
			error: {
				type: 'SyntaxError',
				source: 'console',
				message: `console error: Failed to parse response: "Hello my private chat"`,
				stack,
				resource: { url: `${ORIGIN}/api/chat?prompt=secret` },
				causes: [
					{ type: 'Error', message: 'private cause', stack: 'Error: private\n    at x (y.js:1:1)' }
				]
			}
		};
		beforeSend(event);
		expect(JSON.stringify(event)).not.toMatch(/private|secret|Hello/);
		expect(event.error.message).toBe('SyntaxError: [redacted]');
		expect(event.error.stack.split('\n')).toEqual([
			'SyntaxError: [redacted]',
			`    at JSON.parse (<anonymous>)`,
			`    at generateTitle (${ORIGIN}/_app/immutable/chunks/abc.js:1:2345)`,
			`fn@${ORIGIN}/_app/immutable/chunks/abc.js:3:4`
		]);
		expect(event.error.resource.url).toBe(`${ORIGIN}/api/chat`);
		expect(event.error.causes[0].stack).toBe('Error: [redacted]\n    at x (y.js:1:1)');
	});

	test('an error with no type or stack still sends', () => {
		const { beforeSend } = runRumInit().config;
		const event: RumEvent = { error: { message: 'Script error with chat text' } };
		expect(beforeSend(event)).toBe(true);
		expect(event.error).toEqual({ message: 'Error: [redacted]', stack: undefined });
	});
});
