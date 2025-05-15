<script lang="ts">
  import { WEBUI_NAME } from '$lib/stores';
  import { getContext } from 'svelte';
  import { user } from '$lib/stores';
  
  const i18n = getContext('i18n');
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
    <!-- Models Section -->
    <section class="bg-[#161922] py-16 border-b border-gray-800">
     <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-12">
       <h2 class="text-3xl font-semibold text-white mb-4">Available Models</h2>
       <div class="py-12 px-7 my-10 text-center max-w-4xl mx-auto bg-gradient-to-b from-[#1f2537]/70 to-[#111827]/70 rounded-xl border-[1.5px] border-emerald-500/25 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
        <p class="text-2xl text-gray-200 max-w-3xl mx-auto font-medium leading-relaxed">
         Our API is fully compatible with OpenAI's API format. Choose from our <span class="text-2xl bg-gradient-to-r from-emerald-400 to-blue-500 text-transparent bg-clip-text font-bold">one-of-a-kind models</span>, combining the world's most powerful AIs, only found on PolyChat.
        </p>
       </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
       <!-- GPT-4o + Sonnet 3.7 -->
       <div class="p-8 bg-[#1e212e] rounded-xl border border-gray-700 transform transition-transform duration-300 hover:shadow-[0_0_25px_rgba(16,185,129,0.1)]">
        <div class="text-2xl font-semibold text-white mb-2">GPT-4o + Sonnet 3.7</div>
        <div class="text-gray-300 mb-6">
         <p class="mb-4 text-lg font-medium">Price per million tokens</p>
         <div class="p-4">
          <div class="flex justify-between items-center py-2 border-b border-gray-700">
           <span class="text-gray-300">Input:</span>
           <span class="font-semibold text-emerald-400">$3.00</span>
          </div>
          <div class="flex justify-between items-center pt-2">
           <span class="text-gray-300">Output:</span>
           <span class="font-semibold text-emerald-400">$15.00</span>
          </div>
         </div>
        </div>
        <div class="text-sm text-gray-400">
         <svg xmlns="http://www.w3.org/2000/svg" class="inline-block h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
         </svg>
         Includes hidden tokens used for combining answers
        </div>
       </div>

       <!-- PolyChat Router -->
       <div class="p-8 bg-gradient-to-br from-[#1a1f2c] to-[#161922] rounded-xl border border-emerald-500/40 transform transition-transform duration-300 shadow-[0_0_25px_rgba(16,185,129,0.1)] hover:shadow-[0_0_35px_rgba(16,185,129,0.2)]">
        <div class="text-2xl font-semibold text-white mb-2">PolyChat Router</div>
        <div class="text-gray-300 mb-6">
         <p class="mb-4 text-lg font-medium">Price per million tokens</p>
         <div class="p-4">
          <div class="flex justify-between items-center py-2 border-b border-gray-700">
           <span class="text-gray-300">Input:</span>
           <span class="font-semibold text-emerald-400">$3.00</span>
          </div>
          <div class="flex justify-between items-center pt-2">
           <span class="text-gray-300">Output:</span>
           <span class="font-semibold text-emerald-400">$15.00</span>
          </div>
         </div>
        </div>
        <div class="text-sm text-gray-400">
         <svg xmlns="http://www.w3.org/2000/svg" class="inline-block h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
         </svg>
         Includes hidden tokens for combining answers and added costs for Perplexity searches
        </div>
       </div>
      </div>
     </div>
    </section>

    <!-- Status Section -->
    <section class="bg-gray-900 py-16 border-b border-gray-700">
     <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="p-8 bg-[#1e212e] rounded-xl border border-gray-700 transform transition-transform duration-300">
       <h2 class="text-3xl font-bold text-white mb-6 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 mr-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
         <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        API Status
       </h2>
       <div class="space-y-4 text-gray-300">
        <p>
         Pay as you go billing is currently being addded through <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" class="text-emerald-400 hover:text-emerald-300 font-medium underline">OpenRouter</a>.
        </p>
        <p>
         For enterprise API access outside of OpenRouter, please contact us at <a href="mailto:api@polychat.co" class="text-emerald-400 hover:text-emerald-300 font-medium underline">api@polychat.co</a>.
        </p>
       </div>
      </div>
     </div>
    </section>

    <!-- Standard Account API Section -->
    <section class="bg-[#161922] py-16 border-b border-gray-800">
     <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="p-8 bg-gradient-to-br from-[#1a1f2c] to-[#161922] rounded-xl border border-blue-500/40 transform transition-transform duration-300">
       <h2 class="text-3xl font-bold text-white mb-6 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 mr-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
         <path stroke-linecap="round" stroke-linejoin="round" d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        Standard Account API Access
       </h2>
       <div class="space-y-4 text-gray-300">
        <p>
         Standard PolyChat accounts have access to an OpenAI-compatible API at these endpoints:
        </p>
        <ul class="space-y-2 list-disc pl-5">
         <li>
          <b>Models</b><br><code class="bg-gray-900/80 px-2 py-1 rounded text-emerald-300">https://polychat.co/api/models</code>
         </li>
         <li>
          <b>Completions</b><br><code class="bg-gray-900/80 px-2 py-1 rounded text-emerald-300">https://polychat.co/api/chat/completions</code>
         </li>
        </ul>
        <p>
         Your API key can be found in <code class="bg-gray-900/80 px-2 py-1 rounded text-emerald-300">Settings > Account > API keys</code>
        </p>
        <p>
         For more details, please refer to <a href="https://docs.openwebui.com/getting-started/api-endpoints/" target="_blank" rel="noopener noreferrer" class="text-emerald-400 hover:text-emerald-300 font-medium underline">this documentation</a>.
        </p>
       </div>
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
        Refunds
       </a>
      </div>
     </div>
    </footer>
   </main>
  </div>
</div> 