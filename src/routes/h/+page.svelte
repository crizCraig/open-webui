<script lang="ts">
    import { getContext } from 'svelte';
    const i18n = getContext('i18n');
</script>

<div class="h-screen overflow-auto">
<div class="w-full bg-[#0f1117]">
    <!-- Header -->
    <header class="fixed top-0 left-0 right-0 z-10 bg-[#0f1117]/80 backdrop-blur">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div class="flex justify-end space-x-6">
                <a href="/pricing" class="text-xl font-medium text-gray-300 hover:text-white transition-colors">
                    Pricing
                </a>
                <a href="/auth" class="text-xl font-medium text-gray-300 hover:text-white transition-colors">
                    {$i18n.t('Login')}
                </a>
            </div>
        </div>
    </header>

    <main class="pt-16">
    <!-- Hero Section -->
    <section class="relative overflow-hidden border-b border-gray-800">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div class="max-w-3xl">
                <h1 class="logo text-8xl font-light bg-gradient-to-r from-emerald-400 to-blue-500 text-transparent bg-clip-text mb-12" style="font-family: 'Gill Sans', sans-serif;">
                    polychat
                </h1>
                <div class="space-y-6">
                    <h2 class="text-6xl font-semibold text-gray-100">
                        Chat with <span class="bg-gradient-to-r from-emerald-100/80 to-blue-200/80 text-transparent bg-clip-text">multiple</span> LLMs
                    </h2>
                    <div class="space-y-4">
                        <p class="text-3xl text-gray-300">
                            Free to try, No rate limits
                        </p>
                        <p class="text-2xl text-gray-400">
                            OpenAI, Anthropic, Perplexity, Google, DeepSeek, Llama, and more
                        </p>
                    </div>
                    <p class="text-xl text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400 font-medium">
                        Plans start at just $5/mo
                    </p>
                    <div>
                        <div class="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                            <a href="/auth" class="w-full sm:w-auto group relative inline-flex justify-center px-8 py-4 text-lg bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-lg font-semibold transition-all duration-500 overflow-hidden shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.3)]">
                                <span class="relative z-10">Try for Free</span>
                                <div class="absolute inset-0 bg-gradient-to-r from-emerald-400/50 to-emerald-300/50 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-500 ease-out"></div>
                            </a>
                            <a href="/pricing" class="w-full sm:w-auto group relative inline-flex justify-center px-8 py-4 text-lg bg-[#161922] hover:bg-[#1e2230] text-white rounded-lg font-semibold transition-all duration-300 border border-gray-700">
                                <span class="relative z-10">View Pricing</span>
                            </a>
                            <a href="/auth" class="w-full sm:w-auto group relative inline-flex justify-center px-8 py-4 text-lg bg-[#161922] hover:bg-[#1e2230] text-white rounded-lg font-semibold transition-all duration-300 border border-gray-700">
                                <span class="relative z-10">Login</span>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Video Section -->
    <section class="bg-[#161922] py-16 border-b border-gray-800">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="transform hover:scale-[1.01] transition-transform duration-300">
                <div class="rounded-xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.3)] bg-gray-800">
                    <div class="relative pt-[56.25%]">
                        <iframe
                            src="https://www.youtube.com/embed/pPKNlcX1Dy8"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowfullscreen
                            class="absolute top-0 left-0 w-full h-full"
                        ></iframe>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Features Section -->
    <section class="bg-[#0f1117] py-24 border-b border-gray-800">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <!-- Multiple LLMs card -->
                <div class="p-8 bg-[#161922] rounded-xl transform hover:scale-105 transition-transform duration-300">
                    <svg class="w-16 h-16 text-emerald-400 mb-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        <path d="M14 8.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0z"></path>
                        <path d="M14 15.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0z"></path>
                    </svg>
                    <h3 class="text-2xl font-semibold text-white mb-2">Multiple LLMs</h3>
                    <p class="text-lg text-gray-300">
                        Access all frontier models in one interface
                    </p>
                </div>

                <!-- Smart Routing card -->
                <div class="p-8 bg-gradient-to-br from-[#1a1f2c] to-[#161922] rounded-xl transform hover:scale-105 transition-transform duration-300 border border-emerald-500/20">
                    <svg class="w-16 h-16 text-emerald-400 mb-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                        <path d="M12 18l4-4-4-4"/>
                        <path d="M8 14l4-4"/>
                    </svg>
                    <h3 class="text-2xl font-semibold text-white mb-2">Smart Routing</h3>
                    <p class="text-lg text-gray-300">
                        Automatically route to the best model for your question
                    </p>
                </div>

                <!-- AI Comparison card -->
                <div class="p-8 bg-[#161922] rounded-xl transform hover:scale-105 transition-transform duration-300">
                    <svg class="w-16 h-16 text-blue-400 mb-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    <h3 class="text-2xl font-semibold text-white mb-2">AI Comparison</h3>
                    <p class="text-lg text-gray-300">
                        Compare responses from different models side by side
                    </p>
                </div>

                <!-- Security card -->
                <div class="p-8 bg-[#161922] rounded-xl transform hover:scale-105 transition-transform duration-300">
                    <svg class="w-16 h-16 text-blue-400 mb-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        <circle cx="12" cy="16" r="1"></circle>
                    </svg>
                    <h3 class="text-2xl font-semibold text-white mb-2">Secure</h3>
                    <p class="text-lg text-gray-300">
                        Enterprise-grade security for your conversations
                    </p>
                </div>
            </div>
        </div>
    </section>

    <!-- Moved Open WebUI to bottom -->
    <section class="bg-[#161922] py-24 border-b border-gray-800">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p class="text-xl text-gray-400">
                Built on the powerful
                <a href="https://github.com/open-webui/open-webui" class="text-emerald-400 hover:text-emerald-300 transition-colors" target="_blank" rel="noopener noreferrer">
                    Open WebUI
                </a>
                framework
            </p>
        </div>
    </section>

    <!-- Footer -->
    <footer class="bg-[#0f1117] py-8">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-center space-x-6 text-gray-400">
                <a href="mailto:support@polychat.com" class="text-lg hover:text-gray-300 transition-colors">
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