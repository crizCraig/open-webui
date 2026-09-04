import { describe, expect, test, vi } from 'vitest';

import { navigateAfterCookieSync } from '$lib/utils/paymentNavigation';

function paymentEvent(href: string): { currentTarget: EventTarget | null } {
	return { currentTarget: { href } as unknown as HTMLAnchorElement };
}

describe('navigateAfterCookieSync', () => {
	test('waits for sync and navigates using the href captured before currentTarget resets', async () => {
		const event = paymentEvent('https://polychat.test/payment?price_id=starter');
		let resolveSync: (() => void) | undefined;
		const syncCookie = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolveSync = resolve;
					event.currentTarget = null;
				})
		);
		const navigate = vi.fn();

		const navigation = navigateAfterCookieSync(event, syncCookie, navigate);
		await Promise.resolve();
		expect(navigate).not.toHaveBeenCalled();

		resolveSync?.();
		await navigation;

		expect(syncCookie).toHaveBeenCalledOnce();
		expect(navigate).toHaveBeenCalledWith('https://polychat.test/payment?price_id=starter');
	});

	test('does not navigate when cookie synchronization fails', async () => {
		const event = paymentEvent('https://polychat.test/payment?price_id=starter');
		const syncCookie = vi.fn(async () => {
			event.currentTarget = null;
			throw new Error('sync failed');
		});
		const navigate = vi.fn();

		await expect(navigateAfterCookieSync(event, syncCookie, navigate)).rejects.toThrow('sync failed');
		expect(navigate).not.toHaveBeenCalled();
	});
});
