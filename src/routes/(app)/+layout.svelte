<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { onMount, tick, getContext } from 'svelte';
	import { openDB, deleteDB } from 'idb';
	import fileSaver from 'file-saver';
	const { saveAs } = fileSaver;
	import mermaid from 'mermaid';
	import FingerprintJS from '@fingerprintjs/fingerprintjs';

	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { fade } from 'svelte/transition';

	import { getKnowledgeBases } from '$lib/apis/knowledge';
	import { getFunctions } from '$lib/apis/functions';
	import { getModels, getToolServersData, getVersionUpdates } from '$lib/apis';
	import { getAllTags } from '$lib/apis/chats';
	import { getPrompts } from '$lib/apis/prompts';
	import { getTools } from '$lib/apis/tools';
	import { getBanners } from '$lib/apis/configs';
	import { getUserSettings } from '$lib/apis/users';
	import { syncPolychatCookie } from '$lib/apis/polychat';

	import { WEBUI_VERSION, getPolychatAppUrl } from '$lib/constants';
	import { compareVersion } from '$lib/utils';

	import {
		config,
		user,
		settings,
		models,
		prompts,
		knowledge,
		tools,
		functions,
		tags,
		banners,
		showSettings,
		showChangelog,
		temporaryChatEnabled,
		toolServers
	} from '$lib/stores';

	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import SettingsModal from '$lib/components/chat/SettingsModal.svelte';
	import ChangelogModal from '$lib/components/ChangelogModal.svelte';
	import AccountPending from '$lib/components/layout/Overlay/AccountPending.svelte';
	import UpdateInfoToast from '$lib/components/layout/UpdateInfoToast.svelte';
	import { get } from 'svelte/store';
	import Spinner from '$lib/components/common/Spinner.svelte';

	const i18n = getContext('i18n');

	let loaded = false;
	let DB = null;
	let localDBChats = [];

	let version;

	// Helper function to hash data using SHA-256
	async function hashData(
		data: any
	): Promise<string | { __error__: string; __original_value__?: any }> {
		try {
			const jsonString = JSON.stringify(data);
			const msgUint8 = new TextEncoder().encode(jsonString); // encode as (utf-8) Uint8Array
			const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8); // hash the message
			const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
			const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join(''); // convert bytes to hex string
			return hashHex;
		} catch (error) {
			console.error('Hashing failed:', error);
			// Mark the data as failed instead of returning a fallback string
			try {
				// Ensure the original data is serializable for sending
				JSON.stringify(data);
				return { __error__: 'hashing_failed', __original_value__: data };
			} catch (stringifyError) {
				console.error('Failed to stringify original data after hashing error:', stringifyError);
				// If original data also fails to stringify, send a simpler error marker
				return { __error__: 'hashing_and_stringify_failed' };
			}
		}
	}

	onMount(async () => {
		if (($user === undefined || $user === null)
			&& $page.url.pathname !== '/pricing' && !$page.url.pathname.startsWith('/legal/')) {
			await goto('/h');
		} else if (['user', 'admin'].includes($user?.role)) {
			// Generate Fingerprint for logged-in user
			try {
				const fp = await FingerprintJS.load();
				const result = await fp.get({ extendedResult: true } as any);

				// console.debug('fingerprintData:', result);

				// Prepare data to send (deep copy and hash specific components)
				const fingerprintData = JSON.parse(JSON.stringify(result));

				const componentsToHash = ['canvas', 'webGlExtensions', 'plugins', 'math'];

				for (const componentName of componentsToHash) {
					if (fingerprintData.components?.[componentName]?.value) {
						fingerprintData.components[componentName].value = await hashData(
							fingerprintData.components[componentName].value
						);
					}
				}

				// Send modified fingerprint data to backend
				try {
					const response = await fetch(`${getPolychatAppUrl()}/client`, {
						method: 'POST',
						mode: 'cors',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							token: localStorage.token, // Include token
							fingerprintData: fingerprintData // Send the modified data
						})
					});

					if (!response.ok) {
						console.error('Failed to send fingerprint data:', response.status, response.statusText);
					}
				} catch (fetchError) {
					console.error('Error sending fingerprint data:', fetchError);
				}

			} catch (error) {
				console.error('Error generating fingerprint in layout:', error);
			}

			// Refresh the Polychat cookie in the background. Payment and plans wait for this
			// same shared request before relying on it.
			if (localStorage.token) {
				void syncPolychatCookie(localStorage.token).catch((error) => {
					console.error('Failed to set Polychat cookie:', error);
				});
			}
			try {
				// Check if IndexedDB exists
				DB = await openDB('Chats', 1);

				if (DB) {
					const chats = await DB.getAllFromIndex('chats', 'timestamp');
					localDBChats = chats.map((item, idx) => chats[chats.length - 1 - idx]);

					if (localDBChats.length === 0) {
						await deleteDB('Chats');
					}
				}

				console.log(DB);
			} catch (error) {
				// IndexedDB Not Found
			}

			const userSettings = await getUserSettings(localStorage.token).catch((error) => {
				console.error(error);
				return null;
			});

			if (userSettings) {
				settings.set(userSettings.ui);
			} else {
				let localStorageSettings = {} as Parameters<(typeof settings)['set']>[0];

				try {
					localStorageSettings = JSON.parse(localStorage.getItem('settings') ?? '{}');
				} catch (e: unknown) {
					console.error('Failed to parse settings from localStorage', e);
				}

				settings.set(localStorageSettings);
			}

			models.set(
				await getModels(
					localStorage.token,
					$config?.features?.enable_direct_connections && ($settings?.directConnections ?? null)
				)
			);

			banners.set(await getBanners(localStorage.token));
			tools.set(await getTools(localStorage.token));
			toolServers.set(await getToolServersData($i18n, $settings?.toolServers ?? []));

			document.addEventListener('keydown', async function (event) {
				const isCtrlPressed = event.ctrlKey || event.metaKey; // metaKey is for Cmd key on Mac
				// Check if the Shift key is pressed
				const isShiftPressed = event.shiftKey;

				// Check if Ctrl + Shift + O is pressed
				if (isCtrlPressed && isShiftPressed && event.key.toLowerCase() === 'o') {
					event.preventDefault();
					console.log('newChat');
					document.getElementById('sidebar-new-chat-button')?.click();
				}

				// Check if Shift + Esc is pressed
				if (isShiftPressed && event.key === 'Escape') {
					event.preventDefault();
					console.log('focusInput');
					document.getElementById('chat-input')?.focus();
				}

				// Check if Ctrl + Shift + ; is pressed
				if (isCtrlPressed && isShiftPressed && event.key === ';') {
					event.preventDefault();
					console.log('copyLastCodeBlock');
					const button = [...document.getElementsByClassName('copy-code-button')]?.at(-1);
					button?.click();
				}

				// Check if Ctrl + Shift + C is pressed
				if (isCtrlPressed && isShiftPressed && event.key.toLowerCase() === 'c') {
					event.preventDefault();
					console.log('copyLastResponse');
					const button = [...document.getElementsByClassName('copy-response-button')]?.at(-1);
					console.log(button);
					button?.click();
				}

				// Check if Ctrl + Shift + S is pressed
				if (isCtrlPressed && isShiftPressed && event.key.toLowerCase() === 's') {
					event.preventDefault();
					console.log('toggleSidebar');
					document.getElementById('sidebar-toggle-button')?.click();
				}

				// Check if Ctrl + Shift + Backspace is pressed
				if (
					isCtrlPressed &&
					isShiftPressed &&
					(event.key === 'Backspace' || event.key === 'Delete')
				) {
					event.preventDefault();
					console.log('deleteChat');
					document.getElementById('delete-chat-button')?.click();
				}

				// Check if Ctrl + . is pressed
				if (isCtrlPressed && event.key === '.') {
					event.preventDefault();
					console.log('openSettings');
					showSettings.set(!$showSettings);
				}

				// Check if Ctrl + / is pressed
				if (isCtrlPressed && event.key === '/') {
					event.preventDefault();
					console.log('showShortcuts');
					document.getElementById('show-shortcuts-button')?.click();
				}

				// Check if Ctrl + Shift + ' is pressed
				if (
					isCtrlPressed &&
					isShiftPressed &&
					(event.key.toLowerCase() === `'` || event.key.toLowerCase() === `"`)
				) {
					event.preventDefault();
					console.log('temporaryChat');
					temporaryChatEnabled.set(!$temporaryChatEnabled);
					await goto('/');
					const newChatButton = document.getElementById('new-chat-button');
					setTimeout(() => {
						newChatButton?.click();
					}, 0);
				}
			});

			if ($user?.role === 'admin' && ($settings?.showChangelog ?? true)) {
				showChangelog.set($settings?.version !== $config.version);
			}

			if ($user?.role === 'admin' || ($user?.permissions?.chat?.temporary ?? true)) {
				if ($page.url.searchParams.get('temporary-chat') === 'true') {
					temporaryChatEnabled.set(true);
				}

				if ($user?.permissions?.chat?.temporary_enforced) {
					temporaryChatEnabled.set(true);
				}
			}

			// Check for version updates
			if ($user?.role === 'admin') {
				// Check if the user has dismissed the update toast in the last 24 hours
				if (localStorage.dismissedUpdateToast) {
					const dismissedUpdateToast = new Date(Number(localStorage.dismissedUpdateToast));
					const now = new Date();

					if (now - dismissedUpdateToast > 24 * 60 * 60 * 1000) {
						checkForVersionUpdates();
					}
				} else {
					checkForVersionUpdates();
				}
			}
			await tick();
		}

		loaded = true;
	});

	const checkForVersionUpdates = async () => {
		version = await getVersionUpdates(localStorage.token).catch((error) => {
			return {
				current: WEBUI_VERSION,
				latest: WEBUI_VERSION
			};
		});
	};
