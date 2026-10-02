<script setup>
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import {
    Mail,
    Phone,
    MapPin,
    Facebook,
    Instagram,
    Twitter,
    Youtube,
    ArrowUp,
    Send,
    ShieldCheck,
    Truck,
    RotateCcw,
    CreditCard,
    Sparkles,
    Loader2,
    AlertCircle,
    CheckCircle
} from 'lucide-vue-next';
import { subscribeNewsletter } from '../api/api.js';

const currentYear = new Date().getFullYear();
const email = ref('');
const subscribed = ref(false);
const subscribing = ref(false);
const subscribeError = ref('');

const submitNewsletter = async () => {
    if (!email.value || !email.value.includes('@')) return;

    subscribing.value = true;
    subscribeError.value = '';

    try {
        const result = await subscribeNewsletter(email.value);
        subscribed.value = true;
        email.value = '';
        setTimeout(() => {
            subscribed.value = false;
        }, 4000);
    } catch (err) {
        const msg = err.response?.data?.message || 'Something went wrong. Please try again.';
        subscribeError.value = msg;
        setTimeout(() => {
            subscribeError.value = '';
        }, 4000);
    } finally {
        subscribing.value = false;
    }
};

const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

const footerLinks = {
    shop: [
        { name: 'New Arrivals', to: '/product?filter=new' },
        { name: 'Best Sellers', to: '/product?filter=bestsellers' },
        { name: 'Gift Cards', to: '/gift-cards' },
        { name: 'Compare Products', to: '/compare' },
    ],
    help: [
        { name: 'Track Order', to: '/track-order' },
        { name: 'Returns & Exchanges', to: '/returns' },
        { name: 'Shipping Info', to: '/shipping' },
        { name: 'FAQ', to: '/faq' },
    ],
    company: [
        { name: 'About Us', to: '/about' },
        { name: 'Contact', to: '/contact' },
        { name: 'Our Journal', to: '/blog' },
        { name: 'Careers', to: '/careers' },
        { name: 'Press', to: '/press' },
        { name: 'Sitemap', to: '/sitemap' },
    ],
};

const socialLinks = [
    { icon: Instagram, href: 'https://instagram.com', label: 'Instagram' },
    { icon: Facebook, href: 'https://facebook.com', label: 'Facebook' },
    { icon: Twitter, href: 'https://twitter.com', label: 'Twitter' },
    { icon: Youtube, href: 'https://youtube.com', label: 'YouTube' },
];

const perks = [
    { icon: Truck, title: 'Free shipping', desc: 'On orders over $50' },
    { icon: RotateCcw, title: '7-day returns', desc: 'Hassle-free refunds' },
    { icon: ShieldCheck, title: 'Secure checkout', desc: '256-bit SSL encryption' },
    { icon: CreditCard, title: 'Flexible payment', desc: 'Cards, wallets, installments' },
];

const contact = [
    { icon: MapPin, label: 'Address', value: '123 Commerce St, Phnom Penh, Cambodia', href: null },
    { icon: Phone, label: 'Phone', value: '+1 (234) 567-890', href: 'tel:+1234567890' },
    { icon: Mail, label: 'Email', value: 'support@aleeshop.com', href: 'mailto:support@aleeshop.com' },
];
</script>

