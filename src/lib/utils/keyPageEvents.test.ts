import { describe, expect, test, vi } from 'vitest';

import {
	KEY_PAGE_EVENT_PATH,
	keyPageTracker,
	sendKeyPageEvent,
	type KeyPageEvent
} from '$lib/utils/keyPageEvents';

const APP = 'https://app.polychat.co/';

function capture(ok = true) {
	const calls: { url: string; init: RequestInit }[] = [];
	const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
		calls.push({ url, init });
		return { ok } as Response;
	});
	return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
}

describe('sendKeyPageEvent', () => {
	test('posts only the event name, with the session', async () => {
		const { calls, fetchImpl } = capture();
		expect(await sendKeyPageEvent('copy_install', { appUrl: APP, token: 'jwt', fetchImpl })).toBe(
			true
		);
		expect(calls).toHaveLength(1);
		expect(calls[0].url).toBe(`https://app.polychat.co${KEY_PAGE_EVENT_PATH}`);
		expect(calls[0].init.body).toBe('{"event":"copy_install"}');
		expect(calls[0].init.credentials).toBe('include');
		// No keepalive: browsers may refuse a keepalive request that needs a CORS preflight.
		expect(calls[0].init.keepalive).toBeUndefined();
		expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer jwt');
	});

	test('never rejects, and sends nothing for unknown names', async () => {
		const failing = vi.fn(async () => {
			throw new TypeError('Failed to fetch');
		}) as unknown as typeof fetch;
		expect(await sendKeyPageEvent('page_view', { appUrl: APP, fetchImpl: failing })).toBe(false);
		const { calls, fetchImpl } = capture();
		expect(
			await sendKeyPageEvent('sk-0123' as KeyPageEvent, { appUrl: APP, fetchImpl })
		).toBe(false);
		expect(calls).toHaveLength(0);
		const refused = capture(false);
		expect(
			await sendKeyPageEvent('page_view', { appUrl: APP, fetchImpl: refused.fetchImpl })
		).toBe(false);
	});
});

describe('keyPageTracker', () => {
	test('sends each event, the page view once', async () => {
		const { calls, fetchImpl } = capture();
		const track = keyPageTracker({ appUrl: APP, token: 't', fetchImpl });
		await Promise.all([
			track('page_view'),
			track('key_created'),
			track('page_view'),
			track('copy_key'),
			track('copy_key')
		]);
		expect(calls.map((c) => JSON.parse(c.init.body as string).event).sort()).toEqual([
			'copy_key',
			'copy_key',
			'key_created',
			'page_view'
		]);
		expect(calls[0].init.signal).toBeDefined();
	});

	test('reads the app URL at each send (the config may load after the page)', async () => {
		const { calls, fetchImpl } = capture();
		let url = 'https://app.polychat.co';
		const track = keyPageTracker({
			get appUrl() {
				return url;
			},
			fetchImpl
		});
		await track('page_view');
		url = 'https://staging.example.test';
		await track('copy_key');
		expect(calls.map((c) => new URL(c.url).host)).toEqual([
			'app.polychat.co',
			'staging.example.test'
		]);
	});

	test('a stalled send does not hold back the others', async () => {
		const sent: string[] = [];
		const fetchImpl = ((_url: string, init: RequestInit) => {
			const event = JSON.parse(init.body as string).event;
			if (event === 'page_view') return new Promise<Response>(() => {});
			sent.push(event);
			return Promise.resolve({ ok: true } as Response);
		}) as unknown as typeof fetch;
		const track = keyPageTracker({ appUrl: APP, fetchImpl });
		void track('page_view');
		expect(await track('copy_install')).toBe(true);
		expect(sent).toEqual(['copy_install']);
	});
});
