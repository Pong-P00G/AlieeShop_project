import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/vue';
import ManageProducts from '../../src/views/dashboard/ManageProducts.vue';

// ── Mock all API modules ────────────────────────────────────────────────────
vi.mock('../../src/api/products/productApi.js', () => ({
    productAPI: {
        getPaginatedProduct: vi.fn(),
        updateProduct: vi.fn(),
        deleteProduct: vi.fn(),
        bulkCreateProducts: vi.fn(),
    }
}));

vi.mock('../../src/api/products/categoryApi.js', () => ({
    categoryAPI: {
        getAllCategories: vi.fn(),
    }
}));

vi.mock('../../src/api/products/variantApi.js', () => ({
    variantAPI: {
        getProductVariants: vi.fn(),
        upadateVariant: vi.fn(),
    }
}));

vi.mock('../../src/api/products/discountApi.js', () => ({
    discountAPI: {
        getAllDiscounts: vi.fn(),
        applyDiscount: vi.fn(),
        updateDiscount: vi.fn(),
        deleteDiscount: vi.fn(),
    }
}));

// Mock router
vi.mock('vue-router', () => ({
    useRouter: vi.fn(() => ({ push: vi.fn() })),
    useRoute: vi.fn(() => ({})),
}));

// Mock toast composable with hoisted ref for assertion access
const mockToast = vi.hoisted(() => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
}));

vi.mock('../../src/composables/useToast.js', () => ({
    useToast: () => mockToast,
}));

// ── Sample data ────────────────────────────────────────────────────────────
const sampleProduct = {
    product_id: 1,
    product_name: 'Force Delete Test Product',
    base_price: 49.99,
    descriptions: 'A test product',
    product_status: 'active',
    tags: ['test'],
    category_name: 'Test Category',
    image_url: null,
    total_stock: 10,
    created_at: '2026-07-01T00:00:00Z',
};

const paginatedResponse = {
    items: [sampleProduct],
    totalItems: 1,
    page: 1,
    pageSize: 10,
    totalPages: 1,
};

const emptyPaginatedResponse = {
    items: [],
    totalItems: 0,
    page: 1,
    pageSize: 10,
    totalPages: 1,
};

