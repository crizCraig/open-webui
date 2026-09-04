export interface PaymentClickEvent {
	currentTarget: EventTarget | null;
	ctrlKey?: boolean;
	metaKey?: boolean;
	shiftKey?: boolean;
}

export type SyncCookie = () => Promise<void>;

export type NavigateToDestination = (destination: string) => void;

export interface PaymentWindow {
	location: {
		replace: (destination: string) => void;
	};
	opener: unknown;
	close: () => void;
}

export type OpenPaymentWindow = () => PaymentWindow | null;

/**
 * Capture the clicked link before waiting for cookie synchronization.
 * Browsers clear MouseEvent.currentTarget after the event handler yields.
 */
export async function navigateAfterCookieSync(
	event: PaymentClickEvent,
	syncCookie: SyncCookie,
	navigate: NavigateToDestination,
	openWindow?: OpenPaymentWindow
): Promise<void> {
	const destination = (event.currentTarget as HTMLAnchorElement).href;
	const opensNewContext = event.ctrlKey || event.metaKey || event.shiftKey;

	if (opensNewContext && openWindow) {
		const paymentWindow = openWindow();
		if (!paymentWindow) {
			return;
		}

		paymentWindow.opener = null;
		try {
			await syncCookie();
			paymentWindow.location.replace(destination);
		} catch (error) {
			paymentWindow.close();
			throw error;
		}
		return;
	}

	await syncCookie();
	navigate(destination);
}
