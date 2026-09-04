import { describe, expect, test, vi } from 'vitest';

import { navigateAfterCookieSync, type PaymentWindow } from '$lib/utils/paymentNavigation';

function paymentEvent(
	href: string,
	modifiers: Partial<Pick<MouseEvent, 'ctrlKey' | 'metaKey' | 'shiftKey'>> = {}
): {
	currentTarget: EventTarget | null;
	ctrlKey?: boolean;
	metaKey?: boolean;
	shiftKey?: boolean;
} {
	return { currentTarget: { href } as unknown as HTMLAnchorElement, ...modifiers };
}

function paymentWindow(): PaymentWindow {
	return {
		location: { replace: vi.fn() },
		opener: {},
		close: vi.fn()
	};
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

	test('opens a new context before waiting for modified-click cookie sync', async () => {
		const event = paymentEvent('https://polychat.test/payment?price_id=starter', {
			ctrlKey: true
		});
		let resolveSync: (() => void) | undefined;
		const syncCookie = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolveSync = resolve;
					event.currentTarget = null;
				})
		);
		const navigate = vi.fn();
		const openedWindow = paymentWindow();
		const openWindow = vi.fn(() => openedWindow);

		const navigation = navigateAfterCookieSync(event, syncCookie, navigate, openWindow);
		expect(openWindow).toHaveBeenCalledOnce();
		expect(openedWindow.opener).toBeNull();
		expect(syncCookie).toHaveBeenCalledOnce();
		expect(openedWindow.location.replace).not.toHaveBeenCalled();

		resolveSync?.();
		await navigation;

		expect(openedWindow.location.replace).toHaveBeenCalledWith(
			'https://polychat.test/payment?price_id=starter'
		);
		expect(navigate).not.toHaveBeenCalled();
	});

	test('closes a modified-click context when cookie synchronization fails', async () => {
		const event = paymentEvent('https://polychat.test/payment?price_id=starter', {
			metaKey: true
		});
		const syncCookie = vi.fn(async () => {
			event.currentTarget = null;
			throw new Error('sync failed');
		});
		const navigate = vi.fn();
		const openedWindow = paymentWindow();

		await expect(
			navigateAfterCookieSync(event, syncCookie, navigate, () => openedWindow)
		).rejects.toThrow('sync failed');

		expect(openedWindow.close).toHaveBeenCalledOnce();
		expect(openedWindow.location.replace).not.toHaveBeenCalled();
		expect(navigate).not.toHaveBeenCalled();
	});

	test('does not navigate the current page when a modified-click popup is blocked', async () => {
		const event = paymentEvent('https://polychat.test/payment?price_id=starter', {
			shiftKey: true
		});
		const syncCookie = vi.fn(async () => {});
		const navigate = vi.fn();
		const openWindow = vi.fn(() => null);

		await navigateAfterCookieSync(event, syncCookie, navigate, openWindow);

		expect(openWindow).toHaveBeenCalledOnce();
		expect(syncCookie).not.toHaveBeenCalled();
		expect(navigate).not.toHaveBeenCalled();
	});
});
