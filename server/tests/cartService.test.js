import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database pool
vi.mock('../src/database/dbpool.js', () => ({
    default: { query: vi.fn() },
}));

// Mock cart model functions
vi.mock('../src/model/cartModel.js', () => {
    const mockCart = {
        cartId: 100,
        userId: 42,
    };
    const mockCartItem = {
        cartItemId: 200,
        cartId: 100,
        productId: 1,
        variantId: null,
        quantity: 2,
    };
    return {
        getOrCreateCart: vi.fn().mockResolvedValue(mockCart),
        getCartByUserId: vi.fn().mockResolvedValue({ ...mockCart, items: [] }),
        getCartItemById: vi.fn().mockResolvedValue(mockCartItem),
        addCartItem: vi.fn().mockResolvedValue({ ...mockCartItem, cartItemId: 101 }),
        updateCartItemQuantity: vi.fn().mockResolvedValue({ ...mockCartItem, quantity: 5 }),
        deleteCartItem: vi.fn().mockResolvedValue(true),
        clearCart: vi.fn().mockResolvedValue(3),
    };
});

// Mock product model
vi.mock('../src/model/products/productModel.js', () => ({
    productExists: vi.fn().mockResolvedValue(true),
}));

import * as CartModel from '../src/model/cartModel.js';
import { productExists } from '../src/model/products/productModel.js';
import * as cartService from '../src/services/cartService.js';

// ═══════════════════════════════════════════════════════════════════════════════
//  getCart
// ═══════════════════════════════════════════════════════════════════════════════

