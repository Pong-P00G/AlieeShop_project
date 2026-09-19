<script setup>
import { ref, computed } from 'vue'
import { useHead } from '@unhead/vue'
import { RouterLink } from 'vue-router'
import { BookOpen, Calendar, Clock, ArrowRight, Search, User, Sparkles } from 'lucide-vue-next'
import LazyImage from '../../components/LazyImage.vue'

useHead({
    title: 'Our Journal | AlieeShop',
    meta: [
        { name: 'description', content: 'Read the latest stories, style guides, buying tips, and company news from AlieeShop.' },
        { name: 'keywords', content: 'blog, journal, style, fashion, buying guides, AlieeShop' },
        { property: 'og:title', content: 'Our Journal | AlieeShop' },
        { property: 'og:description', content: 'Read the latest stories, style guides, buying tips, and company news from AlieeShop.' },
        { property: 'og:type', content: 'blog' },
        { name: 'twitter:title', content: 'Our Journal | AlieeShop' },
        { name: 'twitter:description', content: 'Read the latest stories, style guides, buying tips, and company news from AlieeShop.' },
    ],
    link: [
        { rel: 'canonical', href: 'https://alieeshop.com/blog' },
    ],
})

const searchQuery = ref('')
const activeCategory = ref('all')

const categories = [
    { id: 'all', label: 'All Posts' },
    { id: 'style', label: 'Style & Trends' },
    { id: 'guides', label: 'Buying Guides' },
    { id: 'sustainability', label: 'Sustainability' },
    { id: 'news', label: 'Company News' },
]

const posts = [
    {
        id: 1,
        title: 'The Ultimate Guide to Building a Capsule Wardrobe',
        excerpt: 'Discover how to curate a timeless wardrobe with versatile pieces that work for every occasion. Our comprehensive guide covers everything from color palettes to fabric choices.',
        category: 'guides',
        author: 'Bun Rathanak Pong',
        date: 'June 12, 2026',
        readTime: '8 min read',
        image: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&h=600&fit=crop',
        tags: ['wardrobe', 'minimalist', 'style']
    },
    {
        id: 2,
        title: '5 Sustainable Fashion Brands You Need to Know',
        excerpt: 'We are shining a spotlight on five independent brands that are redefining sustainable fashion through ethical production, recycled materials, and timeless design.',
        category: 'sustainability',
        author: 'Bun Rathanak Pong',
        date: 'June 8, 2026',
        readTime: '6 min read',
        image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&h=600&fit=crop',
        tags: ['sustainable', 'ethical', 'brands']
    },
    {
        id: 3,
        title: 'Spring/Summer 2026 Trends: What to Wear This Season',
        excerpt: 'From bold colors to relaxed silhouettes, here is everything you need to know about the biggest fashion trends for the warmer months ahead.',
        category: 'style',
        author: 'Bun Rathanak Pong',
        date: 'June 5, 2026',
        readTime: '5 min read',
        image: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&h=600&fit=crop',
        tags: ['trends', 'summer', 'fashion']
    },
    {
        id: 4,
        title: 'How to Choose the Perfect Pair of Denim',
        excerpt: 'Finding the right jeans can be overwhelming. Our buying guide breaks down fits, washes, and fabrics to help you find the perfect pair for your body type.',
        category: 'guides',
        author: 'Bun Rathanak Pong',
        date: 'May 28, 2026',
        readTime: '10 min read',
        image: 'https://images.unsplash.com/photo-1485518882345-15568b007407?w=800&h=600&fit=crop',
        tags: ['denim', 'buying-guide', 'fashion']
    },
    {
        id: 5,
        title: 'AlieeShop Partners with Local Artisans in Cambodia',
        excerpt: 'We are proud to announce our new partnership with Cambodian artisans, bringing handcrafted accessories and home goods to our global community.',
        category: 'news',
        author: 'Bun Rathanak Pong',
        date: 'May 20, 2026',
        readTime: '4 min read',
        image: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&h=600&fit=crop',
        tags: ['partnership', 'cambodia', 'artisans']
    },
    {
        id: 6,
        title: 'The Art of Accessorizing: Elevate Any Outfit',
        excerpt: 'Learn how the right accessories can transform a simple outfit into a statement. From scarves to jewelry, we share our top tips for accessorizing with confidence.',
        category: 'style',
        author: 'Bun Rathanak Pong',
        date: 'May 15, 2026',
        readTime: '7 min read',
        image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&h=600&fit=crop',
        tags: ['accessories', 'style', 'tips']
    },
]

const filteredPosts = computed(() => {
    let list = posts
    if (activeCategory !== 'all') {
        list = list.filter(p => p.category === activeCategory)
    }
    if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase()
        list = list.filter(p => 
            p.title.toLowerCase().includes(q) || 
            p.excerpt.toLowerCase().includes(q) ||
            p.tags.some(t => t.includes(q))
        )
    }
    return list
})

</script>

