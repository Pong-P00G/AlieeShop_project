<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { useProductStore } from '../../stores/product.js';
import { useAuthStore } from '../../stores/auth.js';
import { useShopStore } from '../../stores/shop.js';
import { storeToRefs } from 'pinia';
import { useHead } from '@unhead/vue';
import LazyImage from '../../components/LazyImage.vue';
import {
    Heart,
    Share2,
    ShoppingCart,
    Plus,
    Minus,
    Check,
    X,
    ShieldCheck,
    CreditCard,
    RotateCcw,
    Clock,
    ChevronRight,
    PackageOpen,
    AlertTriangle,
    ZoomIn,
    Sparkles,
    Star,
    MessageSquare,
    ThumbsUp,
    Truck,
} from 'lucide-vue-next';
import { reviewAPI } from '../../api/reviewApi.js';
import { useToast } from '../../composables/useToast.js';

const route = useRoute();
const router = useRouter();
const shop = useShopStore();
const productStore = useProductStore();
const authStore = useAuthStore();

const { currentProduct: product, loading, error } = storeToRefs(productStore);

const selectedImage = ref(0);
const selectedVariant = ref(null);
const quantity = ref(1);
const showImageModal = ref(false);
const relatedProducts = ref([]);
const addingItem = ref(false);

const isAdmin = computed(() => authStore.user?.role_id === 1);

const productImages = computed(() => {
    if (!product.value) return [];
    const images = [];

    // Try thumbnail first, then fall back to main_image
    const primaryImage = product.value.thumbnail || product.value.main_image;
    if (primaryImage) {
        images.push(primaryImage);
    }

    if (product.value.images && Array.isArray(product.value.images)) {
        product.value.images.forEach(img => {
            if (img.image_url && img.image_url !== primaryImage) {
                images.push(img.image_url);
            }
        });
    }

    return images;
});

const currentImage = computed(() => {
    return productImages.value[selectedImage.value] || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"%3E%3Crect width="800" height="800" fill="%23f4f4f5"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="%23a1a1aa"%3ENo Image%3C/text%3E%3C/svg%3E';
});

const variants = computed(() => {
    return product.value?.variants || [];
});

const hasVariants = computed(() => variants.value.length > 0);

const currentPrice = computed(() => {
    if (selectedVariant.value) {
        return parseFloat(selectedVariant.value.variant_price || selectedVariant.value.unit_price || 0);
    }
    return parseFloat(product.value?.base_price || 0);
});

const originalPrice = computed(() => {
    if (selectedVariant.value) {
        return parseFloat(selectedVariant.value.variant_price || 0);
    }
    return parseFloat(product.value?.base_price || 0);
});

// Discount info: check for discount_id from getProductById response
const hasDiscount = computed(() => {
    return product.value?.discount_id && parseFloat(product.value.discount_amount || 0) > 0;
});

const discountPercentage = computed(() => {
    if (!hasDiscount.value) return 0;
    const discount = parseFloat(product.value.discount_amount);
    const basePrice = parseFloat(product.value.base_price);
    return Math.round((discount / basePrice) * 100);
});

const stockStatus = computed(() => {
    const stock = parseInt(product.value?.total_stock || 0);
    if (stock === 0) return { text: 'Out of stock', available: false };
    if (stock < 10) return { text: `Only ${stock} left`, available: true };
    return { text: 'In stock', available: true };
});

const breadcrumbs = computed(() => [
    { name: 'Home', path: '/' },
    { name: 'Products', path: '/product' },
    { name: product.value?.category_name || 'Category', path: `/product?category=${product.value?.category_name}` },
    { name: product.value?.product_name || 'Product', path: '' }
]);

const loadProduct = async () => {
    const productId = route.params.id;
    await productStore.fetchProductById(productId);
    if (product.value?.category_name) {
        await loadRelatedProducts();
    }
};

const loadRelatedProducts = async () => {
    await productStore.fetchAllProducts();
    const allProducts = productStore.products || [];

    relatedProducts.value = allProducts
        .filter(p =>
            p.category_name === product.value.category_name &&
            p.product_id !== product.value.product_id
        )
        .slice(0, 4);
};

const selectImage = (index) => {
    selectedImage.value = index;
};

const selectVariant = (variant) => {
    selectedVariant.value = variant;
};

const incrementQuantity = () => {
    const maxStock = parseInt(product.value?.total_stock || 0);
    if (quantity.value < maxStock) {
        quantity.value++;
    }
};

const decrementQuantity = () => {
    if (quantity.value > 1) {
        quantity.value--;
    }
};