describe('cartService — getCart', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns the cart for a user', async () => {
        CartModel.getCartByUserId.mockResolvedValue({
            cartId: 100,
            userId: 42,
            items: [{ cartItemId: 1, productId: 1, quantity: 2 }],
        });

        const result = await cartService.getCart(42);
        expect(result.cartId).toBe(100);
        expect(result.items).toHaveLength(1);
        expect(CartModel.getCartByUserId).toHaveBeenCalledWith(42);
    });

    it('returns empty items array for user with no cart items', async () => {
        CartModel.getCartByUserId.mockResolvedValue({
            cartId: 101,
            userId: 99,
            items: [],
        });

        const result = await cartService.getCart(99);
        expect(result.items).toEqual([]);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  addItem
// ═══════════════════════════════════════════════════════════════════════════════

describe('cartService — addItem', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        productExists.mockResolvedValue(true);
    });

    it('adds an item to cart successfully', async () => {
        const result = await cartService.addItem(42, {
            product_id: 1,
            variant_id: null,
            quantity: 2,
        });

        expect(result.cartItemId).toBe(101);
        expect(CartModel.getOrCreateCart).toHaveBeenCalledWith(42);
        expect(CartModel.addCartItem).toHaveBeenCalledWith(100, 1, null, 2);
    });

    it('throws 400 when quantity is 0', async () => {
        await expect(
            cartService.addItem(42, { product_id: 1, quantity: 0 })
        ).rejects.toMatchObject({ status: 400, message: /positive integer/i });
    });

    it('throws 400 when quantity is negative', async () => {
        await expect(
            cartService.addItem(42, { product_id: 1, quantity: -1 })
        ).rejects.toMatchObject({ status: 400, message: /positive integer/i });
    });

    it('throws 400 when quantity is not an integer', async () => {
        await expect(
            cartService.addItem(42, { product_id: 1, quantity: 1.5 })
        ).rejects.toMatchObject({ status: 400, message: /positive integer/i });
    });

    it('throws 400 for a fractional quantity sent as a string (no silent truncation)', async () => {
        await expect(
            cartService.addItem(42, { product_id: 1, quantity: '1.5' })
        ).rejects.toMatchObject({ status: 400, message: /positive integer/i });

        expect(CartModel.addCartItem).not.toHaveBeenCalled();
    });

    it('coerces integer values sent as strings', async () => {
        await cartService.addItem(42, { product_id: '1', quantity: '3' });

        expect(CartModel.addCartItem).toHaveBeenCalledWith(100, 1, null, 3);
    });

    it('throws 400 when product_id is not a valid id', async () => {
        await expect(
            cartService.addItem(42, { product_id: 'abc', quantity: 1 })
        ).rejects.toMatchObject({ status: 400, message: /product_id/i });
    });

    it('treats an empty variant_id as no variant', async () => {
        await cartService.addItem(42, { product_id: 1, variant_id: '', quantity: 1 });

        expect(CartModel.addCartItem).toHaveBeenCalledWith(100, 1, null, 1);
    });

    it('throws 400 for an invalid variant_id instead of sending NaN to the model', async () => {
        await expect(
            cartService.addItem(42, { product_id: 1, variant_id: 'abc', quantity: 1 })
        ).rejects.toMatchObject({ status: 400, message: /variant_id/i });

        expect(CartModel.addCartItem).not.toHaveBeenCalled();
    });

    it('throws 400 when product_id is missing', async () => {
        await expect(
            cartService.addItem(42, { quantity: 1 })
        ).rejects.toMatchObject({ status: 400, message: /product_id/i });
    });

    it('throws 404 when product does not exist', async () => {
        productExists.mockResolvedValue(false);

        await expect(
            cartService.addItem(42, { product_id: 999, quantity: 1 })
        ).rejects.toMatchObject({ status: 404, message: /Product not found/i });
    });

    it('passes variant_id as null when not provided', async () => {
        await cartService.addItem(42, { product_id: 1, quantity: 1 });

        expect(CartModel.addCartItem).toHaveBeenCalledWith(100, 1, null, 1);
    });

    it('passes variant_id through when provided', async () => {
        await cartService.addItem(42, { product_id: 1, variant_id: 5, quantity: 1 });

        expect(CartModel.addCartItem).toHaveBeenCalledWith(100, 1, 5, 1);
    });

    it('creates a new cart when user has none', async () => {
        CartModel.getOrCreateCart.mockResolvedValue({ cartId: 200, userId: 42 });

        await cartService.addItem(42, { product_id: 1, quantity: 3 });

        expect(CartModel.getOrCreateCart).toHaveBeenCalledWith(42);
        expect(CartModel.addCartItem).toHaveBeenCalledWith(200, 1, null, 3);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  updateItem
// ═══════════════════════════════════════════════════════════════════════════════

describe('cartService — updateItem', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('updates the quantity of a cart item', async () => {
        CartModel.getCartItemById.mockResolvedValue({
            cartItemId: 200,
            cartId: 100,
            productId: 1,
            quantity: 2,
        });
        CartModel.getOrCreateCart.mockResolvedValue({ cartId: 100, userId: 42 });
        CartModel.updateCartItemQuantity.mockResolvedValue({
            cartItemId: 200,
            quantity: 5,
        });

        const result = await cartService.updateItem(42, 200, { quantity: 5 });

        expect(result.quantity).toBe(5);
        expect(CartModel.updateCartItemQuantity).toHaveBeenCalledWith(200, 5);
    });

    it('throws 400 when quantity is invalid', async () => {
        await expect(
            cartService.updateItem(42, 200, { quantity: 0 })
        ).rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 for a fractional quantity', async () => {
        await expect(
            cartService.updateItem(42, 200, { quantity: 2.5 })
        ).rejects.toMatchObject({ status: 400, message: /positive integer/i });

        expect(CartModel.updateCartItemQuantity).not.toHaveBeenCalled();
    });

    it('coerces an integer quantity sent as a string', async () => {
        CartModel.getCartItemById.mockResolvedValue({ cartItemId: 200, cartId: 100 });
        CartModel.getOrCreateCart.mockResolvedValue({ cartId: 100, userId: 42 });
        CartModel.updateCartItemQuantity.mockResolvedValue({ cartItemId: 200, quantity: 4 });

        await cartService.updateItem(42, 200, { quantity: '4' });

        expect(CartModel.updateCartItemQuantity).toHaveBeenCalledWith(200, 4);
    });

    it('throws 404 when cart item does not exist', async () => {
        CartModel.getCartItemById.mockResolvedValue(null);

        await expect(
            cartService.updateItem(42, 999, { quantity: 3 })
        ).rejects.toMatchObject({ status: 404, message: /Cart item not found/i });
    });

    it('throws 403 when item belongs to different user', async () => {
        CartModel.getCartItemById.mockResolvedValue({
            cartItemId: 200,
            cartId: 999, // Different cart
        });
        CartModel.getOrCreateCart.mockResolvedValue({ cartId: 100, userId: 42 });

        await expect(
            cartService.updateItem(42, 200, { quantity: 3 })
        ).rejects.toMatchObject({ status: 403, message: /not belong/i });
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  removeItem
// ═══════════════════════════════════════════════════════════════════════════════

describe('cartService — removeItem', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('removes an item from cart', async () => {
        CartModel.getCartItemById.mockResolvedValue({
            cartItemId: 200,
            cartId: 100,
        });
        CartModel.getOrCreateCart.mockResolvedValue({ cartId: 100, userId: 42 });
        CartModel.deleteCartItem.mockResolvedValue(true);

        const result = await cartService.removeItem(42, 200);
        expect(result).toBe(true);
        expect(CartModel.deleteCartItem).toHaveBeenCalledWith(200);
    });

    it('throws 404 when delete returns false', async () => {
        CartModel.getCartItemById.mockResolvedValue({
            cartItemId: 200,
            cartId: 100,
        });
        CartModel.getOrCreateCart.mockResolvedValue({ cartId: 100, userId: 42 });
        CartModel.deleteCartItem.mockResolvedValue(false);

        await expect(
            cartService.removeItem(42, 200)
        ).rejects.toMatchObject({ status: 404, message: /Cart item not found/i });
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  clearCart
// ═══════════════════════════════════════════════════════════════════════════════

describe('cartService — clearCart', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('clears all items from cart', async () => {
        CartModel.getOrCreateCart.mockResolvedValue({ cartId: 100, userId: 42 });
        CartModel.clearCart.mockResolvedValue(3);

        const result = await cartService.clearCart(42);

        expect(result.cartId).toBe(100);
        expect(result.removedItems).toBe(3);
        expect(CartModel.clearCart).toHaveBeenCalledWith(100);
    });

    it('returns removedItems = 0 when cart is already empty', async () => {
        CartModel.getOrCreateCart.mockResolvedValue({ cartId: 100, userId: 42 });
        CartModel.clearCart.mockResolvedValue(0);

        const result = await cartService.clearCart(42);

        expect(result.removedItems).toBe(0);
    });
});
