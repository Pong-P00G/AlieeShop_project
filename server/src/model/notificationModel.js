import db from '../database/dbpool.js';

const NOTIFICATION_COLS = `
    n.notificationid AS id,
    n.type,
    n.message,
    n.link,
    n.isread AS is_read,
    n.createdat AS created_at
`;

export const getAllNotifications = async (page = 1, pageSize = 20, type = null) => {
    const offset = (page - 1) * pageSize;
    let whereClause = '';
    const params = [];

    if (type && type !== 'all') {
        params.push(type);
        whereClause = `WHERE n.type = $${params.length}`;
    }

    // Get total count
    const countResult = await db.query(
        `SELECT COUNT(*)::int AS total FROM notifications n ${whereClause}`,
        params
    );
    const totalItems = countResult.rows[0]?.total || 0;
    const totalPages = Math.ceil(totalItems / pageSize);

    params.push(pageSize);
    const limitP = `$${params.length}`;
    params.push(offset);
    const offsetP = `$${params.length}`;

    const { rows } = await db.query(
        `SELECT ${NOTIFICATION_COLS}
         FROM notifications n
         ${whereClause}
         ORDER BY n.createdat DESC
         LIMIT ${limitP} OFFSET ${offsetP}`,
        params
    );

    return { page, pageSize, totalItems, totalPages, items: rows };
};

export const getNotifications = async (limit = 20) => {
    const { rows } = await db.query(
        `SELECT ${NOTIFICATION_COLS}
         FROM notifications n
         ORDER BY n.isread ASC, n.createdat DESC
         LIMIT $1`,
        [limit]
    );
    return rows;
};

export const getUnreadCount = async () => {
    const { rows: [row] } = await db.query(
        `SELECT COUNT(*)::int AS count FROM notifications WHERE isread = FALSE`
    );
    return row ? row.count : 0;
};

export const createNotification = async ({ type, message, link = null, userId = null }) => {
    const { rows } = await db.query(
        `INSERT INTO notifications (type, message, link, userid)
         VALUES ($1, $2, $3, $4)
         RETURNING notificationid AS id, type, message, link, isread AS is_read, createdat AS created_at`,
        [type, message, link, userId]
    );
    return rows[0];
};

// ── USER-SPECIFIC NOTIFICATIONS ──────────────────────────────────────────────

export const getUserNotifications = async (userId, page = 1, pageSize = 20, type = null) => {
    const offset = (page - 1) * pageSize;
    const params = [userId];
    let whereClause = 'WHERE n.userid = $1';

    if (type && type !== 'all') {
        params.push(type);
        whereClause += ` AND n.type = $${params.length}`;
    }

    const countResult = await db.query(
        `SELECT COUNT(*)::int AS total FROM notifications n ${whereClause}`,
        params
    );
    const totalItems = countResult.rows[0]?.total || 0;
    const totalPages = Math.ceil(totalItems / pageSize);

    params.push(pageSize);
    const limitP = `$${params.length}`;
    params.push(offset);
    const offsetP = `$${params.length}`;

    const { rows } = await db.query(
        `SELECT ${NOTIFICATION_COLS}
         FROM notifications n
         ${whereClause}
         ORDER BY n.createdat DESC
         LIMIT ${limitP} OFFSET ${offsetP}`,
        params
    );

    return { page, pageSize, totalItems, totalPages, items: rows };
};

export const getUserRecentNotifications = async (userId, limit = 10) => {
    const { rows } = await db.query(
        `SELECT ${NOTIFICATION_COLS}
         FROM notifications n
         WHERE n.userid = $1
         ORDER BY n.isread ASC, n.createdat DESC
         LIMIT $2`,
        [userId, limit]
    );
    return rows;
};

export const getUserUnreadCount = async (userId) => {
    const { rows: [row] } = await db.query(
        `SELECT COUNT(*)::int AS count FROM notifications WHERE userid = $1 AND isread = FALSE`,
        [userId]
    );
    return row ? row.count : 0;
};

export const getUserNotificationById = async (userId, notificationId) => {
    const { rows } = await db.query(
        `SELECT ${NOTIFICATION_COLS}
         FROM notifications n
         WHERE n.userid = $1 AND n.notificationid = $2`,
        [userId, notificationId]
    );
    return rows[0] || null;
};

