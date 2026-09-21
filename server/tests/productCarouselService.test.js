import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/model/settingsModel.js', () => ({
    getAllSettings: vi.fn(async () => []),
    bulkUpsertSettings: vi.fn(async () => []),
}));

vi.mock('../src/model/products/productModel.js', () => ({
    getProductsByIds: vi.fn(async () => []),
}));

import * as SettingsModel from '../src/model/settingsModel.js';
import * as ProductModel from '../src/model/products/productModel.js';
import * as productCarouselService from '../src/services/productCarouselService.js';

const dbProduct = (id, overrides = {}) => ({
    product_id: id,
    product_name: `Product ${id}`,
    base_price: '19.99',
    thumbnail: `https://cdn.example.com/${id}.jpg`,
    ...overrides,
});

const ADMIN = 1;

const rows = (overrides = {}) => Object.entries({
    product_carousel_section_enabled: 'true',
    product_carousel_eyebrow: 'Discover',
    product_carousel_title: 'Curated Collections',
    product_carousel_view_all_label: 'View all',
    product_carousel_view_all_link: '/product',
    product_carousel_autoplay_enabled: 'true',
    product_carousel_autoplay_interval: '4000',
    ...overrides,
}).map(([key, value]) => ({ key, value }));

beforeEach(() => {
    vi.clearAllMocks();
    SettingsModel.getAllSettings.mockResolvedValue([]);
    SettingsModel.bulkUpsertSettings.mockResolvedValue([]);
    ProductModel.getProductsByIds.mockResolvedValue([]);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  getProductCarousel (public)
// ═══════════════════════════════════════════════════════════════════════════════

describe('productCarouselService — getProductCarousel', () => {
    it('returns the built-in defaults when nothing is stored', async () => {
        const { settings, tabs } = await productCarouselService.getProductCarousel();

        expect(settings).toEqual({
            sectionEnabled: true,
            eyebrow: 'Discover',
            title: 'Curated Collections',
            viewAllLabel: 'View all',
            viewAllLink: '/product',
            autoplayEnabled: true,
            autoplayInterval: 4000,
        });
        expect(tabs.map(tab => tab.key))
            .toEqual(['featured', 'new-arrivals', 'best-sellers', 'coming-soon']);
        expect(tabs.every(tab => tab.productIds.length === 0)).toBe(true);
    });

    it('returns defaults (rather than throwing) when the settings table is unavailable', async () => {
        SettingsModel.getAllSettings.mockRejectedValue(new Error('relation "store_settings" does not exist'));

        const { settings, tabs } = await productCarouselService.getProductCarousel();

        expect(settings.autoplayInterval).toBe(4000);
        expect(tabs).toHaveLength(4);
    });

    it('only exposes the tabs the admin left visible, in the stored order', async () => {
        SettingsModel.getAllSettings.mockResolvedValue(rows({
            product_carousel_tabs: JSON.stringify([
                { key: 'best-sellers', label: 'Hot', title: 'Best Sellers', productsPerTab: 4, isActive: true },
                { key: 'featured', label: 'Picked', title: 'Featured', productsPerTab: 6, isActive: false },
            ]),
        }));

        const { tabs } = await productCarouselService.getProductCarousel();

        expect(tabs.map(tab => tab.key)).toEqual(['best-sellers', 'new-arrivals', 'coming-soon']);
        expect(tabs[0]).toMatchObject({ label: 'Hot', productsPerTab: 4 });
    });

    it('never returns the tabs inside the settings object (mirrors the hero payload shape)', async () => {
        const { settings } = await productCarouselService.getProductCarousel();
        expect(settings).not.toHaveProperty('tabs');
    });

    it('ignores unrelated store settings', async () => {
        SettingsModel.getAllSettings.mockResolvedValue([
            { key: 'tax_rate', value: '8' },
            { key: 'product_carousel_autoplay_interval', value: '7000' },
        ]);

        const { settings } = await productCarouselService.getProductCarousel();

        expect(settings.autoplayInterval).toBe(7000);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  toCarouselSettings
// ═══════════════════════════════════════════════════════════════════════════════

describe('productCarouselService — toCarouselSettings', () => {
    it('parses stored strings into typed values', () => {
        const settings = productCarouselService.toCarouselSettings(rows({
            product_carousel_section_enabled: 'false',
            product_carousel_autoplay_enabled: 'off',
        }));

        expect(settings.sectionEnabled).toBe(false);
        expect(settings.autoplayEnabled).toBe(false);
    });

    it.each([
        ['true', true],
        ['1', true],
        ['yes', true],
        ['on', true],
        ['false', false],
        ['0', false],
        ['no', false],
    ])('parses the boolean form %s', (stored, expected) => {
        expect(productCarouselService.toCarouselSettings(rows({ product_carousel_section_enabled: stored })).sectionEnabled)
            .toBe(expected);
    });

    it('falls back to the default when a boolean is unparseable', () => {
        expect(productCarouselService.toCarouselSettings(rows({ product_carousel_autoplay_enabled: 'maybe' })).autoplayEnabled)
            .toBe(true);
    });

    it.each([['500'], ['999999'], ['abc'], ['']])('rejects the out-of-range interval %s', (stored) => {
        expect(productCarouselService.toCarouselSettings(rows({ product_carousel_autoplay_interval: stored })).autoplayInterval)
            .toBe(4000);
    });

    it('uses defaults for keys that were never stored', () => {
        const settings = productCarouselService.toCarouselSettings([]);
        expect(settings.title).toBe('Curated Collections');
        expect(settings.viewAllLink).toBe('/product');
    });

    it('respects a stored-but-blank heading so the admin can hide it', () => {
        const settings = productCarouselService.toCarouselSettings(rows({
            product_carousel_eyebrow: '   ',
            product_carousel_title: '',
            product_carousel_view_all_label: '',
        }));

        expect(settings.eyebrow).toBe('');
        expect(settings.title).toBe('');
        expect(settings.viewAllLabel).toBe('');
    });

    it('falls back to the default tabs when the stored JSON is malformed', () => {
        const settings = productCarouselService.toCarouselSettings(rows({
            product_carousel_tabs: '{not json',
        }));

        expect(settings.tabs).toHaveLength(4);
        expect(settings.tabs[0].key).toBe('featured');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  normalizeTabs
// ═══════════════════════════════════════════════════════════════════════════════

describe('productCarouselService — normalizeTabs', () => {
    it('keeps the submitted order', () => {
        const tabs = productCarouselService.normalizeTabs([
            { key: 'coming-soon' },
            { key: 'featured' },
        ]);

        expect(tabs.map(tab => tab.key))
            .toEqual(['coming-soon', 'featured', 'new-arrivals', 'best-sellers']);
    });

    it('drops unknown keys', () => {
        const tabs = productCarouselService.normalizeTabs([{ key: 'weekly-deals' }]);
        expect(tabs.map(tab => tab.key)).toEqual(['featured', 'new-arrivals', 'best-sellers', 'coming-soon']);
    });

    it('collapses duplicate keys', () => {
        const tabs = productCarouselService.normalizeTabs([{ key: 'featured' }, { key: 'featured' }]);
        expect(tabs.filter(tab => tab.key === 'featured')).toHaveLength(1);
    });

    it('clamps the product count into the allowed range', () => {
        const tabs = productCarouselService.normalizeTabs([
            { key: 'featured', productsPerTab: 999 },
            { key: 'new-arrivals', productsPerTab: 0 },
            { key: 'best-sellers', productsPerTab: 'lots' },
        ]);

        expect(tabs[0].productsPerTab).toBe(productCarouselService.MAX_PRODUCTS_PER_TAB);
        expect(tabs[1].productsPerTab).toBe(productCarouselService.MIN_PRODUCTS_PER_TAB);
        expect(tabs[2].productsPerTab).toBe(8); // default
    });

    it('falls back to the default label and title for blanks', () => {
        const tabs = productCarouselService.normalizeTabs([{ key: 'featured', label: '  ', title: '' }]);

        expect(tabs[0].label).toBe('Hand-picked');
        expect(tabs[0].title).toBe('Featured this week');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  updateCarouselSettings
// ═══════════════════════════════════════════════════════════════════════════════

describe('productCarouselService — updateCarouselSettings', () => {
    it('rejects non-admin callers', async () => {
        await expect(
            productCarouselService.updateCarouselSettings({ product_carousel_section_enabled: false }, 5)
        ).rejects.toMatchObject({ status: 403 });
        expect(SettingsModel.bulkUpsertSettings).not.toHaveBeenCalled();
    });

    it('rejects an empty payload', async () => {
        await expect(productCarouselService.updateCarouselSettings({}, ADMIN))
            .rejects.toMatchObject({ status: 400 });
    });

    it('rejects keys the carousel section does not own', async () => {
        await expect(
            productCarouselService.updateCarouselSettings({ tax_rate: '5' }, ADMIN)
        ).rejects.toMatchObject({ status: 400, message: /Unknown setting/ });
        expect(SettingsModel.bulkUpsertSettings).not.toHaveBeenCalled();
    });

    it('rejects a non-boolean flag', async () => {
        await expect(
            productCarouselService.updateCarouselSettings({ product_carousel_section_enabled: 'yes' }, ADMIN)
        ).rejects.toMatchObject({ status: 400 });
    });

    it('rejects an autoplay interval outside the allowed range', async () => {
        await expect(
            productCarouselService.updateCarouselSettings({ product_carousel_autoplay_interval: 100 }, ADMIN)
        ).rejects.toMatchObject({ status: 400, message: /between 2000 and 60000/ });
    });

    it('rejects an unsafe View-all link', async () => {
        await expect(
            productCarouselService.updateCarouselSettings({ product_carousel_view_all_link: 'javascript:alert(1)' }, ADMIN)
        ).rejects.toMatchObject({ status: 400, message: /must start with/ });
    });

    it('accepts an external https View-all link', async () => {
        await expect(
            productCarouselService.updateCarouselSettings({ product_carousel_view_all_link: 'https://example.com/shop' }, ADMIN)
        ).resolves.toBeTruthy();
    });

    it('rejects a tab list containing an unknown source', async () => {
        await expect(
            productCarouselService.updateCarouselSettings({
                product_carousel_tabs: [{ key: 'featured' }, { key: 'weekly-deals' }],
            }, ADMIN)
        ).rejects.toMatchObject({ status: 400, message: /Unknown carousel tab/ });
        expect(SettingsModel.bulkUpsertSettings).not.toHaveBeenCalled();
    });

    it('rejects duplicate tabs', async () => {
        await expect(
            productCarouselService.updateCarouselSettings({
                product_carousel_tabs: [{ key: 'featured' }, { key: 'featured' }],
            }, ADMIN)
        ).rejects.toMatchObject({ status: 400, message: /duplicate/ });
    });

    it('rejects an empty tab list', async () => {
        await expect(
            productCarouselService.updateCarouselSettings({ product_carousel_tabs: [] }, ADMIN)
        ).rejects.toMatchObject({ status: 400, message: /non-empty array/ });
    });

    it('persists flattened values as strings and the tab list as JSON', async () => {
        await productCarouselService.updateCarouselSettings({
            product_carousel_section_enabled: false,
            product_carousel_autoplay_interval: 8000,
            product_carousel_title: 'Staff Picks',
            product_carousel_tabs: [
                { key: 'best-sellers', label: 'Hot', title: 'Best Sellers', productsPerTab: 4, isActive: true },
            ],
        }, ADMIN);

        const payload = SettingsModel.bulkUpsertSettings.mock.calls[0][0];
        expect(payload.product_carousel_section_enabled).toBe('false');
        expect(payload.product_carousel_autoplay_interval).toBe('8000');
        expect(payload.product_carousel_title).toBe('Staff Picks');

        const storedTabs = JSON.parse(payload.product_carousel_tabs);
        expect(storedTabs.map(tab => tab.key))
            .toEqual(['best-sellers', 'featured', 'new-arrivals', 'coming-soon']);
        expect(storedTabs[0]).toMatchObject({ label: 'Hot', productsPerTab: 4 });
    });

    it('persists an explicit blank heading so it can be cleared', async () => {
        await productCarouselService.updateCarouselSettings({ product_carousel_eyebrow: '   ' }, ADMIN);

        expect(SettingsModel.bulkUpsertSettings.mock.calls[0][0].product_carousel_eyebrow).toBe('');
    });

    it('rejects a tab whose products are not a list', async () => {
        await expect(productCarouselService.updateCarouselSettings({
            product_carousel_tabs: [{ key: 'featured', productIds: '3,4' }],
        }, ADMIN)).rejects.toMatchObject({ status: 400, message: /array of product ids/ });
        expect(SettingsModel.bulkUpsertSettings).not.toHaveBeenCalled();
    });

    it('rejects an invalid product id', async () => {
        await expect(productCarouselService.updateCarouselSettings({
            product_carousel_tabs: [{ key: 'featured', productIds: [1, 0] }],
        }, ADMIN)).rejects.toMatchObject({ status: 400, message: /Invalid product id/ });
    });

    it('rejects more picks than a tab can show', async () => {
        const tooMany = Array.from(
            { length: productCarouselService.MAX_PICKED_PRODUCTS + 1 },
            (_, i) => i + 1
        );

        await expect(productCarouselService.updateCarouselSettings({
            product_carousel_tabs: [{ key: 'featured', productIds: tooMany }],
        }, ADMIN)).rejects.toMatchObject({ status: 400, message: /at most/ });
    });

    it('stores the picked products with the tab', async () => {
        await productCarouselService.updateCarouselSettings({
            product_carousel_tabs: [
                { key: 'featured', label: 'Picked', title: 'Featured', productsPerTab: 8, isActive: true, productIds: [7, 3, 7] },
                { key: 'new-arrivals' },
            ],
        }, ADMIN);

        const stored = JSON.parse(SettingsModel.bulkUpsertSettings.mock.calls[0][0].product_carousel_tabs);
        expect(stored[0].productIds).toEqual([7, 3]);
        expect(stored[1].productIds).toEqual([]);
    });

    it('echoes the refreshed settings', async () => {
        SettingsModel.getAllSettings.mockResolvedValue(rows({
            product_carousel_section_enabled: 'false',
            product_carousel_title: 'Staff Picks',
        }));

        const result = await productCarouselService.updateCarouselSettings({
            product_carousel_section_enabled: false,
        }, ADMIN);

        expect(result).toMatchObject({
            sectionEnabled: false,
            title: 'Staff Picks',
        });
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  getAdminProductCarousel
// ═══════════════════════════════════════════════════════════════════════════════

describe('productCarouselService — getAdminProductCarousel', () => {
    it('rejects non-admin callers', async () => {
        await expect(productCarouselService.getAdminProductCarousel(5)).rejects.toMatchObject({ status: 403 });
    });

    it('includes hidden tabs plus the editable limits', async () => {
        SettingsModel.getAllSettings.mockResolvedValue(rows({
            product_carousel_tabs: JSON.stringify([
                { key: 'featured', isActive: false },
                { key: 'new-arrivals' },
                { key: 'best-sellers' },
                { key: 'coming-soon' },
            ]),
        }));

        const result = await productCarouselService.getAdminProductCarousel(ADMIN);

        expect(result.tabs).toHaveLength(4);
        expect(result.tabs[0].isActive).toBe(false);
        expect(result.maxTabs).toBe(4);
        expect(result.maxProductsPerTab).toBe(productCarouselService.MAX_PRODUCTS_PER_TAB);
        expect(result.maxPickedProducts).toBe(productCarouselService.MAX_PICKED_PRODUCTS);
        expect(result.tabKeys).toEqual(productCarouselService.TAB_KEYS);
    });

    it('resolves picked products for hidden tabs too', async () => {
        SettingsModel.getAllSettings.mockResolvedValue(rows({
            product_carousel_tabs: JSON.stringify([
                { key: 'featured', isActive: false, productIds: [11] },
            ]),
        }));
        ProductModel.getProductsByIds.mockResolvedValue([dbProduct(11)]);

        const result = await productCarouselService.getAdminProductCarousel(ADMIN);
        const featured = result.tabs.find(tab => tab.key === 'featured');

        expect(featured.isActive).toBe(false);
        expect(featured.products.map(p => p.product_id)).toEqual([11]);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Hand-picked products
// ═══════════════════════════════════════════════════════════════════════════════

describe('productCarouselService — hand-picked products', () => {
    const withPicks = (picks) => rows({
        product_carousel_tabs: JSON.stringify([
            { key: 'featured', label: 'Hand-picked', title: 'Featured this week', productsPerTab: 8, isActive: true, productIds: picks },
        ]),
    });

    it('resolves a tab’s picks in the stored order', async () => {
        SettingsModel.getAllSettings.mockResolvedValue(withPicks([7, 3]));
        // The query answers in id order — the payload must follow the picks.
        ProductModel.getProductsByIds.mockResolvedValue([dbProduct(3), dbProduct(7)]);

        const { tabs } = await productCarouselService.getProductCarousel();
        const featured = tabs.find(tab => tab.key === 'featured');

        expect(ProductModel.getProductsByIds).toHaveBeenCalledWith([7, 3]);
        expect(featured.products.map(p => p.product_id)).toEqual([7, 3]);
    });

    it('asks for each picked product once across all tabs', async () => {
        SettingsModel.getAllSettings.mockResolvedValue(rows({
            product_carousel_tabs: JSON.stringify([
                { key: 'featured', productIds: [4, 5] },
                { key: 'new-arrivals', productIds: [5, 9] },
            ]),
        }));

        await productCarouselService.getProductCarousel();

        expect(ProductModel.getProductsByIds).toHaveBeenCalledWith([4, 5, 9]);
    });

    it('does not query products at all when no tab has picks', async () => {
        await productCarouselService.getProductCarousel();
        expect(ProductModel.getProductsByIds).not.toHaveBeenCalled();
    });

    it('skips a pick whose product no longer exists', async () => {
        SettingsModel.getAllSettings.mockResolvedValue(withPicks([1, 999]));
        ProductModel.getProductsByIds.mockResolvedValue([dbProduct(1)]);

        const { tabs } = await productCarouselService.getProductCarousel();

        expect(tabs[0].products.map(p => p.product_id)).toEqual([1]);
    });

    it('still serves the config when the product lookup fails', async () => {
        SettingsModel.getAllSettings.mockResolvedValue(withPicks([2]));
        ProductModel.getProductsByIds.mockRejectedValue(new Error('product query down'));

        const { settings, tabs } = await productCarouselService.getProductCarousel();

        expect(tabs[0].products).toEqual([]);
        expect(settings.sectionEnabled).toBe(true);
    });

    it('gives an automatic tab an empty products list', async () => {
        const { tabs } = await productCarouselService.getProductCarousel();
        expect(tabs.every(tab => Array.isArray(tab.products) && tab.products.length === 0)).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  normalizeProductIds
// ═══════════════════════════════════════════════════════════════════════════════

describe('productCarouselService — normalizeProductIds', () => {
    it('keeps positive integer ids in order', () => {
        expect(productCarouselService.normalizeProductIds([5, 2, 9])).toEqual([5, 2, 9]);
    });

    it('drops duplicates, non-numbers and non-positive ids', () => {
        expect(productCarouselService.normalizeProductIds([3, 3, '4', 0, -2, 'abc', null])).toEqual([3, 4]);
    });

    it('caps the list at the max picked products', () => {
        const many = Array.from({ length: 40 }, (_, i) => i + 1);
        expect(productCarouselService.normalizeProductIds(many))
            .toHaveLength(productCarouselService.MAX_PICKED_PRODUCTS);
    });

    it('treats a non-array as no picks', () => {
        expect(productCarouselService.normalizeProductIds('3,4')).toEqual([]);
        expect(productCarouselService.normalizeProductIds(null)).toEqual([]);
    });
});
