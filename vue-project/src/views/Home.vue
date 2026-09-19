<script setup>
import { ref, computed, onMounted } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import {
    ArrowRight,
    Sparkles,
    Truck,
    ShieldCheck,
    RotateCcw,
    Headphones,
    Search,
    SlidersHorizontal,
    Grid3x3,
    List,
    Heart,
    Plus,
    Tag,
    ChevronLeft,
    ChevronRight,
    ShoppingCart,
    X,
    Check,
    RefreshCw,
    Clock,
    TrendingUp,
    Zap,
    Star,
} from 'lucide-vue-next';
import { useToast } from '../composables/useToast.js';
import { useProductStore } from '../stores/product.js';
import { productAPI } from '../api/products/productApi.js';
import LazyImage from '../components/LazyImage.vue';
import WishListBtn from '../components/WishListBtn.vue';
import HeroCarousel from '../components/HeroCarousel.vue';
import TabbedProductCarousel from '../components/TabbedProductCarousel.vue';
import ProductBadge from '../components/ProductBadge.vue';

const toast = useToast();
const router = useRouter();
const productStore = useProductStore();

const loadingProducts = ref(false);
const loadingSections = ref(true);

// Real product data from store
const featuredProducts = ref([]);
const newArrivals = ref([]);
const bestSellers = ref([]);
const comingSoon = ref([]);
const allProducts = ref([]);

function mapProduct(p, sectionContext = '') {
    let badge = '';
    let badgeVariant = 'ink';
    let badgeSource = null;  // 'tag' | 'heuristic'

    const tags = p.tags || [];

    // 1. Coming Soon — tagged with 'coming_soon' or within coming-soon section
    if (tags.includes('coming_soon') || sectionContext === 'coming-soon') {
        badge = 'Coming Soon';
        badgeVariant = 'info';
        badgeSource = tags.includes('coming_soon') ? 'tag' : 'heuristic';
    }
    // 2. New Arrival — products explicitly tagged as 'new_arrival'
    else if (tags.includes('new_arrival')) {
        badge = 'New Arrival';
        badgeVariant = 'success';
        badgeSource = 'tag';
    }
    // 3. Best Seller — products explicitly tagged as 'best_seller'
    else if (tags.includes('best_seller')) {
        badge = 'Best Seller';
        badgeVariant = 'warning';
        badgeSource = 'tag';
    }
    // 4. Heuristic fallback — recent creation date or high stock
    else if (p.created_at) {
        const createdDate = new Date(p.created_at);
        const now = new Date();
        const daysSinceCreated = (now - createdDate) / (1000 * 60 * 60 * 24);
        if (daysSinceCreated <= 14) {
            badge = 'New';
            badgeVariant = 'success';
            badgeSource = 'heuristic';
        } else if (p.total_stock > 50) {
            badge = 'Best Seller';
            badgeVariant = 'warning';
            badgeSource = 'heuristic';
        } else if (p.total_stock > 20) {
            badge = 'Popular';
            badgeVariant = 'ink';
            badgeSource = 'heuristic';
        }
    }
    // Fallback if no created_at
    else if (p.total_stock > 50) {
        badge = 'Best Seller';
        badgeVariant = 'warning';
        badgeSource = 'heuristic';
    } else if (p.total_stock > 20) {
        badge = 'Popular';
        badgeVariant = 'ink';
        badgeSource = 'heuristic';
    }

    // ── Generate detailed tooltip text ──
    let badgeTooltip = '';
    if (badgeSource === 'tag' && badge) {
        // Show which tags triggered the badge
        const relevantTags = tags.filter(t => ['coming_soon', 'new_arrival', 'best_seller'].includes(t));
        badgeTooltip = 'Tagged: ' + relevantTags.join(', ');
        if (p.created_at) {
            const days = Math.floor((Date.now() - new Date(p.created_at)) / (1000 * 60 * 60 * 24));
            badgeTooltip += ` · ${days}d ago`;
        }
    } else if (badgeSource === 'heuristic') {
        if (badge === 'New') {
            const days = Math.floor((Date.now() - new Date(p.created_at)) / (1000 * 60 * 60 * 24));
            badgeTooltip = `Auto: created ${days}d ago`;
        } else if (badge === 'Best Seller') {
            badgeTooltip = `Auto: ${p.total_stock} in stock`;
        } else if (badge === 'Popular') {
            badgeTooltip = `Auto: ${p.total_stock} in stock`;
        }
    }

    // Use a placeholder or thumbnail image
    const image = p.thumbnail || `https://placehold.co/600x400/e4e4e7/a1a1aa?text=${encodeURIComponent(p.product_name?.slice(0, 2) || 'P')}`;

    return {
        id: p.product_id,
        name: p.product_name,
        price: parseFloat(p.base_price),
        category: p.category_name || 'General',
        tags: [p.category_name || 'general'],
        description: p.descriptions || '',
        image: image,
        badge: badge,
        badgeVariant: badgeVariant,
        badgeSource: badgeSource,
        badgeTooltip: badgeTooltip,
        href: `/product/${p.product_id}`,
        product_status: p.product_status,
        total_stock: p.total_stock,
        created_at: p.created_at,
    };
}

