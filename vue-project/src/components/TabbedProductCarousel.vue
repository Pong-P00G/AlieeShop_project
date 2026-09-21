<script setup>
import { ref, computed, watch } from 'vue';
import ProductCarousel from './ProductCarousel.vue';

const props = defineProps({
    sections: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    // Passed straight through to the carousel; both are admin-managed.
    autoplay: { type: Boolean, default: true },
    interval: { type: Number, default: 4000 },
});

const emit = defineEmits(['tab-change']);

const activeTab = ref(0);

watch(() => props.sections.length, () => { activeTab.value = 0; });

const activeSection = computed(() => {
    if (props.sections.length === 0) return null;
    return props.sections[activeTab.value] || props.sections[0];
});

function switchTab(index) {
    if (index === activeTab.value) return;
    activeTab.value = index;
    emit('tab-change', props.sections[index]);
}

const underlineStyle = computed(() => {
    if (props.sections.length === 0) return {};
    const width = 100 / props.sections.length;
    return { width: width + '%', transform: 'translateX(' + (activeTab.value * 100) + '%)' };
});
</script>

<template>
    <div class="w-full">
        <!-- Tab Bar -->
        <div class="relative mb-8">
            <div class="relative flex items-center bg-neutral-100 rounded-2xl p-1.5 overflow-x-auto">
                <!-- Sliding indicator -->
                <div
                    class="absolute inset-y-1.5 left-1.5 rounded-xl bg-ink shadow-md transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1)"
                    :style="underlineStyle"
                ></div>

                <!-- Tab buttons -->
                <button
                    v-for="(section, index) in sections"
                    :key="section.key"
                    @click="switchTab(index)"
                    class="relative z-10 flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-300 min-w-0"
                    :class="activeTab === index
                        ? 'text-paper'
                        : 'text-neutral-600 hover:text-ink hover:bg-paper/50'"
                >
                    <component :is="section.icon" class="w-4 h-4 shrink-0" />
                    <span class="hidden sm:inline truncate">{{ section.label }}</span>
                    <span
                        v-if="section.products.length"
                        class="inline-flex items-center justify-center min-w-4.5 h-4.5 px-1 text-[10px] font-bold rounded-full"
                        :class="activeTab === index
                            ? 'bg-paper/20 text-paper'
                            : 'bg-neutral-200 text-neutral-600'"
                    >
                        {{ section.products.length }}
                    </span>
                </button>
            </div>
        </div>

        <!-- Content Area -->
        <div class="relative min-h-85">
            <!-- Loading skeleton -->
            <div v-if="loading" class="animate-pulse">
                <div class="flex gap-5 overflow-hidden">
                    <div v-for="i in 4" :key="'skel-' + i" class="shrink-0 w-full sm:w-[70%] md:w-[48%] lg:w-[48%] bg-neutral-100 rounded-2xl h-72"></div>
                </div>
            </div>

            <!-- Empty state -->
            <div v-else-if="!activeSection || activeSection.products.length === 0" class="bg-paper border border-neutral-200 rounded-2xl p-12 text-center">
                <div v-if="activeSection?.icon" class="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                    <component :is="activeSection.icon" class="w-6 h-6 text-neutral-400" />
                </div>
                <p class="text-neutral-500 text-sm">{{ activeSection?.emptyMsg || 'No products available.' }}</p>
            </div>

            <!-- Product carousel with transition -->
            <transition name="tab-fade" mode="out-in">
                <ProductCarousel
                    v-if="!loading && activeSection && activeSection.products.length > 0"
                    :key="activeSection.key"
                    :products="activeSection.products"
                    :autoplay="autoplay"
                    :interval="interval"
                />
            </transition>
        </div>
    </div>
</template>

<style scoped>
.tab-fade-enter-active {
    transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.tab-fade-leave-active {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.tab-fade-enter-from {
    opacity: 0;
    transform: translateY(12px) scale(0.97);
}
.tab-fade-leave-to {
    opacity: 0;
    transform: translateY(-8px) scale(0.97);
}

</style>