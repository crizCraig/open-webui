<script>
	import { toast } from 'svelte-sonner';
	import { onMount, getContext } from 'svelte';
	import { goto } from '$app/navigation';
	
	import { createAPIKey, getAPIKey } from '$lib/apis/auths';
	import { WEBUI_BASE_URL } from '$lib/constants';
	import { WEBUI_NAME, config, user } from '$lib/stores';
	import { copyToClipboard } from '$lib/utils';
	
	import Spinner from '$lib/components/common/Spinner.svelte';
	
	const i18n = getContext('i18n');
	
	let loading = true;
	let apiKey = '';
	let copied = false;
	let webUIName = 'PolyChat'; // Default fallback
	
	const handleAPIKeyCreation = async () => {
		try {
			// First check if API key already exists
			let existingKey = await getAPIKey(localStorage.token).catch(() => '');
			
			if (existingKey) {
				apiKey = existingKey;
			} else {
				// Create new API key if it doesn't exist
				const newKey = await createAPIKey(localStorage.token);
				if (newKey) {
					apiKey = newKey;
				} else {
					throw new Error('Failed to create API key');
				}
			}
			
			// Automatically copy to clipboard
			await copyToClipboard(apiKey);
			copied = true;
			toast.success($i18n.t('API Key copied to clipboard!'));
			
			// Auto-hide the copied state after 3 seconds
			setTimeout(() => {
				copied = false;
			}, 3000);
			
		} catch (error) {
			console.error('API Key creation error:', error);
			toast.error($i18n.t('Failed to create API key. Please try again.'));
		} finally {
			loading = false;
		}
	};
	
	const copyAgain = async () => {
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
			console.error('Memtree API page initialization error:', error);
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
		Memtree API Key - {webUIName}
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
							{$i18n.t('Setting up your Memtree API key...')}
						</div>
						<div>
							<Spinner />
						</div>
					</div>
				{:else}
					<div class="mb-6">
						<div class="text-2xl font-medium mb-2">
							{$i18n.t('Your Memtree API Key')}
						</div>
						<div class="text-sm text-gray-600 dark:text-gray-400 mb-6">
							{$i18n.t('Your API key has been created and copied to your clipboard. Use this key to connect Memtree to your AI assistant.')}
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
						
						<button
							class="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition underline"
							on:click={() => goto('/')}
						>
							{$i18n.t('Continue to Chat')}
						</button>
					</div>
					
					<div class="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-left">
						<div class="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
							{$i18n.t('Next Steps:')}
						</div>
						<div class="text-xs text-blue-700 dark:text-blue-300">
							<ol class="list-decimal list-inside space-y-1">
								<li><a href="https://memtree.dev" target="_blank" class="underline hover:text-blue-600 dark:hover:text-blue-200 transition">{$i18n.t('Return to Memtree')}</a></li>
								<li>{$i18n.t('Paste your API key when prompted')}</li>
								<li>{$i18n.t('Start using AI-powered features in Memtree!')}</li>
							</ol>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
