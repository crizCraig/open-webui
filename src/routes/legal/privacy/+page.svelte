<script>
    import { WEBUI_NAME } from '$lib/stores';
    import { getContext } from 'svelte';
    const i18n = getContext('i18n');
</script>

<svelte:head>
    <title>
        {$i18n.t('Privacy Policy')} | {$WEBUI_NAME}
    </title>
</svelte:head>

<div class="w-full h-screen overflow-auto bg-white dark:bg-gray-900">
    <div class="container mx-auto py-8 px-4">
        <div class="max-w-3xl mx-auto">
            <div class="text-gray-700 dark:text-gray-100">
                <div class="text-3xl font-semibold">
                    {$i18n.t('Privacy Policy')}
                </div>

                <hr class="dark:border-gray-800 mt-6 mb-6" />

                <div class="space-y-4 text-sm">
                    <p class="font-medium">
                        {$i18n.t('Last Updated: February 17, 2025')}
                    </p>
                    
                    <p>
                        {$i18n.t('PolyChat ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your personal information when you use our services.')}
                    </p>

                    <h2 class="text-xl font-semibold mt-4">
                        {$i18n.t('1. Information We Do Not Share')}
                    </h2>
                    <ul class="list-disc pl-5 space-y-2">
                        <li>{$i18n.t('We do not send your email, IP address, or any other metadata beyond prompts with model providers.')}</li>
                    </ul>

                    <h2 class="text-xl font-semibold mt-4">
                        {$i18n.t('2. Information We Share')}
                    </h2>
                    <ul class="list-disc pl-5 space-y-2">
                        <li>{$i18n.t('We assign a random user ID to interactions with model providers to assist in identifying our users in case of abuse.')}</li>
                    </ul>

                    <h2 class="text-xl font-semibold mt-4">
                        {$i18n.t('3. Cookies We Use')}
                    </h2>
                    <ul class="list-disc pl-5 space-y-2">
                        <li>{$i18n.t('We store two cookies:')}
                            <ul class="list-disc pl-5 mt-2">
                                <li>"token"</li>
                                <li>"oauth_id_token"</li>
                            </ul>
                        </li>
                        <li>{$i18n.t('These cookies are used strictly for authentication and authorization.')}</li>
                        <li>{$i18n.t('We do not track you across other websites or share your information with third parties for tracking purposes.')}</li>
                    </ul>

                    <h2 class="text-xl font-semibold mt-4">
                        {$i18n.t('4. Payment Information')}
                    </h2>
                    <ul class="list-disc pl-5 space-y-2">
                        <li>{$i18n.t('When you make payments via credit card, we use Stripe as our third-party payment processor.')}</li>
                        <li>{$i18n.t('We do not see or store your credit card details. However, Stripe collects and stores certain personal information for processing transactions.')}</li>
                        <li>{$i18n.t("Stripe's privacy policy and data retention practices apply to your payment data.")}</li>
                        <li>
                            {$i18n.t('To request deletion of your personal information, you must contact Stripe directly via their ')}
                            <a href="https://stripe.com/privacy" class="text-yellow-600 hover:underline" target="_blank" rel="noopener noreferrer">
                                {$i18n.t('data deletion request page')}
                            </a>.
                        </li>
                    </ul>

                    <h2 class="text-xl font-semibold mt-4">
                        {$i18n.t('5. User Input & Generated Content')}
                    </h2>
                    <ul class="list-disc pl-5 space-y-2">
                        <li>{$i18n.t('Any content you input, upload, or submit to PolyChat, including questions, prompts, and generated output, may contain personal information.')}</li>
                        <li>{$i18n.t('We process this data as necessary to fulfill our contract with you—to generate and deliver content.')}</li>
                        <li>{$i18n.t('Depending on the model chosen, this content is shared with the respsective model provider(s) (such as OpenAI, Anthropic, etc.) and is subject to their respective privacy policies and data handling procedures.')}</li>
                    </ul>

                    <h2 class="text-xl font-semibold mt-4">
                        {$i18n.t('6. Security Measures')}
                    </h2>
                    <ul class="list-disc pl-5 space-y-2">
                        <li>{$i18n.t("All of our services are secured behind Google's load balancers and use Google authentication and authorization.")}</li>
                        <li>{$i18n.t('There are no open ports or unsecured communications to or from our services on Google Cloud.')}</li>
                        <li>
                            {$i18n.t('We follow security best practices related to:')}
                            <ul class="list-disc pl-5 mt-2">
                                <li>{$i18n.t('Password hashing (using industry standards)')}</li>
                                <li>{$i18n.t('Cross-Site Request Forgery (XSRF) protection')}</li>
                                <li>{$i18n.t('Cross-Origin Resource Sharing (CORS) controls')}</li>
                                <li>{$i18n.t('SQL injection prevention')}</li>
                                <li>{$i18n.t('Other common web security attack vectors')}</li>
                            </ul>
                        </li>
                        <li>{$i18n.t('We consult OWASP security guidelines, use automated code scanning tools, and work with tenured security engineers to ensure our infrastructure and application security.')}</li>
                    </ul>

                    <h2 class="text-xl font-semibold mt-4">
                        {$i18n.t('7. Contact Us')}
                    </h2>
                    <p>
                        {$i18n.t('If you have any privacy-related questions or requests, please contact our support team at:')}
                    </p>
                    <p class="mt-4 font-medium">
                        📧 <a href="mailto:support@polychat.com" class="text-yellow-600 hover:underline">support@polychat.com</a>
                    </p>
                    <p class="mt-4">
                        {$i18n.t('We are committed to keeping your data secure and respecting your privacy.')}
                    </p>
                </div>
            </div>
        </div>
    </div>
</div> 