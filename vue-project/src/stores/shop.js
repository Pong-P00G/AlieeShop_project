import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { cartAPI } from '../api/cartApi.js'
import { wishlistAPI } from '../api/wishlistApi.js'

export const useShopStore = defineStore('shop', () => {
    const cart = ref([]) // {id, title, price, qty, variant, image}
    const wishlist = ref([]) // array of product objects {id, name, price, image, category}
    const cartSynced = ref(false)

    const cartOpen = ref(false)
    const cartTotal = computed(() => cart.value.reduce((s, i) => s + i.price * i.qty, 0))
    const cartCount = computed(() => cart.value.reduce((s, i) => s + i.qty, 0))

    // Bounce animation trigger for the navbar cart badge
    const cartBouncing = ref(false)
    let bounceTimer = null
    function triggerCartBounce() {
        cartBouncing.value = true
        if (bounceTimer) clearTimeout(bounceTimer)
        bounceTimer = setTimeout(() => {
            cartBouncing.value = false
        }, 500)
    }

    function openCart() { cartOpen.value = true }
    function closeCart() { cartOpen.value = false }
    function toggleCart() { cartOpen.value = !cartOpen.value }

    function addToCart(item) {
        const idx = cart.value.findIndex(i =>
            i.id === item.id && JSON.stringify(i.variant) === JSON.stringify(item.variant)
        )
        if (idx !== -1) {
            cart.value[idx].qty += item.qty
        } else {
            cart.value.push({ ...item })
        }
        // Trigger badge bounce animation
        triggerCartBounce()
        // Persist to localStorage
        persistCart()
    }

    function removeFromCart(index) {
        cart.value.splice(index, 1)
        persistCart()
    }

    function updateQuantity(index, qty) {
        if (qty <= 0) {
            removeFromCart(index)
        } else {
            cart.value[index].qty = qty
            persistCart()
        }
    }

    function clearCart() {
        cart.value = []
        persistCart()
    }

    function toggleWishlist(item) {
        const i = wishlist.value.findIndex(w => w.id === item.id)
        if (i === -1) wishlist.value.push({ ...item })
        else wishlist.value.splice(i, 1)
        persistWishlist()
    }

    function inWishlist(id) {
        return wishlist.value.some(w => w.id === id)
    }

    function clearWishlist() {
        wishlist.value = []
        persistWishlist()
    }

    // ── Persistence ────────────────────────────────────────────

    const CART_KEY = 'alie_cart_v1'
    const WISHLIST_KEY = 'alie_wishlist_v1'

    function persistCart() {
        try {
            localStorage.setItem(CART_KEY, JSON.stringify(cart.value))
        } catch { /* ignore */ }
    }

    function persistWishlist() {
        try {
            localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist.value))
        } catch { /* ignore */ }
    }

    function loadPersisted() {
        try {
            const raw = localStorage.getItem(CART_KEY)
            if (raw) cart.value = JSON.parse(raw)
            const wRaw = localStorage.getItem(WISHLIST_KEY)
            if (wRaw) wishlist.value = JSON.parse(wRaw)
        } catch { /* ignore */ }
    }

    // ── Backend sync ───────────────────────────────────────────

    /**
     * Sync the local cart to the backend. Called during checkout.
     * Clears the backend cart, then bulk-adds all local items in parallel.
     */
    async function syncCartToBackend() {
        try {
            // Clear backend cart first
            await cartAPI.clearCart()
            // Add all items in parallel for efficiency.
            // variantId fallback: carts persisted before the field existed
            // carry only the full `variant` object — pull the id from there
            // so those lines still hit the right stock bucket server-side.
            await Promise.all(cart.value.map(item =>
                cartAPI.addItem({
                    product_id: item.id,
                    variant_id: item.variantId ?? item.variant?.variant_id ?? null,
                    quantity: item.qty
                })
            ))
            cartSynced.value = true
        } catch (err) {
            console.error('Failed to sync cart to backend:', err)
            cartSynced.value = false
            throw err
        }
    }

    // ── Backend wishlist sync ──────────────────────────────────

    /**
     * Push the local wishlist to the backend (replaces server-side wishlist).
     */
    async function syncWishlistToBackend() {
        try {
            const productIds = wishlist.value.map(w => Number(w.id)).filter(Boolean);
            await wishlistAPI.syncWishlist(productIds);
        } catch (err) {
            console.error('Failed to sync wishlist to backend:', err);
        }
    }

    /**
     * Fetch the user's wishlist from the backend and merge it into the local store.
     * Any items that exist on the server but not locally are appended.
     */
    async function fetchWishlistFromBackend() {
        try {
            const res = await wishlistAPI.getWishlist();
            if (res.success && Array.isArray(res.data)) {
                const localIds = new Set(wishlist.value.map(w => w.id));
                for (const item of res.data) {
                    if (!localIds.has(item.productId)) {
                        wishlist.value.push({
                            id: item.productId,
                            name: item.productName,
                            price: item.basePrice,
                            image: item.thumbnail,
                        });
                    }
                }
                persistWishlist();
            }
        } catch (err) {
            console.error('Failed to fetch wishlist from backend:', err);
        }
    }

    /**
     * Merge wishlist on login: fetch server items, merge with local, sync merged
     * result to backend, then update local store from the synced result.
     * This preserves wishlist items from both the anonymous session and the
     * user's previous account sessions.
     */
    async function mergeAndSyncWishlistOnLogin() {
        let serverIds = [];
        let serverProductMap = new Map();

        try {
            // 1. Fetch server-side wishlist
            const res = await wishlistAPI.getWishlist();
            if (res.success && Array.isArray(res.data)) {
                serverIds = res.data.map(i => i.productId).filter(Boolean);
                serverProductMap = new Map(res.data.map(i => [i.productId, i]));
            }
        } catch (err) {
            // If fetch fails, just sync local items; don't lose them
            console.error('Failed to fetch server wishlist, syncing local only:', err);
        }

        try {
            // 2. Merge local IDs + server IDs (deduplicated)
            const localIds = wishlist.value.map(w => Number(w.id)).filter(Boolean);
            const mergedIds = [...new Set([...serverIds, ...localIds])];

            // 3. Rebuild local wishlist with merged set
            const seenIds = new Set();
            const merged = [];

            // Local items first (they have full product info)
            for (const item of wishlist.value) {
                const id = Number(item.id);
                if (id && !seenIds.has(id)) {
                    seenIds.add(id);
                    merged.push(item);
                }
            }

            // Server-only items
            for (const id of mergedIds) {
                if (!seenIds.has(id)) {
                    seenIds.add(id);
                    const serverItem = serverProductMap.get(id);
                    if (serverItem) {
                        merged.push({
                            id: serverItem.productId,
                            name: serverItem.productName,
                            price: serverItem.basePrice,
                            image: serverItem.thumbnail,
                        });
                    }
                }
            }

            wishlist.value = merged;
            persistWishlist();

            // 4. Sync merged set to backend
            await wishlistAPI.syncWishlist(mergedIds);
        } catch (err) {
            console.error('Failed to merge and sync wishlist:', err);
        }
    }

    // Load persisted cart on init
    loadPersisted()

    return {
        cart, wishlist, cartOpen, cartSynced, cartBouncing,
        cartTotal, cartCount,
        openCart, closeCart, toggleCart,
        addToCart, removeFromCart, updateQuantity, clearCart,
        toggleWishlist, inWishlist, clearWishlist,
        syncCartToBackend, loadPersisted,
        syncWishlistToBackend, fetchWishlistFromBackend,
        mergeAndSyncWishlistOnLogin
    }
})
