<script lang="ts">
    import { getContext, onMount, tick, afterUpdate } from 'svelte';
    const i18n = getContext('i18n');
    
    // Multiple methods to try to remove splash screen
    onMount(async () => {
        // Set body attribute for styling
        document.body.setAttribute('data-pathname', '/chatgpt-alternative');
        
        // Mark page as loaded
        if (typeof window !== 'undefined') {
            window.loaded = true;
        }
        
        // Create a style element to override the global overflow styles
        const style = document.createElement('style');
        style.innerHTML = `
            html { overflow-y: auto !important; height: auto !important; position: relative !important; }
            body { overflow-y: auto !important; height: auto !important; position: relative !important; }
            #app { overflow-y: auto !important; height: auto !important; position: relative !important; }
            .overflow-fix { overflow: unset !important; }
        `;
        document.head.appendChild(style);
        
        // Also set inline styles as a fallback
        document.documentElement.style.cssText += 'overflow-y: auto !important; height: auto !important;';
        document.body.style.cssText += 'overflow-y: auto !important; height: auto !important;';
        
        // Try again after a tick
        await tick();
        
        // Setup custom video player controls
        setTimeout(() => {
            const video = document.getElementById('polychat-video') as HTMLVideoElement;
            const playButton = document.getElementById('custom-play-button');
            
            if (video && playButton) {
                // Handle play button clicks
                playButton.addEventListener('click', () => {
                    if (video.paused) {
                        // Start playing but keep muted by default
                        video.play();
                        playButton.style.opacity = '0';
                    } else {
                        video.pause();
                        playButton.style.opacity = '1';
                    }
                });
                
                // Add mute toggle button functionality
                const muteButton = document.getElementById('mute-toggle-button');
                if (muteButton) {
                    // Initial state
                    updateMuteButtonIcon();
                    
                    // Handle mute toggle
                    muteButton.addEventListener('click', () => {
                        video.muted = !video.muted;
                        updateMuteButtonIcon();
                    });
                    
                    // Function to update button icon based on mute state
                    function updateMuteButtonIcon() {
                        if (muteButton) {
                            if (video.muted) {
                                muteButton.innerHTML = `
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z" clip-rule="evenodd" />
                                        <path d="M12.707 2.293a1 1 0 011.414 0L16 4.172l1.879-1.879a1 1 0 111.414 1.414L17.414 5.586l1.879 1.879a1 1 0 01-1.414 1.414L16 7l-1.879 1.879a1 1 0 01-1.414-1.414l1.879-1.879-1.879-1.879a1 1 0 010-1.414z" />
                                    </svg>`;
                            } else {
                                muteButton.innerHTML = `
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clip-rule="evenodd" />
                                    </svg>`;
                            }
                        }
                    }
                }
                
                // Remove double-click event since we now have a dedicated mute button
                playButton.removeEventListener('dblclick', () => {
                    video.muted = !video.muted;
                });
                
                // Listen for native control events
                video.addEventListener('pause', () => {
                    playButton.style.opacity = '1';
                });
                
                video.addEventListener('play', () => {
                    playButton.style.opacity = '0';
                });
                
                video.addEventListener('ended', () => {
                    playButton.style.opacity = '1';
                });
                
                // No instructions text below video
            }
        }, 100);
    });
    
    // Try again after each update
    // afterUpdate(() => {
    //     document.getElementById('splash-screen')?.remove();
    // });
</script>

