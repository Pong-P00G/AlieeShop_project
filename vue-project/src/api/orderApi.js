import api from './api';

export const orderAPI = {
    // Create a new order from the current cart
    async createOrder() {
        const { data } = await api.post('/orders');
        return data;
    },

    // Get all orders (Admin: all; User: own)
    async getAllOrders() {
        const { data } = await api.get('/orders');
        return data;
    },

    // Get single order by ID with line items
    async getOrder(orderId) {
        const { data } = await api.get(`/orders/${orderId}`);
        return data;
    },

    // Update order status (Admin only)
    async updateOrderStatus(orderId, status) {
        const { data } = await api.put(`/orders/${orderId}/status`, { status });
        return data;
    },

    // Download all orders as a CSV blob (Admin only)
    async exportOrdersCsv() {
        const { data } = await api.get('/orders/export', { responseType: 'blob' });
        return data;
    }
};
