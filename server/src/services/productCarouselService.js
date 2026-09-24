import * as SettingsModel from '../model/settingsModel.js';
import * as ProductModel from '../model/products/productModel.js';

// ═══════════════════════════════════════════════════════════════════════════════
//  Constants
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Built-in tab keys map to product queries the storefront already knows how to
 * run (featured / new arrivals / best sellers / coming soon). Admins can
 * reorder, rename, hide and resize them, and additionally create their own
 * hand-picked tabs — those carry an arbitrary slug key and render only the
 * products picked for them.
 */
export const TAB_KEYS = ['featured', 'new-arrivals', 'best-sellers', 'coming-soon'];

export const DEFAULT_TABS = [
    { key: 'featured', label: 'Hand-picked', title: 'Featured this week', productsPerTab: 8, isActive: true, productIds: [] },
    { key: 'new-arrivals', label: 'Just landed', title: 'New Arrivals', productsPerTab: 8, isActive: true, productIds: [] },
    { key: 'best-sellers', label: 'Trending now', title: 'Best Sellers', productsPerTab: 8, isActive: true, productIds: [] },
    { key: 'coming-soon', label: 'Coming up', title: 'Coming Soon', productsPerTab: 8, isActive: true, productIds: [] },
];

export const DEFAULT_SETTINGS = {
    sectionEnabled: true,
    eyebrow: 'Discover',
    title: 'Curated Collections',
    viewAllLabel: 'View all',
    viewAllLink: '/product',
    autoplayEnabled: true,
    autoplayInterval: 4000,
};

/** Section-level settings live in store_settings under these keys. */
export const SETTING_KEYS = [
    'product_carousel_section_enabled',
    'product_carousel_eyebrow',
    'product_carousel_title',
    'product_carousel_view_all_label',
    'product_carousel_view_all_link',
    'product_carousel_autoplay_enabled',
    'product_carousel_autoplay_interval',
    'product_carousel_tabs',
];

const KEBAB_TO_CAMEL = {
    product_carousel_section_enabled: 'sectionEnabled',
    product_carousel_eyebrow: 'eyebrow',
    product_carousel_title: 'title',
    product_carousel_view_all_label: 'viewAllLabel',
    product_carousel_view_all_link: 'viewAllLink',
    product_carousel_autoplay_enabled: 'autoplayEnabled',
    product_carousel_autoplay_interval: 'autoplayInterval',
    product_carousel_tabs: 'tabs',
};

/**
 * Ceiling for the whole tab list: the four built-ins plus admin-created tabs.
 * Custom tabs are purely hand-picked collections; the built-in keys keep their
 * automatic storefront queries.
 */
export const MAX_TABS = 12;
export const MAX_CUSTOM_TABS = MAX_TABS - TAB_KEYS.length;
export const MAX_TAB_KEY = 40;
export const MAX_PRODUCTS_PER_TAB = 24;
/** A tab renders at most `productsPerTab` cards, so hand-picks are capped there too. */
export const MAX_PICKED_PRODUCTS = MAX_PRODUCTS_PER_TAB;
export const MIN_PRODUCTS_PER_TAB = 1;
const DEFAULT_PRODUCTS_PER_TAB = 8;

/** Tab keys are lowercase slugs so they are safe as DOM keys and in URLs. */
const TAB_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** True for a key the storefront can run an automatic product query for. */
export const isBuiltInTabKey = (key) => TAB_KEYS.includes(key);

/** True when `key` is shaped like a tab key (built-in or custom). */
export const isValidTabKey = (key) => (
    typeof key === 'string'
    && key.length > 0
    && key.length <= MAX_TAB_KEY
    && TAB_KEY_PATTERN.test(key)
);

/** 'weekly-deals' → 'Weekly deals', the fallback label/title for a custom tab. */
const humanizeTabKey = (key) => {
    const words = key.replace(/-/g, ' ').trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
};
export const AUTOPLAY_INTERVAL_MIN = 2000;
export const AUTOPLAY_INTERVAL_MAX = 60000;

