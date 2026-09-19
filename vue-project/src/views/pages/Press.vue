<script setup>
import { Newspaper, Download, Mail, Calendar, ArrowRight } from 'lucide-vue-next'

const pressReleases = [
    { date: '2026-06-15', title: 'AlieeShop Launches Sustainable Collection', summary: 'New eco-friendly line made from recycled materials debuts this summer.', category: 'Product Launch' },
    { date: '2026-05-02', title: 'AlieeShop Reaches 1 Million Customers Milestone', summary: 'Company celebrates significant growth and community expansion across 30+ countries.', category: 'Company News' },
    { date: '2026-03-18', title: 'Series B Funding Announcement', summary: 'AlieeShop secures $50M in Series B funding to accelerate global expansion.', category: 'Funding' },
    { date: '2026-01-10', title: 'AlieeShop Named Top Employer 2026', summary: 'Recognized for outstanding workplace culture and employee satisfaction.', category: 'Awards' }
]

const mediaKit = [
    { name: 'Brand Logos (PNG, SVG)', size: '2.4 MB' },
    { name: 'Brand Guidelines', size: '5.1 MB' },
    { name: 'Product Photography', size: '128 MB' },
    { name: 'Executive Bios', size: '1.2 MB' }
]

const pressContacts = [
    { name: 'Sarah Johnson', role: 'Head of PR', email: 'press@alieeshop.com' },
    { name: 'Michael Chen', role: 'Investor Relations', email: 'ir@alieeshop.com' }
]
</script>

<template>
    <div class="bg-paper min-h-screen">
        <section class="section py-12 md:py-16">
            <!-- Header -->
            <div class="text-center mb-14 max-w-2xl mx-auto">
                <span class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-ink text-paper mb-5 shadow-[0_8px_24px_-6px_rgb(249_115_22_/_0.45)]">
                    <Newspaper class="w-7 h-7 text-accent" />
                </span>
                <h1 class="heading-hero text-4xl sm:text-5xl md:text-6xl text-ink mb-4">
                    Press &
                    <span class="text-accent">media</span>
                </h1>
                <p class="text-neutral-600 text-lg">Latest news, press releases, and media resources.</p>
            </div>

            <!-- Press Releases -->
            <div class="mb-12">
                <div class="flex items-end justify-between mb-7">
                    <div>
                        <span class="text-xs font-bold uppercase tracking-[0.2em] text-accent">Latest news</span>
                        <h2 class="font-elegant font-bold text-3xl text-ink mt-2">Press releases</h2>
                    </div>
                </div>
                <div class="space-y-4">
                    <article
                        v-for="(release, idx) in pressReleases"
                        :key="idx"
                        class="card-base p-6 group"
                    >
                        <div class="flex items-center flex-wrap gap-3 mb-3">
                            <span class="badge-ghost">{{ release.category }}</span>
                            <span class="text-sm text-neutral-500 inline-flex items-center gap-1.5">
                                <Calendar class="w-3.5 h-3.5" />
                                {{ release.date }}
                            </span>
                        </div>
                        <h3 class="text-xl font-bold text-ink mb-2 group-hover:text-accent transition-colors">
                            {{ release.title }}
                        </h3>
                        <p class="text-neutral-600 mb-4 leading-relaxed">{{ release.summary }}</p>
                        <a href="#" class="inline-flex items-center gap-2 text-sm font-bold text-accent hover:gap-3 transition-all">
                            Read full release
                            <ArrowRight class="w-4 h-4" />
                        </a>
                    </article>
                </div>
            </div>

            <!-- Media Kit -->
            <div class="card-flat p-8 mb-10">
                <div class="mb-6">
                    <span class="text-xs font-bold uppercase tracking-[0.2em] text-accent">Resources</span>
                    <h2 class="font-elegant font-bold text-2xl text-ink mt-2">Media kit</h2>
                    <p class="text-sm text-neutral-600 mt-2">Download official AlieeShop brand assets and resources.</p>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div v-for="(item, idx) in mediaKit" :key="idx"
                        class="flex items-center justify-between p-4 bg-neutral-50 rounded-xl hover:bg-neutral-100 transition-colors group">
                        <div>
                            <p class="font-semibold text-ink">{{ item.name }}</p>
                            <p class="text-xs text-neutral-500 mt-0.5">{{ item.size }}</p>
                        </div>
                        <button class="w-10 h-10 rounded-full bg-ink text-paper hover:bg-accent inline-flex items-center justify-center transition-colors shrink-0">
                            <Download class="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            <!-- Press Contacts -->
            <div class="bg-ink text-paper rounded-3xl p-8 md:p-10 relative overflow-hidden">
                <div class="absolute top-0 right-0 w-72 h-72 bg-accent/10 rounded-full -mr-36 -mt-36"></div>
                <div class="relative z-10">
                    <div class="mb-7">
                        <span class="text-xs font-bold uppercase tracking-[0.2em] text-accent">Get in touch</span>
                        <h2 class="font-elegant font-bold text-3xl mt-2">Press contacts</h2>
                        <p class="text-neutral-400 text-sm mt-2">For media inquiries, please reach out to our PR team.</p>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div v-for="contact in pressContacts" :key="contact.email"
                            class="bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10">
                            <p class="font-bold text-lg">{{ contact.name }}</p>
                            <p class="text-neutral-400 text-sm mb-4">{{ contact.role }}</p>
                            <a :href="`mailto:${contact.email}`"
                                class="inline-flex items-center gap-2 text-paper hover:text-accent font-semibold text-sm transition-colors">
                                <Mail class="w-4 h-4" />
                                {{ contact.email }}
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    </div>
</template>
