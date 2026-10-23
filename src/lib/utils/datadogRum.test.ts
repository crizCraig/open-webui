import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, test } from 'vitest';

// The Datadog RUM init is an inline script in src/app.html (it must run before the app);
// these tests run that script with a stand-in DD_RUM and check what it configures and sends.

const ORIGIN = 'https://polychat.co';

// Fields Datadog's browser SDK (v6.33) lets beforeSend change; it reverts any other change.
const MODIFIABLE_FIELDS = [
	'view.name',
	'view.url',
	'view.referrer',
	'context',
	'service',
	'version',
	'view.performance.lcp.resource_url',
	'error.message',
	'error.stack',
	'error.handling_stack',
	'error.resource.url',
	'error.fingerprint',
	'resource.url',
	'action.target.name',
	'long_task.scripts[].source_url',
	'long_task.scripts[].invoker'
];

type RumEvent = Record<string, any>;
type BeforeSend = (event: RumEvent, context?: { error?: unknown }) => boolean;
type RumConfig = Record<string, unknown> & { beforeSend: BeforeSend };
type History = Record<'pushState' | 'replaceState', (s: unknown, t: string, url?: string) => void>;

type RumInit = {
	config: RumConfig;
	loaderSrc: string;
	history: History;
	// What reaches Datadog for an event: null when beforeSend drops it.
	send: (event: RumEvent, context?: { error?: unknown }) => RumEvent | null;
	// Sets the URL as a browser Back/Forward would, firing popstate.
	popTo: (url: string) => void;
	replay: () => { starts: number; stops: number; recording: boolean };
	runTimers: () => void;
};

function runRumInit(path = '/c/abc'): RumInit {
	let config: RumConfig | undefined;
	const replay = { starts: 0, stops: 0, recording: false };
	let timers: (() => void)[] = [];
	const listeners: Record<string, (() => void)[]> = {};
	const loader: { src?: string; async?: number } = {};
	const location = { href: '', origin: ORIGIN };
	const setUrl = (url: string) => (location.href = new URL(url, location.href || ORIGIN).href);
	setUrl(path);
	const history: History = {
		pushState: (_s, _t, url) => url !== undefined && setUrl(url),
		replaceState: (_s, _t, url) => url !== undefined && setUrl(url)
	};
	const DD_RUM = {
		onReady: (callback: () => void) => callback(),
		init: (c: RumConfig) => (config = c),
		startSessionReplayRecording: () => {
			replay.starts += 1;
			replay.recording = true;
		},
		stopSessionReplayRecording: () => {
			replay.stops += 1;
			replay.recording = false;
		}
	};
	const window: Record<string, any> = {
		location,
		history,
		DD_RUM,
		addEventListener: (type: string, listener: () => void) =>
			(listeners[type] ??= []).push(listener)
	};
	const document = {
		createElement: () => loader,
		getElementsByTagName: () => [{ parentNode: { insertBefore: () => undefined } }]
	};
	const setTimeout = (callback: () => void) => timers.push(callback);
	runInNewContext(rumInitScript(), { window, document, URL, setTimeout });
	if (!config) throw new Error('DD_RUM.init was not called');
	const { beforeSend } = config;
	return {
		config,
		loaderSrc: loader.src ?? '',
		history: window.history,
		send: (event, context) => sendThroughBeforeSend(beforeSend, event, context),
		popTo: (url) => {
			setUrl(url);
			(listeners.popstate ?? []).forEach((listener) => listener());
		},
		replay: () => ({ ...replay }),
		runTimers: () => {
			const due = timers;
			timers = [];
			due.forEach((callback) => callback());
		}
	};
}

describe('Datadog RUM init', () => {
	test('session replay masks all text and action names', () => {
		const { config, loaderSrc } = runRumInit();
		expect(config.defaultPrivacyLevel).toBe('mask');
		expect(config.enablePrivacyForActionName).toBe(true);
		expect(config.sessionReplaySampleRate).toBe(20);
		expect(config.startSessionReplayRecordingManually).toBe(true);
		expect(config.site).toBe('us5.datadoghq.com');
		expect(loaderSrc).toBe('https://www.datadoghq-browser-agent.com/us5/v6/datadog-rum.js');
	});
});