const addToCart = () => {
    if (addingItem.value) return;

    // Variant-tracked products must not enter the cart without a variant:
    // backend stock is tracked per variant, and a variantless line would
    // either fail with 409 or drain the wrong bucket at checkout.
    if (hasVariants.value && !selectedVariant.value) {
        toast.error('Please select an option before adding to cart');
        return;
    }

    shop.addToCart({
        id: product.value.product_id,
        title: product.value.product_name,
        price: currentPrice.value,
        qty: quantity.value,
        image: currentImage.value,
        variant: selectedVariant.value || null,
        variantId: selectedVariant.value?.variant_id ?? null,
    });
    toast.success(`Added ${quantity.value} item(s) to cart!`);

    addingItem.value = true;
    setTimeout(() => {
        shop.openCart();
        addingItem.value = false;
    }, 500);
};

const buyNow = () => {
    if (addingItem.value) return;

    if (hasVariants.value && !selectedVariant.value) {
        toast.error('Please select an option before buying');
        return;
    }

    shop.addToCart({
        id: product.value.product_id,
        title: product.value.product_name,
        price: currentPrice.value,
        qty: quantity.value,
        image: currentImage.value,
        variant: selectedVariant.value || null,
        variantId: selectedVariant.value?.variant_id ?? null,
    });
    toast.success(`Added ${quantity.value} item(s) to cart!`);
    router.push('/checkout');
};

const addToWishlist = () => {
    shop.toggleWishlist({
        id: product.value.product_id,
        name: product.value.product_name,
        price: currentPrice.value,
        image: currentImage.value,
        category: product.value.category_name,
    });
    toast.success(shop.inWishlist(product.value.product_id) ? 'Added to wishlist!' : 'Removed from wishlist!');
};

const showShareMenu = ref(false);

const shareProduct = () => {
    if (navigator.share) {
        navigator.share({
            title: product.value?.product_name,
            text: `Check out ${product.value?.product_name} at AlieeShop`,
            url: window.location.href
        });
    } else {
        showShareMenu.value = !showShareMenu.value;
    }
};

const shareUrl = computed(() => encodeURIComponent(window.location.href));
const shareText = computed(() => encodeURIComponent(`Check out ${product.value?.product_name} at AlieeShop`));

const shareLinks = computed(() => [
    { name: 'Facebook',   url: `https://www.facebook.com/sharer/sharer.php?u=${shareUrl.value}`,           color: 'bg-[#1877F2]' },
    { name: 'Twitter',    url: `https://twitter.com/intent/tweet?text=${shareText.value}&url=${shareUrl.value}`, color: 'bg-[#000000]' },
    { name: 'LinkedIn',   url: `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl.value}`,         color: 'bg-[#0A66C2]' },
    { name: 'Pinterest',  url: `https://pinterest.com/pin/create/button/?url=${shareUrl.value}&description=${shareText.value}`, color: 'bg-[#E60023]' },
    { name: 'Copy Link',  url: null, color: 'bg-zinc-600' },
]);

const shareOnPlatform = (link) => {
    if (link.url) {
        window.open(link.url, '_blank', 'width=600,height=400');
    } else {
        navigator.clipboard.writeText(window.location.href);
        showShareMenu.value = false;
    }
    showShareMenu.value = false;
};

const editProduct = () => {
    router.push(`/admin/products/${product.value.product_id}/edit`);
};

const deleteProduct = async () => {
    if (confirm(`Are you sure you want to delete ${product.value.product_name}?`)) {
        const result = await productStore.deleteProduct(product.value.product_id);
        if (result.success) {
            router.push('/products');
        }
    }
};

const viewRelatedProduct = (productId) => {
    router.push(`/product/${productId}`);
};

const handleImageError = (event) => {
    event.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"%3E%3Crect width="800" height="800" fill="%23f4f4f5"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="%23a1a1aa"%3ENo Image%3C/text%3E%3C/svg%3E';
};

const formatPrice = (price) => parseFloat(price || 0).toFixed(2);

// ── Reviews ─────────────────────────────────────────────────────────────────



const toast = useToast();

const reviews = ref([]);
const ratingSummary = ref(null);
const loadingReviews = ref(false);

const reviewForm = ref({ rating: 0, title: '', comment: '' });
const submittingReview = ref(false);
const showReviewForm = ref(false);
const hoverRating = ref(0);
const userReview = ref(null); // user's own review for this product

const isAuthenticated = computed(() => authStore.isAuthenticated);

const averageRating = computed(() => {
    if (!ratingSummary.value) return 0;
    return ratingSummary.value.average_rating || 0;
});

const totalReviews = computed(() => {
    if (!ratingSummary.value) return 0;
    return ratingSummary.value.total_reviews || 0;
});

