/**
 * Return-to-payment after sign-in.
 *
 * Polychat's checkout page lives on the API host (app.polychat.co/payment), not on this
 * origin, so `/auth?redirect=` (SvelteKit `goto`, same-origin only) cannot send a user back
 * there. This module accepts exactly one kind of cross-origin target: an allowlisted
 * polychat origin + `/payment` + an optional query string. Everything else is rejected, so
 * this is not an open redirect.
 *
 * Google (and other OAuth) sign-in leaves this page and comes back to `/auth#token=...`
 * without the query string, so the validated target is kept in sessionStorage for the
 * round trip, the same way `memtree_oauth` is.
 */

export const PAYMENT_RETURN_ORIGINS: readonly string[] = [
	'https://app.polychat.co',
	'https://polychat-staging-421312241218.us-west2.run.app',
	'http://local.polychat.co:8000'
];

export const PAYMENT_RETURN_PATH = '/payment';
export const PAYMENT_RETURN_STORAGE_KEY = 'payment_return';
export const PAYMENT_RETURN_MAX_AGE_MS = 30 * 60 * 1000;
export const PAYMENT_RETURN_MAX_LENGTH = 2048;
export const PAYMENT_COOKIE_SYNC_TIMEOUT_MS = 4000;

// Control characters, space, DEL, backslash, fragment marker, and bidi/invisible format chars.
const FORBIDDEN_CHARS =
	// eslint-disable-next-line no-control-regex
	/[\u0000-\u0020\u007f\\#\u00a0\u200b-\u200f\u2028-\u202e\u2060-\u2064\ufeff]/;

export interface PaymentReturnStorage {
	getItem: (key: string) => string | null;
	setItem: (key: string, value: string) => void;
	removeItem: (key: string) => void;
}

interface StoredPaymentReturn {
	url: string;
	savedAt: number;
}

/**
 * The normalized payment URL if `raw` is exactly an allowlisted origin + `/payment`
 * (optionally followed by `?query`), else null.
 */
export function parsePaymentReturnUrl(raw: unknown): string | null {
	if (typeof raw !== 'string' || raw.length > PAYMENT_RETURN_MAX_LENGTH) {
		return null;
	}
	if (FORBIDDEN_CHARS.test(raw)) {
		return null;
	}
	const origin = PAYMENT_RETURN_ORIGINS.find((allowed) => hasPaymentPrefix(raw, allowed));
	if (!origin) {
		return null;
	}
	return normalizedIfSame(raw, origin);
}

/**
 * Remember (or forget) the payment target named by this visit's `redirect` query value,
 * so it survives an OAuth round trip that drops the query string.
 */
export function rememberPaymentReturn(
	redirect: string | null,
	storage: PaymentReturnStorage,
	now: number = Date.now()
): void {
	const url = parsePaymentReturnUrl(redirect);
	if (!url) {
		storage.removeItem(PAYMENT_RETURN_STORAGE_KEY);
		return;
	}
	const stored: StoredPaymentReturn = { url, savedAt: now };
	storage.setItem(PAYMENT_RETURN_STORAGE_KEY, JSON.stringify(stored));
}

/**
 * The payment target to go to after sign-in: this visit's `redirect` query value if valid,
 * else a fresh one remembered before an OAuth round trip. Always clears the remembered one.
 */
export function takePaymentReturn(
	redirect: string | null,
	storage: PaymentReturnStorage,
	now: number = Date.now()
): string | null {
	const stored = storage.getItem(PAYMENT_RETURN_STORAGE_KEY);
	storage.removeItem(PAYMENT_RETURN_STORAGE_KEY);
	return parsePaymentReturnUrl(redirect) ?? parseStored(stored, now);
}

/**
 * Sync the polychat session cookie on the target's origin (bounded wait), then leave this
 * app with a full-page navigation. A failed or slow sync still navigates: polychat shows a
 * sign-in page rather than charging anyone.
 */
export async function goToPaymentReturn(
	url: string,
	syncCookie: (origin: string) => Promise<void>,
	navigate: (url: string) => void,
	timeoutMs: number = PAYMENT_COOKIE_SYNC_TIMEOUT_MS
): Promise<void> {
	const target = parsePaymentReturnUrl(url);
	if (!target) {
		return;
	}
	try {
		await withTimeout(syncCookie(new URL(target).origin), timeoutMs);
	} catch (error) {
		console.error('Polychat cookie sync before payment failed:', error);
	}
	navigate(target);
}

function hasPaymentPrefix(raw: string, origin: string): boolean {
	const base = `${origin}${PAYMENT_RETURN_PATH}`;
	return raw === base || raw.startsWith(`${base}?`);
}

function normalizedIfSame(raw: string, origin: string): string | null {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return null;
	}
	const clean =
		url.origin === origin &&
		url.pathname === PAYMENT_RETURN_PATH &&
		url.username === '' &&
		url.password === '' &&
		url.hash === '';
	return clean ? `${url.origin}${url.pathname}${url.search}` : null;
}

function parseStored(stored: string | null, now: number): string | null {
	if (!stored) {
		return null;
	}
	try {
		const value = JSON.parse(stored) as Partial<StoredPaymentReturn>;
		const age = now - Number(value.savedAt);
		if (!(age >= 0 && age <= PAYMENT_RETURN_MAX_AGE_MS)) {
			return null;
		}
		return parsePaymentReturnUrl(value.url);
	} catch {
		return null;
	}
}

function withTimeout(promise: Promise<void>, timeoutMs: number): Promise<void> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<void>((_, reject) => {
		timer = setTimeout(() => reject(new Error('cookie sync timed out')), timeoutMs);
	});
	return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
