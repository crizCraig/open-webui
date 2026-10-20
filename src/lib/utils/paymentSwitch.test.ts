import { describe, expect, test } from 'vitest';

import {
	DEV_PAYMENT_RETURN_ORIGIN,
	PRODUCTION_PAYMENT_RETURN_ORIGINS
} from '$lib/utils/paymentReturn';
import {
	maskEmail,
	oauthLoginParams,
	paymentAccountHint,
	paymentLinkEmail,
	paymentLinkFromCcc,
	signInAgainPath,
	switchAccountDecision
} from '$lib/utils/paymentSwitch';

const PROD = PRODUCTION_PAYMENT_RETURN_ORIGINS;
const LINK =
	'https://app.polychat.co/payment?user_id=u1&user_email=craig.quiter%40gmail.com' +
	'&price_id=price_1&source=ccc';
const STAGING = 'https://polychat-staging-421312241218.us-west2.run.app/payment?user_id=u1';
const FROM_PAYMENT = 'https://app.polychat.co/';

const request = (overrides: Partial<Parameters<typeof switchAccountDecision>[0]> = {}) => ({
	switchParam: '1',
	redirect: LINK,
	signedIn: true,
	referrer: FROM_PAYMENT,
	...overrides
});

describe('switchAccountDecision', () => {
	test('signs out when the switch came from the payment host', () => {
		expect(switchAccountDecision(request(), PROD)).toBe('sign_out');
		expect(switchAccountDecision(request({ referrer: `${LINK}#x` }), PROD)).toBe('sign_out');
	});

	test('asks first when the switch came from anywhere else (sign-out CSRF)', () => {
		for (const referrer of ['', 'https://evil.example/', 'https://polychat.co/', 'not a url']) {
			expect(switchAccountDecision(request({ referrer }), PROD)).toBe('confirm');
		}
		expect(
			switchAccountDecision(request({ referrer: 'https://app.polychat.co.evil.example/' }), PROD)
		).toBe('confirm');
	});

	test('does nothing without the flag, a session, or a valid payment target', () => {
		expect(switchAccountDecision(request({ switchParam: null }), PROD)).toBe('none');
		expect(switchAccountDecision(request({ switchParam: 'true' }), PROD)).toBe('none');
		expect(switchAccountDecision(request({ signedIn: false }), PROD)).toBe('none');
		for (const redirect of [null, '/', 'https://evil.example/payment', STAGING, `${LINK}#h`]) {
			expect(switchAccountDecision(request({ redirect }), PROD)).toBe('none');
		}
	});

	test('the local dev API counts only alongside the dev origin', () => {
		const local = 'http://local.polychat.co:8000/payment?user_id=u1';
		const devOrigins = [...PROD, DEV_PAYMENT_RETURN_ORIGIN];
		const fromLocal = { redirect: local, referrer: 'http://local.polychat.co:8000/' };
		expect(switchAccountDecision(request(fromLocal), devOrigins)).toBe('sign_out');
		expect(switchAccountDecision(request(fromLocal), PROD)).toBe('none');
	});
});

describe('payment link account', () => {
	test('reads user_email only from a valid payment URL', () => {
		expect(paymentLinkEmail(LINK, PROD)).toBe('craig.quiter@gmail.com');
		expect(paymentLinkEmail(STAGING.replace('user_id=u1', 'user_email=a%40b.co'), PROD)).toBe(
			null
		);
		expect(paymentLinkEmail('https://evil.example/payment?user_email=a%40b.co', PROD)).toBe(
			null
		);
		expect(paymentLinkEmail('https://app.polychat.co/payment?user_id=u1', PROD)).toBeNull();
		expect(paymentLinkEmail(null, PROD)).toBeNull();
	});

	test('rejects implausible emails', () => {
		for (const email of ['nope', 'a@b', 'a b@c.d', `${'a'.repeat(250)}@b.co`]) {
			const link = `https://app.polychat.co/payment?user_email=${encodeURIComponent(email)}`;
			expect(paymentLinkEmail(link, PROD)).toBeNull();
		}
	});

	test('masks the hint the same way polychat does', () => {
		expect(paymentAccountHint(LINK, PROD)).toBe('cr•••r@gmail.com');
		expect(maskEmail('craig.q.test@gmail.com')).toBe('cr•••t@gmail.com');
		expect(maskEmail('abcd@x.io')).toBe('a•••d@x.io');
		expect(maskEmail('ab@x.io')).toBe('a•••@x.io');
		expect(maskEmail('a@x.io')).toBe('a•••@x.io');
		for (const bad of [null, '', 'nope', 'a@b@c', '@x.io', 'a@']) {
			expect(maskEmail(bad)).toBeNull();
		}
	});

	test('knows a ccc link', () => {
		expect(paymentLinkFromCcc(LINK, PROD)).toBe(true);
		expect(paymentLinkFromCcc('https://app.polychat.co/payment?source=web', PROD)).toBe(false);
		expect(paymentLinkFromCcc('https://evil.example/payment?source=ccc', PROD)).toBe(false);
	});

	test('passes the account to Google as login_hint', () => {
		expect(oauthLoginParams(LINK, PROD)).toBe('?login_hint=craig.quiter%40gmail.com');
		expect(oauthLoginParams('https://app.polychat.co/payment', PROD)).toBe('');
		expect(oauthLoginParams(null, PROD)).toBe('');
	});
});

test('signInAgainPath keeps the payment return and drops the switch flag', () => {
	const path = signInAgainPath(LINK);
	expect(path.startsWith('/auth?redirect=')).toBe(true);
	const params = new URLSearchParams(path.slice('/auth'.length));
	expect(params.get('redirect')).toBe(LINK);
	expect(params.has('switch_account')).toBe(false);
});
