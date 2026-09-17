import * as CartModel from '../model/cartModel.js';
import { productExists } from '../model/products/productModel.js';

/**
 * Coerce and validate a positive-integer field.
 *
 * Accepts real integers and integer-valued strings ('3'); rejects fractional
 * values (1.5, '1.5'), NaN, zero and negatives. parseInt() is deliberately not
 * used here — it silently truncates 1.5 to 1, which would add the wrong
 * quantity instead of rejecting the request.
 */
const parsePositiveInt = (value, fieldName) => {
    const num = typeof value === 'string' ? Number(value.trim()) : value;
    if (!Number.isInteger(num) || num <= 0) {
        const err = new Error(`${fieldName} must be a positive integer`);
        err.status = 400;
        throw err;
    }
    return num;
};

/**
 * Confirm a cart item belongs to a given user. Used for ownership checks before
 * mutating an item that the URL exposes by primary key.
 * Returns the cart item row (with cartId) when valid; throws otherwise.
 */
const assertItemOwnership = async (userId, cartItemId) => {
    const item = await CartModel.getCartItemById(cartItemId);
    if (!item) {
        const err = new Error('Cart item not found');
        err.status = 404;
        throw err;
    }

    const cart = await CartModel.getOrCreateCart(userId);
    if (item.cartId !== cart.cartId) {
        const err = new Error('Cart item does not belong to this user');
        err.status = 403;
        throw err;
    }
    return item;
};

/**
 * Return the full cart (with items) for a user.
 */
export const getCart = async (userId) => {
    return await CartModel.getCartByUserId(userId);
};

/**
 * Add an item to a user's cart. Creates the cart if it does not exist yet.
 * Increments quantity when the (product, variant) tuple is already in the cart.
 */
export const addItem = async (userId, { product_id, variant_id, quantity }) => {
    const qty = parsePositiveInt(quantity, 'Quantity');
    const pid = parsePositiveInt(product_id, 'product_id');

    if (!(await productExists(pid))) {
        const err = new Error('Product not found');
        err.status = 404;
        throw err;
    }

    // variant_id is optional, but when supplied it must be a valid id
    const vid = variant_id == null || variant_id === ''
        ? null
        : parsePositiveInt(variant_id, 'variant_id');

    const cart = await CartModel.getOrCreateCart(userId);
    return await CartModel.addCartItem(cart.cartId, pid, vid, qty);
};

/**
 * Update the quantity of an existing cart item owned by the user.
 */
export const updateItem = async (userId, cartItemId, { quantity }) => {
    const qty = parsePositiveInt(quantity, 'Quantity');

    await assertItemOwnership(userId, cartItemId);
    return await CartModel.updateCartItemQuantity(cartItemId, qty);
};

/**
 * Remove a single cart item owned by the user.
 */
export const removeItem = async (userId, cartItemId) => {
    await assertItemOwnership(userId, cartItemId);
    const deleted = await CartModel.deleteCartItem(cartItemId);
    if (!deleted) {
        const err = new Error('Cart item not found');
        err.status = 404;
        throw err;
    }
    return true;
};

/**
 * Clear every item from the user's cart.
 */
export const clearCart = async (userId) => {
    const cart = await CartModel.getOrCreateCart(userId);
    const removed = await CartModel.clearCart(cart.cartId);
    return { cartId: cart.cartId, removedItems: removed };
};
