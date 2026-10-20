/**
 * Polychat payment sign-in: which account to use, and the one-click account switch.
 *
 * ccc's subscribe link (`app.polychat.co/payment?user_id=&user_email=&source=ccc`) is for the
 * account that owns the user's MemTree key. Two things go wrong when the browser is signed in
 * as someone else (or not at all), and this module holds the logic for both:
 *
 * - Sign-in names the account: `paymentAccountHint` masks the link's `user_email`, and
 *   `oauthLoginParams` passes it to Google as `login_hint` so the right account is picked.
 * - Polychat's wrong-account page posts to `/payment/switch-account`, which clears its cookies
 *   and sends the browser here as `/auth?redirect=<payment URL>&switch_account=1`.
 *   `switchAccountDecision` signs the current account out only when that request came from the
 *   payment host itself (document.referrer), so another site can't sign people out by linking
 *   here; any other referrer gets a confirm button instead.
 *
 * Every target goes through `parsePaymentReturnUrl` (allowlisted origin + `/payment` only).
 */

import { PAYMENT_RETURN_ORIGINS, parsePaymentReturnUrl } from '$lib/utils/paymentReturn';

export const SWITCH_ACCOUNT_PARAM = 'switch_account';
export const CCC_SOURCE = 'ccc';
export const MAX_EMAIL_LENGTH = 254;
const MASK = '•••'; // •••
const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Invisible/bidi format characters: the address is shown on the page.
const FORMAT_CHARS =
	/[\u00ad\u061c\u180e\u200b-\u200f\u2028-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/;

export type SwitchDecision = 'none' | 'sign_out' | 'confirm';

export interface SwitchRequest {
	switchParam: string | null;
	redirect: string | null;
	signedIn: boolean;
	referrer: string;
}

/**
 * What to do on an /auth visit: `sign_out` (switch requested from the payment host),
 * `confirm` (switch requested from anywhere else: ask first), or `none`.
 */
export function switchAccountDecision(
	request: SwitchRequest,
	origins: readonly string[] = PAYMENT_RETURN_ORIGINS
): SwitchDecision {
	if (request.switchParam !== '1' || !request.signedIn) {
		return 'none';
	}
	if (!parsePaymentReturnUrl(request.redirect, origins)) {
		return 'none';
	}
	return isPaymentReferrer(request.referrer, origins) ? 'sign_out' : 'confirm';
}

/** The /auth URL to reload after signing out: same payment return, no switch flag. */
export function signInAgainPath(target: string): string {
	return `/auth?redirect=${encodeURIComponent(target)}`;
}

/** The link's `user_email`, if `redirect` is a valid payment URL carrying a plausible one. */
export function paymentLinkEmail(
	redirect: string | null,
	origins: readonly string[] = PAYMENT_RETURN_ORIGINS
): string | null {
	const target = parsePaymentReturnUrl(redirect, origins);
	if (!target) {
		return null;
	}
	const email = new URL(target).searchParams.get('user_email')?.trim() ?? '';
	const plausible = SIMPLE_EMAIL.test(email) && !FORMAT_CHARS.test(email);
	return email.length <= MAX_EMAIL_LENGTH && plausible ? email : null;
}

/** Whether the payment link came from ccc (the copy then names "the MemTree key in ccc"). */
export function paymentLinkFromCcc(
	redirect: string | null,
	origins: readonly string[] = PAYMENT_RETURN_ORIGINS
): boolean {
	const target = parsePaymentReturnUrl(redirect, origins);
	return target ? new URL(target).searchParams.get('source') === CCC_SOURCE : false;
}

/** The masked account to sign in with for this payment link, or null. */
export function paymentAccountHint(
	redirect: string | null,
	origins: readonly string[] = PAYMENT_RETURN_ORIGINS
): string | null {
	return maskEmail(paymentLinkEmail(redirect, origins));
}

/** `?login_hint=` (plus select_account, added server side) for the OAuth login URL when the payment link names an account, else ''. */
export function oauthLoginParams(
	redirect: string | null,
	origins: readonly string[] = PAYMENT_RETURN_ORIGINS
): string {
	const email = paymentLinkEmail(redirect, origins);
	return email ? `?${new URLSearchParams({ login_hint: email })}` : '';
}

/** Enough of an address to recognise it, e.g. `cr•••r@gmail.com` (same as polychat's). */
export function maskEmail(email: string | null): string | null {
	if (!email || email.split('@').length !== 2) {
		return null;
	}
	const [local, domain] = email.trim().split('@');
	if (!local || !domain) {
		return null;
	}
	if (local.length <= 2) {
		return `${local[0]}${MASK}@${domain}`;
	}
	if (local.length <= 4) {
		return `${local[0]}${MASK}${local[local.length - 1]}@${domain}`;
	}
	return `${local.slice(0, 2)}${MASK}${local[local.length - 1]}@${domain}`;
}

function isPaymentReferrer(referrer: string, origins: readonly string[]): boolean {
	try {
		return origins.includes(new URL(referrer).origin);
	} catch {
		return false;
	}
}
