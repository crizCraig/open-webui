/**
 * Where a signup came from: utm_source / utm_medium / utm_campaign / ref from the landing
 * URL, and the referring site's host name.
 *
 * Captured on the first page of a visit (the root layout and /auth, before any redirect
 * drops the query string) into localStorage, which survives the Google OAuth round trip,
 * then sent once right after sign-in. The server records it only for a new account and
 * only once (backend/open_webui/utils/signup_source.py), so sign-ins of existing users
 * change nothing.
 *
 * Privacy: only those four keys, each a short plain value, and the referrer as a bare host
 * name. Never the full referrer URL, its path or its query string.
 */

export const SIGNUP_SOURCE_STORAGE_KEY = 'signup_source';
export const SIGNUP_SOURCE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const SIGNUP_SOURCE_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'ref'] as const;
export const OWN_SITE_DOMAIN = 'polychat.co';
const MAX_VALUE_LENGTH = 64;
const VALUE_PATTERN = /^[A-Za-z0-9._~+\- ]+$/;

export type SignupSource = Partial<Record<(typeof SIGNUP_SOURCE_PARAMS)[number] | 'referrer', string>>;

export interface SignupSourceStorage {
	getItem: (key: string) => string | null;
	setItem: (key: string, value: string) => void;
	removeItem: (key: string) => void;
}

interface StoredSignupSource {
	source: SignupSource;
	savedAt: number;
}

/**
 * Remember this visit's source. Explicit campaign keys replace an earlier entry; a bare
 * referrer only fills an empty slot, so moving between sites doesn't erase a campaign.
 */
export function captureSignupSource(
	url: URL,
	referrer: string,
	storage: SignupSourceStorage,
	now: number = Date.now()
): void {
	// OAuth comes back to /auth#token=..., referred by the sign-in provider.
	if (new URLSearchParams(url.hash.substring(1)).has('token')) return;
	const source = signupSourceFromVisit(url, referrer);
	if (!source) return;
	const hasCampaign = SIGNUP_SOURCE_PARAMS.some((key) => source[key]);
	if (!hasCampaign && readStoredSignupSource(storage, now)) return;
	const stored: StoredSignupSource = { source, savedAt: now };
	storage.setItem(SIGNUP_SOURCE_STORAGE_KEY, JSON.stringify(stored));
}

/** Send the remembered source after sign-in; forget it once the server has answered. */
export async function sendStoredSignupSource(
	post: (source: SignupSource) => Promise<unknown>,
	storage: SignupSourceStorage,
	now: number = Date.now()
): Promise<void> {
	const source = readStoredSignupSource(storage, now);
	if (!source) return;
	try {
		await post(source);
		storage.removeItem(SIGNUP_SOURCE_STORAGE_KEY);
	} catch (error) {
		console.error('Signup source not recorded:', error);
	}
}

/** The allowed, well-formed source fields of a visit, or null when there are none. */
export function signupSourceFromVisit(url: URL, referrer: string): SignupSource | null {
	const source: SignupSource = {};
	for (const key of SIGNUP_SOURCE_PARAMS) {
		const value = cleanValue(url.searchParams.get(key));
		if (value) source[key] = value;
	}
	const host = referrerHost(referrer, url.hostname);
	if (host) source.referrer = host;
	return Object.keys(source).length ? source : null;
}

export function readStoredSignupSource(
	storage: SignupSourceStorage,
	now: number = Date.now()
): SignupSource | null {
	try {
		const stored = JSON.parse(storage.getItem(SIGNUP_SOURCE_STORAGE_KEY) ?? 'null');
		if (!stored?.source || typeof stored.savedAt !== 'number') return null;
		return now - stored.savedAt <= SIGNUP_SOURCE_MAX_AGE_MS ? stored.source : null;
	} catch {
		return null;
	}
}

function cleanValue(value: string | null): string | null {
	const trimmed = value?.trim();
	if (!trimmed || trimmed.length > MAX_VALUE_LENGTH || !VALUE_PATTERN.test(trimmed)) return null;
	return trimmed;
}

// The referring site's host, unless it is this site (any polychat.co host included).
function referrerHost(referrer: string, ownHost: string): string | null {
	let host: string;
	try {
		host = new URL(referrer).hostname.toLowerCase();
	} catch {
		return null;
	}
	const ownSite = host === OWN_SITE_DOMAIN || host.endsWith(`.${OWN_SITE_DOMAIN}`);
	return host && host !== ownHost && !ownSite ? host : null;
}
