import { describe, expect, test, vi } from 'vitest';

import {
	PAYMENT_RETURN_MAX_AGE_MS,
	PAYMENT_RETURN_STORAGE_KEY,
	goToPaymentReturn,
	parsePaymentReturnUrl,
	rememberPaymentReturn,
	takePaymentReturn,
	type PaymentReturnStorage
} from '$lib/utils/paymentReturn';

const PROD = 'https://app.polychat.co/payment';
const QUERY = '?user_id=u1&user_email=a%40b.co&price_id=price_123&source=ccc';

function memoryStorage(): PaymentReturnStorage & { data: Map<string, string> } {
	const data = new Map<string, string>();
	return {
		data,
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => void data.set(key, value),
		removeItem: (key) => void data.delete(key)
	};
}

describe('parsePaymentReturnUrl accepts', () => {
	test.each([
		[PROD, PROD],
		[`${PROD}${QUERY}`, `${PROD}${QUERY}`],
		[`${PROD}?`, PROD],
		[
			'https://polychat-staging-421312241218.us-west2.run.app/payment?price_id=p',
			'https://polychat-staging-421312241218.us-west2.run.app/payment?price_id=p'
		],
		[
			'http://local.polychat.co:8000/payment?source=ccc',
			'http://local.polychat.co:8000/payment?source=ccc'
		],
		[`${PROD}?next=https%3A%2F%2Fevil.com`, `${PROD}?next=https%3A%2F%2Fevil.com`]
	])('%s', (raw, expected) => {
		expect(parsePaymentReturnUrl(raw)).toBe(expected);
	});
});

describe('parsePaymentReturnUrl rejects', () => {
	test.each([
		null,
		undefined,
		'',
		42,
		'/payment',
		'/',
		'payment',
		'//app.polychat.co/payment',
		'//evil.com/payment',
		'javascript:alert(1)',
		'javascript://app.polychat.co/payment',
		'data:text/html,<script>alert(1)</script>',
		'http://app.polychat.co/payment',
		'HTTPS://app.polychat.co/payment',
		'https://APP.polychat.co/payment',
		'https://app.polychat.co:443/payment',
		'https://app.polychat.co:8443/payment',
		'https://app.polychat.co./payment',
		'https://polychat.co/payment',
		'https://evil.app.polychat.co/payment',
		'https://app.polychat.co.evil.com/payment',
		'https://app.polychat.co@evil.com/payment',
		'https://user:pass@app.polychat.co/payment',
		'https://evil.com/https://app.polychat.co/payment',
		'https://evil.com?https://app.polychat.co/payment',
		'https://app.polychat.co/payment/',
		'https://app.polychat.co/payment/../admin',
		'https://app.polychat.co/payments',
		'https://app.polychat.co/paymentx',
		'https://app.polychat.co/Payment',
		'https://app.polychat.co/payment;x',
		'https://app.polychat.co/payment%3Fx=1',
		'https://app.polychat.co/payment%2F..%2Fadmin',
		'https://app.polychat.co/%70ayment',
		'https://app.polychat.co/payment#frag',
		'https://app.polychat.co/payment?x=1#frag',
		'https%3A%2F%2Fapp.polychat.co%2Fpayment',
		'https:\\\\app.polychat.co\\payment',
		'https://app.polychat.co\\@evil.com/payment',
		'https://app.polychat.co/payment?x=1\\evil',
		' https://app.polychat.co/payment',
		'https://app.polychat.co/payment ',
		'https://app.polychat.co/payment?x=\r\nSet-Cookie:a=b',
		'https://app.polychat.co/payment?x=\t1',
		'\u0000https://app.polychat.co/payment',
		'https://app.polychat.co/payment?x=\u202e',
		'https://app.polychat.co/payment?x=\u200b',
		'https://app.polychat.co\u3002evil.com/payment',
		'http://local.polychat.co/payment',
		'http://local.polychat.co:5173/payment',
		'http://localhost:8000/payment',
		'https://polychat-staging-421312241218.us-west2.run.app.evil.com/payment',
		`${PROD}?${'a'.repeat(2100)}`
	])('%s', (raw) => {
		expect(parsePaymentReturnUrl(raw)).toBeNull();
	});
});

