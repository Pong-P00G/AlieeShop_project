<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import { useHead } from '@unhead/vue';
import { RouterLink } from 'vue-router';
import LazyImage from '../components/LazyImage.vue';
import { useWishlistStock } from '../composables/useWishlistStock.js';
import {
    Heart, ShoppingCart, Trash2, ArrowRight, CheckCheck,
    LayoutGrid, List, ArrowUpDown, Check,
} from 'lucide-vue-next';

useHead({
    title: 'My Wishlist | AlieeShop',
    meta: [
        { name: 'description', content: 'View and manage your saved items at AlieeShop. Your wishlist is saved across all your devices.' },
        { property: 'og:title', content: 'My Wishlist | AlieeShop' },
        { property: 'og:description', content: 'View and manage your saved items at AlieeShop.' },
        { name: 'twitter:title', content: 'My Wishlist | AlieeShop' },
        { name: 'twitter:description', content: 'View and manage your saved items at AlieeShop.' },
    ],
    link: [
        { rel: 'canonical', href: 'https://alieeshop.com/wishlist' },
    ],
})
import { useShopStore } from '../stores/shop';
import { useToast } from '../composables/useToast.js';
import WishListBtn from '../components/WishListBtn.vue';

const shop = useShopStore();
const toast = useToast();

// ── Live stock ───────────────────────────────────────────────
const { fetchStock, statusFor, quantityFor } = useWishlistStock();

const STOCK_BADGES = {
    in: { text: 'In stock', cls: 'bg-success/10 text-success' },
    low: { text: 'Low stock', cls: 'bg-amber-100 text-amber-700' },
    out: { text: 'Out of stock', cls: 'bg-danger/10 text-danger' },
    unavailable: { text: 'Unavailable', cls: 'bg-neutral-200 text-neutral-600' },
};
const stockBadge = (id) => STOCK_BADGES[statusFor(id)] ?? null;
const isPurchasable = (id) => {
    const s = statusFor(id);
    return s === 'in' || s === 'low';
};

const refreshStock = () => {
    if (shop.wishlist.length) fetchStock(shop.wishlist.map(i => i.id));
};

onMounted(() => {
    refreshStock();
    // Re-validate when the tab regains focus — catches stock that
    // sold down while the page sat open, without polling.
    window.addEventListener('focus', refreshStock);
});
onBeforeUnmount(() => window.removeEventListener('focus', refreshStock));

const items = computed(() => shop.wishlist);
const totalValue = computed(() =>
    items.value.reduce((sum, i) => sum + (parseFloat(i.price || i.base_price) || 0), 0)
);

// ── View options ─────────────────────────────────────────────
const viewMode = ref('grid'); // 'grid' | 'list'
const sortBy = ref('added');  // 'added' | 'name' | 'price-asc' | 'price-desc'

const sortedItems = computed(() => {
    const list = [...items.value];
    switch (sortBy.value) {
        case 'name':
            return list.sort((a, b) =>
                (a.name || a.product_name || '').localeCompare(b.name || b.product_name || ''));
        case 'price-asc':
            return list.sort((a, b) =>
                (parseFloat(a.price || a.base_price) || 0) - (parseFloat(b.price || b.base_price) || 0));
        case 'price-desc':
            return list.sort((a, b) =>
                (parseFloat(b.price || b.base_price) || 0) - (parseFloat(a.price || a.base_price) || 0));
        default:
            return list; // 'added' = store order (newest appended last)
    }
});

const categoryName = (item) =>
    typeof item.category === 'object' ? item.category?.name : item.category;

// ── Cart / removal actions ───────────────────────────────────
const movingIds = ref(new Set());
const removedIds = ref(new Set()); // drives the collapse-out animation

const moveToCart = (item) => {
    if (!isPurchasable(item.id)) {
        toast.error('This item is currently out of stock');
        return;
    }
    movingIds.value.add(item.id);
    shop.addToCart({
        id: item.id,
        title: item.name || item.product_name,
        price: parseFloat(item.price || item.base_price) || 0,
        qty: 1,
        image: item.image || item.thumbnail,
    });
    // Collapse the card, then drop it from the wishlist
    setTimeout(() => {
        shop.toggleWishlist(item);
        movingIds.value.delete(item.id);
    }, 350);
    toast.success('Moved to cart');
};

const removeItem = (item) => {
    removedIds.value.add(item.id);
    setTimeout(() => {
        shop.toggleWishlist(item);
        removedIds.value.delete(item.id);
    }, 350);
    toast.success('Removed from wishlist');
};

