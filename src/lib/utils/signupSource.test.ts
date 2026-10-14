import { describe, expect, test, vi } from 'vitest';

import {
	SIGNUP_SOURCE_MAX_AGE_MS,
	SIGNUP_SOURCE_STORAGE_KEY,
	captureSignupSource,
	readStoredSignupSource,
	sendStoredSignupSource,
	signupSourceFromVisit,
	type SignupSourceStorage
} from '$lib/utils/signupSource';

const NOW = 1_800_000_000_000;

function memoryStorage(): SignupSourceStorage & { data: Map<string, string> } {
	const data = new Map<string, string>();
	return {
		data,
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => void data.set(key, value),
		removeItem: (key) => void data.delete(key)
	};
}

const visit = (path: string) => new URL(`https://polychat.co${path}`);

describe('signupSourceFromVisit', () => {
	test('keeps utm keys, ref and the referrer host only', () => {
		const url = visit('/auth?memtree=true&utm_source=ccc&utm_medium=cli&utm_campaign=x&ref=hn&q=1');
		expect(signupSourceFromVisit(url, 'https://news.ycombinator.com/item?id=1')).toEqual({
			utm_source: 'ccc',
			utm_medium: 'cli',
			utm_campaign: 'x',
			ref: 'hn',
			referrer: 'news.ycombinator.com'
		});
	});

	test('ignores our own site, junk referrers and odd values', () => {
		expect(signupSourceFromVisit(visit('/'), 'https://app.polychat.co/payment')).toBeNull();
		expect(signupSourceFromVisit(visit('/'), 'https://polychat.co/h')).toBeNull();
		expect(signupSourceFromVisit(visit('/'), 'not a url')).toBeNull();
		expect(signupSourceFromVisit(visit('/'), '')).toBeNull();
		expect(signupSourceFromVisit(visit('/?utm_source=%3Cscript%3E'), '')).toBeNull();
		expect(signupSourceFromVisit(visit('/?utm_source=' + 'a'.repeat(65)), '')).toBeNull();
	});
});

describe('captureSignupSource', () => {
	test('stores the first source; a later campaign replaces it, a bare referrer does not', () => {
		const storage = memoryStorage();
		captureSignupSource(visit('/'), 'https://www.reddit.com/r/x', storage, NOW);
		expect(readStoredSignupSource(storage, NOW)).toEqual({ referrer: 'www.reddit.com' });
		captureSignupSource(visit('/'), 'https://x.com/', storage, NOW);
		expect(readStoredSignupSource(storage, NOW)).toEqual({ referrer: 'www.reddit.com' });
		captureSignupSource(visit('/auth?utm_source=ccc'), '', storage, NOW);
		expect(readStoredSignupSource(storage, NOW)).toEqual({ utm_source: 'ccc' });
	});

	test('skips the OAuth return, whose referrer is the sign-in provider', () => {
		const storage = memoryStorage();
		captureSignupSource(visit('/auth#token=abc'), 'https://github.com/', storage, NOW);
		expect(storage.data.size).toBe(0);
	});

	test('expires old and malformed entries', () => {
		const storage = memoryStorage();
		captureSignupSource(visit('/?ref=hn'), '', storage, NOW);
		expect(readStoredSignupSource(storage, NOW + SIGNUP_SOURCE_MAX_AGE_MS + 1)).toBeNull();
		storage.setItem(SIGNUP_SOURCE_STORAGE_KEY, '{nope');
		expect(readStoredSignupSource(storage, NOW)).toBeNull();
	});
});

describe('sendStoredSignupSource', () => {
	test('sends once and clears after the server answers', async () => {
		const storage = memoryStorage();
		captureSignupSource(visit('/?utm_source=ccc'), '', storage, NOW);
		const post = vi.fn().mockResolvedValue(undefined);
		await sendStoredSignupSource(post, storage, NOW);
		expect(post).toHaveBeenCalledWith({ utm_source: 'ccc' });
		expect(storage.data.size).toBe(0);
		await sendStoredSignupSource(post, storage, NOW);
		expect(post).toHaveBeenCalledTimes(1);
	});

	test('keeps the source when the request fails', async () => {
		const storage = memoryStorage();
		captureSignupSource(visit('/?utm_source=ccc'), '', storage, NOW);
		await sendStoredSignupSource(vi.fn().mockRejectedValue(new Error('offline')), storage, NOW);
		expect(readStoredSignupSource(storage, NOW)).toEqual({ utm_source: 'ccc' });
	});
});
