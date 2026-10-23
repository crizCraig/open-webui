/**
 * Event names from the MemTree key page, keyed to the signed-in user, (/memtree-api) for the ccc install
 * funnel: polychat's POST /v1/memtree/key-page-event (polychat docs/install_funnel.md).
 *
 * Only an event name is sent, with the signed-in session (internal analytics only): never
 * the key, a URL or any text from the page. No third-party trackers. Sends are
 * fire-and-forget: a failure is dropped and never reaches the page.
 */

export const KEY_PAGE_EVENT_PATH = '/v1/memtree/key-page-event';
export const KEY_PAGE_EVENT_TIMEOUT_MS = 5_000;

export const KEY_PAGE_EVENTS = [
	'page_view',
	'key_created',
	'key_shown',
	'copy_key',
	'copy_install',
	'copy_ccc',
	'link_readme'
] as const;

export type KeyPageEvent = (typeof KEY_PAGE_EVENTS)[number];

export interface KeyPageEventOptions {
	appUrl: string;
	token?: string | null;
	fetchImpl?: typeof fetch;
}

/** Send one event; resolves true when the server accepted it, never rejects. */
export async function sendKeyPageEvent(
	event: KeyPageEvent,
	opts: KeyPageEventOptions
): Promise<boolean> {
	if (!KEY_PAGE_EVENTS.includes(event)) return false;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), KEY_PAGE_EVENT_TIMEOUT_MS);
	try {
		const doFetch = opts.fetchImpl ?? fetch;
		const response = await doFetch(`${opts.appUrl.replace(/\/$/, '')}${KEY_PAGE_EVENT_PATH}`, {
			method: 'POST',
			mode: 'cors',
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json',
				...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {})
			},
			body: JSON.stringify({ event }),
			signal: controller.signal
		});
		return response.ok;
	} catch {
		return false;
	} finally {
		clearTimeout(timer);
	}
}

/**
 * A tracker: each event is its own request (the funnel counts sets, so order does not
 * matter, and one stalled request never holds back the others); `once` events (the page
 * view) are sent at most once.
 */
export function keyPageTracker(opts: KeyPageEventOptions, once: KeyPageEvent[] = ['page_view']) {
	const sent = new Set<KeyPageEvent>();
	return (event: KeyPageEvent): Promise<boolean> => {
		if (once.includes(event)) {
			if (sent.has(event)) return Promise.resolve(false);
			sent.add(event);
		}
		return sendKeyPageEvent(event, opts);
	};
}
