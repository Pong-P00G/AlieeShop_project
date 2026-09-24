import { ref, onMounted, onUnmounted } from 'vue';

/**
 * Reactive CSS media-query matcher.
 *
 * Returns a ref that tracks whether `query` currently matches. When
 * `window.matchMedia` is unavailable (e.g. jsdom during tests) the ref stays at
 * `fallback`, so components render a single, predictable branch instead of
 * duplicating markup that only CSS can hide.
 *
 * @param {string} query    Media query, e.g. '(min-width: 1024px)'.
 * @param {boolean} fallback Value to use where matchMedia is not available.
 */
export function useMediaQuery(query, fallback = false) {
    const matches = ref(fallback);

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        matches.value = window.matchMedia(query).matches;
    }

    let mql = null;
    const onChange = (event) => { matches.value = event.matches; };

    onMounted(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
        mql = window.matchMedia(query);
        matches.value = mql.matches;
        // Older Safari exposes only addListener/removeListener.
        if (mql.addEventListener) mql.addEventListener('change', onChange);
        else if (mql.addListener) mql.addListener(onChange);
    });

    onUnmounted(() => {
        if (!mql) return;
        if (mql.removeEventListener) mql.removeEventListener('change', onChange);
        else if (mql.removeListener) mql.removeListener(onChange);
    });

    return matches;
}