describe('session replay start', () => {
	test('starts at once on a URL with no query or fragment', () => {
		const rum = runRumInit();
		expect(rum.replay()).toEqual({ starts: 1, stops: 0, recording: true });
		rum.runTimers();
		expect(rum.replay().starts).toBe(1);
	});

	test('waits until ?q= or a fragment is gone', () => {
		for (const path of ['/?q=my%20secret', '/auth#token=secret']) {
			const rum = runRumInit(path);
			rum.runTimers();
			expect(rum.replay().recording).toBe(false);
			rum.history.replaceState(null, '', '/c/new-chat');
			rum.runTimers();
			expect(rum.replay()).toEqual({ starts: 1, stops: 0, recording: true });
			rum.runTimers();
			expect(rum.replay().starts).toBe(1);
		}
	});

	test('stops before an in-app navigation adds a query, and restarts once it is gone', () => {
		const rum = runRumInit('/c/abc');
		rum.history.pushState(null, '', `/auth?redirect=${encodeURIComponent('/?q=secret')}`);
		expect(rum.replay()).toEqual({ starts: 1, stops: 1, recording: false });
		rum.runTimers();
		expect(rum.replay().recording).toBe(false);
		rum.history.pushState(null, '', '/c/abc');
		expect(rum.replay().stops).toBe(1);
		rum.runTimers();
		expect(rum.replay()).toEqual({ starts: 2, stops: 1, recording: true });
	});

	test('stops when Back/Forward lands on a URL with a query', () => {
		const rum = runRumInit('/c/abc');
		rum.popTo('/?q=secret');
		expect(rum.replay().recording).toBe(false);
		rum.popTo('/c/abc');
		rum.runTimers();
		expect(rum.replay().recording).toBe(true);
	});

	test('one restart timer however many navigations pause it', () => {
		const rum = runRumInit('/c/abc');
		rum.history.pushState(null, '', '/?a=1');
		rum.history.replaceState(null, '', '/?a=2');
		rum.popTo('/#x');
		rum.history.replaceState(null, '', '/c/abc');
		rum.runTimers();
		expect(rum.replay()).toEqual({ starts: 2, stops: 3, recording: true });
	});

	test('a history call with no URL keeps replay running', () => {
		const rum = runRumInit('/c/abc');
		rum.history.replaceState({ x: 1 }, '');
		expect(rum.replay()).toEqual({ starts: 1, stops: 0, recording: true });
	});
});

