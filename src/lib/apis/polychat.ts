import { getPolychatAppUrl } from '$lib/constants';

let cookieSyncToken: string | undefined;
let cookieSyncPromise: Promise<void> | undefined;

export function syncPolychatCookie(token: string | undefined): Promise<void> {
	if (!token) {
		return Promise.reject(new Error('Cannot sync a Polychat cookie without a session token.'));
	}

	if (cookieSyncToken === token && cookieSyncPromise) {
		return cookieSyncPromise;
	}

	const syncPromise = fetch(`${getPolychatAppUrl()}/set-cookie`, {
		method: 'POST',
		mode: 'cors',
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ token })
	}).then((response) => {
		if (!response.ok) {
			throw new Error(`Failed to set Polychat cookie: ${response.status} ${response.statusText}`);
		}
	});

	const sharedPromise = syncPromise.finally(() => {
		if (cookieSyncPromise === sharedPromise) {
			cookieSyncToken = undefined;
			cookieSyncPromise = undefined;
		}
	});

	cookieSyncToken = token;
	cookieSyncPromise = sharedPromise;

	return sharedPromise;
}
