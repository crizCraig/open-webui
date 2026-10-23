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
	test('sends in order, the page view once', async () => {
		const { calls, fetchImpl } = capture();
		const track = keyPageTracker({ appUrl: APP, token: 't', fetchImpl });
		track('page_view');
		track('key_created');
		track('page_view');
		track('copy_key');
		await track('copy_key');
		expect(calls.map((c) => JSON.parse(c.init.body as string).event)).toEqual([
			'page_view',
			'key_created',
			'copy_key',
			'copy_key'
		]);
	});

	test('a failed send does not stop the ones after it', async () => {
		let n = 0;
		const sent: string[] = [];
		const fetchImpl = (async (_url: string, init: RequestInit) => {
			n += 1;
			if (n === 1) throw new TypeError('offline');
			sent.push(JSON.parse(init.body as string).event);
			return { ok: true } as Response;
		}) as unknown as typeof fetch;
		const track = keyPageTracker({ appUrl: APP, fetchImpl });
		track('page_view');
		await track('copy_install');
		expect(sent).toEqual(['copy_install']);
	});
});
