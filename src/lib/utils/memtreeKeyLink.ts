/**
 * Where a signed-in user finds their MemTree key (the key page that polychat.co/auth?memtree=true
 * lands on), and the dismissible hint for it on the new-chat screen. Without these, someone who
 * signed up without ?memtree=true had no way to reach the key page.
 */

export const MEMTREE_KEY_PATH = '/memtree-api';

/** Set once the hint is dismissed or the key page has been opened. */
export const MEMTREE_KEY_HINT_STORAGE_KEY = 'memtree-key-hint-done';

export type HintStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Whether to show the "Get your MemTree key" hint. Storage errors (blocked) hide it. */
export function shouldShowMemtreeKeyHint(storage: HintStorage | undefined): boolean {
	try {
		return !!storage && storage.getItem(MEMTREE_KEY_HINT_STORAGE_KEY) === null;
	} catch {
		return false;
	}
}

/** Hide the hint for good: after a dismiss, or once the user has reached the key page. */
export function markMemtreeKeyHintDone(storage: HintStorage | undefined): void {
	try {
		storage?.setItem(MEMTREE_KEY_HINT_STORAGE_KEY, '1');
	} catch {
		// Storage blocked: the hint just shows again next time.
	}
}
