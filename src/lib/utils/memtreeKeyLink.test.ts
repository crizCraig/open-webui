import { describe, expect, test } from 'vitest';

import {
	MEMTREE_KEY_HINT_STORAGE_KEY,
	markMemtreeKeyHintDone,
	shouldShowMemtreeKeyHint,
	type HintStorage
} from '$lib/utils/memtreeKeyLink';

function memoryStorage(): HintStorage & { data: Map<string, string> } {
	const data = new Map<string, string>();
	return {
		data,
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => void data.set(key, value)
	};
}

const throwing: HintStorage = {
	getItem: () => {
		throw new Error('blocked');
	},
	setItem: () => {
		throw new Error('blocked');
	}
};

describe('memtree key hint', () => {
	test('shows until marked done, then stays hidden', () => {
		const storage = memoryStorage();
		expect(shouldShowMemtreeKeyHint(storage)).toBe(true);
		markMemtreeKeyHintDone(storage);
		expect(storage.data.get(MEMTREE_KEY_HINT_STORAGE_KEY)).toBe('1');
		expect(shouldShowMemtreeKeyHint(storage)).toBe(false);
	});

	test('blocked or missing storage hides the hint and never throws', () => {
		expect(shouldShowMemtreeKeyHint(throwing)).toBe(false);
		expect(shouldShowMemtreeKeyHint(undefined)).toBe(false);
		expect(() => markMemtreeKeyHintDone(throwing)).not.toThrow();
		expect(() => markMemtreeKeyHintDone(undefined)).not.toThrow();
	});
});
