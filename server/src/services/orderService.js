import db from '../database/dbpool.js';
import * as CartModel from '../model/cartModel.js';
import * as OrderModel from '../model/orderModel.js';
import { notifyNewOrder, notifyOrderStatusChange } from './dashboardService.js';

// Status values enforced by the orders.status CHECK constraint.
const ALLOWED_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

/**
 * Decrement stock for a single cart item using the supplied transaction client.
 * Done inline (instead of via ProductModel.decrementStock) so the operation
 * participates in the surrounding transaction without modifying Phase 3 files.
 *
 * Returns nothing on success. Throws an Error with status=409 when stock is
 * insufficient so the caller can ROLLBACK.
 *
 * Product-level rows are the first choice for variantless cart items, but a
 * product may track stock ONLY at variant level (no product-level row). In
 * that case decrement the variants round-robin — cheapest-first is not the
 * goal; draining fewest rows first is simply deterministic.
 */
const decrementStockForItem = async (client, item) => {
    const { productId, variantId, quantity } = item;

    let result;
    if (variantId != null) {
        result = await client.query(
            `UPDATE stock
             SET quantity = quantity - $1, updatedat = NOW()
             WHERE variantid = $2 AND quantity >= $1
             RETURNING stockid`,
            [quantity, variantId]
        );
    } else {
        result = await client.query(
            `UPDATE stock
             SET quantity = quantity - $1, updatedat = NOW()
             WHERE productsid = $2 AND variantid IS NULL AND quantity >= $1
             RETURNING stockid`,
            [quantity, productId]
        );

        // No product-level stock row: this product's stock lives on its
        // variants. Spread the decrement across them, running out only if
        // the VARIANT TOTAL cannot cover the requested quantity.
        if (result.rowCount === 0) {
            const { rows: variantStock } = await client.query(
                `SELECT stockid, quantity
                 FROM stock
                 WHERE productsid = $1 AND variantid IS NOT NULL
                 ORDER BY quantity DESC
                 FOR UPDATE`,
                [productId]
            );

            const available = variantStock.reduce((sum, r) => sum + r.quantity, 0);
            if (available < quantity) {
                const err = new Error(
                    `Insufficient stock for product ${productId}: requested ${quantity}, only ${available} available`
                );
                err.status = 409;
                throw err;
            }

            let remaining = quantity;
            for (const row of variantStock) {
                if (remaining <= 0) break;
                const take = Math.min(row.quantity, remaining);
                const dec = await client.query(
                    `UPDATE stock
                     SET quantity = quantity - $1, updatedat = NOW()
                     WHERE stockid = $2
                     RETURNING stockid`,
                    [take, row.stockid]
                );
                if (dec.rowCount === 0) {
                    const err = new Error(`Stock row ${row.stockid} disappeared during decrement`);
                    err.status = 409;
                    throw err;
                }
                remaining -= take;
            }
            return;
        }
    }

    if (result.rowCount === 0) {
        const err = new Error(
            variantId != null
                ? `Insufficient stock for variant ${variantId}`
                : `Insufficient stock for product ${productId}`
        );
        err.status = 409;
        throw err;
    }
};

/**
 * Create a new order from the contents of the user's cart.
 *
 * Flow (all inside a single transaction):
 *   1. Load the cart and reject if it is empty.
 *   2. Insert the orders row with totalAmount = 0; we'll update it once we
 *      know the per-line subtotals.
 *   3. For each cart item, fetch the current product baseprice and insert an
 *      orderItems row with `unitPrice = baseprice` (price snapshot at order
 *      time — never trust the cart's `currentPrice` since it may be stale).
 *   4. Update orders.totalAmount = SUM(quantity * unitPrice).
 *   5. Decrement stock for every line (variant-level or product-level).
 *      Any failure rolls the whole transaction back.
 *   6. Clear the cart.
 *   7. COMMIT and return the fully-hydrated order.
 */
export const createOrderFromCart = async (userId) => {
    const cart = await CartModel.getCartByUserId(userId);
    if (!cart || !cart.items || cart.items.length === 0) {
        const err = new Error('Cart is empty');
        err.status = 400;
        throw err;
    }

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        // 1. Create the order shell with totalAmount = 0.
        const order = await OrderModel.createOrder(userId, 0, client);
        const orderId = order.orderId;

        // 2. Insert each line item using the product's current baseprice.
        for (const item of cart.items) {
            const { rows: priceRows } = await client.query(
                `SELECT baseprice AS "basePrice"
                 FROM products WHERE productsid = $1`,
                [item.productId]
            );
            if (priceRows.length === 0) {
                const err = new Error(`Product ${item.productId} not found`);
                err.status = 404;
                throw err;
            }
            const unitPrice = priceRows[0].basePrice;

            await OrderModel.addOrderItem(
                {
                    orderId,
                    productId: item.productId,
                    variantId: item.variantId,
                    quantity: item.quantity,
                    unitPrice,
                },
                client
            );
        }

        // 3. Compute and persist the order total.
        const { rows: totalRows } = await client.query(
            `SELECT COALESCE(SUM(quantity * unitprice), 0) AS total
             FROM orderitems WHERE ordersid = $1`,
            [orderId]
        );
        await client.query(
            `UPDATE orders SET totalamount = $1, updatedat = NOW()
             WHERE ordersid = $2`,
            [totalRows[0].total, orderId]
        );

        // 4. Decrement stock for every line. Any failure rolls back.
        for (const item of cart.items) {
            await decrementStockForItem(client, item);
        }

        // 5. Clear the cart now that the order is committed locally.
        await client.query(
            'DELETE FROM cartitems WHERE cartid = $1',
            [cart.cartId]
        );

        await client.query('COMMIT');

        // Return the order via the model (which uses the pool, outside the tx).
        const result = await OrderModel.getOrderById(orderId);

        // Fire-and-forget: notify admins and customer about the new order
        notifyNewOrder(orderId, result.username, result.totalAmount, result.userId).catch(() => {});

        return result;
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Return the orders belonging to a user.
 */
export const getUserOrders = async (userId) => {
    return await OrderModel.getOrdersByUserId(userId);
};

/**
 * Return a single order. Admin roles (1 or 2) may read any order; everyone
 * else is restricted to orders they own.
 */
export const getOrder = async (userId, orderId, roleId) => {
    const order = await OrderModel.getOrderById(orderId);
    if (!order) {
        const err = new Error('Order not found');
        err.status = 404;
        throw err;
    }

    const isAdmin = roleId === 1 || roleId === 2;
    if (!isAdmin && order.userId !== userId) {
        const err = new Error('Not authorized to view this order');
        err.status = 403;
        throw err;
    }

    return order;
};

/**
 * Update an order's status. Admin only; validates the status against the
 * schema's CHECK enum before touching the database.
 */
export const updateStatus = async (orderId, status, _userId, _roleId) => {
    if (!ALLOWED_STATUSES.includes(status)) {
        const err = new Error(
            `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(', ')}`
        );
        err.status = 400;
        throw err;
    }

    const existing = await OrderModel.getOrderById(orderId);
    if (!existing) {
        const err = new Error('Order not found');
        err.status = 404;
        throw err;
    }

    const updated = await OrderModel.updateOrderStatus(orderId, status);
    if (!updated) {
        const err = new Error('Failed to update order status');
        err.status = 500;
        throw err;
    }

    // Fire-and-forget: notify the customer about the status change
    notifyOrderStatusChange(orderId, existing.userId, existing.username, existing.email, status).catch(() => {});

    return updated;
};

export const getAllOrders = async () => {
    return await OrderModel.getAllOrders();
};