// ── Tests ───────────────────────────────────────────────────────────────────
describe('ManageProducts — force delete flow', () => {
    let productAPI;

    beforeEach(async () => {
        vi.clearAllMocks();
        productAPI = (await import('../../src/api/products/productApi.js')).productAPI;
        const { categoryAPI } = await import('../../src/api/products/categoryApi.js');

        productAPI.getPaginatedProduct.mockResolvedValue(paginatedResponse);
        categoryAPI.getAllCategories.mockResolvedValue([]);
    });

    it('opens delete modal with force delete checkbox unchecked by default', async () => {
        render(ManageProducts);

        // Wait for products to load from the mocked API
        expect(await screen.findByText('Force Delete Test Product')).toBeTruthy();

        // Click the delete button on the product row
        await fireEvent.click(screen.getByTitle('Delete product'));

        // Modal should appear — heading is "Delete Product", body has "Are you sure..."
        expect(await screen.findByText('Delete Product')).toBeTruthy();
        expect(screen.getByText(/Are you sure/)).toBeTruthy();

        // The confirm button should say "Delete" (not "Force Delete") by default
        expect(screen.getByText('Delete')).toBeTruthy();
        expect(screen.queryByText('Force Delete')).toBeNull();

        // The force delete checkbox should be present and unchecked
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toBeTruthy();
        expect(checkbox.checked).toBe(false);
    });

    it('toggles force delete checkbox and changes button text', async () => {
        render(ManageProducts);

        await screen.findByText('Force Delete Test Product');

        // Open delete modal
        await fireEvent.click(screen.getByTitle('Delete product'));
        await screen.findByText('Delete Product');

        const checkbox = screen.getByRole('checkbox');
        expect(checkbox.checked).toBe(false);
        expect(screen.getByText('Delete')).toBeTruthy();

        // Check the force delete checkbox
        await fireEvent.click(checkbox);
        expect(checkbox.checked).toBe(true);

        // Button text should change to "Force Delete"
        expect(screen.getByText('Force Delete')).toBeTruthy();
        expect(screen.queryByText('Delete')).toBeNull();

        // Uncheck it again
        await fireEvent.click(checkbox);
        expect(checkbox.checked).toBe(false);
        expect(screen.getByText('Delete')).toBeTruthy();
    });

    it('calls deleteProduct with force=true when force delete is checked', async () => {
        render(ManageProducts);

        await screen.findByText('Force Delete Test Product');

        // Open delete modal
        await fireEvent.click(screen.getByTitle('Delete product'));
        await screen.findByText('Delete Product');

        // Check force delete
        await fireEvent.click(screen.getByRole('checkbox'));
        expect(screen.getByText('Force Delete')).toBeTruthy();

        // Set up mock resolution
        productAPI.deleteProduct.mockResolvedValue({ success: true, message: 'Force-deleted' });
        productAPI.getPaginatedProduct.mockResolvedValue(emptyPaginatedResponse);

        // Confirm deletion
        await fireEvent.click(screen.getByText('Force Delete'));

        // Verify deleteProduct was called with the product ID and force=true
        await waitFor(() => {
            expect(productAPI.deleteProduct).toHaveBeenCalledTimes(1);
            expect(productAPI.deleteProduct).toHaveBeenCalledWith(1, true);
        });
    });

    it('calls deleteProduct with force=false when force delete is unchecked', async () => {
        render(ManageProducts);

        await screen.findByText('Force Delete Test Product');

        // Open delete modal
        await fireEvent.click(screen.getByTitle('Delete product'));
        await screen.findByText('Delete Product');

        // Verify checkbox is unchecked
        expect(screen.getByRole('checkbox').checked).toBe(false);

        // Set up mock resolution
        productAPI.deleteProduct.mockResolvedValue({ success: true });
        productAPI.getPaginatedProduct.mockResolvedValue(emptyPaginatedResponse);

        // Confirm deletion (without force)
        await fireEvent.click(screen.getByText('Delete'));

        // Verify deleteProduct was called with force=false
        await waitFor(() => {
            expect(productAPI.deleteProduct).toHaveBeenCalledWith(1, false);
        });
    });

    it('shows toast warning when API returns suggestForceDelete', async () => {
        render(ManageProducts);

        await screen.findByText('Force Delete Test Product');

        // Open delete modal (force unchecked)
        await fireEvent.click(screen.getByTitle('Delete product'));
        await screen.findByText('Delete Product');

        // Mock the API to return a suggestForceDelete error
        productAPI.deleteProduct.mockRejectedValue({
            response: {
                data: {
                    message: 'Cannot delete: product has existing orders',
                    suggestForceDelete: true,
                },
            },
        });

        // Keep the product list unchanged for after the failed delete
        productAPI.getPaginatedProduct.mockResolvedValue(paginatedResponse);

        // Click Delete (without force)
        await fireEvent.click(screen.getByText('Delete'));

        // Verify deleteProduct was called
        await waitFor(() => {
            expect(productAPI.deleteProduct).toHaveBeenCalledWith(1, false);
        });

        // Verify toast.warning was called with the suggestion message
        await waitFor(() => {
            expect(mockToast.warning).toHaveBeenCalled();
            const warningMsg = mockToast.warning.mock.calls[0][0];
            expect(warningMsg).toContain('has existing orders');
            expect(warningMsg).toContain('Force delete');
        });
    });

    it('closes modal on cancel and resets force delete state', async () => {
        render(ManageProducts);

        await screen.findByText('Force Delete Test Product');

        // Open modal and check force delete
        await fireEvent.click(screen.getByTitle('Delete product'));
        await screen.findByText('Delete Product');
        await fireEvent.click(screen.getByRole('checkbox'));
        expect(screen.getByRole('checkbox').checked).toBe(true);

        // Click Cancel
        await fireEvent.click(screen.getByText('Cancel'));

        // Modal should close
        await waitFor(() => {
            expect(screen.queryByText('Delete Product')).toBeNull();
        });

        // Re-open modal — force delete should be reset to false
        await fireEvent.click(screen.getByTitle('Delete product'));
        await screen.findByText('Delete Product');
        expect(screen.getByRole('checkbox').checked).toBe(false);
        expect(screen.getByText('Delete')).toBeTruthy();
    });

    it('renders each product once, as a card, with no table markup', async () => {
        productAPI.getPaginatedProduct.mockResolvedValue({
            items: [
                { ...sampleProduct, product_id: 1, product_name: 'Product A' },
                { ...sampleProduct, product_id: 2, product_name: 'Product B' },
            ],
            totalItems: 2,
            page: 1,
            pageSize: 10,
            totalPages: 1,
        });

        const { container } = render(ManageProducts);

        await screen.findByText('Product A');

        expect(container.querySelectorAll('table')).toHaveLength(0);
        expect(container.querySelectorAll('article')).toHaveLength(2);
        expect(screen.getAllByText('Product A')).toHaveLength(1);
        expect(screen.getAllByText('Product B')).toHaveLength(1);
    });

    it('exposes a sort control that refetches with the chosen field and direction', async () => {
        render(ManageProducts);

        await screen.findByText('Force Delete Test Product');

        await fireEvent.update(screen.getByLabelText('Sort products'), 'product_name:asc');

        await waitFor(() => {
            const params = productAPI.getPaginatedProduct.mock.calls.at(-1)[0];
            expect(params.sortField).toBe('product_name');
            expect(params.sortDirection).toBe('asc');
        });
    });

    it('offers a select-page control instead of a table header checkbox', async () => {
        render(ManageProducts);

        await screen.findByText('Force Delete Test Product');

        // No bulk-action toolbar until something is selected.
        expect(screen.queryByText('selected')).toBeNull();

        await fireEvent.click(screen.getByText('Select page'));

        // The bulk toolbar now reports the selected count.
        expect(await screen.findByText('selected')).toBeTruthy();
    });

    it('resets forceDelete when opening modal for a different product', async () => {
        // Add a second product
        productAPI.getPaginatedProduct.mockResolvedValue({
            items: [
                { ...sampleProduct, product_id: 1, product_name: 'Product A' },
                { ...sampleProduct, product_id: 2, product_name: 'Product B' },
            ],
            totalItems: 2,
            page: 1,
            pageSize: 10,
            totalPages: 1,
        });

        render(ManageProducts);

        await screen.findByText('Product A');

        // Open modal for Product A, check force delete
        const deleteButtons = screen.getAllByTitle('Delete product');
        await fireEvent.click(deleteButtons[0]);
        await screen.findByText('Delete Product');
        await fireEvent.click(screen.getByRole('checkbox'));
        expect(screen.getByRole('checkbox').checked).toBe(true);

        // Cancel and open for Product B
        await fireEvent.click(screen.getByText('Cancel'));
        await waitFor(() => expect(screen.queryByText('Delete Product')).toBeNull());

        await fireEvent.click(deleteButtons[1]);
        await screen.findByText('Delete Product');

        // Force delete should be reset to false for the new product
        expect(screen.getByRole('checkbox').checked).toBe(false);
        expect(screen.getByText('Delete')).toBeTruthy();
    });
});