const MAX_EYEBROW = 40;
const MAX_SECTION_TITLE = 80;
const MAX_TAB_LABEL = 40;
const MAX_TAB_TITLE = 80;
const MAX_LINK = 500;

const httpError = (status, message) => {
    const err = new Error(message);
    err.status = status;
    return err;
};

const assertAdmin = (roleId) => {
    if (roleId !== 1 && roleId !== 2) {
        throw httpError(403, 'Admin privileges required');
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  Parsing helpers
// ═══════════════════════════════════════════════════════════════════════════════

const parseBoolean = (value, fallback) => {
    if (value == null) return fallback;
    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    return fallback;
};

const normalizeText = (value, max) => {
    if (value == null) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    return trimmed.slice(0, max);
};

/** A link must be safe to hand to RouterLink: in-app path or http(s) URL. */
const isSafeLink = (link) => /^(\/[^/]|https?:\/\/)/.test(link);

const clampInt = (value, min, max, fallback) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(Math.max(Math.round(num), min), max);
};

/**
 * Hand-picked product ids: positive integers, de-duplicated, capped.
 * A tab with no picks keeps using its automatic query.
 */
export const normalizeProductIds = (value, max = MAX_PICKED_PRODUCTS) => {
    if (!Array.isArray(value)) return [];

    const ids = [];
    for (const entry of value) {
        const id = Number(entry);
        if (!Number.isInteger(id) || id <= 0) continue;
        if (ids.includes(id)) continue;
        ids.push(id);
        if (ids.length >= max) break;
    }
    return ids;
};

const parseStoredTabs = (value) => {
    if (!value) return null;
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        // Hand-edited or truncated row — fall back to the defaults below.
        return null;
    }
};

/**
 * Merge incoming tabs with the built-in defaults.
 *
 * Order is whatever was submitted (this is what the admin reorders). Keys that
 * are not valid slugs — or that duplicate an earlier entry — are dropped, and
 * every built-in tab missing from the payload is appended in its default
 * position, so a partial payload can never leave the storefront without one of
 * its data sources. Custom keys are kept and flagged with `isCustom`.
 */
export const normalizeTabs = (raw = []) => {
    const byKey = new Map();
    const order = [];

    if (Array.isArray(raw)) {
        for (const entry of raw) {
            const rawKey = typeof entry === 'string' ? entry : entry?.key;
            if (typeof rawKey !== 'string') continue;

            const key = rawKey.trim().toLowerCase();
            if (!isValidTabKey(key) || byKey.has(key)) continue;

            const defaults = DEFAULT_TABS.find(tab => tab.key === key);
            byKey.set(key, {
                key,
                label: normalizeText(entry?.label, MAX_TAB_LABEL) ?? defaults?.label ?? humanizeTabKey(key),
                title: normalizeText(entry?.title, MAX_TAB_TITLE) ?? defaults?.title ?? humanizeTabKey(key),
                productsPerTab: clampInt(
                    entry?.productsPerTab,
                    MIN_PRODUCTS_PER_TAB,
                    MAX_PRODUCTS_PER_TAB,
                    defaults?.productsPerTab ?? DEFAULT_PRODUCTS_PER_TAB
                ),
                isActive: typeof entry?.isActive === 'boolean' ? entry.isActive : (defaults?.isActive ?? true),
                productIds: normalizeProductIds(entry?.productIds),
                isCustom: !defaults,
            });
            order.push(key);
        }
    }

    for (const defaults of DEFAULT_TABS) {
        if (!byKey.has(defaults.key)) {
            byKey.set(defaults.key, { ...defaults, isCustom: false });
            order.push(defaults.key);
        }
    }

    return order.map(key => byKey.get(key));
};

const asTabList = (raw) => (Array.isArray(raw) ? raw : parseStoredTabs(raw));

/**
 * Map the stored flat rows onto a typed settings object.
 *
 * Missing keys fall back to the built-in defaults; a key that is stored but
 * blank is respected as "deliberately empty" (that is how the admin clears the
 * section heading or removes the View-all button).
 */