<template>
    <div class="bg-paper min-h-screen">
        <section class="section py-12 md:py-16">
            <!-- Header -->
            <div class="text-center mb-12 max-w-2xl mx-auto">
                <span class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-ink text-paper mb-5 shadow-[0_8px_24px_-6px_rgb(249_115_22_/_0.45)]">
                    <BookOpen class="w-7 h-7 text-accent" />
                </span>
                <h1 class="heading-hero text-4xl sm:text-5xl md:text-6xl text-ink mb-4">
                    Our
                    <span class="text-accent">journal</span>
                </h1>
                <p class="text-neutral-600 text-lg">Stories, guides, and ideas — curated for the curious.</p>
            </div>

            <!-- Search & Categories -->
            <div class="max-w-3xl mx-auto mb-10">
                <div class="card-flat p-2 mb-6">
                    <div class="relative">
                        <Search class="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none" />
                        <input
                            v-model="searchQuery"
                            type="text"
                            placeholder="Search articles..."
                            class="w-full pl-14 pr-5 py-4 bg-transparent text-ink placeholder:text-neutral-400 focus:outline-none text-base"
                        />
                    </div>
                </div>
                <div class="flex flex-wrap gap-2 justify-center">
                    <button
                        v-for="cat in categories"
                        :key="cat.id"
                        @click="activeCategory = cat.id"
                        :class="[
                            'px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200',
                            activeCategory === cat.id
                                ? 'bg-ink text-paper shadow-sm'
                                : 'bg-paper border border-neutral-200 text-neutral-700 hover:border-ink'
                        ]"
                    >
                        {{ cat.label }}
                    </button>
                </div>
            </div>

            <!-- Posts Grid -->
            <div v-if="filteredPosts.length > 0" class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <article v-for="post in filteredPosts" :key="post.id"
                    class="card-base overflow-hidden group flex flex-col">
                    <RouterLink :to="`/blog/${post.id}`" class="block">
                        <div class="relative h-52 overflow-hidden bg-neutral-100">
                            <LazyImage
                                :src="post.image"
                                :alt="post.title"
                                wrapper-class="w-full h-full"
                                img-class="group-hover:scale-110 transition-transform duration-500"
                            />
                            <span class="absolute top-3 left-3 badge-ghost text-[10px]">
                                {{ categories.find(c => c.id === post.category)?.label || post.category }}
                            </span>
                        </div>
                    </RouterLink>
                    <div class="p-5 flex-1 flex flex-col">
                        <div class="flex items-center gap-3 text-xs text-neutral-500 mb-3">
                            <span class="inline-flex items-center gap-1">
                                <Calendar class="w-3 h-3" />
                                {{ post.date }}
                            </span>
                            <span class="inline-flex items-center gap-1">
                                <Clock class="w-3 h-3" />
                                {{ post.readTime }}
                            </span>
                        </div>
                        <RouterLink :to="`/blog/${post.id}`" class="block flex-1">
                            <h2 class="text-lg font-bold text-ink mb-2 group-hover:text-accent transition-colors leading-snug">
                                {{ post.title }}
                            </h2>
                            <p class="text-sm text-neutral-600 leading-relaxed line-clamp-3">{{ post.excerpt }}</p>
                        </RouterLink>
                        <div class="mt-4 pt-4 border-t border-neutral-100 flex items-center justify-between">
                            <span class="inline-flex items-center gap-1.5 text-xs text-neutral-500">
                                <User class="w-3 h-3" />
                                {{ post.author }}
                            </span>
                            <RouterLink :to="`/blog/${post.id}`"
                                class="inline-flex items-center gap-1 text-xs font-bold text-ink group-hover/link:text-accent transition-colors">
                                Read
                                <ArrowRight class="w-3 h-3" />
                            </RouterLink>
                        </div>
                    </div>
                </article>
            </div>

            <!-- Empty State -->
            <div v-else class="card-flat text-center py-20">
                <div class="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                    <BookOpen class="w-8 h-8 text-neutral-400" />
                </div>
                <h3 class="text-xl font-bold text-ink mb-2">No articles found</h3>
                <p class="text-neutral-500 mb-6 max-w-md mx-auto">Try adjusting your search or category to find what you are looking for.</p>
                <button @click="searchQuery = ''; activeCategory = 'all'" class="btn-outline">Reset filters</button>
            </div>

            <!-- Newsletter CTA -->
            <div class="mt-12 bg-ink text-paper rounded-3xl p-10 md:p-14 text-center relative overflow-hidden">
                <div class="absolute top-0 right-0 w-72 h-72 bg-accent/10 rounded-full -mr-36 -mt-36"></div>
                <div class="absolute bottom-0 left-0 w-48 h-48 bg-accent/10 rounded-full -ml-24 -mb-24"></div>
                <div class="relative z-10">
                    <Sparkles class="w-10 h-10 text-accent mx-auto mb-5" />
                    <h2 class="font-elegant font-bold text-3xl md:text-4xl mb-3">Stay inspired</h2>
                    <p class="text-neutral-400 mb-7 max-w-md mx-auto">Get the latest articles, style guides, and curated picks delivered to your inbox.</p>
                    <RouterLink to="/" class="btn-accent shine-effect inline-flex">
                        Subscribe to newsletter
                        <ArrowRight class="w-4 h-4" />
                    </RouterLink>
                </div>
            </div>
        </section>
    </div>
</template>
