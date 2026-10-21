import { describe, expect, test } from 'vitest';

import { OAUTH_ERROR_MESSAGES, oauthErrorMessage, withoutOAuthError } from '$lib/utils/oauthError';

describe('oauthErrorMessage', () => {
	test('known codes from the OAuth callback have a message', () => {
		expect(oauthErrorMessage('?error=oauth_expired')).toBe('Sign-in expired, please try again.');
		expect(oauthErrorMessage('?error=oauth_cancelled')).toBe(OAUTH_ERROR_MESSAGES.oauth_cancelled);
		expect(oauthErrorMessage('?a=1&error=email_taken')).toBe(OAUTH_ERROR_MESSAGES.email_taken);
	});

	test('anything else shows nothing', () => {
		for (const search of [
			'',
			'?error=',
			'?error=<b>hi</b>',
			'?error=toString',
			'?error=__proto__'
		]) {
			expect(oauthErrorMessage(search)).toBeNull();
		}
	});
});

describe('withoutOAuthError', () => {
	test('drops only the error parameter', () => {
		expect(withoutOAuthError('https://polychat.co/auth?error=oauth_expired')).toBe('/auth');
		expect(withoutOAuthError('https://polychat.co/auth?redirect=x&error=a#h')).toBe(
			'/auth?redirect=x#h'
		);
	});
});
