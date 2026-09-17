import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/model/notificationModel.js', () => ({
    createNotification: vi.fn(),
    getNotifications: vi.fn(),
    getAllNotifications: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    getUnreadCount: vi.fn(),
    savePushSubscription: vi.fn(),
    removePushSubscription: vi.fn(),
}));

vi.mock('../src/services/pushService.js', () => ({
    sendPushToUser: vi.fn(),
    sendPushToAllSubscribers: vi.fn(),
    isPushConfigured: vi.fn(),
    getVapidConfig: vi.fn(),
}));

const NotificationModel = await import('../src/model/notificationModel.js');
const pushService = await import('../src/services/pushService.js');
const dashboardService = await import('../src/services/dashboardService.js');

beforeEach(() => {
    vi.clearAllMocks();
    NotificationModel.createNotification.mockResolvedValue({ id: 42 });
    pushService.sendPushToUser.mockResolvedValue({ sent: 1, failed: 0, removed: 0 });
    pushService.sendPushToAllSubscribers.mockResolvedValue({ sent: 1, failed: 0, removed: 0 });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Order notifications
// ═══════════════════════════════════════════════════════════════════════════════

describe('notifyNewOrder', () => {
    it('stores an admin broadcast and a customer notification', async () => {
        await dashboardService.notifyNewOrder(12, 'bob', 99.5, 7);

        expect(NotificationModel.createNotification).toHaveBeenCalledTimes(2);
        const [admin, customer] = NotificationModel.createNotification.mock.calls.map(c => c[0]);

        expect(admin.userId).toBeNull();
        expect(admin.link).toBe('/admin/orders');
        expect(customer.userId).toBe(7);
        expect(customer.link).toBe('/notifications');
    });

    it('pushes the broadcast to subscribers and the receipt to the buyer', async () => {
        await dashboardService.notifyNewOrder(12, 'bob', 99.5, 7);

        expect(pushService.sendPushToAllSubscribers).toHaveBeenCalledTimes(1);
        expect(pushService.sendPushToUser).toHaveBeenCalledTimes(1);

        const [userId, payload] = pushService.sendPushToUser.mock.calls[0];
        expect(userId).toBe(7);
        expect(payload.title).toBe('Order update');
        expect(payload.body).toContain('Order #12');
        expect(payload.url).toBe('/notifications');
        expect(payload.tag).toBe('order-42');
    });

    it('still pushes the broadcast when the order has no customer id', async () => {
        await dashboardService.notifyNewOrder(12, 'guest', 10, null);

        expect(pushService.sendPushToAllSubscribers).toHaveBeenCalledTimes(1);
        expect(pushService.sendPushToUser).not.toHaveBeenCalled();
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Status changes, stock, users, products
// ═══════════════════════════════════════════════════════════════════════════════

describe('notifyOrderStatusChange', () => {
    it('pushes the status update to the customer', async () => {
        await dashboardService.notifyOrderStatusChange(12, 7, 'bob', 'bob@example.com', 'shipped');

        expect(pushService.sendPushToUser).toHaveBeenCalledTimes(1);
        const [userId, payload] = pushService.sendPushToUser.mock.calls[0];
        expect(userId).toBe(7);
        expect(payload.body).toContain('Shipped');
    });
});

describe('notifyLowStock', () => {
    it('pushes a stock alert to subscribers', async () => {
        await dashboardService.notifyLowStock('iPhone 16', 2, 'IP16-256');

        expect(pushService.sendPushToAllSubscribers).toHaveBeenCalledTimes(1);
        const [payload] = pushService.sendPushToAllSubscribers.mock.calls[0];
        expect(payload.title).toBe('Low stock alert');
        expect(payload.body).toContain('iPhone 16 (IP16-256)');
        expect(payload.url).toBe('/admin/manage-stock');
    });
});

describe('notifyNewUser', () => {
    it('pushes a registration notice to admins', async () => {
        await dashboardService.notifyNewUser('alice');

        expect(pushService.sendPushToAllSubscribers).toHaveBeenCalledTimes(1);
        const [payload] = pushService.sendPushToAllSubscribers.mock.calls[0];
        expect(payload.title).toBe('New user');
        expect(payload.body).toContain('alice');
        expect(payload.url).toBe('/admin/manage-user');
    });
});

describe('notifyNewProduct', () => {
    it('pushes a product notice to admins', async () => {
        await dashboardService.notifyNewProduct('Galaxy S25');

        const [payload] = pushService.sendPushToAllSubscribers.mock.calls[0];
        expect(payload.title).toBe('New product');
        expect(payload.url).toBe('/admin/manage-products');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Resilience
// ═══════════════════════════════════════════════════════════════════════════════

describe('push failures never break notifications', () => {
    it('resolves even when every push delivery fails', async () => {
        pushService.sendPushToAllSubscribers.mockRejectedValue(new Error('push down'));
        pushService.sendPushToUser.mockRejectedValue(new Error('push down'));

        await expect(dashboardService.notifyNewOrder(12, 'bob', 10, 7)).resolves.toBeUndefined();
        await expect(dashboardService.notifyNewUser('alice')).resolves.toBeUndefined();

        // The notifications themselves were still persisted
        expect(NotificationModel.createNotification).toHaveBeenCalledTimes(3);
    });
});