<svelte:head>
    
    <title>ChatGPT Alternative</title>
    <meta name="description" content="ChatGPT Alternative - All ChatGPT alternatives in one place with PolyChat." />
    <style>
        /* Force hide splash screen with CSS */
        /* #splash-screen {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            z-index: -9999 !important;
        } */
        
        /* Ensure content is visible */
        body > div {
            display: block !important;
        }
        
        /* Set dark theme */
        html, body {
            background-color: #0f1117;
            color: white;
            overflow-y: auto !important;
            height: auto !important;
            position: relative !important;
        }
        
        :global(html) {
            overflow-y: auto !important;
        }

				html {
						overflow-y: auto !important;
						height: auto !important;
						position: relative !important;
				}
				
				body {
						min-height: 100% !important;
				}
    </style>
    
    <!-- Script to run immediately when head is parsed -->
    <script>
        // Immediately remove splash screen
        // document.getElementById('splash-screen')?.remove();
        
        // Set loaded state to bypass layout waiting
        window.loaded = true;
        
        // Create a style element to override the global overflow styles
        const style = document.createElement('style');
        style.innerHTML = `
            html { overflow-y: auto !important; height: auto !important; position: relative !important; }
            body { overflow-y: auto !important; height: auto !important; position: relative !important; }
            #app { overflow-y: auto !important; height: auto !important; position: relative !important; }
            .overflow-fix { overflow: unset !important; }
        `;
        document.head.appendChild(style);
        
        // Also set inline styles as a fallback
        document.documentElement.style.overflow = 'auto !important';
        document.body.style.overflow = 'auto !important';
        document.documentElement.style.position = 'relative';
        document.body.style.position = 'relative';
        document.documentElement.style.height = 'auto';
        document.body.style.height = 'auto';
    </script>
</svelte:head>

