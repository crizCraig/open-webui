export type PaymentClickEvent = Pick<MouseEvent, 'currentTarget'>;

export type SyncCookie = () => Promise<void>;

export type NavigateToDestination = (destination: string) => void;

/**
 * Capture the clicked link before waiting for cookie synchronization.
 * Browsers clear MouseEvent.currentTarget after the event handler yields.
 */
export async function navigateAfterCookieSync(
	event: PaymentClickEvent,
	syncCookie: SyncCookie,
	navigate: NavigateToDestination
): Promise<void> {
	const destination = (event.currentTarget as HTMLAnchorElement).href;
	await syncCookie();
	navigate(destination);
}