const moveAllToCart = () => {
    items.value.forEach((item) => {
        shop.addToCart({
            id: item.id,
            title: item.name || item.product_name,
            price: parseFloat(item.price || item.base_price) || 0,
            qty: 1,
            image: item.image || item.thumbnail,
        });
    });
    shop.clearWishlist();
    toast.success('All items moved to cart');
};

const showClearConfirm = ref(false);

const confirmClear = () => {
    shop.clearWishlist();
    showClearConfirm.value = false;
    toast.success('Wishlist cleared');
};

const formatPrice = (val) =>
    '$' + (parseFloat(val) || 0).toFixed(2);
</script>

<template>
    <div class="bg-paper min-h-[70vh]">
        <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <!-- Header -->
            <div class="flex flex-wrap items-end justify-between gap-4 mb-8">
                <div>
                    <span class="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-accent mb-3">
                        <Heart class="w-4 h-4 fill-accent" />
                        Saved for later
                    </span>
                    <h1 class="text-3xl sm:text-4xl md:text-5xl font-elegant font-bold text-ink leading-tight">Your wishlist</h1>
                    <p class="text-sm text-neutral-500 mt-1.5">
                        <span class="font-bold text-ink tabular-nums">{{ items.length }}</span>
                        {{ items.length === 1 ? 'item' : 'items' }}
                        <span v-if="items.length" class="mx-2">&middot;</span>
                        <span v-if="items.length" class="font-bold text-accent tabular-nums">
                            {{ formatPrice(totalValue) }}
                        </span> total value
                    </p>
                </div>

                <div v-if="items.length" class="flex items-center gap-3">
                    <button
                        @click="moveAllToCart"
                        class="inline-flex items-center gap-2 px-5 py-2.5 bg-ink text-paper text-sm font-bold rounded-full hover:bg-accent active:scale-95 transition-all duration-200"
                    >
                        <ShoppingCart class="w-4 h-4" />
                        Move all to cart
                    </button>
                    <button
                        @click="showClearConfirm = true"
                        class="inline-flex items-center gap-2 px-4 py-2.5 bg-paper border border-neutral-300 text-ink text-sm font-bold rounded-full hover:border-danger hover:text-danger active:scale-95 transition-all duration-200"
                    >
                        <Trash2 class="w-4 h-4" />
                        Clear all
                    </button>
                </div>
            </div>

            <!-- Toolbar: view toggle + sort -->
            <div v-if="items.length" class="card-flat px-4 sm:px-6 py-3.5 mb-6 flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-1.5 text-xs text-neutral-500">
                    <span class="hidden sm:inline font-medium">Showing</span>
                    <span class="font-bold text-ink tabular-nums">{{ items.length }}</span>
                    <span>{{ items.length === 1 ? 'item' : 'items' }}</span>
                </div>

                <div class="flex items-center gap-2 sm:gap-3">
                    <!-- Sort -->
                    <label class="relative inline-flex items-center">
                        <ArrowUpDown class="absolute left-3 w-4 h-4 text-neutral-400 pointer-events-none" />
                        <select v-model="sortBy" class="input-base pl-9 pr-8 py-2 text-xs font-bold appearance-none cursor-pointer" aria-label="Sort wishlist items">
                            <option value="added">Recently added</option>
                            <option value="name">Name A–Z</option>
                            <option value="price-asc">Price: low to high</option>
                            <option value="price-desc">Price: high to low</option>
                        </select>
                    </label>

                    <!-- View toggle -->
                    <div class="flex items-center bg-neutral-100 rounded-full p-1" role="group" aria-label="View mode">
                        <button
                            @click="viewMode = 'grid'"
                            class="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200"
                            :class="viewMode === 'grid' ? 'bg-paper text-ink shadow-sm' : 'text-neutral-400 hover:text-ink'"
                            :aria-pressed="viewMode === 'grid'"
                            aria-label="Grid view"
                        >
                            <LayoutGrid class="w-4 h-4" />
                        </button>
                        <button
                            @click="viewMode = 'list'"
                            class="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200"
                            :class="viewMode === 'list' ? 'bg-paper text-ink shadow-sm' : 'text-neutral-400 hover:text-ink'"
                            :aria-pressed="viewMode === 'list'"
                            aria-label="List view"
                        >
                            <List class="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            <!-- Empty state -->
            <div v-if="!items.length" class="card-flat text-center py-24 px-6">
                <div class="relative w-20 h-20 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-6">
                    <Heart class="w-10 h-10 text-neutral-300" />
                    <span class="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center">
                        <Check class="w-3.5 h-3.5 text-accent" />
                    </span>
                </div>
                <h2 class="text-2xl font-elegant font-bold text-ink mb-2">Your wishlist is empty</h2>
                <p class="text-neutral-500 mb-8 max-w-md mx-auto">
                    Tap the <Heart class="w-4 h-4 inline-block text-accent" /> heart on any product
                    to save it here. Your wishlist is saved even if you leave.
                </p>
                <RouterLink to="/product" class="btn-accent inline-flex">
                    Discover products
                    <ArrowRight class="w-4 h-4" />
                </RouterLink>
            </div>

            <!-- Grid view -->
            <div v-else-if="viewMode === 'grid'" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                <TransitionGroup name="card">
                    <article
                        v-for="item in sortedItems"
                        :key="item.id"
                        class="group/card bg-paper border border-neutral-200 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-ink hover:shadow-[0_12px_32px_-8px_rgb(0_0_0_/_0.12)]"
                        :class="statusFor(item.id) === 'out' || statusFor(item.id) === 'unavailable' ? 'opacity-75 saturate-50' : ''"
                    >
                        <RouterLink :to="'/product/' + item.id" class="block">
                            <div class="relative aspect-square bg-neutral-100 overflow-hidden">
                                <LazyImage
                                    :src="item.image || item.thumbnail || item.images?.[0]?.image_url"
                                    :alt="item.name || item.product_name"
                                    wrapper-class="w-full h-full"
                                    img-class="w-full h-full object-cover group-hover/card:scale-110 transition-transform duration-500"
                                />
                                <div class="absolute top-3 right-3 z-10">
                                    <WishListBtn :item="item" />
                                </div>
                                <!-- Live stock badge over image -->
                                <span
                                    v-if="stockBadge(item.id)"
                                    class="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.12em]"
                                    :class="stockBadge(item.id).cls"
                                >
                                    {{ quantityFor(item.id) != null && statusFor(item.id) === 'low'
                                        ? `Only ${quantityFor(item.id)} left`
                                        : stockBadge(item.id).text }}
                                </span>
                                <!-- Category chip over image -->
                                <span
                                    v-if="categoryName(item)"
                                    class="absolute bottom-3 left-3 z-10 px-2.5 py-1 bg-ink/70 backdrop-blur-sm text-paper text-[10px] font-bold uppercase tracking-[0.15em] rounded-full"
                                >
                                    {{ categoryName(item) }}
                                </span>
                            </div>
                        </RouterLink>
                        <div class="p-5 space-y-2">
                            <RouterLink :to="'/product/' + item.id">
                                <h3 class="font-bold text-base text-ink group-hover/card:text-accent transition-colors line-clamp-2">
                                    {{ item.name || item.product_name }}
                                </h3>
                            </RouterLink>
                            <div class="flex items-center justify-between gap-2">
                                <p class="text-lg font-bold text-ink tabular-nums">
                                    {{ formatPrice(item.price || item.base_price) }}
                                </p>
                                <button
                                    @click="removeItem(item)"
                                    class="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-danger hover:bg-danger/10 active:scale-90 transition-all"
                                    aria-label="Remove from wishlist"
                                    title="Remove from wishlist"
                                >
                                    <Trash2 class="w-4 h-4" />
                                </button>
                            </div>
                            <button
                                @click="moveToCart(item)"
                                :disabled="movingIds.has(item.id) || (statusFor(item.id) && !isPurchasable(item.id))"
                                class="mt-1 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                :class="movingIds.has(item.id)
                                    ? 'bg-success/10 text-success'
                                    : isPurchasable(item.id) || !statusFor(item.id)
                                        ? 'bg-ink text-paper hover:bg-accent active:scale-[0.97]'
                                        : 'bg-neutral-200 text-neutral-500'"
                            >
                                <template v-if="movingIds.has(item.id)">
                                    <CheckCheck class="w-4 h-4" />
                                    Moved!
                                </template>
                                <template v-else>
                                    <ShoppingCart class="w-4 h-4" />
                                    Move to cart
                                </template>
                            </button>
                        </div>
                    </article>
                </TransitionGroup>
            </div>

            <!-- List view -->
            <div v-else class="space-y-3">
                <TransitionGroup name="card">
                    <article
                        v-for="item in sortedItems"
                        :key="item.id"
                        class="group/row card-flat p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-4 transition-all duration-300 hover:border-ink hover:shadow-md"
                        :class="statusFor(item.id) === 'out' || statusFor(item.id) === 'unavailable' ? 'opacity-75 saturate-50' : ''"
                    >
                        <!-- Thumbnail -->
                        <RouterLink :to="'/product/' + item.id"
                            class="relative w-full sm:w-24 h-40 sm:h-24 rounded-xl overflow-hidden bg-neutral-100 shrink-0">
                            <LazyImage
                                :src="item.image || item.thumbnail || item.images?.[0]?.image_url"
                                :alt="item.name || item.product_name"
                                wrapper-class="w-full h-full"
                                img-class="w-full h-full object-cover group-hover/row:scale-105 transition-transform duration-500"
                            />
                        </RouterLink>

                        <!-- Details -->
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-1">
                                <p v-if="categoryName(item)" class="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
                                    {{ categoryName(item) }}
                                </p>
                                <span
                                    v-if="stockBadge(item.id)"
                                    class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.12em]"
                                    :class="stockBadge(item.id).cls"
                                >
                                    {{ quantityFor(item.id) != null && statusFor(item.id) === 'low'
                                        ? `Only ${quantityFor(item.id)} left`
                                        : stockBadge(item.id).text }}
                                </span>
                            </div>
                            <RouterLink :to="'/product/' + item.id">
                                <h3 class="font-bold text-base text-ink group-hover/row:text-accent transition-colors truncate">
                                    {{ item.name || item.product_name }}
                                </h3>
                            </RouterLink>
                            <p class="text-lg font-bold text-ink tabular-nums mt-1">
                                {{ formatPrice(item.price || item.base_price) }}
                            </p>
                        </div>

                        <!-- Actions -->
                        <div class="flex items-center gap-2 shrink-0">
                            <WishListBtn :item="item" size="sm" />
                            <button
                                @click="removeItem(item)"
                                class="w-9 h-9 rounded-full flex items-center justify-center text-neutral-400 hover:text-danger hover:bg-danger/10 active:scale-90 transition-all"
                                aria-label="Remove from wishlist"
                                title="Remove from wishlist"
                            >
                                <Trash2 class="w-4 h-4" />
                            </button>
                            <button
                                @click="moveToCart(item)"
                                :disabled="movingIds.has(item.id) || (statusFor(item.id) && !isPurchasable(item.id))"
                                class="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                :class="movingIds.has(item.id)
                                    ? 'bg-success/10 text-success'
                                    : isPurchasable(item.id) || !statusFor(item.id)
                                        ? 'bg-ink text-paper hover:bg-accent active:scale-[0.97]'
                                        : 'bg-neutral-200 text-neutral-500'"
                            >
                                <template v-if="movingIds.has(item.id)">
                                    <CheckCheck class="w-4 h-4" />
                                    Moved!
                                </template>
                                <template v-else>
                                    <ShoppingCart class="w-4 h-4" />
                                    <span class="hidden sm:inline">Move to cart</span>
                                </template>
                            </button>
                        </div>
                    </article>
                </TransitionGroup>
            </div>
        </section>

        <!-- Clear All Confirmation Modal -->
        <Transition name="modal">
            <div v-if="showClearConfirm" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="showClearConfirm = false">
                <div class="absolute inset-0 bg-ink/60 backdrop-blur-sm"></div>
                <div class="relative bg-paper rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-[scale-in_0.25s_ease-out]">
                    <div class="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-4">
                        <Trash2 class="w-7 h-7 text-danger" />
                    </div>
                    <h3 class="text-lg font-bold text-ink mb-2">Clear all {{ items.length }} items?</h3>
                    <p class="text-sm text-neutral-500 mb-6">This can't be undone. You'll lose all your saved items.</p>
                    <div class="flex gap-3">
                        <button
                            @click="showClearConfirm = false"
                            class="flex-1 px-4 py-2.5 border border-neutral-300 text-ink text-sm font-bold rounded-full hover:bg-neutral-50 active:scale-[0.97] transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            @click="confirmClear"
                            class="flex-1 px-4 py-2.5 bg-danger text-paper text-sm font-bold rounded-full hover:bg-danger-600 active:scale-[0.97] transition-all"
                        >
                            Clear all
                        </button>
                    </div>
                </div>
            </div>
        </Transition>
    </div>
</template>

<style scoped>
/* Card collapse-out when moved to cart or removed */
.card-leave-active {
    transition: all 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}
.card-leave-to {
    opacity: 0;
    transform: scale(0.92);
}
.card-move {
    transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}

.modal-enter-active,
.modal-leave-active {
    transition: all 0.25s ease;
}
.modal-enter-from,
.modal-leave-to {
    opacity: 0;
}
.modal-enter-from .relative,
.modal-leave-to .relative {
    transform: scale(0.9);
    opacity: 0;
}
.modal-enter-active .relative,
.modal-leave-active .relative {
    transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}
</style>
