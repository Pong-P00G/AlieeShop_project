import * as orderService from '../services/orderService.js';
import { toCsv } from '../utils/csv.js';

// POST /api/orders
export const createOrder = async (req, res) => {
    try {
        const order = await orderService.createOrderFromCart(req.user.id);
        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            data: order
        });
    } catch (error) {
        res.status(error.status || 500).json({
            success: false,
            message: error.message
        });
    }
};

// GET /api/orders
// Admins see every order; everyone else sees only their own.
export const getOrders = async (req, res) => {
    try {
        const isAdmin = req.user.role_id === 1 || req.user.role_id === 2;
        const orders = isAdmin
            ? await orderService.getAllOrders()
            : await orderService.getUserOrders(req.user.id);

        res.json({
            success: true,
            data: orders
        });
    } catch (error) {
        res.status(error.status || 500).json({
            success: false,
            message: error.message
        });
    }
};

// GET /api/orders/export
// Admin-only CSV export of every order.
export const exportOrders = async (req, res) => {
    try {
        const orders = await orderService.getAllOrders();

        const csv = toCsv(orders, [
            { label: 'Order ID', value: 'orderId' },
            { label: 'Customer', value: 'username' },
            { label: 'Email', value: 'email' },
            { label: 'Status', value: 'status' },
            { label: 'Total', value: 'totalAmount' },
            { label: 'Items', value: 'itemCount' },
            { label: 'Payment Method', value: 'paymentMethod' },
            { label: 'Payment Status', value: 'paymentStatus' },
            { label: 'Created At', value: (o) => (o.createdAt ? new Date(o.createdAt).toISOString() : '') },
        ]);

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
        res.send(csv);
    } catch (error) {
        res.status(error.status || 500).json({
            success: false,
            message: error.message
        });
    }
};

// GET /api/orders/:id
export const getOrder = async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        const order = await orderService.getOrder(req.user.id, orderId, req.user.role_id);
        res.json({
            success: true,
            data: order
        });
    } catch (error) {
        res.status(error.status || 500).json({
            success: false,
            message: error.message
        });
    }
};

// PUT /api/orders/:id/status
export const updateStatus = async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        const { status } = req.body;
        const updated = await orderService.updateStatus(
            orderId,
            status,
            req.user.id,
            req.user.role_id
        );
        res.json({
            success: true,
            message: 'Order status updated',
            data: updated
        });
    } catch (error) {
        res.status(error.status || 400).json({
            success: false,
            message: error.message
        });
    }
};