const ratingDistribution = computed(() => {
    if (!ratingSummary.value) return [];
    const total = totalReviews.value || 1;
    return [
        { stars: 5, count: ratingSummary.value.five_star || 0, pct: Math.round(((ratingSummary.value.five_star || 0) / total) * 100) },
        { stars: 4, count: ratingSummary.value.four_star || 0, pct: Math.round(((ratingSummary.value.four_star || 0) / total) * 100) },
        { stars: 3, count: ratingSummary.value.three_star || 0, pct: Math.round(((ratingSummary.value.three_star || 0) / total) * 100) },
        { stars: 2, count: ratingSummary.value.two_star || 0, pct: Math.round(((ratingSummary.value.two_star || 0) / total) * 100) },
        { stars: 1, count: ratingSummary.value.one_star || 0, pct: Math.round(((ratingSummary.value.one_star || 0) / total) * 100) },
    ];
});

const fetchReviews = async () => {
    const productId = route.params.id;
    if (!productId) return;
    loadingReviews.value = true;
    try {
        const res = await reviewAPI.getProductReviews(productId);
        if (res.success) {
            reviews.value = res.data.reviews || [];
            ratingSummary.value = res.data.summary || null;
            // Check if current user has already reviewed
            if (isAuthenticated.value) {
                userReview.value = reviews.value.find(r => r.user_id === authStore.user?.id) || null;
            }
        }
    } catch (err) {
        console.error('Failed to load reviews:', err);
    } finally {
        loadingReviews.value = false;
    }
};

const submitReview = async () => {
    if (reviewForm.value.rating === 0) {
        toast.warning('Please select a rating');
        return;
    }
    submittingReview.value = true;
    try {
        const res = await reviewAPI.submitReview(route.params.id, {
            rating: reviewForm.value.rating,
            title: reviewForm.value.title,
            comment: reviewForm.value.comment,
        });
        if (res.success) {
            toast.success('Review submitted! Pending moderation.');
            showReviewForm.value = false;
            reviewForm.value = { rating: 0, title: '', comment: '' };
            await fetchReviews();
        } else {
            toast.error(res.message || 'Failed to submit review');
        }
    } catch (err) {
        console.error('Review submission error:', err);
        toast.error(err.response?.data?.message || 'Failed to submit review');
    } finally {
        submittingReview.value = false;
    }
};

const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => i < rating);
};

const formatReviewDate = (d) => {
    if (!d) return '';
    const date = new Date(d);
    const now = new Date();
    const diff = Math.floor((now - date) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return `${diff} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

watch(() => route.params.id, async (newId) => {
    if (newId) {
        selectedImage.value = 0;
        selectedVariant.value = null;
        quantity.value = 1;
        await loadProduct();
    }
});

// ── SEO: Dynamic product meta tags (reactive getters — no watch needed) ────────

const productDescription = computed(() => {
    if (!product.value) return '';
    const desc = product.value.descriptions || product.value.product_description || '';
    return desc.substring(0, 200) || `Shop ${product.value.product_name} at AlieeShop`;
});

// useHead with reactive getter functions — replaces entries automatically when refs change
useHead({
    title: () => product.value?.product_name || 'Product Details',
    meta: () => {
        if (!product.value) return [];
        const name = product.value.product_name;
        const desc = productDescription.value;
        const image = product.value.main_image || productImages.value[0] || '';
        const price = currentPrice.value;
        const url = `https://alieeshop.com/product/${product.value.product_id}`;
        return [
            { name: 'description', content: desc },
            { property: 'og:title', content: `${name} | AlieeShop` },
            { property: 'og:description', content: desc },
            { property: 'og:image', content: image },
            { property: 'og:url', content: url },
            { property: 'og:type', content: 'product' },
            { property: 'product:price:amount', content: String(price) },
            { property: 'product:price:currency', content: 'USD' },
            { name: 'twitter:card', content: 'summary_large_image' },
            { name: 'twitter:title', content: `${name} | AlieeShop` },
            { name: 'twitter:description', content: desc },
            { name: 'twitter:image', content: image },
        ];
    },
    link: () => product.value
        ? [{ rel: 'canonical', href: `https://alieeshop.com/product/${product.value.product_id}` }]
        : [],
});

onMounted(async () => {
    await loadProduct();
});
</script>

