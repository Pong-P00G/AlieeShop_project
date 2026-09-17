import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('web-push', () => ({
    default: {
        setVapidDetails: vi.fn(),
        sendNotification: vi.fn(),
    },
}));

vi.mock('../src/model/notificationModel.js', () => ({
    getPushSubscriptions: vi.fn(),
    getAllPushSubscriptions: vi.fn(),
    deletePushSubscriptionByEndpoint: vi.fn(),
}));

const webpush = (await import('web-push')).default;
const NotificationModel = await import('../src/model/notificationModel.js');
const pushService = await import('../src/services/pushService.js');

const ORIGINAL_ENV = {
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    VAPID_EMAIL: process.env.VAPID_EMAIL,
};

const subscriptionRow = (id = 1) => ({
    subscriptionid: id,
    userid: 7,
    endpoint: `https://push.example.com/${id}`,
    p256dh_key: 'p256dh-key',
    auth_key: 'auth-key',
});

const configurePush = () => {
    process.env.VAPID_PUBLIC_KEY = 'BPublicKey';
    process.env.VAPID_PRIVATE_KEY = 'private-key';
    process.env.VAPID_EMAIL = 'admin@aliee.shop';
};

const unconfigurePush = () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_EMAIL;
};

beforeEach(() => {
    vi.clearAllMocks();
    webpush.sendNotification.mockResolvedValue({ statusCode: 201 });
    NotificationModel.deletePushSubscriptionByEndpoint.mockResolvedValue(true);
});

