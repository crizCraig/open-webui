<script lang="ts">
	// New-chat hint for the MemTree key, so a user who signed up without ?memtree=true (e.g.
	// from polychat.co itself) finds the key page in one click. Dismissible; gone for good once
	// dismissed or once the key page has been opened. The user menu has the same link.
	import { getContext, onMount } from 'svelte';
	import { fade } from 'svelte/transition';

	import {
		MEMTREE_KEY_PATH,
		markMemtreeKeyHintDone,
		shouldShowMemtreeKeyHint
	} from '$lib/utils/memtreeKeyLink';

	const i18n = getContext('i18n');

	let show = false;

	onMount(() => {
		show = shouldShowMemtreeKeyHint(localStorage);
	});

	const dismiss = () => {
		markMemtreeKeyHintDone(localStorage);
		show = false;
	};
</script>

{#if show}
	<div
		class="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-1"
		data-testid="memtree-key-hint"
		in:fade={{ duration: 150 }}
	>
		<span>
			{$i18n.t('Using Claude Code?')}
			<a
				href={MEMTREE_KEY_PATH}
				class="font-medium text-gray-900 dark:text-gray-100 underline underline-offset-2 hover:text-black dark:hover:text-white"
			>
				{$i18n.t('Get your MemTree key')}
			</a>
		</span>
		<button
			type="button"
			class="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
			aria-label={$i18n.t('Dismiss')}
			on:click={dismiss}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 20 20"
				fill="currentColor"
				class="size-3.5"
				aria-hidden="true"
			>
				<path
					d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"
				/>
			</svg>
		</button>
	</div>
{/if}
