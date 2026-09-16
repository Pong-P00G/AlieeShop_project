<script setup>
import { ref, watch } from 'vue'
import { useRouter, RouterView } from 'vue-router'
import ToastContainer from './components/ToastContainer.vue'
import CookieConsent from './components/CookieConsent.vue'
import BackToTop from './components/BackToTop.vue'
import SearchOverlay from './components/SearchOverlay.vue'
import { useAuthStore } from './stores/auth.js'
import { useUIStore } from './stores/ui.js'

const router = useRouter()
const authStore = useAuthStore()
const ui = useUIStore()

// ── Direction-aware page transitions ──────────────────────────────
// Track navigation direction so the page transition animation
// slides left (forward) or right (backward) naturally.
const transitionDirection = ref('forward');

// Define route hierarchy depth for auto-direction detection
// Deeper pages (product detail, checkout) slide in from the right
// Shallower pages (home, product listing) slide in from the left
const ROUTE_DEPTH_MAP = {
    home: 0,
    about: 1,
    contact: 1,
    Product: 1,
    ProductDetail: 2,
    checkout: 2,
    payment: 3,
    orderSucces: 4,
    wishlist: 1,
    userprofile: 1,
    userNotifications: 1,
    login: 1,
    register: 1,
    forgotPassword: 1,
    giftCards: 1,
    trackOrder: 1,
    returns: 1,
    shipping: 1,
    faq: 1,
    careers: 1,
    press: 1,
    blog: 1,
    blogPost: 2,
    privacy: 1,
    terms: 1,
    compare: 1,
    sitemap: 1,
};

router.beforeEach((to, from, next) => {
    if (from.name && to.name) {
        const fromDepth = ROUTE_DEPTH_MAP[from.name] ?? 1;
        const toDepth = ROUTE_DEPTH_MAP[to.name] ?? 1;
        if (toDepth > fromDepth) {
            transitionDirection.value = 'forward';
        } else if (toDepth < fromDepth) {
            transitionDirection.value = 'backward';
        } else {
            transitionDirection.value = to.path.length >= from.path.length ? 'forward' : 'backward';
        }
    } else {
        transitionDirection.value = 'forward';
    }
    next();
});

// ── Re-evaluate route after auth init completes ────────────────────────
watch(() => authStore.initialized, (val) => {
    if (val) {
        router.replace(router.currentRoute.value.fullPath);
    }
});
</script>

<template>
    <div class="min-h-screen font-sans antialiased">
        <!-- ── Auth Loading Overlay ──────────────────────────── -->
        <Transition name="auth-loading">
            <div v-if="!authStore.initialized"
                class="fixed inset-0 z-100 flex flex-col items-center justify-center bg-white">
                <div class="flex flex-col items-center gap-6">
                    <!-- Logo -->
                    <div class="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center">
                        <svg class="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                                d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <!-- Spinner -->
                    <div class="relative w-10 h-10">
                        <div class="absolute inset-0 border-4 border-zinc-100 rounded-full"></div>
                        <div class="absolute inset-0 border-4 border-transparent border-t-zinc-900 rounded-full animate-spin"></div>
                    </div>
                    <p class="text-sm font-medium text-zinc-500">Loading your experience...</p>
                </div>
            </div>
        </Transition>

        <!-- ── Main App ─────────────────────────────────────── -->
        <div v-if="authStore.initialized">
            <RouterView v-slot="{ Component, route }">
                <Transition 
                    :name="'page-' + transitionDirection" 
                    mode="out-in"
                >
                    <component :is="Component" :key="route.path" />
                </Transition>
            </RouterView>
            
            <!-- Global Components -->
            <CookieConsent />
            <BackToTop />
            <SearchOverlay :show="ui.searchOpen" @close="ui.closeSearch()" />
            <ToastContainer />
        </div>
    </div>
</template>

<style scoped>
.auth-loading-leave-active {
    transition: opacity 0.4s ease, backdrop-filter 0.4s ease;
}
.auth-loading-leave-to {
    opacity: 0;
    backdrop-filter: blur(0px);
}
</style>