afterEach(() => {
    process.env.VAPID_PUBLIC_KEY = ORIGINAL_ENV.VAPID_PUBLIC_KEY ?? '';
    process.env.VAPID_PRIVATE_KEY = ORIGINAL_ENV.VAPID_PRIVATE_KEY ?? '';
    process.env.VAPID_EMAIL = ORIGINAL_ENV.VAPID_EMAIL ?? '';
    if (!ORIGINAL_ENV.VAPID_PUBLIC_KEY) delete process.env.VAPID_PUBLIC_KEY;
    if (!ORIGINAL_ENV.VAPID_PRIVATE_KEY) delete process.env.VAPID_PRIVATE_KEY;
    if (!ORIGINAL_ENV.VAPID_EMAIL) delete process.env.VAPID_EMAIL;
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Configuration
// ═══════════════════════════════════════════════════════════════════════════════

describe('pushService — configuration', () => {
    it('reports push as unconfigured when the VAPID keys are missing', () => {
        unconfigurePush();

        expect(pushService.isPushConfigured()).toBe(false);
        expect(pushService.getVapidConfig()).toBeNull();
    });

    it('exposes the public key once configured (no placeholder fallback)', () => {
        configurePush();

        expect(pushService.isPushConfigured()).toBe(true);
        expect(pushService.getVapidConfig().publicKey).toBe('BPublicKey');
    });

    it('normalises the contact email into a mailto: subject', () => {
        configurePush();

        expect(pushService.getVapidConfig().subject).toBe('mailto:admin@aliee.shop');
    });

    it('leaves an already-formatted subject untouched', () => {
        configurePush();
        process.env.VAPID_EMAIL = 'mailto:someone@aliee.shop';

        expect(pushService.getVapidConfig().subject).toBe('mailto:someone@aliee.shop');
    });

    it('skips delivery entirely when unconfigured instead of throwing', async () => {
        unconfigurePush();

        const summary = await pushService.sendToSubscriptions([subscriptionRow()], { body: 'hi' });

        expect(summary).toEqual({ sent: 0, failed: 0, removed: 0 });
        expect(webpush.sendNotification).not.toHaveBeenCalled();
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Delivery
// ═══════════════════════════════════════════════════════════════════════════════

describe('pushService — delivery', () => {
    beforeEach(configurePush);

    it('sends to every subscription and reports how many succeeded', async () => {
        const summary = await pushService.sendToSubscriptions(
            [subscriptionRow(1), subscriptionRow(2)],
            { title: 'Low stock alert', body: 'Only 2 left', url: '/admin/manage-stock' }
        );

        expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
        expect(summary).toEqual({ sent: 2, failed: 0, removed: 0 });
    });

    it('sends a payload shaped for the service worker (data.url drives the click target)', async () => {
        await pushService.sendToSubscriptions([subscriptionRow()], {
            title: 'Order update',
            body: 'Order #12 shipped',
            url: '/notifications',
            tag: 'order-12',
        });

        const [subscription, rawBody] = webpush.sendNotification.mock.calls[0];
        const payload = JSON.parse(rawBody);

        expect(subscription).toEqual({
            endpoint: 'https://push.example.com/1',
            keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
        });
        expect(payload.title).toBe('Order update');
        expect(payload.body).toBe('Order #12 shipped');
        expect(payload.tag).toBe('order-12');
        expect(payload.data.url).toBe('/notifications');
    });

    it('falls back to the shop title and link when the payload omits them', async () => {
        await pushService.sendToSubscriptions([subscriptionRow()], { body: 'Hello' });

        const payload = JSON.parse(webpush.sendNotification.mock.calls[0][1]);
        expect(payload.title).toBe('AlieeShop');
        expect(payload.data.url).toBe('/notifications');
    });

    it('deletes subscriptions the push service reports as gone (410)', async () => {
        const gone = new Error('Gone');
        gone.statusCode = 410;
        webpush.sendNotification.mockRejectedValueOnce(gone);

        const summary = await pushService.sendToSubscriptions([subscriptionRow(9)], { body: 'hi' });

        expect(summary).toEqual({ sent: 0, failed: 0, removed: 1 });
        expect(NotificationModel.deletePushSubscriptionByEndpoint).toHaveBeenCalledWith('https://push.example.com/9');
    });

    it('deletes subscriptions for 404 responses too', async () => {
        const notFound = new Error('Not found');
        notFound.statusCode = 404;
        webpush.sendNotification.mockRejectedValueOnce(notFound);

        const summary = await pushService.sendToSubscriptions([subscriptionRow(3)], { body: 'hi' });

        expect(summary.removed).toBe(1);
        expect(NotificationModel.deletePushSubscriptionByEndpoint).toHaveBeenCalled();
    });

    it('keeps subscriptions on transient errors and continues the batch', async () => {
        const serverError = new Error('Push service unavailable');
        serverError.statusCode = 503;
        webpush.sendNotification
            .mockRejectedValueOnce(serverError)
            .mockResolvedValueOnce({ statusCode: 201 });

        const summary = await pushService.sendToSubscriptions(
            [subscriptionRow(1), subscriptionRow(2)],
            { body: 'hi' }
        );

        expect(summary).toEqual({ sent: 1, failed: 1, removed: 0 });
        expect(NotificationModel.deletePushSubscriptionByEndpoint).not.toHaveBeenCalled();
    });

    it('is a no-op for an empty subscription list', async () => {
        const summary = await pushService.sendToSubscriptions([], { body: 'hi' });

        expect(summary).toEqual({ sent: 0, failed: 0, removed: 0 });
        expect(webpush.sendNotification).not.toHaveBeenCalled();
    });

    it('configures VAPID details only once per process', async () => {
        // "Configured once" is module-level state, so this needs a fresh module
        // instance (and therefore a fresh web-push mock) to be observable
        vi.resetModules();
        const freshWebpush = (await import('web-push')).default;
        const freshPushService = await import('../src/services/pushService.js');

        await freshPushService.sendToSubscriptions([subscriptionRow()], { body: 'one' });
        await freshPushService.sendToSubscriptions([subscriptionRow()], { body: 'two' });

        expect(freshWebpush.setVapidDetails).toHaveBeenCalledTimes(1);
        expect(freshWebpush.sendNotification).toHaveBeenCalledTimes(2);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Targets
// ═══════════════════════════════════════════════════════════════════════════════

describe('pushService — targets', () => {
    beforeEach(configurePush);

    it('sendPushToUser only loads that user\'s subscriptions', async () => {
        NotificationModel.getPushSubscriptions.mockResolvedValue([subscriptionRow()]);

        await pushService.sendPushToUser(7, { body: 'your order shipped' });

        expect(NotificationModel.getPushSubscriptions).toHaveBeenCalledWith(7);
        expect(NotificationModel.getAllPushSubscriptions).not.toHaveBeenCalled();
        expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
    });

    it('sendPushToAllSubscribers targets every subscriber (admin broadcasts)', async () => {
        NotificationModel.getAllPushSubscriptions.mockResolvedValue([subscriptionRow(1), subscriptionRow(2)]);

        const summary = await pushService.sendPushToAllSubscribers({ body: 'new order' });

        expect(summary.sent).toBe(2);
        expect(NotificationModel.getPushSubscriptions).not.toHaveBeenCalled();
    });

    it('never throws when the subscription lookup fails', async () => {
        NotificationModel.getPushSubscriptions.mockRejectedValue(new Error('db down'));

        await expect(pushService.sendPushToUser(7, { body: 'hi' })).resolves.toEqual({
            sent: 0, failed: 0, removed: 0,
        });
    });

    it('never throws when the subscription table lookup fails', async () => {
        NotificationModel.getAllPushSubscriptions.mockRejectedValue(new Error('db down'));

        await expect(pushService.sendPushToAllSubscribers({ body: 'hi' })).resolves.toEqual({
            sent: 0, failed: 0, removed: 0,
        });
    });
});
