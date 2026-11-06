<script>
	import { toast } from 'svelte-sonner';
	import { onMount, getContext } from 'svelte';
	import { goto } from '$app/navigation';
	
	import { createAPIKey, getAPIKey } from '$lib/apis/auths';
	import { WEBUI_BASE_URL, getPolychatAppUrl } from '$lib/constants';
	import { WEBUI_NAME, config, user } from '$lib/stores';
	import { copyToClipboard } from '$lib/utils';
	import { keyPageTracker } from '$lib/utils/keyPageEvents';
	import { markMemtreeKeyHintDone } from '$lib/utils/memtreeKeyLink';
	
	import Spinner from '$lib/components/common/Spinner.svelte';
	
	const i18n = getContext('i18n');
	
	let loading = true;
	let apiKey = '';
	let copied = false;
	let webUIName = 'PolyChat'; // Default fallback
	
	// Install funnel events: names only, keyed to the signed-in user (keyPageEvents.ts).
	// The app URL and session are read at each send, so a late-loading config still counts.
	const tracker = keyPageTracker({
		get appUrl() {
			return getPolychatAppUrl();
		},
		get token() {
			return localStorage.token;
		}
	});
	const track = (event) => void tracker(event);

	const handleAPIKeyCreation = async () => {
		track('page_view');
		try {
			// First check if API key already exists
			let existingKey = await getAPIKey(localStorage.token).catch(() => '');
			
			if (existingKey) {
				apiKey = existingKey;
				track('key_shown');
			} else {
				// Create new API key if it doesn't exist
				const newKey = await createAPIKey(localStorage.token);
				if (newKey) {
					apiKey = newKey;
					track('key_created');
				} else {
					throw new Error('Failed to create API key');
				}
			}
			
			// The user has their key: the new-chat hint has done its job.
			markMemtreeKeyHintDone(localStorage);
		} catch (error) {
			console.error('API Key creation error:', error);
			toast.error($i18n.t('Failed to create API key. Please try again.'));
		} finally {
			loading = false;
		}
	};
	
	const INSTALL_COMMAND = 'npm install -g claude-code-infinite';
	const CCC_COMMAND = 'ccc';
	const README_URL = 'https://github.com/crizCraig/claude-code-infinite#readme';
	let installCopied = false;
	let cccCopied = false;

	const copyInstall = async () => {
		track('copy_install');
		await copyToClipboard(INSTALL_COMMAND);
		installCopied = true;
		setTimeout(() => {
			installCopied = false;
		}, 2000);
	};

	const copyCcc = async () => {
		track('copy_ccc');
		await copyToClipboard(CCC_COMMAND);
		cccCopied = true;
		setTimeout(() => {
			cccCopied = false;
		}, 2000);
	};

	const copyAgain = async () => {
		track('copy_key');
		await copyToClipboard(apiKey);
		copied = true;
		toast.success($i18n.t('API Key copied to clipboard!'));
		
		setTimeout(() => {
			copied = false;
		}, 2000);
	};
	
	onMount(async () => {
		try {
			// Set the webUI name if available
			if ($WEBUI_NAME) {
				webUIName = $WEBUI_NAME;
			}
			
			// Check if user is logged in
			if (!$user || !localStorage?.token) {
				// Redirect to auth with memtree parameter
				goto('/auth?memtree=true');
				return;
			}
			
			// Wait for config to load or proceed after timeout
			if (!$config) {
				setTimeout(() => {
					handleAPIKeyCreation();
				}, 1000);
			} else {
				await handleAPIKeyCreation();
			}
		} catch (error) {
			console.error('PolyChat API page initialization error:', error);
			goto('/auth?memtree=true');
		}
	});
	
	// Reactively update webUIName when WEBUI_NAME store is ready
	$: {
		try {
			if ($WEBUI_NAME) {
				webUIName = $WEBUI_NAME;
			}
		} catch (error) {
			// Ignore store access errors during initialization
		}
	}
</script>

<svelte:head>
	<title>
		PolyChat API Key - {webUIName}
	</title>
</svelte:head>