export const toCarouselSettings = (rows = []) => {
    const byKey = {};
    for (const row of rows) byKey[row.key] = row.value;

    const text = (key, max, fallback) => {
        if (!(key in byKey)) return fallback;
        return normalizeText(byKey[key], max) ?? '';
    };

    const interval = Number(byKey.product_carousel_autoplay_interval);
    const hasValidInterval = Number.isFinite(interval)
        && interval >= AUTOPLAY_INTERVAL_MIN
        && interval <= AUTOPLAY_INTERVAL_MAX;

    const storedTabs = asTabList(byKey.product_carousel_tabs);

    return {
        sectionEnabled: parseBoolean(byKey.product_carousel_section_enabled, DEFAULT_SETTINGS.sectionEnabled),
        eyebrow: text('product_carousel_eyebrow', MAX_EYEBROW, DEFAULT_SETTINGS.eyebrow),
        title: text('product_carousel_title', MAX_SECTION_TITLE, DEFAULT_SETTINGS.title),
        viewAllLabel: text('product_carousel_view_all_label', MAX_TAB_LABEL, DEFAULT_SETTINGS.viewAllLabel),
        viewAllLink: text('product_carousel_view_all_link', MAX_LINK, DEFAULT_SETTINGS.viewAllLink),
        autoplayEnabled: parseBoolean(byKey.product_carousel_autoplay_enabled, DEFAULT_SETTINGS.autoplayEnabled),
        autoplayInterval: hasValidInterval ? Math.round(interval) : DEFAULT_SETTINGS.autoplayInterval,
        tabs: normalizeTabs(storedTabs ?? DEFAULT_TABS),
    };
};

// ═══════════════════════════════════════════════════════════════════════════════
//  Read
// ═══════════════════════════════════════════════════════════════════════════════

export const getCarouselSettings = async () => {
    let rows = [];
    try {
        rows = await SettingsModel.getAllSettings();
    } catch {
        // store_settings unavailable — render with defaults.
        return { ...DEFAULT_SETTINGS, tabs: normalizeTabs(DEFAULT_TABS) };
    }
    const mine = rows.filter(row => SETTING_KEYS.includes(row.key));
    return toCarouselSettings(mine);
};

/** Strip the tabs out of the settings object so the payload mirrors /api/hero. */
const splitSettings = (settings) => {
    const { tabs, ...rest } = settings;
    return { settings: rest, tabs };
};

/**
 * Attach the hand-picked products to every tab that has any, resolved in the
 * stored order with one query for the whole payload.
 *
 * Tabs without picks carry an empty `products` array — the storefront then runs
 * that tab's automatic query (featured / new arrivals / …).
 */
const withPickedProducts = async (tabs) => {
    const ids = [...new Set(tabs.flatMap(tab => tab.productIds))];
    if (ids.length === 0) return tabs.map(tab => ({ ...tab, products: [] }));

    let products = [];
    try {
        products = await ProductModel.getProductsByIds(ids);
    } catch {
        // The storefront must still render: manual tabs fall back to an empty
        // list (never to the automatic query, which would contradict the picks).
        products = [];
    }

    const byId = new Map(products.map(product => [product.product_id, product]));
    return tabs.map(tab => ({
        ...tab,
        products: tab.productIds.map(id => byId.get(id)).filter(Boolean),
    }));
};

/**
 * Storefront payload: section behaviour plus the visible tabs, in order.
 * Never throws — a half-configured store still renders a working carousel.
 */
export const getProductCarousel = async () => {
    const { settings, tabs } = splitSettings(await getCarouselSettings());
    return { settings, tabs: await withPickedProducts(tabs.filter(tab => tab.isActive)) };
};

export const getAdminProductCarousel = async (roleId) => {
    assertAdmin(roleId);

    const { settings, tabs } = splitSettings(await getCarouselSettings());
    return {
        settings,
        tabs: await withPickedProducts(tabs), // includes hidden tabs
        tabKeys: TAB_KEYS,
        maxTabs: MAX_TABS,
        maxCustomTabs: MAX_CUSTOM_TABS,
        maxProductsPerTab: MAX_PRODUCTS_PER_TAB,
        minProductsPerTab: MIN_PRODUCTS_PER_TAB,
        maxPickedProducts: MAX_PICKED_PRODUCTS,
    };
};

