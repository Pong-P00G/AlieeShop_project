<script setup>
import { useRouter, RouterLink } from 'vue-router';
import { Home, ArrowLeft, AlertCircle, Search } from 'lucide-vue-next';

const router = useRouter();

const goBack = () => {
    if (window.history.length > 1) {
        router.back();
    } else {
        router.push('/');
    }
};

const quickLinks = [
    { label: 'Shop Products', to: '/product' },
    { label: 'Our Journal', to: '/blog' },
    { label: 'Contact Us', to: '/contact' },
    { label: 'FAQ', to: '/faq' },
];
</script>

<template>
    <div class="min-h-screen bg-paper relative flex items-center justify-center px-4 py-12">
        <!-- Decorative background -->
        <div class="absolute inset-0 bg-[radial-gradient(var(--color-neutral-200)_1px,transparent_1px)] bg-size-[18px_18px]"></div>

        <div class="relative w-full max-w-lg text-center">
            <!-- 404 image area -->
            <div class="mb-8">
                <div class="relative inline-block">
                    <span class="text-[120px] sm:text-[160px] font-elegant font-bold leading-none text-ink">
                        4<span class="text-accent">0</span>4
                    </span>
                    <div class="absolute -top-4 -right-4 w-8 h-8 rounded-full bg-accent/20 animate-pulse"></div>
                </div>
            </div>

            <!-- Content -->
            <span class="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-accent mb-3">
                <AlertCircle class="w-4 h-4" />
                Page not found
            </span>

            <h1 class="text-3xl sm:text-4xl font-elegant font-bold text-ink mb-3">
                Looks like you've wandered off
            </h1>

            <p class="text-neutral-500 text-sm max-w-sm mx-auto mb-8">
                The page you're looking for doesn't exist or has been moved.
                Let's get you back on track.
            </p>

            <!-- Quick links -->
            <div class="card-flat p-6 mb-6">
                <p class="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400 mb-3">Quick links</p>
                <div class="grid grid-cols-2 gap-2">
                    <RouterLink v-for="link in quickLinks" :key="link.to" :to="link.to"
                        class="px-4 py-2.5 bg-neutral-50 hover:bg-neutral-100 rounded-xl text-sm font-medium text-ink transition-colors text-center">
                        {{ link.label }}
                    </RouterLink>
                </div>
            </div>

            <!-- Actions -->
            <div class="flex flex-col sm:flex-row gap-3 justify-center">
                <RouterLink to="/"
                    class="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-ink text-paper font-bold text-sm rounded-full hover:bg-neutral-800 transition-all hover:-translate-y-0.5">
                    <Home class="w-4 h-4" />
                    Go Home
                </RouterLink>
                <button type="button" @click="goBack"
                    class="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-paper border border-neutral-300 text-ink font-bold text-sm rounded-full hover:border-ink hover:bg-ink hover:text-paper transition-all">
                    <ArrowLeft class="w-4 h-4" />
                    Go Back
                </button>
            </div>

            <!-- Search suggestion -->
            <div class="mt-8 inline-flex items-center gap-2 text-xs text-neutral-400">
                <Search class="w-3.5 h-3.5" />
                Try searching for what you need
            </div>
        </div>
    </div>
</template>

<style scoped>
.bg-size-\[18px_18px\] {
    background-size: 18px 18px;
}
</style>
