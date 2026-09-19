<script setup>
import { ref, computed } from 'vue'
import { useHead } from '@unhead/vue'
import { RouterLink } from 'vue-router'
import { ArrowLeftRight, X, Plus, Star, ShoppingCart, ArrowRight } from 'lucide-vue-next'
import LazyImage from '../../components/LazyImage.vue'

useHead({
    title: 'Product Comparison | AlieeShop',
    meta: [
        { name: 'description', content: 'Compare products side by side at AlieeShop. Find the perfect fit by comparing features, prices, and ratings.' },
        { property: 'og:title', content: 'Product Comparison | AlieeShop' },
        { property: 'og:description', content: 'Compare products side by side at AlieeShop. Find the perfect fit by comparing features, prices, and ratings.' },
        { name: 'twitter:title', content: 'Product Comparison | AlieeShop' },
        { name: 'twitter:description', content: 'Compare products side by side at AlieeShop.' },
    ],
    link: [
        { rel: 'canonical', href: 'https://alieeshop.com/compare' },
    ],
})
import { useShopStore } from '../../stores/shop.js'
import { useToast } from '../../composables/useToast.js'

const shop = useShopStore()
const toast = useToast()

// Sample products for comparison demonstration
const allProducts = [
    { id: 1, name: 'Classic White Shirt', price: 89, rating: 4.5, reviews: 128, category: 'Tops', brand: 'Aliee', material: '100% Organic Cotton', fit: 'Regular', sizes: 'XS-XXL', colors: 'White, Black, Blue', care: 'Machine Wash', origin: 'Portugal', image: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=400&h=500&fit=crop' },
    { id: 2, name: 'Tailored Blazer', price: 245, rating: 4.7, reviews: 89, category: 'Outerwear', brand: 'Aliee', material: 'Wool Blend', fit: 'Slim', sizes: 'XS-XL', colors: 'Navy, Charcoal, Black', care: 'Dry Clean', origin: 'Italy', image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400&h=500&fit=crop' },
    { id: 3, name: 'Slim Fit Denim', price: 120, rating: 4.3, reviews: 256, category: 'Bottoms', brand: 'Aliee', material: 'Stretch Denim', fit: 'Slim', sizes: '28-38', colors: 'Indigo, Black, Grey', care: 'Machine Wash', origin: 'Japan', image: 'https://images.unsplash.com/photo-1485518882345-15568b007407?w=400&h=500&fit=crop' },
    { id: 4, name: 'Cashmere Sweater', price: 195, rating: 4.8, reviews: 67, category: 'Knitwear', brand: 'Aliee', material: '100% Cashmere', fit: 'Relaxed', sizes: 'XS-XL', colors: 'Camel, Black, Grey', care: 'Hand Wash', origin: 'Scotland', image: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&h=500&fit=crop' },
]

const selectedProducts = ref([allProducts[0], allProducts[1], allProducts[2]])

const comparisonAttributes = [
    { key: 'price', label: 'Price', type: 'price' },
    { key: 'rating', label: 'Rating', type: 'rating' },
    { key: 'category', label: 'Category', type: 'text' },
    { key: 'brand', label: 'Brand', type: 'text' },
    { key: 'material', label: 'Material', type: 'text' },
    { key: 'fit', label: 'Fit', type: 'text' },
    { key: 'sizes', label: 'Available Sizes', type: 'text' },
    { key: 'colors', label: 'Colors', type: 'text' },
    { key: 'care', label: 'Care Instructions', type: 'text' },
    { key: 'origin', label: 'Country of Origin', type: 'text' },
]

const availableToAdd = computed(() => allProducts.filter(p => !selectedProducts.value.find(s => s.id === p.id)))

const addProduct = (product) => {
    if (selectedProducts.value.length >= 4) {
        toast.warning('Maximum 4 products can be compared at once')
        return
    }
    selectedProducts.value.push(product)
    toast.success(`"${product.name}" added to comparison`)
}

const removeProduct = (productId) => {
    if (selectedProducts.value.length <= 2) {
        toast.warning('Need at least 2 products to compare')
        return
    }
    selectedProducts.value = selectedProducts.value.filter(p => p.id !== productId)
}

const bestValue = computed(() => {
    if (selectedProducts.value.length === 0) return null
    return selectedProducts.value.reduce((best, p) => 
        (p.price < best.price ? p : best), selectedProducts.value[0])
})

const bestRated = computed(() => {
    if (selectedProducts.value.length === 0) return null
    return selectedProducts.value.reduce((best, p) => 
        (p.rating > best.rating ? p : best), selectedProducts.value[0])
})

const isWinner = (product, attr) => {
    if (attr === 'price') return bestValue.value?.id === product.id
    if (attr === 'rating') return bestRated.value?.id === product.id
    return false
}

const addToCart = (product) => {
    shop.addToCart({ id: product.id, title: product.name, price: product.price, qty: 1 })
    toast.success(`"${product.name}" added to cart`)
}
</script>

<template>
    <div class="bg-paper min-h-screen">
        <section class="section py-12 md:py-16">
            <!-- Header -->
            <div class="text-center mb-12 max-w-2xl mx-auto">
                <span class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-ink text-paper mb-5 shadow-[0_8px_24px_-6px_rgb(249_115_22_/_0.45)]">
                    <ArrowLeftRight class="w-7 h-7 text-accent" />
                </span>
                <h1 class="heading-hero text-4xl sm:text-5xl md:text-6xl text-ink mb-4">
                    Product
                    <span class="text-accent">comparison</span>
                </h1>
                <p class="text-neutral-600 text-lg">Compare features, prices, and ratings to find the perfect product for you.</p>
            </div>

            <!-- No products selected -->
            <div v-if="selectedProducts.length < 2" class="card-flat text-center py-16">
                <div class="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                    <ArrowLeftRight class="w-8 h-8 text-neutral-400" />
                </div>
                <h3 class="text-xl font-bold text-ink mb-2">Select products to compare</h3>
                <p class="text-neutral-500 mb-6">Add at least 2 products to start comparing.</p>
                <RouterLink to="/product" class="btn-accent inline-flex">
                    Browse products
                    <ArrowRight class="w-4 h-4" />
                </RouterLink>
            </div>

            <!-- Comparison Table -->
            <div v-else class="overflow-x-auto">
                <div class="min-w-[640px]">
                    <!-- Product Cards Row -->
                    <div class="grid gap-4" :style="{ gridTemplateColumns: `200px repeat(${selectedProducts.length}, 1fr)` }">
                        <!-- Empty header cell -->
                        <div class="hidden sm:block"></div>

                        <!-- Product cards -->
                        <div v-for="product in selectedProducts" :key="product.id" class="relative">
                            <div class="card-flat p-4 text-center group">
                                <button @click="removeProduct(product.id)"
                                    class="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-paper border border-neutral-200 flex items-center justify-center text-neutral-400 hover:text-danger hover:border-danger transition-all opacity-0 group-hover:opacity-100 z-10">
                                    <X class="w-3.5 h-3.5" />
                                </button>
                                <div class="h-44 rounded-xl bg-neutral-100 overflow-hidden mb-4">
                                    <LazyImage :src="product.image" :alt="product.name" wrapper-class="w-full h-full" img-class="w-full h-full object-cover" />
                                </div>
                                <h3 class="font-bold text-ink text-sm leading-tight">{{ product.name }}</h3>
                                <p class="text-lg font-bold text-accent mt-1 tabular-nums">${{ product.price }}</p>
                                <div class="flex items-center justify-center gap-1 mt-1">
                                    <Star v-for="i in 5" :key="i" class="w-3 h-3"
                                        :class="i <= Math.floor(product.rating) ? 'text-amber-400 fill-amber-400' : 'text-neutral-300'" />
                                    <span class="text-xs text-neutral-500 ml-1">({{ product.reviews }})</span>
                                </div>
                                <button @click="addToCart(product)"
                                    class="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-ink text-paper text-xs font-bold rounded-full hover:bg-accent transition-all">
                                    <ShoppingCart class="w-3.5 h-3.5" />
                                    Add to cart
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Attribute Rows -->
                    <div class="mt-6 space-y-1">
                        <div v-for="attr in comparisonAttributes" :key="attr.key"
                            class="grid gap-1" :style="{ gridTemplateColumns: `200px repeat(${selectedProducts.length}, 1fr)` }">
                            <div class="flex items-center px-4 py-3 bg-neutral-50 rounded-xl text-sm font-bold text-ink">
                                {{ attr.label }}
                            </div>
                            <div v-for="product in selectedProducts" :key="product.id"
                                class="flex items-center justify-center px-4 py-3 bg-paper border border-neutral-100 rounded-xl"
                                :class="{ 'ring-2 ring-accent/30 bg-accent-50/40': isWinner(product, attr.key) }">
                                <template v-if="attr.type === 'price'">
                                    <span class="text-sm font-bold tabular-nums"
                                        :class="isWinner(product, attr.key) ? 'text-success' : 'text-ink'">
                                        ${{ product[attr.key] }}
                                    </span>
                                    <span v-if="isWinner(product, attr.key)" class="ml-1.5 badge-success text-[9px]">Best price</span>
                                </template>
                                <template v-else-if="attr.type === 'rating'">
                                    <div class="flex items-center gap-1.5">
                                        <span class="text-sm font-bold tabular-nums"
                                            :class="isWinner(product, attr.key) ? 'text-success' : 'text-ink'">
                                            {{ product[attr.key] }}
                                        </span>
                                        <Star class="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                                        <span v-if="isWinner(product, attr.key)" class="badge-success text-[9px]">Best rated</span>
                                    </div>
                                </template>
                                <template v-else>
                                    <span class="text-sm text-neutral-700 text-center">{{ product[attr.key] }}</span>
                                </template>
                            </div>
                        </div>
                    </div>

                    <!-- Summary -->
                    <div class="mt-6 grid gap-1" :style="{ gridTemplateColumns: `200px repeat(${selectedProducts.length}, 1fr)` }">
                        <div class="flex items-center px-4 py-3 bg-neutral-50 rounded-xl text-sm font-bold text-ink">
                            Summary
                        </div>
                        <div v-for="product in selectedProducts" :key="'sum-'+product.id"
                            class="flex flex-col items-center justify-center px-4 py-4 bg-ink text-paper rounded-xl">
                            <p class="text-xs text-neutral-400 mb-1">Total score</p>
                            <p class="text-2xl font-bold tabular-nums">
                                {{ ((product.rating * 10) + (100 - product.price)).toFixed(0) }}
                            </p>
                            <p class="text-[10px] text-neutral-500 mt-1">out of 100</p>
                        </div>
                    </div>
                </div>

                <!-- Add more products -->
                <div v-if="availableToAdd.length > 0 && selectedProducts.length < 4" class="mt-8 text-center">
                    <div class="inline-flex items-center gap-2 flex-wrap justify-center">
                        <span class="text-sm text-neutral-500 font-medium">Add another product:</span>
                        <button v-for="p in availableToAdd" :key="p.id"
                            @click="addProduct(p)"
                            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-paper border border-neutral-200 rounded-full text-xs font-bold text-ink hover:border-accent hover:text-accent transition-all">
                            <Plus class="w-3 h-3" />
                            {{ p.name }}
                        </button>
                    </div>
                </div>
            </div>
        </section>
    </div>
</template>
