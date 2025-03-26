<script>
    import { WEBUI_NAME } from '$lib/stores';
    import { getContext } from 'svelte';
    const i18n = getContext('i18n');
</script>

<svelte:head>
    <title>
        {$i18n.t('Refund & Dispute Policy')} | {$WEBUI_NAME}
    </title>
</svelte:head>

<div class="w-full h-screen overflow-auto bg-white dark:bg-gray-900">
    <div class="container mx-auto py-8 px-4">
        <div class="max-w-3xl mx-auto">
            <div class="text-gray-700 dark:text-gray-100">
                <div class="text-3xl font-semibold">
                    {$i18n.t('Refund & Dispute Policy')}
                </div>

                <hr class="dark:border-gray-800 mt-6 mb-6" />

                <div class="space-y-4 text-sm">
                    <p>
                        {$i18n.t('Last updated: April 15, 2024')}
                    </p>

                    <h2 class="text-xl font-semibold mt-4">
                        {$i18n.t('1. Refund Policy')}
                    </h2>
                    <p>
                        {$i18n.t('We strive to provide the best possible service to our customers. If you are not satisfied with your purchase, you may be eligible for a refund under the following conditions:')}
                    </p>

                    <h2 class="text-xl font-semibold mt-4">
                        {$i18n.t('2. Eligibility for Refunds')}
                    </h2>
                    <ul class="list-disc pl-5 space-y-2">
                        <li>{$i18n.t('Technical issues preventing service access')}</li>
                        <li>{$i18n.t('Service unavailability exceeding 24 hours')}</li>
                        <li>{$i18n.t('Billing errors or duplicate charges')}</li>
                    </ul>

                    <h2 class="text-xl font-semibold mt-4">
                        {$i18n.t('3. Dispute Resolution')}
                    </h2>
                    <p>
                        {$i18n.t('If you have any concerns or disputes regarding our services, please contact our support team at refunds@polychat.co. We aim to resolve all disputes within 5 business days.')}
                    </p>

                    <h2 class="text-xl font-semibold mt-4">
                        {$i18n.t('4. Refund Process')}
                    </h2>
                    <p>
                        {$i18n.t('Refunds will be processed using the original payment method. Processing time may vary depending on your payment provider, typically taking 5-10 business days.')}
                    </p>
                </div>
            </div>
        </div>
    </div>
</div> 