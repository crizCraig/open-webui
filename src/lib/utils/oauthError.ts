/**
 * Polychat: the sign-in page's message for `/auth?error=<code>`, where the backend sends a
 * Google sign-in that couldn't complete (backend/open_webui/utils/oauth_callback.py) instead
 * of an error page. Unknown codes show nothing, so the parameter can't inject text.
 */

export const OAUTH_ERROR_PARAM = 'error';

export const OAUTH_ERROR_MESSAGES: Readonly<Record<string, string>> = {
	oauth_expired: 'Sign-in expired, please try again.',
	oauth_cancelled: 'Sign-in was cancelled. Please try again.',
	email_taken:
		'That Google account’s email is already registered with a different sign-in. ' +
		'Try another Google account, or contact support.'
};

/** The message for this page's `error` code, or null. */
export function oauthErrorMessage(search: string): string | null {
	const code = new URLSearchParams(search).get(OAUTH_ERROR_PARAM);
	return code && Object.prototype.hasOwnProperty.call(OAUTH_ERROR_MESSAGES, code)
		? OAUTH_ERROR_MESSAGES[code]
		: null;
}

/**
 * `href` without its `error` parameter (so a reload doesn't repeat the message), with
 * `redirect` set to `restoredRedirect` when given (so a reload keeps a restored payment link).
 */
export function withoutOAuthError(href: string, restoredRedirect: string | null = null): string {
	const url = new URL(href);
	url.searchParams.delete(OAUTH_ERROR_PARAM);
	if (restoredRedirect && !url.searchParams.has('redirect')) {
		url.searchParams.set('redirect', restoredRedirect);
	}
	return url.pathname + url.search + url.hash;
}
