<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { ChevronLeft, ChevronRight, ArrowUpRight } from 'lucide-vue-next';
import { RouterLink } from 'vue-router';
import LazyImage from './LazyImage.vue';
import ProductBadge from './ProductBadge.vue';

const props = defineProps({
    products: { type: Array, default: () => [] },
    interval: { type: Number, default: 4000 },
    // Admin-managed: the carousel section can be configured not to auto-advance.
    autoplay: { type: Boolean, default: true },
});

const carousel = ref(null);
const currentIndex = ref(0);
const isPaused = ref(false);
let autoPlayTimer = null;
let scrollRaf = null;
let touchStartX = 0;
let touchEndX = 0;

/** Distance of a card from the start of the scrollable track. */
const cardOffset = (track, i) => {
    const card = track?.children?.[i];
    return card ? card.offsetLeft - track.offsetLeft : 0;
};

const scrollToIndex = (i) => {
    const track = carousel.value;
    if (!track) return;
    currentIndex.value = i;
    // Scroll by the card's own offset rather than the container width — with
    // more than one card in view the latter overshoots and skips products.
    track.scrollTo({ left: cardOffset(track, i), behavior: 'smooth' });
};

/**
 * Keep the active dot honest: the browser clamps scrollLeft at either end, so
 * the nearest card is authoritative rather than the index we last requested.
 */
const handleScroll = () => {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
        scrollRaf = null;
        const track = carousel.value;
        if (!track || !track.children.length) return;
        let closest = 0;
        let smallest = Infinity;
        for (let i = 0; i < track.children.length; i++) {
            const distance = Math.abs(cardOffset(track, i) - track.scrollLeft);
            if (distance < smallest) {
                smallest = distance;
                closest = i;
            }
        }
        currentIndex.value = closest;
    });
};

const next = () => {
    if (!carousel.value) return;
    const max = props.products.length - 1;
    currentIndex.value = currentIndex.value >= max ? 0 : currentIndex.value + 1;
    scrollToIndex(currentIndex.value);
};

const prev = () => {
    if (!carousel.value) return;
    const max = props.products.length - 1;
    currentIndex.value = currentIndex.value <= 0 ? max : currentIndex.value - 1;
    scrollToIndex(currentIndex.value);
};

const handleTouchStart = (e) => {
    touchStartX = e.touches[0].clientX;
};

const handleTouchEnd = (e) => {
    touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 50) {
        diff > 0 ? next() : prev();
    }
};

const startAutoPlay = () => {
    stopAutoPlay();
    if (!props.autoplay || isPaused.value) return;
    autoPlayTimer = setInterval(next, props.interval);
};

const stopAutoPlay = () => {
    if (autoPlayTimer) {
        clearInterval(autoPlayTimer);
        autoPlayTimer = null;
    }
};

const pauseAutoPlay = () => { isPaused.value = true; stopAutoPlay(); };
const resumeAutoPlay = () => { isPaused.value = false; startAutoPlay(); };

// The config can change after mount (the home page loads it from the API).
watch(() => [props.autoplay, props.interval], () => startAutoPlay());

onMounted(() => {
    startAutoPlay();
});
onUnmounted(() => {
    stopAutoPlay();
    if (scrollRaf) cancelAnimationFrame(scrollRaf);
});
</script>

<template>
    <div class="relative w-full group/carousel"
        @mouseenter="pauseAutoPlay"
        @mouseleave="resumeAutoPlay"
        @touchstart="handleTouchStart"
        @touchend="handleTouchEnd">
        <div
            ref="carousel"
            class="flex overflow-x-hidden snap-x snap-mandatory scroll-smooth gap-5 select-none"
            @scroll.passive="handleScroll"
        >
            <div
                v-for="p in props.products"
                :key="p.id"
                class="snap-start shrink-0 w-full sm:w-[70%] md:w-[48%] lg:w-[48%] bg-paper border border-neutral-200 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-ink hover:shadow-[0_12px_32px_-8px_rgb(0_0_0_/0.12)] relative group/card"
            >
                <RouterLink :to="p.href" class="block">
                    <div class="relative overflow-hidden bg-neutral-100 h-48 sm:h-56">
                        <LazyImage :src="p.image" :alt="p.name" wrapper-class="h-full w-full" img-class="group-hover/card:scale-110" />
                        <ProductBadge
                            v-if="p.badge"
                            :label="p.badge"
                            :variant="p.badgeVariant || 'ink'"
                            :source="p.badgeSource"
                            :tooltip="p.badgeTooltip"
                            class="absolute top-3 left-3 z-10"
                        />
                        <span
                            class="absolute bottom-3 right-3 inline-flex items-center gap-1 px-3 py-1.5 bg-paper text-ink text-xs font-bold rounded-full opacity-0 translate-y-2 transition-all duration-300 group-hover/card:opacity-100 group-hover/card:translate-y-0"
                        >
                            View
                            <ArrowUpRight class="w-3 h-3" />
                        </span>
                    </div>
                    <div class="p-5 space-y-1">
                        <p class="text-xs font-bold uppercase tracking-[0.2em] text-accent">{{ p.category }}</p>
                        <h3 class="font-bold text-lg text-ink group-hover/card:text-accent transition-colors">
                            {{ p.name }}
                        </h3>
                        <p class="text-sm text-neutral-500 line-clamp-2">{{ p.description }}</p>
                        <p class="mt-3 font-bold text-xl text-ink tabular-nums">{{ '$' }}{{ p.price }}</p>
                    </div>
                </RouterLink>
            </div>
        </div>

        <button
            @click="prev"
            class="absolute top-1/2 left-2 sm:-left-4 -translate-y-1/2 h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-paper border border-neutral-200 shadow-md flex items-center justify-center hover:bg-ink hover:text-paper hover:border-ink hover:scale-110 transition-all duration-300 z-10"
            aria-label="Previous"
        >
            <ChevronLeft class="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
        <button
            @click="next"
            class="absolute top-1/2 right-2 sm:-right-4 -translate-y-1/2 h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-paper border border-neutral-200 shadow-md flex items-center justify-center hover:bg-ink hover:text-paper hover:border-ink hover:scale-110 transition-all duration-300 z-10"
            aria-label="Next"
        >
            <ChevronRight class="w-5 h-5" />
        </button>

        <div class="absolute -bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            <button
                v-for="(p, i) in props.products"
                :key="i"
                @click="scrollToIndex(i)"
                class="h-2 rounded-full transition-all duration-300"
                :class="i === currentIndex ? 'w-8 bg-accent' : 'w-2 bg-neutral-300 hover:bg-neutral-500'"
                :aria-label="'Slide ' + (i + 1)"
            ></button>
        </div>
    </div>
</template>
