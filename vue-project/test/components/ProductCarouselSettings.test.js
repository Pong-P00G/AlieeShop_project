import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/vue';
import ProductCarouselSettings from '../../src/views/dashboard/ProductCarouselSettings.vue';
import { productCarouselAPI } from '../../src/api/productCarouselApi.js';
import { productAPI } from '../../src/api/products/productApi.js';

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../../src/api/productCarouselApi.js', () => ({
    productCarouselAPI: {
        getConfig: vi.fn(),
        getAdminConfig: vi.fn(),
        updateSettings: vi.fn(),
    },
}));

vi.mock('../../src/api/products/productApi.js', () => ({
    productAPI: {
        getPaginatedProduct: vi.fn(),
        getProductById: vi.fn(),
    },
}));

const mockToast = vi.hoisted(() => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
}));

vi.mock('../../src/composables/useToast.js', () => ({
    useToast: () => mockToast,
}));

// ── Fixtures ────────────────────────────────────────────────────────────────

const product = (id, name) => ({
    product_id: id,
    product_name: name,
    thumbnail: `https://cdn.example.com/${id}.jpg`,
    base_price: '19.99',
});

const defaultTabs = () => [
    {
        key: 'featured',
        label: 'Hand-picked',
        title: 'Featured this week',
        productsPerTab: 8,
        isActive: true,
        productIds: [7],
        products: [product(7, 'Silk Scarf')],
    },
    {
        key: 'new-arrivals',
        label: 'Just landed',
        title: 'New Arrivals',
        productsPerTab: 8,
        isActive: true,
        productIds: [],
        products: [],
    },
];

const adminConfig = () => ({
    success: true,
    data: {
        settings: {
            sectionEnabled: true,
            eyebrow: 'Discover',
            title: 'Curated Collections',
            viewAllLabel: 'View all',
            viewAllLink: '/product',
            autoplayEnabled: true,
            autoplayInterval: 4000,
        },
        tabs: defaultTabs(),
        tabKeys: ['featured', 'new-arrivals', 'best-sellers', 'coming-soon'],
        maxTabs: 12,
        maxCustomTabs: 8,
        maxProductsPerTab: 24,
        minProductsPerTab: 1,
        maxPickedProducts: 24,
    },
});

/** Wait for the panel to load, then open a tab's editor. */
const openTabEditor = async (tabLabel) => {
    await screen.findByText('Carousel Tabs');
    await fireEvent.click(screen.getByRole('button', { name: `Edit ${tabLabel}` }));
};

const savedTabs = () => productCarouselAPI.updateSettings.mock.calls[0][0].product_carousel_tabs;
const savedTab = (key) => savedTabs().find(tab => tab.key === key);

beforeEach(() => {
    vi.clearAllMocks();
    productCarouselAPI.getAdminConfig.mockResolvedValue(adminConfig());
    productCarouselAPI.updateSettings.mockResolvedValue({ success: true, data: { tabs: defaultTabs() } });
    productAPI.getPaginatedProduct.mockResolvedValue({ items: [product(3, 'Leather Wallet')] });
});

// ── Tab list summary ────────────────────────────────────────────────────────

describe('ProductCarouselSettings — tab list', () => {
    it('marks a tab with picks and one without', async () => {
        render(ProductCarouselSettings);

        await screen.findByText('Carousel Tabs');

        expect(screen.getByText(/1 picked/)).toBeTruthy();
        expect(screen.getByText(/automatic selection/)).toBeTruthy();
    });
});

// ── Picker ──────────────────────────────────────────────────────────────────