export const markUserNotificationAsRead = async (userId, notificationId) => {
    const { rows } = await db.query(
        `UPDATE notifications SET isread = TRUE
         WHERE notificationid = $1 AND userid = $2
         RETURNING notificationid AS id`,
        [notificationId, userId]
    );
    return rows[0] ? true : false;
};

export const markAllUserNotificationsAsRead = async (userId) => {
    await db.query(
        `UPDATE notifications SET isread = TRUE WHERE userid = $1 AND isread = FALSE`,
        [userId]
    );
    return true;
};

export const markAsRead = async (notificationId) => {
    const { rows } = await db.query(
        `UPDATE notifications SET isread = TRUE
         WHERE notificationid = $1
         RETURNING notificationid AS id`,
        [notificationId]
    );
    return rows[0] ? true : false;
};

export const markAllAsRead = async () => {
    const { rows: [row] } = await db.query(
        `UPDATE notifications SET isread = TRUE WHERE isread = FALSE`
    );
    return row ? true : false;
};

// ============================================================
// AUDIT LOG
// ============================================================

export const createAuditLog = async ({ action, entity_type, entity_id, entity_name, performed_by, details }) => {
    const { rows } = await db.query(
        `INSERT INTO audit_log (action, entity_type, entity_id, entity_name, performed_by, details)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING auditid AS id, action, entity_type, entity_id, entity_name, performed_by, details, createdat AS created_at`,
        [action, entity_type, entity_id, entity_name, performed_by, details]
    );
    return rows[0];
};

// ============================================================
// NOTIFICATION PREFERENCES
// ============================================================

export const getPreferences = async (userId) => {
    const { rows: [row] } = await db.query(
        `SELECT * FROM notification_preferences WHERE userid = $1`,
        [userId]
    );
    return row || null;
};

export const upsertPreferences = async (userId, prefs) => {
    const { rows: [row] } = await db.query(
        `INSERT INTO notification_preferences (userid, order_updates, promotions, newsletter, product_alerts, sms, push_enabled)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (userid) DO UPDATE SET
             order_updates  = COALESCE($2, notification_preferences.order_updates),
             promotions     = COALESCE($3, notification_preferences.promotions),
             newsletter     = COALESCE($4, notification_preferences.newsletter),
             product_alerts = COALESCE($5, notification_preferences.product_alerts),
             sms            = COALESCE($6, notification_preferences.sms),
             push_enabled   = COALESCE($7, notification_preferences.push_enabled),
             updatedat      = NOW()
         RETURNING *`,
        [
            userId,
            prefs.order_updates ?? true,
            prefs.promotions ?? false,
            prefs.newsletter ?? true,
            prefs.product_alerts ?? true,
            prefs.sms ?? false,
            prefs.push_enabled ?? false,
        ]
    );
    return row;
};

// ============================================================
// PUSH SUBSCRIPTIONS
// ============================================================

export const savePushSubscription = async (userId, subscription) => {
    const { rows: [row] } = await db.query(
        `INSERT INTO push_subscriptions (userid, endpoint, p256dh_key, auth_key)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (userid, endpoint) DO UPDATE SET
             p256dh_key = $3,
             auth_key   = $4,
             createdat  = NOW()
         RETURNING *`,
        [userId, subscription.endpoint, subscription.p256dh_key, subscription.auth_key]
    );
    return row;
};

export const removePushSubscription = async (userId, endpoint) => {
    await db.query(
        `DELETE FROM push_subscriptions WHERE userid = $1 AND endpoint = $2`,
        [userId, endpoint]
    );
};

export const getPushSubscriptions = async (userId) => {
    const { rows } = await db.query(
        `SELECT * FROM push_subscriptions WHERE userid = $1`,
        [userId]
    );
    return rows;
};

export const getAllPushSubscriptions = async () => {
    const { rows } = await db.query('SELECT * FROM push_subscriptions');
    return rows;
};

// Remove a subscription the push service reported as gone (HTTP 404/410)
export const deletePushSubscriptionByEndpoint = async (endpoint) => {
    const result = await db.query(
        'DELETE FROM push_subscriptions WHERE endpoint = $1',
        [endpoint]
    );
    return result.rowCount > 0;
};