<div class="w-full bg-[#0f1117] min-h-full overflow-y-auto overflow-fix" style="height: auto !important; overflow-y: auto !important; position: relative !important;">
    <!-- Header -->
    <header class="fixed top-0 left-0 right-0 z-10 bg-[#0f1117]/80 backdrop-blur">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div class="flex justify-between items-center">
                <div class="text-xl font-medium text-gray-300">
                    <span class="logo bg-gradient-to-r from-emerald-400 to-blue-500 text-transparent bg-clip-text"
                        style="font-family: 'Gill Sans', sans-serif;">
                        polychat
                    </span>
                </div>
                <div>
                    <a href="/auth" class="text-xl font-medium text-gray-300 hover:text-white transition-colors">
                        {$i18n.t('Login')}
                    </a>
                </div>
            </div>
        </div>
    </header>

    <main class="pt-16">
        <!-- Article Section (Blog) Moved to Top -->
        <section class="bg-[#0f1117] py-16 border-b border-gray-800">
            <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <h1 class="text-6xl font-semibold text-gray-100 mb-8 text-center">
                    ChatGPT Alternative
                </h1>
                
                <p class="text-lg text-gray-300 mb-6 p-4 bg-gradient-to-r from-blue-900/30 to-emerald-900/30 rounded-lg border border-emerald-500/20">
                    <span class="font-semibold text-emerald-400">Try the latest models for free today:</span> Get immediate access to GPT-4.5, Claude 3.5 Sonnet, Gemini 2.5 Pro, and other cutting-edge AI models with no credit card required. We combine the best AIs to give you more accurate and comprehensive responses than any single provider can deliver. Experience the most advanced AI capabilities without any commitment.
                </p>
                
                <div class="flex justify-center my-6">
                    <a href="/auth" class="w-full sm:w-auto group relative inline-flex justify-center px-8 py-4 text-lg bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-lg font-semibold transition-all duration-500 overflow-hidden shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.3)]">
                        <span class="relative z-10">Try now for free</span>
                        <div class="absolute inset-0 bg-gradient-to-r from-emerald-400/50 to-emerald-300/50 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-500 ease-out"></div>
                    </a>
                </div>
                
                <!-- Genies image added above video -->
                <div class="my-8 flex justify-center">
                    <div class="transform hover:scale-[1.01] transition-transform duration-300 w-full max-w-2xl mx-auto">
                        <img src="/static/polychat-genies2.webp" alt="AI Assistant Genies" class="w-full mx-auto rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.3)]" />
                    </div>
                </div>
                
                <!-- Moving video section higher -->
                <div class="my-10 flex justify-center flex-col">
                    <h3 class="text-2xl font-semibold text-white mb-4 text-center">Demo</h3>
                    <div class="transform hover:scale-[1.01] transition-transform duration-300 w-full max-w-5xl mx-auto">
                        <div class="rounded-xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.3)] bg-gray-800">
                            <div class="relative pt-[56.25%]">
                                <video
                                    id="polychat-video"
                                    src="https://storage.googleapis.com/polychat_public/polychat-home.mp4"
                                    poster="/static/polychat.co-frame.jpg"
                                    muted
                                    controls
                                    loop
                                    playsinline
                                    class="absolute top-0 left-0 w-full h-full"
                                ></video>
                                <div id="custom-play-button" class="absolute inset-0 flex items-center justify-center cursor-pointer group">
                                    <div class="w-20 h-20 rounded-full bg-emerald-500/80 group-hover:bg-emerald-400 flex items-center justify-center transition-all transform group-hover:scale-110 shadow-[0_0_30px_rgba(16,185,129,0.5)]">
                                        <div class="w-0 h-0 border-y-[15px] border-y-transparent border-l-[25px] border-l-white ml-2"></div>
                                    </div>
                                </div>
                                <div id="mute-toggle-button" class="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-emerald-500/80 hover:bg-emerald-400 flex items-center justify-center cursor-pointer transition-all shadow-lg">
                                    <div class="volume-icon">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                                            <path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clip-rule="evenodd" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <article class="prose prose-lg prose-invert max-w-none">
                    <p class="text-xl text-gray-300">
                        In the rapidly evolving AI landscape, finding the perfect ChatGPT alternative can be overwhelming. With dozens of models available, each with unique strengths and weaknesses, users often struggle to determine which AI assistant is best for their specific needs.
                    </p>
                    
                    <h3 class="text-2xl font-semibold text-white mt-8 mb-4">All ChatGPT Alternatives in One Place</h3>
                    <p class="text-lg text-gray-300">
                        PolyChat solves this problem by providing a unified platform where you can access all major ChatGPT alternatives without juggling multiple subscriptions or interfaces. From Claude and Gemini to Llama and DeepSeek, we've integrated the best AI models into one seamless experience.
                    </p>
                    
                    <div class="my-10 text-center">
                        <p class="text-lg text-gray-300 mb-4">See how these advanced AI models can transform your workflow</p>
                    </div>
                    
                    <h3 class="text-2xl font-semibold text-white mt-8 mb-4">Why Choose Multiple Models Over Just ChatGPT?</h3>
                    <p class="text-lg text-gray-300">
                        Different AI models excel at different tasks. Claude is known for thoughtful reasoning, following instructions, and coding assistance, Gemini for knowledge and multimodal capabilities, and specialized models like DeepSeek for other tasks. By having access to multiple models, you can:
                    </p>
                    <ul class="text-lg text-gray-300 list-disc ml-6 mb-6">
                        <li>Compare responses side-by-side to get the most accurate information</li>
                        <li>Choose specialized models for specific tasks like coding, creative writing, or data analysis</li>
                        <li>Avoid the limitations and knowledge cutoffs of any single model</li>
                        <li>Experience the latest AI advancements as soon as they're released</li>
                    </ul>
                    
                    <h3 class="text-2xl font-semibold text-white mt-8 mb-4">Beyond Alternative Models: A Better Experience</h3>
                    <p class="text-lg text-gray-300">
                        PolyChat isn't just about providing alternatives to ChatGPT—it's about creating a superior AI chat experience. Our platform offers:
                    </p>
                    <ul class="text-lg text-gray-300 list-disc ml-6 mb-6">
                        <li>Smart routing that automatically selects the best model for your specific question</li>
                        <li>No arbitrary rate limits that interrupt your workflow</li>
                        <li>Lower costs than subscribing to multiple AI services individually</li>
                        <li>Enterprise-grade security for your conversations</li>
                        <li>Seamless file uploads and document analysis across models</li>
                    </ul>
                    
                    <h3 class="text-2xl font-semibold text-white mt-8 mb-4">Start Using Better ChatGPT Alternatives Today</h3>
                    <p class="text-lg text-gray-300">
                        Whether you're a developer, writer, researcher, or business professional, having access to multiple AI models gives you an edge in productivity and creativity. PolyChat offers free access to get started, with affordable plans starting at just $5/month as your needs grow.
                    </p>
                    <p class="text-lg text-gray-300 mt-4">
                        Don't limit yourself to just one AI assistant. Experience the full spectrum of what modern AI can offer with PolyChat—the ultimate ChatGPT alternative hub.
                    </p>
                </article>
                
                <div class="mt-12 text-center">
                    <p class="text-xl text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400 font-medium mb-6">
                        Try the latest AI models completely free - no credit card required
                    </p>
                    <div class="flex justify-center">
                        <a href="/auth" class="w-full sm:w-auto group relative inline-flex justify-center px-8 py-4 text-lg bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-lg font-semibold transition-all duration-500 overflow-hidden shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.3)]">
                            <span class="relative z-10">Try now for free</span>
                            <div class="absolute inset-0 bg-gradient-to-r from-emerald-400/50 to-emerald-300/50 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-500 ease-out"></div>
                        </a>
                    </div>
                </div>
            </div>
        </section>

        <!-- Features Section -->
        <section class="bg-[#161922] py-16 border-b border-gray-800">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <h2 class="text-3xl font-semibold text-white mb-12 text-center">Top ChatGPT Alternatives Available</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    <!-- Gemini card -->
                    <div class="p-8 bg-[#161922] rounded-xl transform hover:scale-105 transition-transform duration-300 border border-blue-500/20">
                        <h3 class="text-2xl font-semibold text-white mb-4">Gemini 2.5 Pro</h3>
                        <p class="text-lg text-gray-300 mb-4">
                            Google's latest multimodal AI with extensive knowledge and advanced reasoning capabilities.
                        </p>
                        <p class="text-base text-emerald-400">
                            Free to try on PolyChat
                        </p>
                    </div>

                    <!-- Claude card -->
                    <div class="p-8 bg-[#161922] rounded-xl transform hover:scale-105 transition-transform duration-300 border border-indigo-500/20">
                        <h3 class="text-2xl font-semibold text-white mb-4">Claude 3.5 Sonnet</h3>
                        <p class="text-lg text-gray-300 mb-4">
                            Anthropic's latest Claude model excels at thoughtful reasoning, instruction following, and safety.
                        </p>
                        <p class="text-base text-emerald-400">
                            Free to try on PolyChat
                        </p>
                    </div>

                    <!-- GPT-4 card -->
                    <div class="p-8 bg-[#161922] rounded-xl transform hover:scale-105 transition-transform duration-300 border border-emerald-500/20">
                        <h3 class="text-2xl font-semibold text-white mb-4">GPT-4.5</h3>
                        <p class="text-lg text-gray-300 mb-4">
                            OpenAI's latest flagship model with enhanced capabilities and superior reasoning.
                        </p>
                        <p class="text-base text-emerald-400">
                            Free to try on PolyChat
                        </p>
                    </div>

                    <!-- Llama card -->
                    <div class="p-8 bg-[#161922] rounded-xl transform hover:scale-105 transition-transform duration-300 border border-purple-500/20">
                        <h3 class="text-2xl font-semibold text-white mb-4">Llama</h3>
                        <p class="text-lg text-gray-300 mb-4">
                            Meta's powerful open-source model with multiple specialized versions.
                        </p>
                        <p class="text-base text-emerald-400">
                            Available on all PolyChat plans
                        </p>
                    </div>
                </div>
            </div>
        </section>

        <!-- CTA Section -->
        <section class="bg-[#0f1117] py-16">
            <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <h2 class="text-3xl font-semibold text-white mb-6">Ready to explore ChatGPT alternatives?</h2>
                <p class="text-xl text-gray-300 mb-8">
                    Try PolyChat today and access all major AI models in one place. No credit card required.
                </p>
                <div class="flex justify-center">
                    <a href="/auth"
                        class="inline-flex px-8 py-4 text-lg bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-lg font-semibold transition-all duration-300 shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.3)]">
                        Try for Free
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