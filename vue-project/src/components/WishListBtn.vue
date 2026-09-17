<script setup>
import { computed, ref } from 'vue';
import { Heart } from 'lucide-vue-next';
import { useShopStore } from '../stores/shop';
import { useAuthStore } from '../stores/auth.js';
import { wishlistAPI } from '../api/wishlistApi.js';

const props = defineProps({
    item: { type: Object, required: true },
    size: { type: String, default: 'md' }, // sm, md, lg
    showText: { type: Boolean, default: false },
    // Skip backend sync (e.g. on cards shown before login) — local only
    sync: { type: Boolean, default: true },
});

const emit = defineEmits(['added', 'removed']);

const shop = useShopStore();
const isWishlisted = computed(() => shop.inWishlist(props.item.id));

const sizeClasses = computed(() => ({
    sm: 'w-9 h-9',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
}[props.size] || 'w-10 h-10'));

const iconSize = computed(() => ({
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
}[props.size] || 'w-5 h-5'));

// Burst particles fire once per add, driven by a key bump
const burstKey = ref(0);
// Authenticated users get their wishlist synced; guests are local-only
// (their items merge into the account on the next login).
const authStore = useAuthStore();
const isAuthed = computed(() => authStore.isAuthenticated);

const toggleWishlist = () => {
    const wasWishlisted = isWishlisted.value;
    shop.toggleWishlist(props.item);

    if (!wasWishlisted) {
        burstKey.value++; // trigger particle burst
        emit('added', props.item);
    } else {
        emit('removed', props.item);
    }

    if (props.sync && isAuthed.value) {
        // Fire-and-forget: server wishlist mirrors local state as the source
        // of truth; a failure must not roll back the optimistic UI toggle.
        wishlistAPI.syncWishlist(shop.wishlist.map(w => Number(w.id)).filter(Boolean))
            .catch(() => {});
    }
};

const handleToggle = toggleWishlist;
</script>

<style scoped>
@keyframes heartbeat {
    0% { transform: scale(1); }
    15% { transform: scale(1.3); }
    30% { transform: scale(0.95); }
    45% { transform: scale(1.15); }
    65% { transform: scale(1); }
    100% { transform: scale(1); }
}
.heartbeat {
    animation: heartbeat 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.wishlist-btn:active .heartbeat {
    animation: heartbeat 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Particle burst when an item is added */
.burst {
    position: absolute;
    inset: 0;
    pointer-events: none;
}
.burst span {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 5px;
    height: 5px;
    margin: -2.5px;
    border-radius: 9999px;
    background: var(--color-accent, #f97316);
    opacity: 0;
}
.burst span:nth-child(1) { --tx: 0px;    --ty: -16px; }
.burst span:nth-child(2) { --tx: 12px;   --ty: -10px; }
.burst span:nth-child(3) { --tx: 16px;   --ty: 2px;   }
.burst span:nth-child(4) { --tx: 10px;   --ty: 12px;  }
.burst span:nth-child(5) { --tx: -2px;   --ty: 16px;  }
.burst span:nth-child(6) { --tx: -13px;  --ty: 9px;   }
.burst span:nth-child(7) { --tx: -16px;  --ty: -3px;  }
.burst span:nth-child(8) { --tx: -10px;  --ty: -12px; }
.burst-run span {
    animation: burst 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
@keyframes burst {
    0%   { opacity: 0.95; transform: translate(0, 0) scale(1); }
    100% { opacity: 0;    transform: translate(var(--tx), var(--ty)) scale(0.4); }
}

@media (prefers-reduced-motion: reduce) {
    .heartbeat,
    .burst-run span {
        animation: none;
    }
}
</style>

<template>
    <div class="inline-flex items-center relative">
        <button
            @click="handleToggle"
            :class="[
                sizeClasses,
                'relative rounded-full transition-all duration-300 flex items-center justify-center',
                'hover:scale-110 active:scale-95',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                isWishlisted
                    ? 'bg-accent text-white shadow-[0_8px_24px_-6px_rgb(249_115_22_/_0.45)]'
                    : 'bg-paper text-ink border border-neutral-300 hover:border-ink hover:bg-ink hover:text-paper',
                'wishlist-btn'
            ]"
            :title="isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'"
            :aria-pressed="isWishlisted.toString()"
            aria-label="Toggle wishlist"
        >
            <Heart :class="[iconSize, isWishlisted ? 'fill-current heartbeat' : '']" />
            <!-- Particle burst on add; keyed so it re-runs on every add -->
            <span v-if="burstKey > 0" :key="burstKey" class="burst burst-run" aria-hidden="true">
                <span v-for="i in 8" :key="i"></span>
            </span>
        </button>
        <span v-if="showText" class="ml-2 text-sm font-medium text-ink">
            <slot name="text" :inWish="isWishlisted">
                {{ isWishlisted ? 'In Wishlist' : 'Add to Wishlist' }}
            </slot>
        </span>
    </div>
</template>
