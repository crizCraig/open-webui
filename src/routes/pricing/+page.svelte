<script lang="ts">
  import { WEBUI_NAME } from '$lib/stores';
  import { getContext, onMount } from 'svelte';
  import { getPolychatAppUrl } from '$lib/constants';
  import { user } from '$lib/stores';
  
  const i18n = getContext('i18n');
  const POLYCHAT_APP_URL = getPolychatAppUrl();
  
  let plansData = null;
  
  onMount(async () => {
    // Set the token cookie for Polychat app if user is logged in
    if ($user && localStorage.token) {
      try {
        // Make a background fetch request to set the cookie
        fetch(`${POLYCHAT_APP_URL}/set-cookie`, {
          method: 'POST',
          mode: 'cors',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            token: localStorage.token
          }),
        }).catch(error => {
          console.error('Failed to set cookie:', error);
        });
      } catch (error) {
        console.error('Error setting token cookie:', error);
      }
    }
    
    if ($user) {
      try {
        const response = await fetch(`${POLYCHAT_APP_URL}/plans?user_email=${encodeURIComponent($user.email)}`, {
          credentials: 'include'
        });
        if (response.ok) {
          plansData = await response.json();
        }
      } catch (error) {
        console.error('Failed to fetch user plan:', error);
      }
    }
  });