describe('beforeSend', () => {
	test('URLs lose their query and fragment; other sites keep only their origin', () => {
		const { send } = runRumInit();
		const sent = send({
			view: {
				url: `${ORIGIN}/?q=my%20secret%20prompt#x`,
				referrer: `${ORIGIN}/c/1?q=hi`,
				performance: { lcp: { resource_url: 'https://img.example.com/private.png?x=1' } }
			},
			resource: { url: `${ORIGIN}/api/v1/chats/search?text=private+words&page=1` }
		});
		expect(sent?.view.url).toBe(`${ORIGIN}/`);
		expect(sent?.view.referrer).toBe(`${ORIGIN}/c/1`);
		expect(sent?.view.performance.lcp.resource_url).toBe('https://img.example.com/');
		expect(sent?.resource.url).toBe(`${ORIGIN}/api/v1/chats/search`);

		const external = send({ resource: { url: 'https://img.example.com/my/private/pic.png' } });
		expect(external?.resource.url).toBe('https://img.example.com/');
		const data = send({ resource: { url: 'data:image/png;base64,AAAA' } });
		expect(data?.resource.url).toBe('data:');
	});

	test('an empty referrer stays empty', () => {
		const sent = runRumInit().send({ view: { url: `${ORIGIN}/`, referrer: '' } });
		expect(sent?.view.referrer).toBe('');
	});

	test('action names are always the masked placeholder', () => {
		const sent = runRumInit().send({ action: { target: { name: 'my private chat text' } } });
		expect(sent?.action.target.name).toBe('Masked Element');
	});

	test("long animation frames lose script URLs' queries; other invokers stay", () => {
		const sent = runRumInit().send({
			long_task: {
				scripts: [
					{ source_url: `${ORIGIN}/?q=secret`, invoker: `${ORIGIN}/?q=secret` },
					{ source_url: `${ORIGIN}/_app/x.js`, invoker: 'DIV.onclick' },
					{ source_url: '', invoker: 'Window.requestAnimationFrame' },
					{ source_url: '', invoker: 'IMG[src="/x.png?q=secret]"].onload' },
					{ source_url: '', invoker: 'IMG#avatar.onload' }
				]
			}
		});
		expect(sent?.long_task.scripts).toEqual([
			{ source_url: `${ORIGIN}/`, invoker: `${ORIGIN}/` },
			{ source_url: `${ORIGIN}/_app/x.js`, invoker: 'DIV.onclick' },
			{ source_url: '', invoker: 'Window.requestAnimationFrame' },
			{ source_url: '', invoker: 'IMG[src].onload' },
			{ source_url: '', invoker: 'IMG#avatar.onload' }
		]);
	});

	test('error messages, which can quote chat text, are dropped; stack frames stay', () => {
		// The SDK's own stack format: "Name: message" then "  at <function> @ <url>" frames.
		const stack = [
			`SyntaxError: Unexpected token 'H', "Hello my private chat" is not valid JSON`,
			'at 5pm we talked about private things',
			'  at the cafe @ 10:30:45 private',
			'fn@private.example:1:2',
			`  at JSON.parse @ <anonymous>`,
			`  at generateTitle @ ${ORIGIN}/_app/immutable/chunks/abc.js:1:2345`,
			`  at <anonymous> @ ${ORIGIN}/?q=secret%20words#frag:180:12`,
			`  at f @ ${ORIGIN}/?q=fix%20my%20code%20(secret):180:12`,
			`  at new Chat @ ${ORIGIN}/c/1?q=secret:5:6b:3:4`,
			`  at eval @ :291:30`
		].join('\n');
		const sent = runRumInit().send({
			error: {
				type: 'SyntaxError',
				source: 'console',
				message: `console error: Failed to parse response: "Hello my private chat"`,
				stack,
				handling_stack: `HandlingStack: console error\n  at log @ ${ORIGIN}/x.js?private:1:2`,
				resource: { url: `${ORIGIN}/api/chat?prompt=secret` }
			}
		});
		expect(JSON.stringify(sent)).not.toMatch(/private|secret|Hello/);
		expect(sent?.error.message).toBe('SyntaxError: [redacted]');
		expect(sent?.error.stack.split('\n')).toEqual([
			'SyntaxError: [redacted]',
			`  at JSON.parse @ <anonymous>`,
			`  at generateTitle @ ${ORIGIN}/_app/immutable/chunks/abc.js:1:2345`,
			`  at <anonymous> @ ${ORIGIN}/:180:12`,
			`  at f @ ${ORIGIN}/:180:12`,
			`  at new Chat @ ${ORIGIN}/c/1:3:4`,
			`  at eval @ :291:30`
		]);
		expect(sent?.error.handling_stack).toBe(
			`HandlingStack: [redacted]\n  at log @ ${ORIGIN}/x.js:1:2`
		);
		expect(sent?.error.resource.url).toBe(`${ORIGIN}/api/chat`);
	});

	test("a multi-line message's lines are dropped even when shaped like frames", () => {
		const message = 'first line\n  at forged @ https://private.example/secret';
		const sent = runRumInit().send(
			{
				error: {
					type: 'Error',
					message,
					stack: `Error: ${message}\n  at real @ ${ORIGIN}/_app/a.js:1:2`
				}
			},
			{ error: new Error(message) }
		);
		expect(sent?.error.stack).toBe(`Error: [redacted]\n  at real @ ${ORIGIN}/_app/a.js:1:2`);
	});

	test('an event that scrubbing throws on is not sent', () => {
		expect(runRumInit().send({ long_task: { scripts: 5 } })).toBeNull();
	});

	test('an error with causes, which beforeSend cannot change, is not sent', () => {
		const event = {
			error: {
				type: 'Error',
				message: 'outer',
				causes: [{ type: 'Error', message: 'private cause', stack: 'Error: private' }]
			}
		};
		expect(runRumInit().send(event)).toBeNull();
	});

	test('an error with no type or stack still sends', () => {
		const sent = runRumInit().send({ error: { message: 'Script error with chat text' } });
		expect(sent?.error.message).toBe('Error: [redacted]');
	});
});

function rumInitScript(): string {
	const html = readFileSync(new URL('../../app.html', import.meta.url), 'utf8');
	const start = html.indexOf('<!-- datadog -->');
	const match = html.slice(start).match(/<script>([\s\S]*?)<\/script>/);
	if (start < 0 || !match) throw new Error('Datadog RUM script not found in app.html');
	return match[1];
}

// Like the SDK: beforeSend gets a copy, and only MODIFIABLE_FIELDS are copied back.
function sendThroughBeforeSend(
	beforeSend: BeforeSend,
	event: RumEvent,
	context: { error?: unknown } = {}
): RumEvent | null {
	const edited = structuredClone(event);
	if (beforeSend(edited, context) === false) return null;
	const sent = structuredClone(event);
	for (const field of MODIFIABLE_FIELDS) copyField(edited, sent, field.split('.'));
	return sent;
}

function copyField(from: any, to: any, path: string[]): void {
	if (!from || !to) return;
	const [head, ...rest] = path;
	if (head.endsWith('[]')) {
		const key = head.slice(0, -2);
		(to[key] ?? []).forEach((item: any, i: number) => copyField(from[key]?.[i], item, rest));
	} else if (rest.length === 0) {
		if (head in to) to[head] = from[head];
	} else {
		copyField(from[head], to[head], rest);
	}
}