// Fetch all sections on mount
onMounted(async () => {
    loadingSections.value = true;
    loadingProducts.value = true;

    try {
        // Fetch all sections in parallel
        const [featuredRes, newRes, bestRes, comingRes, allRes] = await Promise.all([
            productStore.fetchFeaturedProducts(8),
            productStore.fetchNewArrivals(8),
            productStore.fetchBestSellers(8),
            productStore.fetchComingSoon(8),
            productStore.fetchAllProducts(),
        ]);

        featuredProducts.value = (featuredRes.data || []).map(mapProduct);
        newArrivals.value = (newRes.data || []).map(mapProduct);
        bestSellers.value = (bestRes.data || []).map(mapProduct);
        comingSoon.value = (comingRes.data || []).map(mapProduct);

        // Map all products for the filter/grid section
        const raw = productStore.products || [];
        allProducts.value = raw.map(mapProduct);

    } catch (err) {
        console.error('Failed to load homepage data:', err);
        toast.error('Failed to load products. Please refresh the page.');
    } finally {
        loadingSections.value = false;
        loadingProducts.value = false;
    }
});

// Filters & Pagination (apply to allProducts)
const filters = ref({ q: '', category: '', tag: '', minPrice: null, maxPrice: null, sort: 'new' });
const view = ref('grid');
const page = ref(1);
const perPage = ref(9);
const showFilters = ref(false);

const categories = computed(() => [...new Set(allProducts.value.map((p) => p.category))]);
const tags = computed(() => [...new Set(allProducts.value.flatMap((p) => p.tags))]);

function toggleTag(t) {
    filters.value.tag = filters.value.tag === t ? '' : t;
}

function resetFilters() {
    filters.value = { q: '', category: '', tag: '', minPrice: null, maxPrice: null, sort: 'new' };
    page.value = 1;
}

const filtered = computed(() => {
    let list = allProducts.value.slice();
    const f = filters.value;
    if (f.q) {
        const q = f.q.toLowerCase();
        list = list.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    if (f.category) list = list.filter((p) => p.category === f.category);
    if (f.tag) list = list.filter((p) => p.tags.includes(f.tag));
    if (f.minPrice != null) list = list.filter((p) => p.price >= f.minPrice);
    if (f.maxPrice != null) list = list.filter((p) => p.price <= f.maxPrice);
    if (f.sort === 'price-asc') list.sort((a, b) => a.price - b.price);
    else if (f.sort === 'price-desc') list.sort((a, b) => b.price - a.price);
    else list.sort((a, b) => b.id - a.id);
    return list;
});

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / perPage.value)));
const paginated = computed(() => {
    const start = (page.value - 1) * perPage.value;
    return filtered.value.slice(start, start + perPage.value);
});