</script>
<div class="h-screen overflow-auto">
  <div class="w-full bg-[#0f1117]">
   <!-- Header -->
   <header class="fixed top-0 left-0 right-0 z-10 bg-[#0f1117]/80 backdrop-blur">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
     <div class="flex justify-between items-center">
      <a href="/h" class="text-xl font-medium text-gray-300 hover:text-white transition-colors">
                    <span class="logo bg-gradient-to-r from-emerald-400 to-blue-500 text-transparent bg-clip-text"
              style="font-family: 'Gill Sans', sans-serif;">
                        polychat
                    </span>
      </a>
      {#if !$user}
      <a href="/auth" class="text-xl font-medium text-gray-300 hover:text-white transition-colors">
       {$i18n.t('Login')}
      </a>
      {/if}
     </div>
    </div>
   </header>
   <main class="pt-16">
    <!-- Pricing Hero Section -->
    <section class="relative overflow-hidden border-b border-gray-800">
     <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div class="max-w-3xl">
       <h1 class="text-5xl font-semibold text-gray-100 mb-6">
        Simple, transparent <span class="bg-gradient-to-r from-emerald-400 to-blue-500 text-transparent bg-clip-text">pricing</span>
       </h1>
       <p class="text-xl text-gray-300 mb-8">
        Free to try. No rate limits. Cancel anytime.
       </p>
      </div>
     </div>
    </section>
    <!-- Plans Section -->
    <section class="bg-[#161922] py-16 border-b border-gray-800">
     <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-12">
       <h2 class="text-3xl font-semibold text-white mb-4">Subscription Plans</h2>
       <p class="text-lg text-gray-300 max-w-2xl mx-auto">
        Choose a plan based on your usage needs. Upgrade or downgrade anytime.
       </p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
       <!-- Free Plan -->
       <div
        class="p-8 bg-[#1e212e] rounded-xl border border-gray-700 transform transition-transform duration-300 hover:shadow-[0_0_25px_rgba(16,185,129,0.1)] flex flex-col">
        <div class="text-2xl font-semibold text-white mb-2">Free</div>
        <div class="text-4xl font-bold text-white mb-6">$0<span class="text-lg text-gray-400">/month</span></div>
        <ul class="space-y-3 mb-8 flex-grow">
         <li class="flex items-start">
          <svg class="w-5 h-5 text-emerald-400 mr-2 mt-1 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
           <path fill-rule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clip-rule="evenodd" />
          </svg>
          <span class="text-gray-300">Access to all models</span>
         </li>
         <li class="flex items-start">
          <svg class="w-5 h-5 text-emerald-400 mr-2 mt-1 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
           <path fill-rule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clip-rule="evenodd" />
          </svg>
          <div><span class="text-gray-300">100k tokens one time use</span></div>
         </li>
         <li class="flex items-start">
          <svg class="w-5 h-5 text-emerald-400 mr-2 mt-1 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
           <path fill-rule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clip-rule="evenodd" />
          </svg>
          <span class="text-gray-300">4 messages/day</span>
         </li>
        </ul>
        <div class="mt-auto h-[52px]">
        {#if $user}
         {#if !plansData?.current_subscription || plansData?.current_subscription?.status !== 'active'}
         <div class="text-center">
          <div class="text-gray-300 inline-block">Current plan</div>
         </div>
         {:else}
         <a href="{POLYCHAT_APP_URL}/payment?user_id={$user.id}&user_email={$user.email}&price_id={plansData?.available_plans?.find(p => p.name === 'Starter')?.price_id || ''}"
           class="block w-full py-3 px-4 text-center bg-[#0f1117] hover:bg-[#1a1d2a] text-white rounded-lg font-medium transition-colors border border-emerald-500/30">
          Subscribe Now
         </a>
         {/if}
        {:else}
         <a href="/auth" class="block w-full py-3 px-4 text-center bg-[#0f1117] hover:bg-[#1a1d2a] text-white rounded-lg font-medium transition-colors">
          Try for Free
         </a>
        {/if}
        </div>
       </div>
       <!-- Starter Plan -->
       <div
        class="p-8 bg-gradient-to-br from-[#1a1f2c] to-[#161922] rounded-xl border border-emerald-500/40 transform transition-transform duration-300 shadow-[0_0_25px_rgba(16,185,129,0.1)] hover:shadow-[0_0_35px_rgba(16,185,129,0.2)] flex flex-col">
        <div class="flex items-center gap-2 mb-2">
         <div class="text-2xl font-semibold text-white">🌱 Starter</div>
        </div>
        <div class="text-4xl font-bold text-white mb-6">$5<span class="text-lg text-gray-400">/month</span></div>
        <ul class="space-y-3 mb-8 flex-grow">
         <li class="flex items-start">
          <svg class="w-5 h-5 text-emerald-400 mr-2 mt-1 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
           <path fill-rule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clip-rule="evenodd" />
          </svg>
          <span class="text-gray-300">Access to all models</span>
         </li>
         <li class="flex items-start">
          <svg class="w-5 h-5 text-emerald-400 mr-2 mt-1 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
           <path fill-rule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clip-rule="evenodd" />
          </svg>
          <div><span class="text-gray-300">1 million tokens/month</span></div>
         </li>
         <li class="flex items-start">
          <svg class="w-5 h-5 text-emerald-400 mr-2 mt-1 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
           <path fill-rule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clip-rule="evenodd" />
          </svg>
          <span class="text-gray-300">8 messages/day</span>
         </li>
        </ul>
        <div class="mt-auto h-[52px]">
        {#if $user}
         {#if plansData?.current_subscription?.status === 'active' && plansData?.current_subscription?.price_id === plansData?.available_plans?.find(p => p.name === 'Starter')?.price_id}
         <div class="text-center">
          <div class="text-gray-300 inline-block">Current plan</div>
         </div>
         {:else}
         <a href="{POLYCHAT_APP_URL}/payment?user_id={$user.id}&user_email={$user.email}&price_id={plansData?.available_plans?.find(p => p.name === 'Starter')?.price_id || ''}"
           class="block w-full py-3 px-4 text-center bg-[#0f1117] hover:bg-[#1a1d2a] text-white rounded-lg font-medium transition-colors border border-emerald-500/30">
          Subscribe Now
         </a>
         {/if}
        {:else}
         <a href="/auth"
           class="block w-full py-3 px-4 text-center bg-[#0f1117] hover:bg-[#1a1d2a] text-white rounded-lg font-medium transition-colors border border-emerald-500/30">
          Try Before You Buy
         </a>
        {/if}
        </div>
       </div>
       <!-- Basic Plan -->
       <div
        class="p-8 bg-[#1e212e] rounded-xl border border-gray-700 transform transition-transform duration-300 hover:shadow-[0_0_25px_rgba(16,185,129,0.1)] flex flex-col">
        <div class="flex items-center gap-2 mb-2">
          <div class="text-2xl font-semibold text-white">🚀 Basic</div>
          <span class="text-xs font-semibold bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded">POPULAR</span>
         </div>
        <div class="text-4xl font-bold text-white mb-6">$10<span class="text-lg text-gray-400">/month</span></div>
        <ul class="space-y-3 mb-8 flex-grow">
         <li class="flex items-start">
          <svg class="w-5 h-5 text-emerald-400 mr-2 mt-1 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
           <path fill-rule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clip-rule="evenodd" />
          </svg>
          <span class="text-gray-300">Access to all models</span>
         </li>
         <li class="flex items-start">
          <svg class="w-5 h-5 text-emerald-400 mr-2 mt-1 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
           <path fill-rule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clip-rule="evenodd" />
          </svg>
          <div><span class="text-gray-300">2 million tokens/month</span></div>
         </li>
         <li class="flex items-start">
          <svg class="w-5 h-5 text-emerald-400 mr-2 mt-1 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
           <path fill-rule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clip-rule="evenodd" />
          </svg>
          <span class="text-gray-300">16 messages/day</span>
         </li>
        </ul>
        <div class="mt-auto h-[52px]">
        {#if $user}
         {#if plansData?.current_subscription?.status === 'active' && plansData?.current_subscription?.price_id === plansData?.available_plans?.find(p => p.name === 'Basic')?.price_id}
         <div class="text-center">
          <div class="text-gray-300 inline-block">Current plan</div>
         </div>
         {:else}
         <a href="{POLYCHAT_APP_URL}/payment?user_id={$user.id}&user_email={$user.email}&price_id={plansData?.available_plans?.find(p => p.name === 'Basic')?.price_id || ''}"
           class="block w-full py-3 px-4 text-center bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors">
          Subscribe Now
         </a>
         {/if}
        {:else}
         <a href="/auth"
           class="block w-full py-3 px-4 text-center bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors">
          Try Before You Buy
         </a>
        {/if}
        </div>
       </div>
       <!-- Plus Plan -->
       <div
        class="p-8 bg-[#1e212e] rounded-xl border border-indigo-500/40 transform transition-transform duration-300 hover:shadow-[0_0_25px_rgba(99,102,241,0.1)] flex flex-col">
        <div class="flex items-center gap-2 mb-2">
         <div class="text-2xl font-semibold text-white">⭐ Plus</div>
        </div>
        <div class="text-4xl font-bold text-white mb-6">$20<span class="text-lg text-gray-400">/month</span></div>
        <ul class="space-y-3 mb-8 flex-grow">
         <li class="flex items-start">
          <svg class="w-5 h-5 text-indigo-400 mr-2 mt-1 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
           <path fill-rule="evenodd"
             d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
             clip-rule="evenodd" />
          </svg>
          <span class="text-gray-300">Access to all models</span>
         </li>
         <li class="flex items-start">
          <svg class="w-5 h-5 text-indigo-400 mr-2 mt-1 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
           <path fill-rule="evenodd"
             d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
             clip-rule="evenodd" />
          </svg>
          <div><span class="text-gray-300">4 million tokens/month</span></div>
         </li>
         <li class="flex items-start">
          <svg class="w-5 h-5 text-indigo-400 mr-2 mt-1 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
           <path fill-rule="evenodd"
             d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
             clip-rule="evenodd" />
          </svg>
          <span class="text-gray-300">Unlimited messages/day</span>
         </li>
        </ul>
        <div class="mt-auto h-[52px]">
        {#if $user}
         {#if plansData?.current_subscription?.status === 'active' && plansData?.current_subscription?.price_id === plansData?.available_plans?.find(p => p.name === 'Plus')?.price_id}
         <div class="text-center">
          <div class="text-gray-300 inline-block">Current plan</div>
         </div>
         {:else}
         <a href="{POLYCHAT_APP_URL}/payment?user_id={$user.id}&user_email={$user.email}&price_id={plansData?.available_plans?.find(p => p.name === 'Plus')?.price_id || ''}"
           class="block w-full py-3 px-4 text-center bg-[#0f1117] hover:bg-[#1a1d2a] text-white rounded-lg font-medium transition-colors border border-indigo-500/30">
          Subscribe Now
         </a>
         {/if}
        {:else}
         <a href="/auth"
           class="block w-full py-3 px-4 text-center bg-[#0f1117] hover:bg-[#1a1d2a] text-white rounded-lg font-medium transition-colors border border-indigo-500/30">
          Try Before You Buy
         </a>
        {/if}
        </div>
       </div>
      </div>
     </div>
    </section>
    <!-- Full Plans Table -->
    <section class="bg-[#0f1117] py-16 border-b border-gray-800">
     <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-12">
       <h2 class="text-3xl font-semibold text-white mb-4">All Available Plans</h2>
       <p class="text-lg text-gray-300 max-w-2xl mx-auto">
        Find the perfect plan for your needs
       </p>
      </div>
      <div class="overflow-x-auto">
       <table class="w-full text-left">
        <thead>
        <tr class="border-b border-gray-700">
         <th class="px-6 py-3 text-lg font-medium text-gray-300">Plan</th>
         <th class="px-6 py-3 text-lg font-medium text-gray-300">Price</th>
         <th class="px-6 py-3 text-lg font-medium text-gray-300">tokens</th>
         <th class="px-6 py-3 text-lg font-medium text-gray-300">Messages/Day</th>
         <th class="px-6 py-3 text-lg font-medium text-gray-300">Action</th>
        </tr>
        </thead>
        <tbody>
        <tr class="border-b border-gray-800 hover:bg-[#161922]">
         <td class="px-6 py-4 text-white">Free</td>
         <td class="px-6 py-4 text-white">$0</td>
         <td class="px-6 py-4 text-gray-300">~100k</td>
         <td class="px-6 py-4 text-gray-300">4</td>
         <td class="px-6 py-4">
          {#if $user}
            {#if !plansData?.current_subscription || plansData?.current_subscription?.status !== 'active'}
              <span class="inline-block px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-sm font-medium">Current Plan</span>
            {:else}
              <span class="text-gray-400">Default Plan</span>
            {/if}
          {:else}
            <a href="/auth" class="text-emerald-400 hover:text-emerald-300 transition-colors">
              Try Now
            </a>
          {/if}
         </td>
        </tr>
        <tr class="border-b border-gray-800 hover:bg-[#161922]">
         <td class="px-6 py-4 text-white">🌱 Starter</td>
         <td class="px-6 py-4 text-white">$5</td>
         <td class="px-6 py-4 text-gray-300">~1 million</td>
         <td class="px-6 py-4 text-gray-300">8</td>
         <td class="px-6 py-4">
          {#if $user}
            {#if plansData?.current_subscription?.status === 'active' && plansData?.current_subscription?.price_id === plansData?.available_plans?.find(p => p.name === 'Starter')?.price_id}
              <span class="inline-block px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-sm font-medium">Current Plan</span>
            {:else}
              <a href="{POLYCHAT_APP_URL}/payment?user_id={$user.id}&user_email={$user.email}&price_id={plansData?.available_plans?.find(p => p.name === 'Starter')?.price_id || ''}"
                class="text-emerald-400 hover:text-emerald-300 transition-colors">
                Subscribe
              </a>
            {/if}
          {:else}
            <a href="/auth" class="text-emerald-400 hover:text-emerald-300 transition-colors">
              Try First
            </a>
          {/if}
         </td>
        </tr>
        <tr class="border-b border-gray-800 hover:bg-[#161922]">
         <td class="px-6 py-4 text-white">🚀 Basic</td>
         <td class="px-6 py-4 text-white">$10</td>
         <td class="px-6 py-4 text-gray-300">~2 million</td>
         <td class="px-6 py-4 text-gray-300">16</td>
         <td class="px-6 py-4">
          {#if $user}
            {#if plansData?.current_subscription?.status === 'active' && plansData?.current_subscription?.price_id === plansData?.available_plans?.find(p => p.name === 'Basic')?.price_id}
              <span class="inline-block px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-sm font-medium">Current Plan</span>
            {:else}
              <a href="{POLYCHAT_APP_URL}/payment?user_id={$user.id}&user_email={$user.email}&price_id={plansData?.available_plans?.find(p => p.name === 'Basic')?.price_id || ''}"
                class="text-emerald-400 hover:text-emerald-300 transition-colors">
                Subscribe
              </a>
            {/if}
          {:else}
            <a href="/auth" class="text-emerald-400 hover:text-emerald-300 transition-colors">
              Try First
            </a>
          {/if}
         </td>
        </tr>
        <tr class="border-b border-gray-800 hover:bg-[#161922]">
         <td class="px-6 py-4 text-white">⭐ Plus</td>
         <td class="px-6 py-4 text-white">$20</td>
         <td class="px-6 py-4 text-gray-300">~4 million</td>
         <td class="px-6 py-4 text-gray-300">Unlimited</td>
         <td class="px-6 py-4">
          {#if $user}
            {#if plansData?.current_subscription?.status === 'active' && plansData?.current_subscription?.price_id === plansData?.available_plans?.find(p => p.name === 'Plus')?.price_id}
              <span class="inline-block px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-sm font-medium">Current Plan</span>
            {:else}
              <a href="{POLYCHAT_APP_URL}/payment?user_id={$user.id}&user_email={$user.email}&price_id={plansData?.available_plans?.find(p => p.name === 'Plus')?.price_id || ''}"
                class="text-emerald-400 hover:text-emerald-300 transition-colors">
                Subscribe
              </a>
            {/if}
          {:else}
            <a href="/auth" class="text-emerald-400 hover:text-emerald-300 transition-colors">
              Try First
            </a>
          {/if}
         </td>
        </tr>
        <tr class="border-b border-gray-800 hover:bg-[#161922]">
         <td class="px-6 py-4 text-white">💎 Pro</td>
         <td class="px-6 py-4 text-white">$40</td>
         <td class="px-6 py-4 text-gray-300">~8 million</td>
         <td class="px-6 py-4 text-gray-300">Unlimited</td>
         <td class="px-6 py-4">
          {#if $user}
            {#if plansData?.current_subscription?.status === 'active' && plansData?.current_subscription?.price_id === plansData?.available_plans?.find(p => p.name === 'Pro')?.price_id}
              <span class="inline-block px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-sm font-medium">Current Plan</span>
            {:else}
              <a href="{POLYCHAT_APP_URL}/payment?user_id={$user.id}&user_email={$user.email}&price_id={plansData?.available_plans?.find(p => p.name === 'Pro')?.price_id || ''}"
                class="text-emerald-400 hover:text-emerald-300 transition-colors">
                Subscribe
              </a>
            {/if}
          {:else}
            <a href="/auth" class="text-emerald-400 hover:text-emerald-300 transition-colors">
              Try First
            </a>
          {/if}
         </td>
        </tr>
        <tr class="border-b border-gray-800 hover:bg-[#161922]">
         <td class="px-6 py-4 text-white">🏆 Top 1%</td>
         <td class="px-6 py-4 text-white">$80</td>
         <td class="px-6 py-4 text-gray-300">~16 million</td>
         <td class="px-6 py-4 text-gray-300">Unlimited</td>
         <td class="px-6 py-4">
          {#if $user}
            {#if plansData?.current_subscription?.status === 'active' && plansData?.current_subscription?.price_id === plansData?.available_plans?.find(p => p.name === 'Top 1%')?.price_id}
              <span class="inline-block px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-sm font-medium">Current Plan</span>
            {:else}
              <a href="{POLYCHAT_APP_URL}/payment?user_id={$user.id}&user_email={$user.email}&price_id={plansData?.available_plans?.find(p => p.name === 'Top 1%')?.price_id || ''}"
                class="text-emerald-400 hover:text-emerald-300 transition-colors">
                Subscribe
              </a>
            {/if}
          {:else}
            <a href="/auth" class="text-emerald-400 hover:text-emerald-300 transition-colors">
              Try First
            </a>
          {/if}
         </td>
        </tr>
        <tr class="border-b border-gray-800 hover:bg-[#161922]">
         <td class="px-6 py-4 text-white">👑 Top 0.1%</td>
         <td class="px-6 py-4 text-white">$160</td>
         <td class="px-6 py-4 text-gray-300">~32 million</td>
         <td class="px-6 py-4 text-gray-300">Unlimited</td>
         <td class="px-6 py-4">
          {#if $user}
            {#if plansData?.current_subscription?.status === 'active' && plansData?.current_subscription?.price_id === plansData?.available_plans?.find(p => p.name === 'Top 0.1%')?.price_id}
              <span class="inline-block px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-sm font-medium">Current Plan</span>
            {:else}
              <a href="{POLYCHAT_APP_URL}/payment?user_id={$user.id}&user_email={$user.email}&price_id={plansData?.available_plans?.find(p => p.name === 'Top 0.1%')?.price_id || ''}"
                class="text-emerald-400 hover:text-emerald-300 transition-colors">
                Subscribe
              </a>
            {/if}
          {:else}
            <a href="/auth" class="text-emerald-400 hover:text-emerald-300 transition-colors">
              Try First
            </a>
          {/if}
         </td>
        </tr>
        <tr class="border-b border-gray-800 hover:bg-[#161922]">
         <td class="px-6 py-4 text-white">🌟 Top 0.01%</td>
         <td class="px-6 py-4 text-white">$320</td>
         <td class="px-6 py-4 text-gray-300">~64 million</td>
         <td class="px-6 py-4 text-gray-300">Unlimited</td>
         <td class="px-6 py-4">
          {#if $user}
            {#if plansData?.current_subscription?.status === 'active' && plansData?.current_subscription?.price_id === plansData?.available_plans?.find(p => p.name === 'Top 0.01%')?.price_id}
              <span class="inline-block px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-sm font-medium">Current Plan</span>
            {:else}
              <a href="{POLYCHAT_APP_URL}/payment?user_id={$user.id}&user_email={$user.email}&price_id={plansData?.available_plans?.find(p => p.name === 'Top 0.01%')?.price_id || ''}"
                class="text-emerald-400 hover:text-emerald-300 transition-colors">
                Subscribe
              </a>
            {/if}
          {:else}
            <a href="/auth" class="text-emerald-400 hover:text-emerald-300 transition-colors">
              Try First
            </a>
          {/if}
         </td>
        </tr>
        </tbody>
       </table>
       <div class="text-base text-gray-500 mt-4 text-center">
         Token estimates assume GPT-4o level prices. Actual token amounts will vary by model.
         <br>
         Free tokens are one-time use only and do not renew each month. All other plans renew their tokens each month.
       </div>
      </div>
     </div>
    </section>
    <!-- FAQ Section -->
    <section class="bg-[#161922] py-16 border-b border-gray-800">
     <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-12">
       <h2 class="text-3xl font-semibold text-white mb-4">Frequently Asked Questions</h2>
      </div>
      <div class="space-y-8">
       <div class="bg-[#1e212e] p-6 rounded-lg">
        <h3 class="text-xl font-medium text-white mb-2">How are tokens calculated?</h3>
        <p class="text-gray-300">Tokens are roughly equivalent to words. For example, 1 million tokens is similar to the number of words in a Bible.</p>
       </div>
       <div class="bg-[#1e212e] p-6 rounded-lg">
        <h3 class="text-xl font-medium text-white mb-2">Can I use my own API keys?</h3>
        <p class="text-gray-300">Yes! If you provide your own API keys for providers like OpenAI, Anthropic, Groq, etc., you'll only be charged for
         messages, not tokens, since the provider bills you directly for token usage. So for example, with the $20/month Plus plan, you'll get unlimited messages with your own API keys.</p>
       </div>
       <div class="bg-[#1e212e] p-6 rounded-lg">
        <h3 class="text-xl font-medium text-white mb-2">How do I know which plan is right for me?</h3>
        <p class="text-gray-300">We recommend starting with the free tier. Once your usage exceeds the free limits, we'll suggest the appropriate plan
         based on your activity levels.</p>
       </div>
       <div class="bg-[#1e212e] p-6 rounded-lg">
        <h3 class="text-xl font-medium text-white mb-2">Can I change my plan later?</h3>
        <p class="text-gray-300">Yes, you can upgrade or downgrade your subscription at any time via a "manage subscription" link we provide to you.</p>
       </div>
       <div class="bg-[#1e212e] p-6 rounded-lg">
        <h3 class="text-xl font-medium text-white mb-2">Are there any rate limits?</h3>
        <p class="text-gray-300">No, there are no rate limits. You can use your tokens as fast or as slow as you want during the month. Tokens reset
         at the beginning of the next billing cycle. If you hit the limits of your plan, you can upgrade to a higher plan to continue using.</p>
       </div>
       <div class="bg-[#1e212e] p-6 rounded-lg">
        <h3 class="text-xl font-medium text-white mb-2">When do messages/day reset?</h3>
        <p class="text-gray-300">Messages per day are calculated as a rolling average over the last 14 days. So you will get new messages each day depending on the last 14 days of usage. Doing this allows you to be bursty and use more messages on a given day, provided you've used fewer than the limit in the 14 days previous.</p>
       </div>
      </div>
     </div>
    </section>
    <!-- CTA Section -->
    <section class="bg-[#0f1117] py-16">
     <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <h2 class="text-3xl font-semibold text-white mb-6">Ready to get started?</h2>
      <p class="text-xl text-gray-300 mb-8">
       Try PolyChat for free today. No credit card required.
      </p>
      <div class="flex justify-center gap-4">
       <a href="/auth"
         class="inline-flex px-8 py-4 text-lg bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-lg font-semibold transition-all duration-300 shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.3)]">
        Try for Free
       </a>
       <a href="mailto:support@polychat.co"
         class="inline-flex px-8 py-4 text-lg bg-[#161922] hover:bg-[#1e2230] text-white rounded-lg font-semibold transition-all duration-300 border border-gray-700">
        Contact Support
       </a>
      </div>
     </div>
    </section>

    <!-- Footer -->
    <footer class="bg-[#0f1117] py-8 border-t border-gray-800">
     <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-center space-x-6 text-gray-400">
       <a href="mailto:support@polychat.co" class="text-lg hover:text-gray-300 transition-colors">
        Contact Us
       </a>
       <a href="/legal/privacy" class="text-lg hover:text-gray-300 transition-colors">
        Privacy Policy
       </a>
       <a href="/legal/refund" class="text-lg hover:text-gray-300 transition-colors">
        Refund & Dispute Policy
       </a>
      </div>
     </div>
    </footer>
   </main>
  </div>
</div>