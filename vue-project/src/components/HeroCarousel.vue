<script setup>
import LazyImage from './LazyImage.vue';
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { RouterLink } from 'vue-router';
import { ArrowRight, Sparkles } from 'lucide-vue-next';
import { heroAPI } from '../api/heroApi.js';

const currentSlide = ref(0);
const autoPlayInterval = ref(null);
const slideKey = ref(0);

// ── Parallax state ──
const heroRef = ref(null);
const mouseX = ref(0);
const mouseY = ref(0);
const parallaxStyle = computed(() => ({
    transform: `translate(${mouseX.value * 1.5}px, ${mouseY.value * 1.2}px) scale(1.08)`
}));

const handleMouseMove = (e) => {
    if (!heroRef.value) return;
    const rect = heroRef.value.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;  // -1 to 1
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2; // -1 to 1
    mouseX.value = x * 8;
    mouseY.value = y * 6;
};

const resetParallax = () => {
    mouseX.value = 0;
    mouseY.value = 0;
};

// Used until the API answers, and as the permanent fallback when the store
// has no hero slides configured. Mirrors the seeded rows in add_hero_slides.sql.
const FALLBACK_SLIDES = [
    {
        id: 1,
        eyebrow: 'Summer Collection 2024',
        title: 'Threads of',
        titleAccent: 'Modernity',
        description: 'Curated apparel and essentials designed for the contemporary wardrobe.',
        image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&h=600&fit=crop',
        cta: 'Shop Collection',
        ctaLink: '/product',
        badge: 'New Season',
    },
    {
        id: 2,
        eyebrow: 'Premium Electronics',
        title: 'Built for',
        titleAccent: 'Tomorrow',
        description: 'Cutting-edge devices and accessories engineered for everyday excellence.',
        image: 'https://images.unsplash.com/photo-1468495244123-6c6c332eeece?w=1200&h=600&fit=crop',
        cta: 'Explore Tech',
        ctaLink: '/product?category=tech',
        badge: 'Trending',
    },
    {
        id: 3,
        eyebrow: 'Home & Living',
        title: 'Spaces that',
        titleAccent: 'Inspire',
        description: 'Transformative pieces that turn any room into a personal sanctuary.',
        image: 'https://images.unsplash.com/photo-1484101403633-562f891dc89a?w=1200&h=600&fit=crop',
        cta: 'Discover More',
        ctaLink: '/product?category=home',
        badge: 'On Sale',
    },
];

const FALLBACK_SETTINGS = {
    sectionEnabled: true,
    autoplayEnabled: true,
    autoplayInterval: 5000,
    secondaryLabel: 'Our Story',
    secondaryLink: '/about',
};

const slides = ref(FALLBACK_SLIDES);
const settings = ref({ ...FALLBACK_SETTINGS });

const heroSlides = computed(() => slides.value);

const nextSlide = () => {
    if (heroSlides.value.length === 0) return;
    currentSlide.value = (currentSlide.value + 1) % heroSlides.value.length;
    slideKey.value++;
};
const goToSlide = (index) => {
    currentSlide.value = index;
    slideKey.value++;
};
const stopAutoPlay = () => {
    if (autoPlayInterval.value) {
        clearInterval(autoPlayInterval.value);
        autoPlayInterval.value = null;
    }
};
const startAutoPlay = () => {
    stopAutoPlay();
    // A single slide has nothing to rotate to.
    if (!settings.value.autoplayEnabled || heroSlides.value.length <= 1) return;
    autoPlayInterval.value = setInterval(() => nextSlide(), settings.value.autoplayInterval);
};

/**
 * Pull the admin-managed slides + section settings. Any failure leaves the
 * built-in fallback in place so the homepage always renders a hero.
 */
const loadHero = async () => {
    try {
        const res = await heroAPI.getHero();
        const data = res?.data;
        if (!res?.success || !data) return;

        // A successful response is authoritative — if the admin hid every
        // slide, the hero is meant to disappear rather than fall back.
        slides.value = Array.isArray(data.slides) ? data.slides : [];
        currentSlide.value = 0;
        slideKey.value++;
        settings.value = { ...FALLBACK_SETTINGS, ...(data.settings || {}) };
    } catch {
        // Storefront hero must never break the page — keep the fallbacks.
    } finally {
        startAutoPlay(); // re-arm using the configured interval
    }
};

onMounted(() => {
    startAutoPlay();
    loadHero();
});
onUnmounted(() => stopAutoPlay());
</script>