<div class="w-full h-screen max-h-[100dvh] text-white relative">
	<div class="w-full h-full absolute top-0 left-0 bg-white dark:bg-black"></div>
	
	<div class="w-full absolute top-0 left-0 right-0 h-8 drag-region" />
	
	<div class="fixed m-10 z-50">
		<div class="flex space-x-2">
			<div class="self-center">
				<img
					crossorigin="anonymous"
					src="{WEBUI_BASE_URL}/static/splash.png"
					class="w-6 rounded-full"
					alt=""
				/>
			</div>
		</div>
	</div>
	
	<div class="fixed bg-transparent min-h-screen w-full flex justify-center font-primary z-50 text-black dark:text-white">
		<div class="w-full sm:max-w-md px-10 min-h-screen flex flex-col text-center">
			<div class="my-auto pb-10 w-full dark:text-gray-100">
				{#if loading}
					<div class="flex items-center justify-center gap-3 text-xl sm:text-2xl text-center font-semibold dark:text-gray-200">
						<div>
							{$i18n.t('Setting up your PolyChat API key...')}
						</div>
						<div>
							<Spinner />
						</div>
					</div>
				{:else}
					<div class="mb-6">
						<div class="text-2xl font-medium mb-2">
							{$i18n.t('Your PolyChat API Key')}
						</div>
						<div class="text-sm text-gray-600 dark:text-gray-400 mb-6">
							{$i18n.t('Your API key has been created. Copy it below.')}
						</div>
					</div>
					
					<div class="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-6">
						<div class="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
							{$i18n.t('API Key')}
						</div>
						<div class="font-mono text-sm bg-white dark:bg-gray-900 p-3 rounded border break-all">
							{apiKey}
						</div>
					</div>
					
					<div class="flex flex-col gap-3">
						<button
							class="bg-gray-700/5 hover:bg-gray-700/10 dark:bg-gray-100/5 dark:hover:bg-gray-100/10 dark:text-gray-300 dark:hover:text-white transition w-full rounded-full font-medium text-sm py-2.5 flex items-center justify-center gap-2"
							on:click={copyAgain}
						>
							{#if copied}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 20 20"
									fill="currentColor"
									class="w-4 h-4 text-green-500"
								>
									<path
										fill-rule="evenodd"
										d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
										clip-rule="evenodd"
									/>
								</svg>
								{$i18n.t('Copied!')}
							{:else}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
									class="w-4 h-4"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V5.625c0-.621.504-1.125 1.125-1.125h7.5a1.125 1.125 0 011.125 1.125v9.75l4.125-4.125v5.25z"
									/>
								</svg>
								{$i18n.t('Copy to Clipboard')}
							{/if}
						</button>
						
						<div
							class="mt-3 text-left rounded-lg border border-gray-200 dark:border-gray-700 p-4"
							data-testid="claude-code-setup"
						>
							<div class="text-base font-medium mb-1">{$i18n.t('Use it with Claude Code')}</div>
							<div class="text-sm text-gray-600 dark:text-gray-400 mb-3">
								{$i18n.t(
									'Long sessions stay fast, and every session gets a searchable MemTree.'
								)}
							</div>
							<div class="text-sm text-gray-600 dark:text-gray-400 mb-3">
								{$i18n.t('Needs Claude Code installed and signed in with a Claude Pro or Max plan.')}
							</div>
							<div class="text-sm mb-1">{$i18n.t('1. Install (Node 20.3 or later)')}</div>
							<div
								class="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded px-3 py-2 mb-3"
							>
								<code class="flex-1 min-w-0 overflow-x-auto whitespace-nowrap font-mono text-xs"
									>{INSTALL_COMMAND}</code
								>
								<button
									class="shrink-0 text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition"
									on:click={copyInstall}
								>
									{installCopied ? $i18n.t('Copied!') : $i18n.t('Copy')}
								</button>
							</div>
							<div class="text-sm">
								{$i18n.t('2. In a project, run')}
								<code class="font-mono bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-0.5">ccc</code>
								<button
									class="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition"
									on:click={copyCcc}
								>
									{cccCopied ? $i18n.t('Copied!') : $i18n.t('Copy')}
								</button>
								{$i18n.t(
									'instead of claude. The first time, it asks for your key. Paste the one above.'
								)}
							</div>
							<div class="text-xs mt-3">
								<a
									class="underline text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
									href={README_URL}
									target="_blank"
									rel="noopener noreferrer"
									on:click={() => track('link_readme')}
								>
									{$i18n.t('Setup guide and help')}
								</a>
							</div>
						</div>

						<div class="text-xs text-gray-500 dark:text-gray-400 text-left">
							{$i18n.t(
								'Using the API directly? Use this key to connect to our API, including MemTree memory, to your AI assistant.'
							)}
						</div>

						<!-- The page is also reached from the user menu and the new-chat hint, where an
						installed app (no browser Back) needs a way back -->
						<a
							href="/"
							class="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition underline"
						>
							{$i18n.t('Continue to Chat')}
						</a>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