describe('remember and take', () => {
	test('remembered target survives an OAuth round trip without the query', () => {
		const storage = memoryStorage();
		rememberPaymentReturn(`${PROD}${QUERY}`, storage, 1000);
		expect(takePaymentReturn(null, storage, 2000)).toBe(`${PROD}${QUERY}`);
		expect(storage.data.has(PAYMENT_RETURN_STORAGE_KEY)).toBe(false);
		expect(takePaymentReturn(null, storage, 3000)).toBeNull();
	});

	test('an invalid or missing redirect forgets any earlier target', () => {
		const storage = memoryStorage();
		rememberPaymentReturn(PROD, storage, 0);
		rememberPaymentReturn('https://evil.com/payment', storage, 0);
		expect(storage.data.has(PAYMENT_RETURN_STORAGE_KEY)).toBe(false);
		rememberPaymentReturn(PROD, storage, 0);
		rememberPaymentReturn(null, storage, 0);
		expect(takePaymentReturn(null, storage, 0)).toBeNull();
	});

	test('the query target wins over a remembered one and still clears it', () => {
		const storage = memoryStorage();
		rememberPaymentReturn(`${PROD}?price_id=old`, storage, 0);
		expect(takePaymentReturn(`${PROD}?price_id=new`, storage, 0)).toBe(`${PROD}?price_id=new`);
		expect(storage.data.size).toBe(0);
	});

	test('a stale remembered target is ignored', () => {
		const storage = memoryStorage();
		rememberPaymentReturn(PROD, storage, 0);
		expect(takePaymentReturn(null, storage, PAYMENT_RETURN_MAX_AGE_MS + 1)).toBeNull();
	});

	test('tampered or malformed storage is revalidated and ignored', () => {
		const storage = memoryStorage();
		const tampered = JSON.stringify({ url: 'https://evil.com/payment', savedAt: 0 });
		storage.setItem(PAYMENT_RETURN_STORAGE_KEY, tampered);
		expect(takePaymentReturn(null, storage, 0)).toBeNull();
		storage.setItem(PAYMENT_RETURN_STORAGE_KEY, '{not json');
		expect(takePaymentReturn(null, storage, 0)).toBeNull();
		storage.setItem(PAYMENT_RETURN_STORAGE_KEY, JSON.stringify({ url: PROD, savedAt: 10 }));
		expect(takePaymentReturn(null, storage, 0)).toBeNull(); // from the future
	});

	test('a non-payment redirect never comes back as a payment target', () => {
		const storage = memoryStorage();
		expect(takePaymentReturn('/c/123', storage, 0)).toBeNull();
	});
});

describe('goToPaymentReturn', () => {
	test('syncs the cookie on the target origin, then navigates', async () => {
		const syncCookie = vi.fn(async () => {});
		const navigate = vi.fn();
		await goToPaymentReturn(`${PROD}${QUERY}`, syncCookie, navigate);
		expect(syncCookie).toHaveBeenCalledWith('https://app.polychat.co');
		expect(navigate).toHaveBeenCalledWith(`${PROD}${QUERY}`);
	});

	test('navigates even when the cookie sync fails', async () => {
		const syncCookie = vi.fn(async () => {
			throw new Error('down');
		});
		const navigate = vi.fn();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		await goToPaymentReturn(PROD, syncCookie, navigate);
		expect(navigate).toHaveBeenCalledWith(PROD);
	});

	test('navigates when the cookie sync hangs past the timeout', async () => {
		const navigate = vi.fn();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		await goToPaymentReturn(PROD, () => new Promise<void>(() => {}), navigate, 5);
		expect(navigate).toHaveBeenCalledWith(PROD);
	});

	test('refuses a target outside the allowlist', async () => {
		const syncCookie = vi.fn(async () => {});
		const navigate = vi.fn();
		await goToPaymentReturn('https://evil.com/payment', syncCookie, navigate);
		expect(syncCookie).not.toHaveBeenCalled();
		expect(navigate).not.toHaveBeenCalled();
	});
});