describe('ProductCarouselSettings — custom tabs', () => {
    it('creates a new tab with a slug key and its picked products', async () => {
        render(ProductCarouselSettings);
        await screen.findByText('Carousel Tabs');

        await fireEvent.click(screen.getByRole('button', { name: 'Add tab' }));

        await fireEvent.update(screen.getByLabelText('Tab label'), 'Weekly Deals');
        await fireEvent.update(screen.getByLabelText('Tab section heading'), 'Weekly Deals');

        await fireEvent.update(screen.getByLabelText('Search products to add'), 'wallet');
        await screen.findByText('Leather Wallet', {}, { timeout: 2000 });
        await fireEvent.click(screen.getByRole('button', { name: 'Add' }));

        await fireEvent.click(screen.getByRole('button', { name: 'Create Tab' }));

        await waitFor(() => {
            const created = savedTab('weekly-deals');
            expect(created).toBeTruthy();
            expect(created.label).toBe('Weekly Deals');
            expect(created.productIds).toEqual([3]);
        });
    });

    it('deletes a custom tab after confirmation but offers no delete for built-ins', async () => {
        const tabs = [
            ...defaultTabs(),
            {
                key: 'weekly-deals',
                label: 'Weekly Deals',
                title: 'Weekly Deals',
                productsPerTab: 8,
                isActive: true,
                productIds: [3],
                products: [product(3, 'Leather Wallet')],
                isCustom: true,
            },
        ];
        productCarouselAPI.getAdminConfig.mockResolvedValue({
            success: true,
            data: { ...adminConfig().data, tabs },
        });

        render(ProductCarouselSettings);
        await screen.findByText('Carousel Tabs');

        // Built-in data sources are never removable.
        expect(screen.queryByRole('button', { name: 'Delete Hand-picked' })).toBeNull();

        await fireEvent.click(screen.getByRole('button', { name: 'Delete Weekly Deals' }));
        await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

        await waitFor(() => {
            expect(savedTabs().some(tab => tab.key === 'weekly-deals')).toBe(false);
        });
    });
});

describe('ProductCarouselSettings — product picker', () => {
    it('lists the products already picked for a tab', async () => {
        render(ProductCarouselSettings);
        await openTabEditor('Hand-picked');

        expect(await screen.findByText('Silk Scarf')).toBeTruthy();
        expect(screen.getByText('1 / 24')).toBeTruthy();
        expect(screen.queryByText(/Nothing picked/)).toBeNull();
    });

    it('searches the catalogue, adds the product and saves it with the tab', async () => {
        render(ProductCarouselSettings);
        await openTabEditor('Just landed');

        expect(screen.getByText(/Nothing picked/)).toBeTruthy();

        await fireEvent.update(screen.getByLabelText('Search products to add'), 'wallet');

        // The search is debounced, so the request happens shortly after typing
        expect(await screen.findByText('Leather Wallet', {}, { timeout: 2000 })).toBeTruthy();
        expect(productAPI.getPaginatedProduct).toHaveBeenCalledWith(
            expect.objectContaining({ search: 'wallet', status: 'active' })
        );

        await fireEvent.click(screen.getByRole('button', { name: 'Add' }));
        await fireEvent.click(screen.getByRole('button', { name: 'Save Tab' }));

        await waitFor(() => {
            expect(savedTab('new-arrivals').productIds).toEqual([3]);
        });
    });

    it('clears every pick so the tab goes back to its automatic selection', async () => {
        render(ProductCarouselSettings);
        await openTabEditor('Hand-picked');

        await fireEvent.click(await screen.findByRole('button', { name: 'Clear picks' }));

        expect(screen.getByText(/Nothing picked/)).toBeTruthy();

        await fireEvent.click(screen.getByRole('button', { name: 'Save Tab' }));

        await waitFor(() => {
            expect(savedTab('featured').productIds).toEqual([]);
        });
    });

    it('removes a single pick from the list', async () => {
        render(ProductCarouselSettings);
        await openTabEditor('Hand-picked');

        await fireEvent.click(await screen.findByRole('button', { name: 'Remove Silk Scarf' }));
        await fireEvent.click(screen.getByRole('button', { name: 'Save Tab' }));

        await waitFor(() => {
            expect(savedTab('featured').productIds).toEqual([]);
        });
    });

    it('keeps the other tabs and their picks intact when one tab is saved', async () => {
        render(ProductCarouselSettings);
        await openTabEditor('Just landed');

        await fireEvent.update(screen.getByLabelText('Search products to add'), 'wallet');
        await screen.findByText('Leather Wallet', {}, { timeout: 2000 });
        await fireEvent.click(screen.getByRole('button', { name: 'Add' }));
        await fireEvent.click(screen.getByRole('button', { name: 'Save Tab' }));

        await waitFor(() => {
            expect(savedTab('new-arrivals').productIds).toEqual([3]);
            expect(savedTab('featured').productIds).toEqual([7]);
            expect(savedTabs()).toHaveLength(2);
        });
    });
});
