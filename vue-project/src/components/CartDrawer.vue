<script setup>
import { computed } from 'vue';
import { useShopStore } from '../stores/shop';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-vue-next';
import LazyImage from './LazyImage.vue';
import { RouterLink } from 'vue-router';
import { useToast } from '../composables/useToast';

const shop = useShopStore();
const toast = useToast();

const totalQty = computed(() => shop.cart.reduce((s, i) => s + i.qty, 0));
const totalPrice = computed(() => shop.cart.reduce((s, i) => s + i.qty * i.price, 0));

/**
 * Human label for a cart line's selected variant. Variant objects come in a
 * few shapes depending on where the item was added: full API variants
 * ({ options: [...] } or { variant_size, variant_color, variant_storage }),
 * legacy local carts ({ size }), or bare skus.
 */
const variantLabel = (variant) => {
    if (!variant) return '';
    const optionValues = variant.options?.map(o => o.value).filter(Boolean);
    if (optionValues?.length) return optionValues.join(' / ');
    const fields = [variant.variant_size, variant.variant_color, variant.variant_storage, variant.size]
        .filter(Boolean);
    if (fields.length) return fields.join(' / ');
    if (variant.sku) return variant.sku;
    return variant.variant_id ? `Option ${variant.variant_id}` : '';
};

const inc = (idx) => shop.updateQuantity(idx, shop.cart[idx].qty + 1);

const dec = (idx) => {
    const item = shop.cart[idx];
    if (!item) return;
    if (item.qty > 1) {
        shop.updateQuantity(idx, item.qty - 1);
    } else {
        // Removing the last unit — offer undo
        const removedItem = { ...item };
        shop.removeFromCart(idx);
        toast.warning(`${removedItem.title} removed`, {
            duration: 5000,
            action: {
                label: 'Undo',
                handler: () => {
                    shop.addToCart(removedItem);
                },
            },
        });
    }
};

const remove = (idx) => {
    const item = shop.cart[idx];
    if (!item) return;
    const removedItem = { ...item };
    shop.removeFromCart(idx);
    toast.warning(`${removedItem.title} removed`, {
        duration: 5000,
        action: {
            label: 'Undo',
            handler: () => {
                shop.addToCart(removedItem);
            },
        },
    });
};

const close = () => shop.closeCart();
</script>

<template>
    <transition name="fade">
        <div v-if="shop.cartOpen" class="fixed inset-0 z-[60] flex justify-end" @click.self="close">
            <div class="absolute inset-0 bg-ink/50 backdrop-blur-sm"></div>

            <transition name="slide-x">
                <aside
                    v-if="shop.cartOpen"
                    class="relative bg-paper w-full max-w-md h-full flex flex-col shadow-2xl"
                >
                    <div class="flex items-center justify-between px-6 py-5 border-b border-neutral-200">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-ink text-paper flex items-center justify-center">
                                <ShoppingBag class="w-5 h-5" />
                            </div>
                            <div>
                                <h3 class="text-base font-bold text-ink">Your Cart</h3>
                                <p class="text-xs text-neutral-500 tabular-nums">{{ totalQty }} {{ totalQty === 1 ? 'item' : 'items' }}</p>
                            </div>
                        </div>
                        <button
                            @click="close"
                            class="w-9 h-9 rounded-full hover:bg-neutral-100 flex items-center justify-center transition-colors"
                            aria-label="Close cart"
                        >
                            <X class="w-5 h-5 text-ink" />
                        </button>
                    </div>

                    <div class="flex-1 overflow-y-auto px-6 py-4">
                        <div
                            v-if="!shop.cart.length"
                            class="flex flex-col items-center justify-center h-full text-center py-12"
                        >
                            <div class="w-20 h-20 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
                                <ShoppingBag class="w-10 h-10 text-neutral-400" />
                            </div>
                            <h4 class="text-lg font-bold text-ink mb-2">Your cart is empty</h4>
                            <p class="text-sm text-neutral-500 mb-6 max-w-xs">Browse our collections and add a few favorites.</p>
                            <RouterLink
                                to="/product"
                                @click="close"
                                class="inline-flex items-center gap-2 px-5 py-2.5 bg-ink text-paper text-sm font-bold rounded-full hover:bg-neutral-800 transition-all"
                            >
                                Shop Now
                                <ArrowRight class="w-4 h-4" />
                            </RouterLink>
                        </div>

                        <div v-else class="space-y-3">
                            <div
                                v-for="(it, idx) in shop.cart"
                                :key="idx"
                                class="flex gap-4 p-3 bg-neutral-50 rounded-2xl border border-neutral-100 group/item"
                            >
                                <LazyImage :src="it.image" :alt="it.title" wrapper-class="w-20 h-20 rounded-xl shrink-0" img-class="rounded-xl" />
                                <div class="flex-1 min-w-0">
                                    <h4 class="text-sm font-bold text-ink truncate">{{ it.title }}</h4>
                                    <p v-if="variantLabel(it.variant)" class="text-xs text-neutral-500 mt-0.5">
                                        {{ variantLabel(it.variant) }}
                                    </p>
                                    <p class="text-sm font-bold text-accent tabular-nums mt-1">{{ '$' }}{{ (it.price * it.qty).toFixed(2) }}</p>
                                    <div class="flex items-center gap-2 mt-2">
                                        <div class="inline-flex items-center bg-paper rounded-full border border-neutral-200">
                                            <button @click="dec(idx)" class="w-7 h-7 rounded-full flex items-center justify-center text-ink hover:bg-neutral-100">
                                                <Minus class="w-3 h-3" />
                                            </button>
                                            <span class="text-xs font-bold tabular-nums px-2 text-ink">{{ it.qty }}</span>
                                            <button @click="inc(idx)" class="w-7 h-7 rounded-full flex items-center justify-center text-ink hover:bg-neutral-100">
                                                <Plus class="w-3 h-3" />
                                            </button>
                                        </div>
                                        <button
                                            @click="remove(idx)"
                                            class="w-7 h-7 rounded-full flex items-center justify-center text-neutral-400 hover:text-accent hover:bg-accent-50 transition-colors"
                                            aria-label="Remove"
                                        >
                                            <Trash2 class="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div v-if="shop.cart.length" class="border-t border-neutral-200 px-6 py-5 bg-neutral-50">
                        <div class="flex justify-between items-baseline mb-1">
                            <span class="text-sm text-neutral-600 font-medium">Subtotal</span>
                            <span class="text-2xl font-bold text-ink tabular-nums">{{ '$' }}{{ totalPrice.toFixed(2) }}</span>
                        </div>
                        <p class="text-xs text-neutral-500 mb-4">Shipping &amp; taxes calculated at checkout.</p>
                        <RouterLink
                            to="/checkout"
                            @click="close"
                            class="block w-full text-center px-6 py-3.5 bg-accent text-white font-bold text-sm rounded-full hover:bg-accent-600 transition-all duration-300 shadow-[0_8px_24px_-6px_rgb(249_115_22_/_0.45)] hover:-translate-y-0.5"
                        >
                            Checkout
                            <ArrowRight class="w-4 h-4 inline-block ml-1" />
                        </RouterLink>
                    </div>
                </aside>
            </transition>
        </div>
    </transition>
</template>

<style scoped>
.slide-x-enter-active,
.slide-x-leave-active {
    transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
.slide-x-enter-from,
.slide-x-leave-to {
    transform: translateX(100%);
}
</style>