function nextPage() {
    if (page.value < totalPages.value) page.value++;
}
function prevPage() {
    if (page.value > 1) page.value--;
}

async function addToCart(p) {
    try {
        const res = await productAPI.getProductById(p.id);
        if (res?.success && Array.isArray(res.data?.variants) && res.data.variants.length > 0) {
            toast.info('Choose an option first');
            router.push('/product/' + p.id);
            return;
        }
        shop.addToCart({
            id: p.id,
            title: p.name,
            price: p.price,
            qty: 1,
            image: p.image,
            variant: null,
            variantId: null,
        });
        toast.success('"' + p.name + '" added to cart!');
    } catch (err) {
        console.error('Quick add failed:', err);
        toast.error('Could not add this product — please open its page');
    }
}

const promises = [
    { icon: Truck, title: 'Free shipping', desc: 'On orders over $50' },
    { icon: RotateCcw, title: '7-day returns', desc: 'Hassle-free refunds' },
    { icon: ShieldCheck, title: 'Secure checkout', desc: '256-bit SSL encryption' },
    { icon: Headphones, title: '24/7 support', desc: 'Real humans, real help' },
];

// Section helper: carousel sections config
const carouselSections = computed(() => [
    {
        key: 'featured',
        label: 'Hand-picked',
        title: 'Featured this week',
        icon: Sparkles,
        products: featuredProducts.value,
        emptyMsg: 'No featured products available yet.',
    },
    {
        key: 'new-arrivals',
        label: 'Just landed',
        title: 'New Arrivals',
        icon: Clock,
        products: newArrivals.value,
        emptyMsg: 'No new arrivals at the moment.',
    },
    {
        key: 'best-sellers',
        label: 'Trending now',
        title: 'Best Sellers',
        icon: TrendingUp,
        products: bestSellers.value,
        emptyMsg: 'No best sellers data yet.',
    },
    {
        key: 'coming-soon',
        label: 'Coming up',
        title: 'Coming Soon',
        icon: Zap,
        products: comingSoon.value,
        emptyMsg: 'No upcoming products right now.',
    },
]);
</script>

