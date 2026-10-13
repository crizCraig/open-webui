import { getPolychatAppUrl } from '$lib/constants';

let cookieSyncKey: string | undefined;
let cookieSyncPromise: Promise<void> | undefined;

export function syncPolychatCookie(
	token: string | undefined,
	appUrl: string = getPolychatAppUrl()
): Promise<void> {
	if (!token) {
		return Promise.reject(new Error('Cannot sync a Polychat cookie without a session token.'));
	}

	const syncKey = `${appUrl} ${token}`;
	if (cookieSyncKey === syncKey && cookieSyncPromise) {
		return cookieSyncPromise;
	}

	const syncPromise = fetch(`${appUrl}/set-cookie`, {
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
			cookieSyncKey = undefined;
			cookieSyncPromise = undefined;
		}
	});

	cookieSyncKey = syncKey;
	cookieSyncPromise = sharedPromise;

	return sharedPromise;
}