<template>
    <div class="bg-paper min-h-screen">
        <!-- Skeleton Loading State -->
        <div v-if="loading" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14">
                <div class="space-y-4">
                    <div class="aspect-square rounded-2xl bg-neutral-100 skeleton-shimmer"></div>
                    <div class="grid grid-cols-5 gap-3">
                        <div v-for="i in 5" :key="'sk-thumb-'+i" class="aspect-square rounded-xl bg-neutral-100 skeleton-shimmer"></div>
                    </div>
                </div>
                <div class="space-y-5">
                    <div class="h-6 w-24 skeleton-shimmer rounded-full"></div>
                    <div class="h-10 w-72 skeleton-shimmer rounded"></div>
                    <div class="h-12 w-32 skeleton-shimmer rounded"></div>
                    <div class="h-4 w-20 skeleton-shimmer rounded"></div>
                    <div class="space-y-2">
                        <div class="h-4 w-full skeleton-shimmer rounded"></div>
                        <div class="h-4 w-3/4 skeleton-shimmer rounded"></div>
                    </div>
                    <div class="flex gap-3 pt-4">
                        <div class="flex-1 h-14 skeleton-shimmer rounded-full"></div>
                        <div class="flex-1 h-14 skeleton-shimmer rounded-full"></div>
                    </div>
                    <div class="grid grid-cols-2 gap-3 pt-4">
                        <div v-for="i in 4" :key="'sk-feat-'+i" class="h-16 skeleton-shimmer rounded-xl"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="flex items-center justify-center min-h-[60vh]">
            <div class="text-center">
                <AlertTriangle class="mx-auto h-12 w-12 text-accent mb-4" :stroke-width="1.5" />
                <p class="text-neutral-700 font-medium mb-4">{{ error }}</p>
                <RouterLink to="/product" class="btn-primary">Back to products</RouterLink>
            </div>
        </div>

        <!-- Product Content -->
        <div v-else-if="product" class="section py-8 md:py-12">
            <!-- Breadcrumbs -->
            <nav class="flex items-center flex-wrap gap-y-1 text-sm mb-8">
                <template v-for="(crumb, index) in breadcrumbs">
                    <RouterLink
                        v-if="crumb.path"
                        :key="`crumb-${index}`"
                        :to="crumb.path"
                        class="text-neutral-500 hover:text-accent transition-colors"
                    >
                        {{ crumb.name }}
                    </RouterLink>
                    <span v-else :key="`crumb-text-${index}`" class="text-ink font-semibold">{{ crumb.name }}</span>
                    <ChevronRight v-if="index < breadcrumbs.length - 1" :key="`chevron-${index}`" class="w-4 h-4 mx-1.5 text-neutral-400" />
                </template>
            </nav>

            <!-- Product Info Grid -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 mb-16">
                <!-- Left: Images -->
                <div class="space-y-4">
                    <div class="relative aspect-square card-flat overflow-hidden bg-neutral-50">
                        <LazyImage
                            :src="currentImage"
                            :alt="product.product_name"
                            wrapper-class="w-full h-full cursor-zoom-in"
                            img-class="w-full h-full object-cover"
                            @click="showImageModal = true"
                        />
                        <div v-if="hasDiscount && discountPercentage > 0" class="absolute top-4 left-4">
                            <span class="badge-accent">-{{ discountPercentage }}% OFF</span>
                        </div>
                        <div class="absolute top-4 right-4 flex gap-2">
                            <button
                                @click="addToWishlist"
                                class="w-11 h-11 rounded-full bg-paper shadow-md hover:bg-accent hover:text-white text-ink inline-flex items-center justify-center transition-all duration-200"
                            >
                                <Heart class="w-5 h-5" />
                            </button>
                            <div class="relative">
                                <button
                                    @click.stop="shareProduct"
                                    class="w-11 h-11 rounded-full bg-paper shadow-md hover:bg-accent hover:text-white text-ink inline-flex items-center justify-center transition-all duration-200"
                                >
                                    <Share2 class="w-5 h-5" />
                                </button>
                                <!-- Social Share Popup -->
                                <div v-if="showShareMenu" @click.stop
                                    class="absolute right-0 top-full mt-2 w-44 bg-paper rounded-2xl shadow-xl border border-neutral-200 z-50 overflow-hidden max-w-[calc(100vw-2rem)]">
                                    <div class="p-1.5">
                                        <button v-for="link in shareLinks" :key="link.name"
                                            @click="shareOnPlatform(link)"
                                            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-neutral-50 transition-colors text-left">
                                            <span :class="['w-7 h-7 rounded-lg inline-flex items-center justify-center text-paper text-xs font-bold shrink-0', link.color]">
                                                {{ link.name.charAt(0) }}
                                            </span>
                                            <span class="text-sm font-semibold text-ink">{{ link.name }}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-paper/90 backdrop-blur-sm inline-flex items-center justify-center text-ink">
                            <ZoomIn class="w-5 h-5" />
                        </div>
                    </div>

                    <div v-if="productImages.length > 1" class="grid grid-cols-5 gap-3">
                        <button
                            v-for="(image, index) in productImages"
                            :key="index"
                            @click="selectImage(index)"
                            :class="[
                                'aspect-square rounded-xl overflow-hidden border-2 transition-all duration-200',
                                selectedImage === index ? 'border-accent' : 'border-neutral-200 hover:border-ink'
                            ]"
                        >
                            <LazyImage
                                :src="image"
                                :alt="`${product.product_name} ${index + 1}`"
                                wrapper-class="w-full h-full"
                                img-class="w-full h-full object-cover"
                            />
                        </button>
                    </div>
                </div>

                <!-- Right: Product Info -->
                <div class="space-y-6">
                    <span class="badge-ghost">{{ product.category_name || 'Uncategorized' }}</span>

                    <h1 class="heading-hero text-3xl sm:text-4xl md:text-5xl text-ink">
                        {{ product.product_name }}
                    </h1>

                    <div class="flex items-baseline gap-4 flex-wrap">
                        <span class="text-4xl font-bold text-ink tabular-nums">
                            {{ '$' }}{{ formatPrice(currentPrice) }}
                        </span>
                        <span v-if="hasDiscount && discountPercentage > 0" class="text-base sm:text-xl text-neutral-400 line-through tabular-nums">
                            {{ '$' }}{{ formatPrice(originalPrice) }}
                        </span>
                        <span v-if="hasDiscount && discountPercentage > 0" class="badge-accent">
                            Save {{ '$' }}{{ formatPrice(product.discount_amount) }}
                        </span>
                    </div>

                    <div class="flex items-center gap-2 text-sm font-semibold">
                        <span class="relative flex h-2.5 w-2.5">
                            <span class="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 pulse-dot"></span>
                            <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-success"></span>
                        </span>
                        <span :class="stockStatus.available ? 'text-success' : 'text-danger'">
                            {{ stockStatus.text }}
                        </span>
                    </div>

                    <p v-if="product.descriptions || product.product_description" class="text-neutral-600 leading-relaxed">
                        {{ product.descriptions || product.product_description }}
                    </p>

                    <!-- Variants -->
                    <div v-if="hasVariants" class="space-y-3 pt-2">
                        <h3 class="text-xs font-bold uppercase tracking-[0.2em] text-ink">Select options</h3>
                        <div class="flex flex-wrap gap-2.5">
                            <button
                                v-for="variant in variants"
                                :key="variant.variant_id"
                                @click="selectVariant(variant)"
                                :class="[
                                    'group relative px-5 py-3 rounded-xl border-2 text-sm font-semibold transition-all duration-200 text-left',
                                    selectedVariant?.variant_id === variant.variant_id
                                        ? 'border-ink bg-ink text-paper'
                                        : 'border-neutral-300 text-ink hover:border-ink'
                                ]"
                            >
                                <span class="block text-xs opacity-80">
                                    {{ variant.options?.map(o => o.value).filter(Boolean).join(' / ') || [variant.variant_storage, variant.variant_size, variant.variant_color].filter(Boolean).join(' / ') || `Option ${variant.variant_id}` }}
                                </span>
                                <span class="block text-sm font-bold mt-0.5" :class="selectedVariant?.variant_id === variant.variant_id ? 'text-paper' : 'text-ink'">
                                    {{ variant.variant_price ? '$' + parseFloat(variant.variant_price).toFixed(2) : 'See price' }}
                                </span>
                            </button>
                        </div>
                    </div>

                    <!-- Quantity -->
                    <div class="space-y-3 pt-2">
                        <h3 class="text-xs font-bold uppercase tracking-[0.2em] text-ink">Quantity</h3>
                        <div class="flex items-center gap-4">
                            <div class="inline-flex items-center border-2 border-neutral-300 rounded-full overflow-hidden">
                                <button
                                    @click="decrementQuantity"
                                    :disabled="quantity <= 1"
                                    class="w-10 h-10 sm:w-11 sm:h-11 hover:bg-neutral-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center justify-center"
                                    aria-label="Decrease quantity"
                                >
                                    <Minus class="w-4 h-4" />
                                </button>
                                <span class="w-12 text-center font-bold text-ink tabular-nums">
                                    {{ quantity }}
                                </span>
                                <button
                                    @click="incrementQuantity"
                                    :disabled="quantity >= parseInt(product.total_stock)"
                                    class="w-10 h-10 sm:w-11 sm:h-11 hover:bg-neutral-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center justify-center"
                                    aria-label="Increase quantity"
                                >
                                    <Plus class="w-4 h-4" />
                                </button>
                            </div>
                            <span class="text-sm text-neutral-500 tabular-nums">
                                {{ product.total_stock }} available
                            </span>
                        </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="flex flex-col sm:flex-row gap-3 pt-2">
                        <button
                            @click="addToCart"
                            :disabled="!stockStatus.available || addingItem"
                            :title="hasVariants && !selectedVariant ? 'Select an option first' : null"
                            class="flex-1 py-4 text-sm font-bold rounded-full transition-all duration-300"
                            :class="addingItem
                                ? 'bg-success text-white scale-[1.02] shadow-[0_8px_24px_-6px_rgb(34_197_94_/_0.45)]'
                                : hasVariants && !selectedVariant
                                    ? 'btn-primary opacity-60 ring-2 ring-accent/40'
                                    : 'btn-primary disabled:opacity-40 disabled:hover:translate-y-0'"
                        >
                            <transition name="icon-swap" mode="out-in">
                                <Check v-if="addingItem" key="check" class="w-4 h-4" />
                                <ShoppingCart v-else key="cart" class="w-4 h-4" />
                            </transition>
                            <transition name="icon-swap" mode="out-in">
                                <span v-if="addingItem" key="added">Added!</span>
                                <span v-else key="add">Add to cart</span>
                            </transition>
                        </button>
                        <button
                            @click="buyNow"
                            :disabled="!stockStatus.available"
                            class="btn-accent shine-effect flex-1 py-4 disabled:opacity-40 disabled:hover:translate-y-0"
                        >
                            Buy now
                        </button>
                    </div>

                    <!-- Admin Actions -->
                    <div v-if="isAdmin" class="flex gap-3 pt-4 border-t border-neutral-200">
                        <button @click="editProduct" class="btn-outline flex-1">Edit product</button>
                        <button @click="deleteProduct" class="btn-outline flex-1 border-danger! text-danger! hover:bg-danger! hover:text-paper!">
                            Delete
                        </button>
                    </div>

                    <!-- Features -->
                    <div class="grid grid-cols-2 gap-3 pt-6 border-t border-neutral-200">
                        <div class="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 transition-all duration-200 hover:bg-ink hover:text-paper group/feat">
                            <div class="w-10 h-10 rounded-full bg-paper inline-flex items-center justify-center text-ink shrink-0 transition-colors group-hover/feat:bg-accent group-hover/feat:text-white">
                                <Truck class="w-5 h-5 group-hover/feat:scale-110 transition-transform" />
                            </div>
                            <span class="text-xs font-semibold text-ink group-hover/feat:text-paper transition-colors">Free shipping</span>
                        </div>
                        <div class="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 transition-all duration-200 hover:bg-ink hover:text-paper group/feat">
                            <div class="w-10 h-10 rounded-full bg-paper inline-flex items-center justify-center text-ink shrink-0 transition-colors group-hover/feat:bg-accent group-hover/feat:text-white">
                                <CreditCard class="w-5 h-5 group-hover/feat:scale-110 transition-transform" />
                            </div>
                            <span class="text-xs font-semibold text-ink group-hover/feat:text-paper transition-colors">Secure payment</span>
                        </div>
                        <div class="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 transition-all duration-200 hover:bg-ink hover:text-paper group/feat">
                            <div class="w-10 h-10 rounded-full bg-paper inline-flex items-center justify-center text-ink shrink-0 transition-colors group-hover/feat:bg-accent group-hover/feat:text-white">
                                <RotateCcw class="w-5 h-5 group-hover/feat:scale-110 transition-transform" />
                            </div>
                            <span class="text-xs font-semibold text-ink group-hover/feat:text-paper transition-colors">Easy returns</span>
                        </div>
                        <div class="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 transition-all duration-200 hover:bg-ink hover:text-paper group/feat">
                            <div class="w-10 h-10 rounded-full bg-paper inline-flex items-center justify-center text-ink shrink-0 transition-colors group-hover/feat:bg-accent group-hover/feat:text-white">
                                <Clock class="w-5 h-5 group-hover/feat:scale-110 transition-transform" />
                            </div>
                            <span class="text-xs font-semibold text-ink group-hover/feat:text-paper transition-colors">24/7 support</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Related Products -->
            <section v-if="relatedProducts.length > 0" class="mt-12 sm:mt-16">
                <div class="text-center mb-10">
                    <span class="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-accent mb-3">
                        <Sparkles class="w-3.5 h-3.5" />
                        You may also love
                    </span>
                    <h2 class="heading-hero text-2xl sm:text-3xl md:text-4xl text-ink">Related products</h2>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    <article
                        v-for="relatedProduct in relatedProducts"
                        :key="relatedProduct.product_id"
                        @click="viewRelatedProduct(relatedProduct.product_id)"
                        class="card-base overflow-hidden cursor-pointer group transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_32px_-8px_rgb(0_0_0_/_0.12)]"
                    >
                        <div class="aspect-square bg-neutral-100 overflow-hidden">
                            <LazyImage
                                :src="relatedProduct.main_image || 'https://via.placeholder.com/400'"
                                :alt="relatedProduct.product_name"
                                wrapper-class="w-full h-full transition-transform duration-700 group-hover:scale-110"
                                img-class="w-full h-full object-cover"
                            />
                        </div>
                        <div class="p-4 space-y-1.5">
                            <p class="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
                                {{ relatedProduct.category_name }}
                            </p>
                            <h3 class="font-bold text-sm text-ink line-clamp-2 group-hover:text-accent transition-colors">
                                {{ relatedProduct.product_name }}
                            </h3>
                            <div class="flex items-baseline gap-2 pt-1">
                                <span class="text-base font-bold text-ink tabular-nums">
                                    {{ '$' }}{{ formatPrice(relatedProduct.base_price) }}
                                </span>
                            </div>
                        </div>
                    </article>
                </div>
            </section>

            <!-- Reviews Section -->
            <section class="mt-12 sm:mt-16 border-t border-neutral-200 pt-10">
                <div class="flex items-start justify-between gap-6 mb-8 flex-wrap">
                    <div>
                        <span class="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-accent mb-2">
                            <MessageSquare class="w-3.5 h-3.5" />
                            Reviews
                        </span>
                        <div class="flex items-center gap-3 mt-1">
                            <h2 class="heading-hero text-2xl sm:text-3xl text-ink">Customer reviews</h2>
                            <span v-if="!loadingReviews" class="px-3 py-1 bg-neutral-100 rounded-full text-xs font-bold text-neutral-600 tabular-nums">
                                {{ totalReviews }}
                            </span>
                        </div>
                    </div>
                    <button
                        v-if="isAuthenticated && !userReview && !showReviewForm"
                        @click="showReviewForm = true"
                        class="btn-accent text-sm gap-2"
                    >
                        <Star class="w-4 h-4" />
                        Write a Review
                    </button>
                </div>

                <!-- Loading -->
                <div v-if="loadingReviews" class="py-12 text-center">
                    <div class="w-8 h-8 border-3 border-neutral-200 border-t-accent rounded-full animate-spin mx-auto"></div>
                </div>

                <div v-else-if="totalReviews > 0" class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <!-- Rating Summary Sidebar -->
                    <div class="lg:col-span-1 space-y-5">
                        <div class="card-flat p-6 text-center">
                            <p class="text-4xl sm:text-5xl font-bold text-ink tabular-nums">{{ averageRating }}</p>
                            <div class="flex items-center justify-center gap-0.5 mt-2">
                                <Star
                                    v-for="(filled, i) in renderStars(Math.round(averageRating))"
                                    :key="i"
                                    :class="['w-5 h-5', filled ? 'fill-amber-400 text-amber-400' : 'fill-neutral-200 text-neutral-200']"
                                />
                            </div>
                            <p class="text-sm text-neutral-500 mt-2">{{ totalReviews }} review{{ totalReviews !== 1 ? 's' : '' }}</p>
                        </div>

                        <div class="card-flat p-5 space-y-2">
                            <div v-for="dist in ratingDistribution" :key="dist.stars" class="flex items-center gap-2">
                                <span class="text-xs font-semibold text-ink w-3 text-right tabular-nums">{{ dist.stars }}</span>
                                <Star class="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                                <div class="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
                                    <div class="h-full bg-amber-400 rounded-full transition-all" :style="{ width: dist.pct + '%' }"></div>
                                </div>
                                <span class="text-xs text-neutral-500 w-8 text-right tabular-nums">{{ dist.count }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Review List -->
                    <div class="lg:col-span-2 space-y-4">
                        <!-- Review Submission Form -->
                        <div v-if="showReviewForm" class="card-flat p-5 border-2 border-accent/20">
                            <div class="flex items-center justify-between mb-4">
                                <h3 class="font-bold text-ink">Write your review</h3>
                                <button @click="showReviewForm = false" class="text-neutral-400 hover:text-ink transition-colors">
                                    <X class="w-5 h-5" />
                                </button>
                            </div>

                            <!-- Star Selector -->
                            <div class="mb-4">
                                <p class="text-xs font-bold uppercase tracking-[0.15em] text-ink mb-2">Your Rating</p>
                                <div class="flex items-center gap-1">
                                    <button
                                        v-for="star in 5"
                                        :key="star"
                                        @click="reviewForm.rating = star"
                                        @mouseenter="hoverRating = star"
                                        @mouseleave="hoverRating = 0"
                                        class="p-0.5 transition-transform hover:scale-110"
                                    >
                                        <Star
                                            :class="['w-7 h-7 transition-colors',
                                                (hoverRating || reviewForm.rating) >= star
                                                    ? 'fill-amber-400 text-amber-400'
                                                    : 'fill-neutral-200 text-neutral-200'
                                            ]"
                                        />
                                    </button>
                                    <span v-if="reviewForm.rating > 0" class="ml-2 text-sm text-neutral-500">
                                        {{ ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][reviewForm.rating] }}
                                    </span>
                                </div>
                            </div>

                            <!-- Title -->
                            <div class="mb-3">
                                <label class="block text-xs font-bold uppercase tracking-[0.15em] text-ink mb-2">Title <span class="text-neutral-400">(optional)</span></label>
                                <input
                                    v-model="reviewForm.title"
                                    type="text"
                                    placeholder="Summary of your review"
                                    class="input-base text-sm"
                                    aria-label="Review title"
                                />
                            </div>

                            <!-- Comment -->
                            <div class="mb-4">
                                <label class="block text-xs font-bold uppercase tracking-[0.15em] text-ink mb-2">Comment <span class="text-neutral-400">(optional)</span></label>
                                <textarea
                                    v-model="reviewForm.comment"
                                    placeholder="Share your experience with this product..."
                                    class="input-base text-sm min-h-24"
                                    rows="4"
                                    aria-label="Review comment"
                                ></textarea>
                            </div>

                            <div class="flex gap-3 justify-end">
                                <button @click="showReviewForm = false" class="btn-outline text-sm" :disabled="submittingReview">
                                    Cancel
                                </button>
                                <button
                                    @click="submitReview"
                                    :disabled="submittingReview || reviewForm.rating === 0"
                                    class="btn-accent text-sm gap-2"
                                >
                                    <div v-if="submittingReview" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    <Star v-else class="w-4 h-4" />
                                    {{ submittingReview ? 'Submitting...' : 'Submit Review' }}
                                </button>
                            </div>
                        </div>

                        <!-- Review Cards -->
                        <div
                            v-for="review in reviews"
                            :key="review.review_id"
                            class="card-flat p-5"
                        >
                            <div class="flex items-start gap-3">
                                <div class="w-9 h-9 rounded-full bg-neutral-100 text-neutral-600 flex items-center justify-center font-bold text-sm shrink-0">
                                    {{ (review.username || '?').charAt(0).toUpperCase() }}
                                </div>
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <p class="font-bold text-sm text-ink">{{ review.username }}</p>
                                        <span class="text-xs text-neutral-400">&middot;</span>
                                        <span class="text-xs text-neutral-500">{{ formatReviewDate(review.created_at) }}</span>
                                    </div>
                                    <div class="flex items-center gap-0.5 mt-1">
                                        <Star
                                            v-for="(filled, i) in renderStars(review.rating)"
                                            :key="i"
                                            :class="['w-3.5 h-3.5', filled ? 'fill-amber-400 text-amber-400' : 'fill-neutral-200 text-neutral-200']"
                                        />
                                    </div>
                                    <p v-if="review.title" class="font-semibold text-sm text-ink mt-2">{{ review.title }}</p>
                                    <p v-if="review.comment" class="text-sm text-neutral-600 leading-relaxed mt-1">{{ review.comment }}</p>
                                </div>
                            </div>
                        </div>

                        <!-- User already reviewed notice -->
                        <div v-if="userReview && !showReviewForm" class="p-4 bg-neutral-50 rounded-xl text-center">
                            <ThumbsUp class="w-6 h-6 text-accent mx-auto mb-2" />
                            <p class="text-sm text-neutral-600">You've reviewed this product. Thank you!</p>
                        </div>
                    </div>
                </div>

                <!-- No Reviews State -->
                <div v-else-if="!loadingReviews" class="card-flat p-10 text-center">
                    <MessageSquare class="w-14 h-14 text-neutral-200 mx-auto mb-4" />
                    <p class="text-neutral-500 font-semibold">No reviews yet</p>
                    <p class="text-xs text-neutral-400 mt-1">Be the first to share your experience!</p>
                    <button
                        v-if="isAuthenticated && !userReview"
                        @click="showReviewForm = true"
                        class="btn-accent text-sm gap-2 mt-5"
                    >
                        <Star class="w-4 h-4" />
                        Write a Review
                    </button>
                    <router-link
                        v-else-if="!isAuthenticated"
                        :to="{ name: 'login', query: { redirect: route.fullPath } }"
                        class="btn-accent text-sm gap-2 mt-5 inline-flex"
                    >
                        Sign in to review
                    </router-link>
                </div>
            </section>
        </div>

        <!-- Image Modal -->
        <div
            v-if="showImageModal"
            @click="showImageModal = false"
            class="fixed inset-0 bg-ink/95 backdrop-blur-md z-50 flex items-center justify-center p-4"
        >
            <button
                @click="showImageModal = false"
                class="absolute top-4 right-4 w-12 h-12 rounded-full bg-paper/10 hover:bg-paper/20 text-paper inline-flex items-center justify-center transition-colors"
            >
                <X class="w-6 h-6" />
            </button>
            <img
                :src="currentImage"
                :alt="product?.product_name"
                class="max-w-full max-h-full rounded-2xl shadow-2xl"
                @error="handleImageError"
            />
        </div>
    </div>
</template>

<style scoped>
/* Icon swap animation — matches ShopCart / QuickViewModal */
.icon-swap-enter-active,
.icon-swap-leave-active {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.icon-swap-enter-from {
    opacity: 0;
    transform: scale(0.6) rotate(-12deg);
}
.icon-swap-leave-to {
    opacity: 0;
    transform: scale(0.6) rotate(12deg);
}
</style>