<template>
    <div class="min-h-screen bg-paper">
        <!-- Hero Carousel -->
        <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <HeroCarousel />
        </section>

        <!-- Promise strip -->
        <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 sm:mt-12">
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                <div
                    v-for="p in promises"
                    :key="p.title"
                    class="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-paper border border-neutral-200 rounded-2xl hover:border-ink transition-colors group"
                >
                    <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-neutral-100 group-hover:bg-accent group-hover:text-white flex items-center justify-center transition-colors shrink-0">
                        <component :is="p.icon" class="w-4 h-4 text-ink group-hover:text-white transition-colors" />
                    </div>
                    <div class="min-w-0">
                        <p class="text-xs sm:text-sm font-bold text-ink truncate">{{ p.title }}</p>
                        <p class="text-[10px] sm:text-xs text-neutral-500 truncate">{{ p.desc }}</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- ── Tabbed Product Carousel ── -->
        <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 sm:mt-16">
            <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
                <div>
                    <span class="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-accent mb-2">
                        <Sparkles class="w-3.5 h-3.5" />
                        Discover
                    </span>
                    <h2 class="text-2xl sm:text-3xl md:text-4xl font-elegant font-bold text-ink">
                        Curated Collections
                    </h2>
                </div>
                <RouterLink
                    to="/product"
                    class="hidden md:inline-flex items-center gap-2 text-sm font-bold text-ink hover:text-accent transition-colors"
                >
                    View all
                    <ArrowRight class="w-4 h-4" />
                </RouterLink>
            </div>

            <TabbedProductCarousel
                :sections="carouselSections"
                :loading="loadingSections"
            />
        </section>

        <!-- ── Filters + Products ── -->
        <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 sm:mt-20">
            <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-8 gap-4 flex-wrap">
                <div>
                    <span class="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-accent mb-2">
                        <Tag class="w-3.5 h-3.5" />
                        Catalog
                    </span>
                    <h2 class="text-2xl sm:text-3xl md:text-4xl font-elegant font-bold text-ink">All products</h2>
                </div>
                <div class="flex items-center gap-2">
                    <button
                        @click="showFilters = !showFilters"
                        class="lg:hidden inline-flex items-center gap-2 px-4 py-2.5 bg-ink text-paper text-sm font-bold rounded-full"
                    >
                        <SlidersHorizontal class="w-4 h-4" />
                        Filters
                    </button>
                    <div class="hidden sm:flex items-center bg-paper border border-neutral-200 rounded-full p-1">
                        <button
                            @click="view = 'grid'"
                            :class="view === 'grid' ? 'bg-ink text-paper' : 'text-ink hover:bg-neutral-100'"
                            class="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
                            aria-label="Grid view"
                        >
                            <Grid3x3 class="w-4 h-4" />
                        </button>
                        <button
                            @click="view = 'list'"
                            :class="view === 'list' ? 'bg-ink text-paper' : 'text-ink hover:bg-neutral-100'"
                            class="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
                            aria-label="List view"
                        >
                            <List class="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <!-- Filters -->
                <aside
                    class="lg:col-span-1 bg-paper border border-neutral-200 rounded-2xl p-6 h-fit lg:sticky lg:top-24"
                    :class="showFilters ? 'block' : 'hidden lg:block'"
                >
                    <h4 class="text-sm font-bold uppercase tracking-[0.2em] text-ink mb-5 flex items-center gap-2">
                        <SlidersHorizontal class="w-4 h-4" />
                        Filters
                    </h4>
                    <div class="space-y-5">
                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">Search</label>
                            <div class="relative">
                                <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                                <input
                                    v-model="filters.q"
                                    placeholder="Search products"
                                    class="w-full pl-10 pr-3 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 focus:border-ink focus:bg-paper focus:outline-none transition-all text-sm"
                                    aria-label="Search products"
                                />
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">Category</label>
                            <div class="flex flex-wrap gap-1.5">
                                <button
                                    v-for="c in ['All', ...categories]"
                                    :key="c"
                                    @click="filters.category = c === 'All' ? '' : c"
                                    :class="[
                                        'px-3 py-1.5 rounded-full text-xs font-bold border transition-all duration-200',
                                        filters.category === c
                                            ? 'bg-ink text-paper border-ink'
                                            : 'bg-paper text-neutral-700 border-neutral-200 hover:border-ink'
                                    ]"
                                >
                                    {{ c }}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">Tags</label>
                            <div class="flex flex-wrap gap-1.5">
                                <button
                                    v-for="t in tags"
                                    :key="t"
                                    @click="toggleTag(t)"
                                    :class="[
                                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200',
                                        filters.tag === t
                                            ? 'bg-accent text-white border-accent'
                                            : 'bg-paper text-neutral-700 border-neutral-200 hover:border-accent'
                                    ]"
                                >
                                    #{{ t }}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">Price range</label>
                            <div class="flex items-center gap-2">
                                <input
                                    type="number"
                                    v-model.number="filters.minPrice"
                                    class="w-1/2 px-3 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 focus:border-ink focus:bg-paper focus:outline-none transition-all text-sm"
                                    placeholder="Min"
                                    aria-label="Minimum price"
                                />
                                <span class="text-neutral-400">–</span>
                                <input
                                    type="number"
                                    v-model.number="filters.maxPrice"
                                    class="w-1/2 px-3 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 focus:border-ink focus:bg-paper focus:outline-none transition-all text-sm"
                                    placeholder="Max"
                                    aria-label="Maximum price"
                                />
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">Sort by</label>
                            <select
                                v-model="filters.sort"
                                class="w-full px-3 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 focus:border-ink focus:bg-paper focus:outline-none transition-all text-sm"
                                aria-label="Sort products by"
                            >
                                <option value="new">Newest</option>
                                <option value="price-asc">Price: Low to High</option>
                                <option value="price-desc">Price: High to Low</option>
                            </select>
                        </div>
                        <button
                            @click="resetFilters"
                            class="w-full mt-2 px-4 py-2.5 rounded-xl bg-neutral-100 hover:bg-ink hover:text-paper text-ink text-sm font-bold transition-all"
                        >
                            Reset filters
                        </button>
                    </div>
                </aside>

                <!-- Grid / List -->
                <section class="lg:col-span-3">
                    <div class="mb-5 space-y-3">
                        <div class="flex items-center justify-between">
                            <p class="text-sm text-neutral-600">
                                Showing <span class="font-bold text-ink">{{ filtered.length }}</span>
                                {{ filtered.length === 1 ? 'product' : 'products' }}
                            </p>
                            <button
                                v-if="page < totalPages"
                                @click="nextPage"
                                class="sm:hidden inline-flex items-center gap-1 text-xs font-bold text-accent hover:text-accent-600 transition-colors"
                            >
                                Next <ChevronRight class="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <!-- Badge source legend -->
                        <div class="flex items-center gap-3 text-[11px] text-neutral-500">
                            <span class="inline-flex items-center gap-1">
                                <Tag class="w-3 h-3" />
                                Tagged
                            </span>
                            <span class="text-neutral-300">·</span>
                            <span class="inline-flex items-center gap-1">
                                <Sparkles class="w-3 h-3" />
                                Auto-detected
                            </span>
                            <span class="text-neutral-300">·</span>
                            <span class="text-neutral-400">Hover badges for details</span>
                        </div>
                        <!-- Active filter badges -->
                        <div
                            v-if="filters.category || filters.tag || filters.minPrice != null || filters.maxPrice != null || filters.q"
                            class="flex flex-wrap items-center gap-1.5"
                        >
                            <span class="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mr-0.5">Active:</span>
                            <span
                                v-if="filters.q"
                                class="inline-flex items-center gap-1 px-2 py-1 bg-neutral-100 rounded-full text-[10px] font-bold text-ink"
                            >
                                "{{ filters.q }}"
                                <button @click="filters.q = ''; page = 1" class="hover:text-accent transition-colors"><X class="w-3 h-3" /></button>
                            </span>
                            <span
                                v-if="filters.category"
                                class="inline-flex items-center gap-1 px-2 py-1 bg-neutral-100 rounded-full text-[10px] font-bold text-ink"
                            >
                                {{ filters.category }}
                                <button @click="filters.category = ''; page = 1" class="hover:text-accent transition-colors"><X class="w-3 h-3" /></button>
                            </span>
                            <span
                                v-if="filters.tag"
                                class="inline-flex items-center gap-1 px-2 py-1 bg-accent/10 rounded-full text-[10px] font-bold text-accent"
                            >
                                #{{ filters.tag }}
                                <button @click="filters.tag = ''; page = 1" class="hover:text-accent-600 transition-colors"><X class="w-3 h-3" /></button>
                            </span>
                            <span
                                v-if="filters.minPrice != null || filters.maxPrice != null"
                                class="inline-flex items-center gap-1 px-2 py-1 bg-neutral-100 rounded-full text-[10px] font-bold text-ink"
                            >
                                ${{ filters.minPrice ?? '0' }}–${{ filters.maxPrice ?? '∞' }}
                                <button @click="filters.minPrice = null; filters.maxPrice = null; page = 1" class="hover:text-accent transition-colors"><X class="w-3 h-3" /></button>
                            </span>
                            <button
                                @click="resetFilters"
                                class="text-[10px] font-bold text-neutral-400 hover:text-accent underline underline-offset-2 transition-colors ml-1"
                            >
                                Clear all
                            </button>
                        </div>
                    </div>

                    <!-- Skeleton Loading -->
                    <div v-if="loadingProducts" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 animate-pulse">
                        <div v-for="i in 6" :key="'s-' + i" class="bg-paper border border-neutral-200 rounded-2xl overflow-hidden">
                            <div class="h-48 sm:h-56 bg-neutral-200"></div>
                            <div class="p-5 space-y-3">
                                <div class="h-3 w-16 bg-neutral-200 rounded"></div>
                                <div class="h-5 w-32 bg-neutral-200 rounded"></div>
                                <div class="h-3 w-48 bg-neutral-200 rounded"></div>
                                <div class="flex items-center justify-between pt-2">
                                    <div class="h-6 w-16 bg-neutral-200 rounded"></div>
                                    <div class="h-4 w-12 bg-neutral-200 rounded"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Empty State -->
                    <div v-else-if="filtered.length === 0" class="bg-paper border border-neutral-200 rounded-2xl p-12 sm:p-16 text-center">
                        <div class="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search class="w-8 h-8 text-neutral-400" />
                        </div>
                        <h3 class="text-lg font-bold text-ink mb-1">No products match your filters</h3>
                        <p class="text-sm text-neutral-500 max-w-sm mx-auto">
                            Try adjusting your search, category, or price range to find what you're looking for.
                        </p>
                        <button
                            @click="resetFilters"
                            class="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-ink text-paper text-sm font-bold rounded-full hover:bg-neutral-800 transition-all duration-300"
                        >
                            <RefreshCw class="w-4 h-4" />
                            Reset all filters
                        </button>
                    </div>

                    <!-- Product Grid -->
                    <transition-group
                        v-else
                        name="list"
                        tag="div"
                        :class="view === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5' : 'flex flex-col gap-4'"
                    >
                        <article
                            v-for="p in paginated"
                            :key="p.id"
                            v-show="view === 'grid'"
                            class="bg-paper border border-neutral-200 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-ink hover:shadow-[0_12px_32px_-8px_rgb(0_0_0_/0.12)] group/card"
                        >
                            <RouterLink :to="'/product/' + p.id" class="block">
                                <div class="relative h-48 sm:h-56 bg-neutral-100 overflow-hidden">
                                    <LazyImage
                                        :src="p.image"
                                        :alt="p.name"
                                        wrapper-class="w-full h-full"
                                        img-class="group-hover/card:scale-110"
                                    />
                                    <ProductBadge
                                        v-if="p.badge"
                                        :label="p.badge"
                                        :variant="p.badgeVariant"
                                        :source="p.badgeSource"
                                        :tooltip="p.badgeTooltip"
                                        class="absolute top-3 left-3 z-10"
                                    />
                                    <!-- Wishlist heart: always visible — hover can't be relied on
                                         for touch devices, and a saved state should be seen at a
                                         glance. Kept outside the RouterLink so the click never
                                         triggers navigation. -->
                                    <div class="absolute top-3 right-3 z-10">
                                        <WishListBtn
                                            :item="{ id: p.id, name: p.name, price: p.price, image: p.image, category: p.category }"
                                            size="sm"
                                            class="shadow-md"
                                            @added="toast.success('Added to wishlist!')"
                                            @removed="toast.success('Removed from wishlist')"
                                        />
                                    </div>
                                    <!-- Quick add: desktop hover reveal only -->
                                    <button
                                        class="absolute top-14 right-3 z-10 w-9 h-9 rounded-full bg-paper text-ink flex items-center justify-center hover:bg-ink hover:text-paper transition-all shadow-md opacity-0 group-hover/card:opacity-100 translate-y-1 group-hover/card:translate-y-0 duration-300"
                                        @click.prevent="addToCart(p)"
                                    >
                                        <Plus class="w-4 h-4" />
                                    </button>
                                </div>
                                <div class="p-5">
                                    <p class="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">{{ p.category }}</p>
                                    <h3 class="font-bold text-lg text-ink mt-1 group-hover/card:text-accent transition-colors">{{ p.name }}</h3>
                                    <p class="text-sm text-neutral-500 mt-1 line-clamp-2">{{ p.description }}</p>
                                    <div class="mt-4 flex items-center justify-between">
                                        <span class="text-xl font-bold text-ink tabular-nums">${{ p.price }}</span>
                                        <span class="inline-flex items-center gap-1 text-xs font-bold text-ink group-hover/card:text-accent transition-colors">
                                            View <ArrowRight class="w-3.5 h-3.5" />
                                        </span>
                                    </div>
                                </div>
                            </RouterLink>
                        </article>

                        <article
                            v-for="p in paginated"
                            :key="'l-' + p.id"
                            v-show="view === 'list'"
                            class="bg-paper border border-neutral-200 rounded-2xl overflow-hidden transition-all duration-300 hover:border-ink group/list"
                        >
                            <RouterLink :to="'/product/' + p.id" class="flex flex-col sm:flex-row">
                                <div class="relative h-48 sm:h-auto sm:w-48 shrink-0 bg-neutral-100 overflow-hidden">
                                    <LazyImage
                                        :src="p.image"
                                        :alt="p.name"
                                        wrapper-class="w-full h-full"
                                        img-class="group-hover/list:scale-110"
                                    />
                                    <ProductBadge
                                        v-if="p.badge"
                                        :label="p.badge"
                                        :variant="p.badgeVariant"
                                        :source="p.badgeSource"
                                        :tooltip="p.badgeTooltip"
                                        compact
                                        class="absolute top-2 left-2 z-10"
                                    />
                                </div>
                                <div class="p-5 flex-1 flex flex-col">
                                    <p class="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">{{ p.category }}</p>
                                    <h3 class="font-bold text-lg text-ink mt-1">{{ p.name }}</h3>
                                    <p class="text-sm text-neutral-500 mt-2 flex-1">{{ p.description }}</p>
                                    <div class="mt-4 flex items-center justify-between">
                                        <span class="text-xl font-bold text-ink tabular-nums">${{ p.price }}</span>
                                        <span class="inline-flex items-center gap-1 text-xs font-bold text-ink">
                                            View <ArrowRight class="w-3.5 h-3.5" />
                                        </span>
                                    </div>
                                </div>
                            </RouterLink>
                        </article>
                    </transition-group>

                    <!-- Pagination -->
                    <div v-if="totalPages > 1" class="mt-10 flex items-center justify-center gap-2">
                        <button
                            @click="prevPage"
                            :disabled="page === 1"
                            class="w-10 h-10 rounded-full border border-neutral-200 flex items-center justify-center text-ink hover:border-ink hover:bg-ink hover:text-paper transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-paper disabled:hover:text-ink"
                        >
                            <ChevronLeft class="w-4 h-4" />
                        </button>
                        <span class="px-4 text-sm font-bold text-ink tabular-nums">{{ page }} / {{ totalPages }}</span>
                        <button
                            @click="nextPage"
                            :disabled="page === totalPages"
                            class="w-10 h-10 rounded-full border border-neutral-200 flex items-center justify-center text-ink hover:border-ink hover:bg-ink hover:text-paper transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-paper disabled:hover:text-ink"
                        >
                            <ChevronRight class="w-4 h-4" />
                        </button>
                    </div>
                </section>
            </div>
        </section>

        <!-- CTA Banner -->
        <section class="mt-16 sm:mt-24 bg-ink overflow-hidden">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 grid lg:grid-cols-2 gap-10 sm:gap-12 items-center">
                <div class="space-y-6 text-paper">
                    <span class="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-accent">
                        <Sparkles class="w-4 h-4" />
                        Limited offer
                    </span>
                    <h3 class="text-3xl sm:text-4xl md:text-5xl font-elegant font-bold leading-tight">
                        Get <span class="italic text-accent">20% off</span> your first order.
                    </h3>
                    <p class="text-lg text-neutral-400 font-light max-w-md">
                        Use code <span class="font-bold text-paper px-2 py-1 bg-accent rounded-md ml-1">WELCOME20</span> at checkout — limited time only.
                    </p>
                    <div class="flex items-center gap-3 pt-2">
                        <RouterLink to="/checkout" class="btn-accent shine-effect">
                            Redeem Offer <ArrowRight class="w-4 h-4" />
                        </RouterLink>
                        <RouterLink to="/product" class="btn-outline border-neutral-700 text-paper hover:bg-paper hover:text-ink">
                            Browse Shop
                        </RouterLink>
                    </div>
                </div>
                <div class="hidden lg:flex justify-end">
                    <div class="relative">
                        <div class="w-72 h-72 rounded-full bg-accent/20 blur-3xl absolute -top-10 -right-10"></div>
                        <div class="relative grid grid-cols-2 gap-3">
                            <div class="space-y-3 pt-12">
                                <div class="bg-paper rounded-2xl p-3 shadow-2xl">
                                    <div class="h-32 rounded-xl bg-neutral-100 overflow-hidden">
                                        <LazyImage
                                            :src="featuredProducts[0]?.image || 'https://placehold.co/600x400/e4e4e7/a1a1aa?text=P'"
                                            alt=""
                                            wrapper-class="w-full h-32"
                                        />
                                    </div>
                                    <p class="mt-2 text-xs font-bold text-ink truncate">{{ featuredProducts[0]?.name || 'Product' }}</p>
                                    <p class="text-xs text-accent font-bold mt-1">${{ featuredProducts[0]?.price || '00' }}</p>
                                </div>
                                <div class="bg-paper rounded-2xl p-3 shadow-2xl">
                                    <div class="h-32 rounded-xl bg-neutral-100 overflow-hidden">
                                        <LazyImage
                                            :src="featuredProducts[2]?.image || 'https://placehold.co/600x400/e4e4e7/a1a1aa?text=P'"
                                            alt=""
                                            wrapper-class="w-full h-32"
                                        />
                                    </div>
                                    <p class="mt-2 text-xs font-bold text-ink truncate">{{ featuredProducts[2]?.name || 'Product' }}</p>
                                    <p class="text-xs text-accent font-bold mt-1">${{ featuredProducts[2]?.price || '00' }}</p>
                                </div>
                            </div>
                            <div class="space-y-3">
                                <div class="bg-paper rounded-2xl p-3 shadow-2xl">
                                    <div class="h-32 rounded-xl bg-neutral-100 overflow-hidden">
                                        <LazyImage
                                            :src="featuredProducts[1]?.image || 'https://placehold.co/600x400/e4e4e7/a1a1aa?text=P'"
                                            alt=""
                                            wrapper-class="w-full h-32"
                                        />
                                    </div>
                                    <p class="mt-2 text-xs font-bold text-ink truncate">{{ featuredProducts[1]?.name || 'Product' }}</p>
                                    <p class="text-xs text-accent font-bold mt-1">${{ featuredProducts[1]?.price || '00' }}</p>
                                </div>
                                <div class="bg-paper rounded-2xl p-3 shadow-2xl">
                                    <div class="h-32 rounded-xl bg-neutral-100 overflow-hidden">
                                        <LazyImage
                                            :src="featuredProducts[3]?.image || 'https://placehold.co/600x400/e4e4e7/a1a1aa?text=P'"
                                            alt=""
                                            wrapper-class="w-full h-32"
                                        />
                                    </div>
                                    <p class="mt-2 text-xs font-bold text-ink truncate">{{ featuredProducts[3]?.name || 'Product' }}</p>
                                    <p class="text-xs text-accent font-bold mt-1">${{ featuredProducts[3]?.price || '00' }}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    </div>
</template>

<style scoped>
/* ── Product list transitions ──────────────────────────── */
.list-enter-active {
    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.list-leave-active {
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.list-enter-from {
    opacity: 0;
    transform: translateY(16px) scale(0.96);
}
.list-leave-to {
    opacity: 0;
    transform: translateY(-8px) scale(0.96);
}
.list-move {
    transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

/* ── Quick add button pulse animation ──────────────────── */
@keyframes quick-add-pop {
    0% { transform: scale(1); }
    40% { transform: scale(1.3); }
    100% { transform: scale(1); }
}
.quick-add-pop {
    animation: quick-add-pop 0.35s ease-out;
}
</style>
