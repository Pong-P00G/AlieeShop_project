import webpush from 'web-push';
import * as NotificationModel from '../model/notificationModel.js';

// ── Web push delivery ─────────────────────────────────────────────────────────
// Subscriptions are stored by /api/dashboard/push-subscribe; this service is the
// only thing that actually sends a push. Delivery is always best-effort: it is
// invoked fire-and-forget after a notification row is written, so a push failure
// must never break the notification itself.
//
// The payload shape matches vue-project/public/sw.js, which reads the click
// target from `event.notification.data.url`.

const DEFAULT_TITLE = 'AlieeShop';
const DEFAULT_LINK = '/notifications';

let vapidConfigured = false;

/**
 * Read the VAPID credentials from the environment.
 * Returns null when push is not configured — we deliberately have no hardcoded
 * fallback key, because subscribing with a bogus key silently breaks delivery.
 */
export const getVapidConfig = () => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const email = process.env.VAPID_EMAIL;

    if (!publicKey || !privateKey || !email) return null;

    return {
        publicKey,
        privateKey,
        // web-push requires a mailto: or https: subject
        subject: email.startsWith('mailto:') || email.startsWith('https://')
            ? email
            : `mailto:${email}`,
    };
};

export const isPushConfigured = () => getVapidConfig() !== null;

const ensureConfigured = () => {
    const config = getVapidConfig();
    if (!config) {
        throw new Error('Web push is not configured (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_EMAIL)');
    }
    if (!vapidConfigured) {
        webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
        vapidConfigured = true;
    }
    return config;
};

const toWebPushSubscription = (row) => ({
    endpoint: row.endpoint,
    keys: { p256dh: row.p256dh_key, auth: row.auth_key },
});

/**
 * Send one payload to a list of stored subscription rows.
 * Subscriptions the push service reports as gone (404/410) are deleted.
 * Never throws — returns a summary so callers can log it.
 */
export const sendToSubscriptions = async (subscriptions, payload) => {
    const summary = { sent: 0, failed: 0, removed: 0 };

    if (!subscriptions || subscriptions.length === 0) return summary;

    try {
        ensureConfigured();
    } catch (err) {
        console.warn('[Push] Skipped:', err.message);
        return summary;
    }

    const body = JSON.stringify({
        title: payload.title || DEFAULT_TITLE,
        body: payload.body || '',
        icon: payload.icon || '/favicon.ico',
        badge: payload.badge || '/favicon.ico',
        tag: payload.tag || 'aliee-notification',
        // sw.js reads the click target from data.url
        data: { url: payload.url || DEFAULT_LINK },
    });

    await Promise.all(subscriptions.map(async (row) => {
        try {
            await webpush.sendNotification(toWebPushSubscription(row), body);
            summary.sent += 1;
        } catch (err) {
            const statusCode = err?.statusCode;

            // 404/410 mean the browser dropped the subscription — clean it up
            if (statusCode === 404 || statusCode === 410) {
                summary.removed += 1;
                await NotificationModel
                    .deletePushSubscriptionByEndpoint(row.endpoint)
                    .catch(() => {});
                return;
            }

            summary.failed += 1;
            console.error(`[Push] Delivery failed (${statusCode || 'no status'}):`, err.message);
        }
    }));

    return summary;
};

/** Push to every device a single user has subscribed */
export const sendPushToUser = async (userId, payload) => {
    try {
        const subscriptions = await NotificationModel.getPushSubscriptions(userId);
        return await sendToSubscriptions(subscriptions, payload);
    } catch (err) {
        console.error('[Push] Could not load subscriptions for user:', err.message);
        return { sent: 0, failed: 0, removed: 0 };
    }
};

/** Push to every subscriber — used for admin broadcasts */
export const sendPushToAllSubscribers = async (payload) => {
    try {
        const subscriptions = await NotificationModel.getAllPushSubscriptions();
        return await sendToSubscriptions(subscriptions, payload);
    } catch (err) {
        console.error('[Push] Could not load push subscriptions:', err.message);
        return { sent: 0, failed: 0, removed: 0 };
    }
};

export default { isPushConfigured, getVapidConfig, sendToSubscriptions, sendPushToUser, sendPushToAllSubscribers };