// ═══════════════════════════════════════════════════════════════════════════════
//  Update
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Persist section settings and/or the tab list.
 * Only the keys this section owns are accepted, so the endpoint cannot be used
 * to overwrite unrelated store settings.
 */
export const updateCarouselSettings = async (settings = {}, roleId) => {
    assertAdmin(roleId);

    const keys = Object.keys(settings);
    if (keys.length === 0) {
        throw httpError(400, 'No settings provided');
    }

    const unknown = keys.filter(key => !(key in KEBAB_TO_CAMEL));
    if (unknown.length > 0) {
        throw httpError(400, `Unknown setting: "${unknown[0]}"`);
    }

    const payload = {};

    for (const [key, value] of Object.entries(settings)) {
        const target = KEBAB_TO_CAMEL[key];

        if (target === 'sectionEnabled' || target === 'autoplayEnabled') {
            if (typeof value !== 'boolean') {
                throw httpError(400, `${key} must be true or false`);
            }
            payload[key] = String(value);
            continue;
        }

        if (target === 'autoplayInterval') {
            const num = Number(value);
            if (!Number.isFinite(num) || num < AUTOPLAY_INTERVAL_MIN || num > AUTOPLAY_INTERVAL_MAX) {
                throw httpError(400, `product_carousel_autoplay_interval must be between ${AUTOPLAY_INTERVAL_MIN} and ${AUTOPLAY_INTERVAL_MAX} ms`);
            }
            payload[key] = String(Math.round(num));
            continue;
        }

        if (target === 'viewAllLink') {
            const link = String(value ?? '').trim();
            if (link && !isSafeLink(link)) {
                throw httpError(400, 'View-all link must start with "/" or be a full http(s) URL');
            }
            payload[key] = link;
            continue;
        }

        if (target === 'tabs') {
            if (!Array.isArray(value) || value.length === 0) {
                throw httpError(400, 'product_carousel_tabs must be a non-empty array');
            }
            // Keys must be slug-shaped. A built-in key keeps its storefront
            // query; any other key becomes an admin-created, hand-picked tab.
            const submitted = value.map(entry => (
                typeof entry?.key === 'string' ? entry.key.trim().toLowerCase() : entry?.key
            ));
            const invalid = submitted.find(key => !isValidTabKey(key));
            if (invalid !== undefined) {
                throw httpError(400, `Invalid carousel tab key: "${invalid}"`);
            }
            if (new Set(submitted).size !== submitted.length) {
                throw httpError(400, 'product_carousel_tabs contains duplicate tabs');
            }
            for (const entry of value) {
                const picks = entry?.productIds;
                if (picks == null) continue;
                if (!Array.isArray(picks)) {
                    throw httpError(400, 'Tab products must be an array of product ids');
                }
                const bad = picks.find(id => !Number.isInteger(Number(id)) || Number(id) <= 0);
                if (bad !== undefined) {
                    throw httpError(400, `Invalid product id on tab "${entry.key}": ${bad}`);
                }
                if (picks.length > MAX_PICKED_PRODUCTS) {
                    throw httpError(400, `A tab can hold at most ${MAX_PICKED_PRODUCTS} hand-picked products`);
                }
            }
            const normalized = normalizeTabs(value);
            if (normalized.length > MAX_TABS) {
                throw httpError(400, `A maximum of ${MAX_TABS} carousel tabs is allowed`);
            }
            // `isCustom` is derived when reading, so it is not persisted.
            payload[key] = JSON.stringify(normalized.map(({ isCustom, ...tab }) => tab));
            continue;
        }

        // Plain text fields (eyebrow, title, view-all label). Blank is allowed
        // and means "hide it" — see toCarouselSettings.
        const max = target === 'eyebrow' ? MAX_EYEBROW
            : target === 'title' ? MAX_SECTION_TITLE
                : MAX_TAB_LABEL;
        payload[key] = String(value ?? '').trim().slice(0, max);
    }

    await SettingsModel.bulkUpsertSettings(payload);
    return getCarouselSettings();
};