<template>
    <section
        v-if="settings.sectionEnabled && heroSlides.length > 0"
        ref="heroRef"
        class="relative w-full h-105 md:h-130 lg:h-150 overflow-hidden bg-ink group"
        @mouseenter="stopAutoPlay"
        @mouseleave="startAutoPlay"
        @mousemove="handleMouseMove"
    >
        <!-- Slides -->
        <div
            v-for="(slide, index) in heroSlides"
            :key="slide.id"
            class="absolute inset-0 transition-opacity duration-1000"
            :class="currentSlide === index ? 'opacity-100 z-10' : 'opacity-0 z-0'"
        >
            <!-- Background image -->
            <div class="absolute inset-0 overflow-hidden">
                <LazyImage
                    :src="slide.image"
                    :alt="slide.title"
                    wrapper-class="w-full h-full transition-transform duration-[250ms] ease-out will-change-transform"
                    :class="currentSlide === index ? 'scale-110' : 'scale-105'"
                    :style="currentSlide === index ? parallaxStyle : undefined"
                />
                <div class="absolute inset-0 bg-linear-to-r from-ink via-ink/70 to-transparent"></div>
                <div class="absolute inset-0 bg-linear-to-t from-ink/40 to-transparent"></div>
            </div>

            <!-- Content -->
            <div class="relative h-full px-4 sm:px-6 lg:px-8 flex items-center">
                <!-- Key wrapper to re-trigger stagger animations on slide change -->
                <div :key="`content-${slideKey}-${index}`" class="max-w-2xl space-y-6">
                    <div
                        class="inline-flex items-center gap-2 px-4 py-1.5 bg-paper/15 backdrop-blur-md border border-paper/20 rounded-full text-paper text-xs font-bold uppercase tracking-[0.2em] animate-fade-up"
                        style="animation-delay: 50ms"
                    >
                        <span class="w-1.5 h-1.5 bg-accent rounded-full pulse-dot"></span>
                        {{ slide.badge }}
                    </div>

                    <p
                        class="text-sm font-bold uppercase tracking-[0.25em] text-accent animate-fade-up"
                        style="animation-delay: 150ms"
                    >
                        {{ slide.eyebrow }}
                    </p>

                    <h2
                        class="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-elegant text-paper leading-[0.95] animate-fade-up"
                        style="animation-delay: 280ms"
                    >
                        {{ slide.title }}
                        <span class="block font-bold italic">{{ slide.titleAccent }}</span>
                    </h2>

                    <p
                        class="text-base md:text-lg text-paper/80 font-light max-w-lg leading-relaxed animate-fade-up"
                        style="animation-delay: 400ms"
                    >
                        {{ slide.description }}
                    </p>

                    <div
                        class="flex items-center gap-4 pt-2 animate-fade-up"
                        style="animation-delay: 520ms"
                    >
                        <RouterLink
                            :to="slide.ctaLink"
                            class="shine-effect inline-flex items-center gap-2 px-7 py-3.5 bg-accent text-white font-bold text-sm rounded-full shadow-[0_8px_24px_-6px_rgb(249_115_22_/0.6)] hover:bg-accent-600 hover:-translate-y-0.5 transition-all duration-300 group/cta"
                        >
                            {{ slide.cta }}
                            <ArrowRight class="w-4 h-4 group-hover/cta:translate-x-1 transition-transform" />
                        </RouterLink>
                        <RouterLink
                            v-if="settings.secondaryLabel && settings.secondaryLink"
                            :to="settings.secondaryLink"
                            class="inline-flex items-center gap-2 px-7 py-3.5 bg-paper/10 backdrop-blur-md text-paper font-bold text-sm rounded-full border border-paper/20 hover:bg-paper hover:text-ink transition-all duration-300"
                        >
                            <Sparkles class="w-4 h-4" />
                            {{ settings.secondaryLabel }}
                        </RouterLink>
                    </div>
                </div>
            </div>
        </div>

        <!-- Dots -->
        <div class="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
            <button
                v-for="(slide, index) in heroSlides"
                :key="`dot-${index}`"
                @click="goToSlide(index)"
                class="transition-all duration-300 h-2 rounded-full"
                :class="currentSlide === index
                    ? 'w-10 bg-accent'
                    : 'w-2 bg-paper/40 hover:bg-paper/70'"
                :aria-label="`Go to slide ${index + 1}`"
            ></button>
        </div>

        <!-- Slide counter -->
        <div class="absolute top-6 right-6 z-20 hidden md:flex items-center gap-2 px-3 py-1.5 bg-paper/10 backdrop-blur-md border border-paper/20 rounded-full text-paper text-xs font-bold tabular-nums">
            <span class="text-accent">{{ String(currentSlide + 1).padStart(2, '0') }}</span>
            <span class="text-paper/40">/</span>
            <span>{{ String(heroSlides.length).padStart(2, '0') }}</span>
        </div>
    </section>
</template>