<template>
    <footer class="bg-ink text-paper mt-auto">
        <!-- ── Perks strip ─────────────────────────────────────────────── -->
        <div class="border-b border-neutral-800">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
                <ul class="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-6 sm:gap-x-6">
                    <li
                        v-for="perk in perks"
                        :key="perk.title"
                        class="flex items-start gap-3 group min-w-0"
                    >
                        <div class="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-neutral-900 group-hover:bg-accent transition-colors duration-300 flex items-center justify-center shrink-0">
                            <component :is="perk.icon" class="w-5 h-5 text-accent group-hover:text-white transition-colors duration-300" />
                        </div>
                        <div class="min-w-0">
                            <p class="text-sm font-bold text-paper leading-tight">{{ perk.title }}</p>
                            <p class="text-xs text-neutral-400 mt-0.5">{{ perk.desc }}</p>
                        </div>
                    </li>
                </ul>
            </div>
        </div>

        <!-- ── Main footer ─────────────────────────────────────────────── -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 sm:pt-20 pb-10">
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 mb-12 lg:mb-16">
                <!-- Brand + newsletter -->
                <div class="lg:col-span-5 space-y-7">
                    <RouterLink to="/" class="inline-flex items-center gap-2 group" aria-label="ALIESHOP home">
                        <span class="text-3xl font-elegant text-paper">
                            <span class="font-light">ALIE</span><span class="font-bold">SHOP</span>
                        </span>
                        <span class="w-2 h-2 bg-accent rounded-full pulse-dot"></span>
                    </RouterLink>

                    <p class="text-neutral-400 text-base font-light leading-relaxed max-w-md">
                        Curating a world of exceptional products for your modern lifestyle.
                        Quality, sustainability, and design — in every detail.
                    </p>

                    <!-- Newsletter -->
                    <div class="space-y-3">
                        <div class="flex items-center gap-2">
                            <Sparkles class="w-4 h-4 text-accent shrink-0" />
                            <p class="text-xs font-bold uppercase tracking-[0.2em] text-paper">
                                Get 15% off your first order
                            </p>
                        </div>
                        <form @submit.prevent="submitNewsletter" class="flex gap-2 w-full max-w-md">
                            <div class="relative flex-1 min-w-0">
                                <Mail class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                                <input
                                    v-model="email"
                                    type="email"
                                    required
                                    id="footer-email"
                                    name="email"
                                    aria-label="Email address for newsletter"
                                    placeholder="Enter your email"
                                    class="w-full pl-11 pr-4 py-3 bg-neutral-900 border border-neutral-800 rounded-full text-sm text-paper placeholder:text-neutral-500 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                                />
                            </div>
                            <button
                                type="submit"
                                :disabled="subscribing"
                                aria-label="Subscribe to newsletter"
                                class="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-3 bg-accent hover:bg-accent-600 text-white font-bold text-sm rounded-full transition-all duration-300 shadow-[0_8px_24px_-6px_rgb(249_115_22_/0.45)] hover:shadow-[0_12px_28px_-6px_rgb(249_115_22_/0.55)] hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 shrink-0"
                            >
                                <component :is="subscribing ? Loader2 : Send" class="w-4 h-4" :class="{ 'animate-spin': subscribing }" />
                                <span class="hidden sm:inline">{{ subscribing ? 'Sending...' : 'Subscribe' }}</span>
                            </button>
                        </form>

                        <!-- Feedback -->
                        <transition name="slide-fade">
                            <p v-if="subscribed" class="text-xs text-accent-300 font-medium flex items-center gap-1.5">
                                <CheckCircle class="w-3.5 h-3.5 text-accent-400 shrink-0" />
                                Thanks for subscribing! Check your inbox.
                            </p>
                        </transition>
                        <transition name="slide-fade">
                            <p v-if="subscribeError" role="alert" class="text-xs text-red-400 font-medium flex items-center gap-1.5">
                                <AlertCircle class="w-3.5 h-3.5 text-red-400 shrink-0" />
                                {{ subscribeError }}
                            </p>
                        </transition>
                        <p class="text-xs text-neutral-500">
                            By subscribing you agree to our privacy policy. Unsubscribe anytime.
                        </p>
                    </div>

                    <!-- Social -->
                    <div class="flex items-center gap-3 flex-wrap">
                        <span class="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500 mr-1">Follow</span>
                        <a
                            v-for="social in socialLinks"
                            :key="social.label"
                            :href="social.href"
                            target="_blank"
                            rel="noopener noreferrer"
                            :aria-label="social.label"
                            class="w-10 h-10 rounded-full border border-neutral-800 flex items-center justify-center text-neutral-400 transition-all duration-300 hover:border-accent hover:bg-accent hover:text-white hover:-translate-y-0.5"
                        >
                            <component :is="social.icon" class="w-4 h-4" />
                        </a>
                    </div>
                </div>

                <!-- Link + contact columns -->
                <nav class="lg:col-span-7" aria-label="Footer navigation">
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-8 sm:gap-6 lg:gap-10">
                        <!-- Shop -->
                        <div class="min-w-0">
                            <h3 class="text-xs font-bold uppercase tracking-[0.2em] text-paper mb-5">Shop</h3>
                            <ul class="space-y-3">
                                <li v-for="link in footerLinks.shop" :key="link.name">
                                    <RouterLink
                                        :to="link.to"
                                        class="text-sm text-neutral-400 hover:text-accent transition-colors font-medium inline-flex items-center gap-1.5 group"
                                    >
                                        <span class="w-1 h-1 bg-neutral-700 group-hover:bg-accent rounded-full transition-colors shrink-0"></span>
                                        {{ link.name }}
                                    </RouterLink>
                                </li>
                            </ul>
                        </div>

                        <!-- Help -->
                        <div class="min-w-0">
                            <h3 class="text-xs font-bold uppercase tracking-[0.2em] text-paper mb-5">Help</h3>
                            <ul class="space-y-3">
                                <li v-for="link in footerLinks.help" :key="link.name">
                                    <RouterLink
                                        :to="link.to"
                                        class="text-sm text-neutral-400 hover:text-accent transition-colors font-medium inline-flex items-center gap-1.5 group"
                                    >
                                        <span class="w-1 h-1 bg-neutral-700 group-hover:bg-accent rounded-full transition-colors shrink-0"></span>
                                        {{ link.name }}
                                    </RouterLink>
                                </li>
                            </ul>
                        </div>

                        <!-- Contact -->
                        <div class="col-span-2 sm:col-span-1 min-w-0">
                            <h3 class="text-xs font-bold uppercase tracking-[0.2em] text-paper mb-5">Contact</h3>
                            <ul class="space-y-4">
                                <li v-for="item in contact" :key="item.label" class="flex gap-3">
                                    <div class="w-9 h-9 rounded-lg bg-neutral-900 flex items-center justify-center shrink-0">
                                        <component :is="item.icon" class="w-4 h-4 text-accent" />
                                    </div>
                                    <component
                                        :is="item.href ? 'a' : 'p'"
                                        :href="item.href || undefined"
                                        class="text-sm text-neutral-400 leading-relaxed font-medium min-w-0 break-words"
                                        :class="item.href ? 'hover:text-paper transition-colors' : ''"
                                    >
                                        {{ item.value }}
                                    </component>
                                </li>
                            </ul>
                        </div>
                    </div>
                </nav>
            </div>

            <!-- ── Bottom bar ──────────────────────────────────────────── -->
            <div class="pt-8 border-t border-neutral-800">
                <div class="flex flex-col items-center gap-6 md:flex-row md:items-center md:justify-between md:gap-4">
                    <p class="order-2 md:order-1 text-xs text-neutral-500 font-bold uppercase tracking-widest text-center md:text-left">
                        © {{ currentYear }} ALIESHOP — Curated with passion.
                    </p>

                    <div class="order-1 md:order-2 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
                        <RouterLink to="/privacy" class="text-[10px] font-bold uppercase tracking-widest text-neutral-500 hover:text-paper transition-colors">Privacy</RouterLink>
                        <RouterLink to="/terms" class="text-[10px] font-bold uppercase tracking-widest text-neutral-500 hover:text-paper transition-colors">Terms</RouterLink>
                        <RouterLink to="/sitemap" class="text-[10px] font-bold uppercase tracking-widest text-neutral-500 hover:text-paper transition-colors">Sitemap</RouterLink>
                    </div>

                    <button
                        @click="scrollToTop"
                        class="order-3 w-10 h-10 rounded-full bg-neutral-900 hover:bg-accent transition-all duration-300 text-neutral-400 hover:text-white hover:-translate-y-0.5 flex items-center justify-center shrink-0"
                        aria-label="Scroll to top"
                    >
                        <ArrowUp class="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    </footer>
</template>
