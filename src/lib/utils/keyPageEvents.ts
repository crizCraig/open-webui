/**
 * Anonymous-count events from the MemTree key page (/memtree-api) for the ccc install
 * funnel: polychat's POST /v1/memtree/key-page-event (polychat docs/install_funnel.md).
 *
 * Only an event name is sent, with the signed-in session (internal analytics only): never
 * the key, a URL or any text from the page. No third-party trackers. Sends are
 * fire-and-forget: a failure is dropped and never reaches the page.
 */

export const KEY_PAGE_EVENT_PATH = '/v1/memtree/key-page-event';

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
			body: JSON.stringify({ event })
		});
		return response.ok;
	} catch {
		return false;
	}
}

/**
 * A tracker that sends events one after another (so the page view lands before the clicks
 * that follow it) and at most once per event name for `once` events.
 */
export function keyPageTracker(opts: KeyPageEventOptions, once: KeyPageEvent[] = ['page_view']) {
	let chain: Promise<unknown> = Promise.resolve();
	const sent = new Set<KeyPageEvent>();
	return (event: KeyPageEvent): Promise<unknown> => {
		if (once.includes(event)) {
			if (sent.has(event)) return chain;
			sent.add(event);
		}
		chain = chain.then(() => sendKeyPageEvent(event, opts));
		return chain;
	};
}
