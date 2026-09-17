import { ref } from 'vue';
import { productAPI } from '../api/products/productApi.js';

/**
 * Real-time stock availability for wishlist items.
 *
 * Fetches each product's `total_stock` from the public
 * GET /api/products/:id endpoint and exposes per-id status.
 *
 * Caching: results persist to localStorage with a short TTL so
 * navigating back to the page doesn't re-spam the API, and are
 * re-validated on window focus (cheap single refresh) to stay
 * reasonably "live" without polling.
 *
 * Buckets match ProductDetail.vue and the backend's stockStatus
 * filters: 0 = out, 1-9 = low, >= 10 = in stock.
 */
const CACHE_KEY = 'alie_wishlist_stock_v1';
const TTL_MS = 5 * 60 * 1000; // 5 minutes

// Module-level state — shared across component instances
const stockById = ref({});   // { [productId]: { status, quantity, fetchedAt } }
const loading = ref(false);

function readCache() {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        // Drop expired entries
        const now = Date.now();
        for (const id of Object.keys(parsed)) {
            if (!parsed[id]?.fetchedAt || now - parsed[id].fetchedAt > TTL_MS) {
                delete parsed[id];
            }
        }
        return parsed;
    } catch {
        return {};
    }
}

function writeCache(cache) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch { /* storage full/blocked — cache is best-effort */ }
}

function bucket(quantity) {
    if (quantity == null || quantity <= 0) return 'out';
    if (quantity < 10) return 'low';
    return 'in';
}

/**
 * Fetch stock for the given product ids. Skips ids that are cached
 * and fresh unless force=true.
 */
async function fetchStock(ids, { force = false } = {}) {
    const uniqueIds = [...new Set(ids.map(Number).filter(Boolean))];
    if (uniqueIds.length === 0) return;

    const cache = force ? {} : readCache();
    const missing = uniqueIds.filter(id => !cache[id]);

    // Hydrate from cache immediately (stale-while-revalidate style)
    for (const id of uniqueIds) {
        if (cache[id]) stockById.value[id] = cache[id];
    }
    if (missing.length === 0) return;

    loading.value = true;
    try {
        // Public endpoint; fetch in parallel and tolerate individual
        // failures (e.g. a product deleted since it was wishlisted —
        // that item simply gets no stock info rather than failing all).
        const results = await Promise.allSettled(
            missing.map(id => productAPI.getProductById(id))
        );

        results.forEach((res, i) => {
            const id = missing[i];
            if (res.status !== 'fulfilled' || !res.value?.success || !res.value.data) return;
            const entry = {
                quantity: parseInt(res.value.data.total_stock, 10),
                productStatus: res.value.data.product_status || null,
                fetchedAt: Date.now(),
            };
            entry.status = entry.productStatus === 'active'
                ? bucket(entry.quantity)
                : 'unavailable';
            stockById.value[id] = entry;
            cache[id] = entry;
        });
        writeCache(cache);
    } finally {
        loading.value = false;
    }
}

export function useWishlistStock() {
    const stockFor = (id) => stockById.value[id] || null;
    const statusFor = (id) => stockById.value[id]?.status ?? null;
    const quantityFor = (id) => stockById.value[id]?.quantity ?? null;

    return {
        stockById,
        loading,
        fetchStock,
        stockFor,
        statusFor,
        quantityFor,
    };
}
