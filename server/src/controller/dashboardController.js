import * as dashboardService from '../services/dashboardService.js';

// Get dashboard statistics
export const getDashboardStats = async (req, res) => {
    try {
        const stats = await dashboardService.getDashboardStats();
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get user statistics
export const getUserStats = async (req, res) => {
    try {
        const stats = await dashboardService.getUserStats();
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get product statistics
export const getProductStats = async (req, res) => {
    try {
        const stats = await dashboardService.getProductStats();
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get recent activities
export const getRecentActivities = async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const activities = await dashboardService.getRecentActivities(parseInt(limit));
        res.json({
            success: true,
            data: activities
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get recent orders
export const getRecentOrders = async (req, res) => {
    try {
        const { limit = 5 } = req.query;
        const orders = await dashboardService.getRecentOrders(parseInt(limit));
        res.json({
            success: true,
            data: orders
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get top products
export const getTopProducts = async (req, res) => {
    try {
        const { limit = 5 } = req.query;
        const products = await dashboardService.getTopProducts(parseInt(limit));
        res.json({
            success: true,
            data: products
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get revenue stats
export const getRevenue = async (req, res) => {
    try {
        const revenue = await dashboardService.getRevenueStats();
        res.json({
            success: true,
            data: revenue
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get order stats
export const getOrderStats = async (req, res) => {
    try {
        const stats = await dashboardService.getOrderStats();
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Generate a report on-the-fly
export const generateReport = async (req, res) => {
    try {
        const { type = 'sales', dateRange = 'month', startDate, endDate } = req.body;
        const report = await dashboardService.generateReport({ type, dateRange, startDate, endDate });
        res.json({
            success: true,
            data: report
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Get all activities (paginated, with type filter)
export const getAllActivities = async (req, res) => {
    try {
        const { page = 1, pageSize = 20, type } = req.query;
        const activities = await dashboardService.getAllActivities(
            parseInt(page),
            parseInt(pageSize),
            type || null
        );
        res.json({
            success: true,
            data: activities
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Manually trigger a low-stock check
// Returns the number of new notifications created
export const checkLowStock = async (req, res) => {
    try {
        const count = await dashboardService.checkAndNotifyLowStock();
        res.json({
            success: true,
            message: `Low-stock check complete`,
            data: { notificationsCreated: count }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get all notifications with pagination and type filter
export const getAllNotifications = async (req, res) => {
    try {
        const { page = 1, pageSize = 20, type } = req.query;
        const result = await dashboardService.getAllNotifications(
            parseInt(page),
            parseInt(pageSize),
            type || null
        );
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ── NOTIFICATION CONTROLLERS ────────────────────────────────────────────────

export const getNotifications = async (req, res) => {
    try {
        const { limit = 20 } = req.query;
        const result = await dashboardService.getNotifications(parseInt(limit));
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const markNotificationRead = async (req, res) => {
    try {
        const updated = await dashboardService.markNotificationRead(req.params.id);
        if (updated) {
            res.json({ success: true, message: 'Notification marked as read' });
        } else {
            res.status(404).json({ success: false, message: 'Notification not found' });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const markAllNotificationsRead = async (req, res) => {
    try {
        await dashboardService.markAllNotificationsRead();
        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ── NOTIFICATION PREFERENCES ────────────────────────────────────────────────

export const getNotificationPreferences = async (req, res) => {
    try {
        const prefs = await dashboardService.getNotificationPreferences(req.user.id);
        res.json({ success: true, data: prefs });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateNotificationPreferences = async (req, res) => {
    try {
        const updated = await dashboardService.updateNotificationPreferences(req.user.id, req.body);
        res.json({ success: true, data: updated, message: 'Preferences updated' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// ── PUSH SUBSCRIPTIONS ─────────────────────────────────────────────────────

export const savePushSubscription = async (req, res) => {
    try {
        const sub = await dashboardService.savePushSubscription(req.user.id, req.body);
        res.json({ success: true, data: sub, message: 'Push subscription saved' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

export const removePushSubscription = async (req, res) => {
    try {
        await dashboardService.removePushSubscription(req.user.id, req.body.endpoint);
        res.json({ success: true, message: 'Push subscription removed' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getVapidPublicKey = async (req, res) => {
    try {
        const key = dashboardService.getVapidPublicKey();

        if (!key) {
            // No placeholder key is ever returned — the browser must not be able
            // to "subscribe" to a key that can never deliver anything.
            return res.status(503).json({
                success: false,
                message: 'Web push is not configured on this server (VAPID keys are missing)',
            });
        }

        res.json({ success: true, data: { publicKey: key } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Global search across products, orders, and users
export const globalSearch = async (req, res) => {
    try {
        const { q } = req.query;
        const results = await dashboardService.globalSearch(q || '');
        res.json({
            success: true,
            data: results
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get review statistics
export const getReviewStats = async (req, res) => {
    try {
        const stats = await dashboardService.getReviewStats();
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get analytics data
export const getAnalytics = async (req, res) => {
    try {
        const { timeframe = 'month' } = req.query;
        const analytics = await dashboardService.getAnalytics(timeframe);
        res.json({
            success: true,
            data: analytics
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
