<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { X, ShoppingCart, Check, Heart, Star, Minus, Plus } from 'lucide-vue-next'
import { useShopStore } from '../stores/shop.js'
import { useToast } from '../composables/useToast.js'
import LazyImage from './LazyImage.vue'

const props = defineProps({
    product: { type: Object, required: true },
    show: { type: Boolean, default: false },
})

const emit = defineEmits(['close'])

const shop = useShopStore()
const toast = useToast()
const router = useRouter()
const quantity = ref(1)
const selectedImage = ref(0)
const addingItem = ref(false)

const images = computed(() => {
    return props.product.images?.length > 0
        ? props.product.images
        : [{ image_url: props.product.image || 'https://placehold.co/600x700/e4e4e7/a1a1aa?text=P' }]
})

const addToCart = () => {
    if (addingItem.value) return

    // Variant-tracked products need an explicit choice made on the detail
    // page — a variantless cart line cannot be stock-checked properly.
    if (props.product.variants?.length > 0) {
        toast.info('Choose an option first')
        close()
        router.push('/product/' + props.product.id)
        return
    }

    shop.addToCart({
        id: props.product.id,
        title: props.product.name || props.product.product_name,
        price: parseFloat(props.product.price || props.product.base_price || 0),
        qty: quantity.value,
        image: props.product.image || props.product.thumbnail,
        variant: null,
        variantId: null,
    })
    toast.success('"' + (props.product.name || props.product.product_name) + '" added to cart')

    // Animate button, then close modal + open drawer
    addingItem.value = true
    setTimeout(() => {
        shop.openCart()
        close()
        addingItem.value = false
    }, 500)
}

const close = () => {
    quantity.value = 1
    selectedImage.value = 0
    addingItem.value = false
    emit('close')
}
</script>

<template>
    <transition name="modal-fade">
        <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
            @click.self="close">
            <div class="absolute inset-0 bg-ink/60 backdrop-blur-sm"></div>

            <div class="relative bg-paper rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-modal-in">
                <button @click="close"
                    class="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-paper shadow-md flex items-center justify-center text-ink hover:bg-neutral-100 transition-colors">
                    <X class="w-5 h-5" />
                </button>

                <div class="grid md:grid-cols-2 gap-0">
                    <!-- Image -->
                    <div class="p-6 bg-neutral-50">
                        <div class="relative rounded-2xl overflow-hidden bg-neutral-100 mb-3">
                            <LazyImage
                                :src="images[selectedImage]?.image_url || images[0]?.image_url"
                                :alt="product.name"
                                wrapper-class="w-full aspect-[4/5]"
                                img-class="w-full h-full object-cover"
                            />
                        </div>
                        <div v-if="images.length > 1" class="flex gap-2 overflow-x-auto">
                            <button v-for="(img, idx) in images" :key="idx"
                                @click="selectedImage = idx"
                                :class="['w-14 h-14 rounded-xl overflow-hidden border-2 transition-all shrink-0',
                                    selectedImage === idx ? 'border-accent' : 'border-transparent opacity-60 hover:opacity-100']">
                                <LazyImage :src="img.image_url" :alt="''" wrapper-class="w-full h-full" img-class="w-full h-full object-cover" />
                            </button>
                        </div>
                    </div>

                    <!-- Details -->
                    <div class="p-6 sm:p-8 flex flex-col">
                        <div class="mb-1">
                            <span class="badge-ghost text-[10px]">{{ product.category || product.category_name || 'General' }}</span>
                        </div>
                        <h2 class="text-2xl font-elegant font-bold text-ink mb-2">{{ product.name || product.product_name }}</h2>

                        <div class="flex items-center gap-2 mb-4">
                            <div class="flex items-center">
                                <Star v-for="i in 5" :key="i" class="w-4 h-4"
                                    :class="i <= 4 ? 'text-amber-400 fill-amber-400' : 'text-neutral-300'" />
                            </div>
                            <span class="text-xs text-neutral-500">(128 reviews)</span>
                        </div>

                        <p class="text-2xl font-bold text-accent tabular-nums mb-4">
                            ${{ parseFloat(product.price || product.base_price || 0).toFixed(2) }}
                        </p>

                        <p class="text-sm text-neutral-600 leading-relaxed mb-6 line-clamp-4">
                            {{ product.description || product.descriptions || 'No description available.' }}
                        </p>

                        <!-- Quantity -->
                        <div class="flex items-center gap-3 mb-6">
                            <span class="text-xs font-bold uppercase tracking-wider text-neutral-500">Qty</span>
                            <div class="flex items-center border border-neutral-200 rounded-full">
                                <button @click="quantity = Math.max(1, quantity - 1)"
                                    class="w-9 h-9 flex items-center justify-center text-ink hover:bg-neutral-100 rounded-l-full transition-colors">
                                    <Minus class="w-3.5 h-3.5" />
                                </button>
                                <span class="w-10 text-center text-sm font-bold text-ink tabular-nums">{{ quantity }}</span>
                                <button @click="quantity++"
                                    class="w-9 h-9 flex items-center justify-center text-ink hover:bg-neutral-100 rounded-r-full transition-colors">
                                    <Plus class="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        <!-- Actions -->
                        <div class="flex flex-col gap-2 mt-auto">
                            <button @click="addToCart"
                                :disabled="addingItem"
                                class="w-full py-3.5 text-sm font-bold rounded-full transition-all duration-300"
                                :class="addingItem
                                    ? 'bg-success text-white scale-[1.02] shadow-[0_8px_24px_-6px_rgb(34_197_94_/_0.45)]'
                                    : 'btn-accent shine-effect'">
                                <transition name="icon-swap" mode="out-in">
                                    <Check v-if="addingItem" key="check" class="w-4 h-4" />
                                    <ShoppingCart v-else key="cart" class="w-4 h-4" />
                                </transition>
                                <transition name="icon-swap" mode="out-in">
                                    <span v-if="addingItem" key="added">Added!</span>
                                    <span v-else key="add">Add to cart</span>
                                </transition>
                            </button>
                            <div class="flex gap-2">
                                <button class="flex-1 btn-outline text-sm py-3">
                                    <Heart class="w-4 h-4" />
                                    Save
                                </button>
                                <RouterLink :to="'/product/' + product.id" @click="close"
                                    class="flex-1 btn-ghost text-sm py-3 border border-neutral-200 rounded-full">
                                    View details
                                </RouterLink>
                            </div>
                        </div>

                        <div class="mt-4 pt-4 border-t border-neutral-100 flex items-center gap-4 text-xs text-neutral-500">
                            <span class="inline-flex items-center gap-1"><Check class="w-3 h-3 text-success" /> Free shipping</span>
                            <span class="inline-flex items-center gap-1"><Check class="w-3 h-3 text-success" /> 30-day returns</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </transition>
</template>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active { transition: all 0.25s ease; }
.modal-fade-enter-from,
.modal-fade-leave-to { opacity: 0; }
.animate-modal-in {
    animation: modalIn 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes modalIn {
    from { opacity: 0; transform: scale(0.95) translateY(10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
}

/* Icon swap animation — same as ShopCart */
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