</script>

<SettingsModal bind:show={$showSettings} />
<ChangelogModal bind:show={$showChangelog} />

{#if version && compareVersion(version.latest, version.current) && ($settings?.showUpdateToast ?? true)}
	<div class=" absolute bottom-8 right-8 z-50" in:fade={{ duration: 100 }}>
		<UpdateInfoToast
			{version}
			on:close={() => {
				localStorage.setItem('dismissedUpdateToast', Date.now().toString());
				version = null;
			}}
		/>
	</div>
{/if}

{#if $user}
	<div class="app relative">
		<div
			class=" text-gray-700 dark:text-gray-100 bg-white dark:bg-gray-900 h-screen max-h-[100dvh] overflow-auto flex flex-row justify-end"
		>
			{#if !['user', 'admin'].includes($user?.role)}
				<AccountPending />
			{:else if localDBChats.length > 0}
				<div class="fixed w-full h-full flex z-50">
					<div
						class="absolute w-full h-full backdrop-blur-md bg-white/20 dark:bg-gray-900/50 flex justify-center"
					>
						<div class="m-auto pb-44 flex flex-col justify-center">
							<div class="max-w-md">
								<div class="text-center dark:text-white text-2xl font-medium z-50">
									Important Update<br /> Action Required for Chat Log Storage
								</div>

								<div class=" mt-4 text-center text-sm dark:text-gray-200 w-full">
									{$i18n.t(
										"Saving chat logs directly to your browser's storage is no longer supported. Please take a moment to download and delete your chat logs by clicking the button below. Don't worry, you can easily re-import your chat logs to the backend through"
									)}
									<span class="font-semibold dark:text-white"
										>{$i18n.t('Settings')} > {$i18n.t('Chats')} > {$i18n.t('Import Chats')}</span
									>. {$i18n.t(
										'This ensures that your valuable conversations are securely saved to your backend database. Thank you!'
									)}
								</div>

								<div class=" mt-6 mx-auto relative group w-fit">
									<button
										class="relative z-20 flex px-5 py-2 rounded-full bg-white border border-gray-100 dark:border-none hover:bg-gray-100 transition font-medium text-sm"
										on:click={async () => {
											let blob = new Blob([JSON.stringify(localDBChats)], {
												type: 'application/json'
											});
											saveAs(blob, `chat-export-${Date.now()}.json`);

											const tx = DB.transaction('chats', 'readwrite');
											await Promise.all([tx.store.clear(), tx.done]);
											await deleteDB('Chats');

											localDBChats = [];
										}}
									>
										Download & Delete
									</button>

									<button
										class="text-xs text-center w-full mt-2 text-gray-400 underline"
										on:click={async () => {
											localDBChats = [];
										}}>{$i18n.t('Close')}</button
									>
								</div>
							</div>
						</div>
					</div>
				</div>
			{/if}

			<Sidebar />

			{#if loaded}
				<slot />
			{:else}
				<div class="w-full flex-1 h-full flex items-center justify-center">
					<Spinner />
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.loading {
		display: inline-block;
		clip-path: inset(0 1ch 0 0);
		animation: l 1s steps(3) infinite;
		letter-spacing: -0.5px;
	}

	@keyframes l {
		to {
			clip-path: inset(0 -1ch 0 0);
		}
	}

	pre[class*='language-'] {
		position: relative;
		overflow: auto;

		/* make space  */
		margin: 5px 0;
		padding: 1.75rem 0 1.75rem 1rem;
		border-radius: 10px;
	}

	pre[class*='language-'] button {
		position: absolute;
		top: 5px;
		right: 5px;

		font-size: 0.9rem;
		padding: 0.15rem;
		background-color: #828282;

		border: ridge 1px #7b7b7c;
		border-radius: 5px;
		text-shadow: #c4c4c4 0 0 2px;
	}

	pre[class*='language-'] button:hover {
		cursor: pointer;
		background-color: #bcbabb;
	}
</style>
