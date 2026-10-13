/**
 * Return-to-payment after sign-in.
 *
 * Polychat's checkout page lives on the API host (app.polychat.co/payment), not on this
 * origin, so `/auth?redirect=` (SvelteKit `goto`, same-origin only) cannot send a user back
 * there. This module accepts exactly one kind of cross-origin target: an allowlisted
 * polychat origin + `/payment` + an optional query string. Everything else is rejected, so
 * this is not an open redirect.
 *
 * Only origins in the same site as this app are allowed: the return first syncs the polychat
 * session cookie with a credentialed fetch, and browsers refuse cookies from cross-site
 * responses (so the staging run.app host can't work and is not listed; its payment page
 * keeps a manual "Continue to payment" fallback). The local dev API host is added only in
 * dev builds.
 *
 * Google (and other OAuth) sign-in leaves this page and comes back to `/auth#token=...`
 * without the query string, so the validated target is kept in sessionStorage for the
 * round trip, the same way `memtree_oauth` is. It is written only when an OAuth sign-in is
 * started from a payment-return visit, cleared by every other /auth visit, and read only on
 * the OAuth return, so it can never override a later visit's own redirect.
 */

import { dev } from '$app/environment';

export const PRODUCTION_PAYMENT_RETURN_ORIGINS: readonly string[] = ['https://app.polychat.co'];
export const DEV_PAYMENT_RETURN_ORIGIN = 'http://local.polychat.co:8000';
export const PAYMENT_RETURN_ORIGINS: readonly string[] = dev
	? [...PRODUCTION_PAYMENT_RETURN_ORIGINS, DEV_PAYMENT_RETURN_ORIGIN]
	: PRODUCTION_PAYMENT_RETURN_ORIGINS;

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
export function parsePaymentReturnUrl(
	raw: unknown,
	origins: readonly string[] = PAYMENT_RETURN_ORIGINS
): string | null {
	if (typeof raw !== 'string' || raw.length > PAYMENT_RETURN_MAX_LENGTH) {
		return null;
	}
	if (FORBIDDEN_CHARS.test(raw)) {
		return null;
	}
	const origin = origins.find((allowed) => hasPaymentPrefix(raw, allowed));
	if (!origin) {
		return null;
	}
	return normalizedIfSame(raw, origin);
}

/**
 * Call on every /auth page load, before any navigation. Anything but the OAuth return
 * (`/auth#token=`) forgets a remembered target, so an abandoned payment sign-in can't
 * redirect a later, unrelated visit.
 */
export function beginAuthVisit(isOAuthReturn: boolean, storage: PaymentReturnStorage): void {
	if (!isOAuthReturn) {
		forgetPaymentReturn(storage);
	}
}

/**
 * Call when starting an OAuth sign-in: remember this visit's `redirect` if it is a payment
 * target (it survives the round trip that drops the query string), else forget.
 */
export function rememberPaymentReturn(
	redirect: string | null,
	storage: PaymentReturnStorage,
	now: number = Date.now()
): void {
	const url = parsePaymentReturnUrl(redirect);
	if (!url) {
		forgetPaymentReturn(storage);
		return;
	}
	const stored: StoredPaymentReturn = { url, savedAt: now };
	storage.setItem(PAYMENT_RETURN_STORAGE_KEY, JSON.stringify(stored));
}

/**
 * The payment target to go to once signed in, or null for the normal redirect. On the OAuth
 * return it is the target remembered when that sign-in started; otherwise (password sign-in,
 * already signed in) only this visit's own `redirect` counts. Always clears the remembered one.
 */
export function paymentReturnAfterSignIn(
	redirect: string | null,
	viaOAuth: boolean,
	storage: PaymentReturnStorage,
	now: number = Date.now()
): string | null {
	const stored = storage.getItem(PAYMENT_RETURN_STORAGE_KEY);
	forgetPaymentReturn(storage);
	return viaOAuth ? parseStored(stored, now) : parsePaymentReturnUrl(redirect);
}

export function forgetPaymentReturn(storage: PaymentReturnStorage): void {
	storage.removeItem(PAYMENT_RETURN_STORAGE_KEY);
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
