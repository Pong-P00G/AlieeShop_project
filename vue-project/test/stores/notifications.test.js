import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('../../src/api/api.js', () => ({
    default: { get: vi.fn(), put: vi.fn() },
}));

vi.mock('../../src/stores/shop.js', () => ({
    useShopStore: () => ({ mergeAndSyncWishlistOnLogin: vi.fn(), cart: [], wishlist: [] }),
}));

const api = (await import('../../src/api/api.js')).default;
const { useAuthStore } = await import('../../src/stores/auth.js');
const { useNotificationStore } = await import('../../src/stores/notifications.js');

// ── BroadcastChannel double ───────────────────────────────────────────────────
class FakeBroadcastChannel {
    static instances = [];

    constructor(name) {
        this.name = name;
        this.onmessage = null;
        this.sent = [];
        this.closed = false;
        FakeBroadcastChannel.instances.push(this);
    }

    postMessage(data) { this.sent.push(data); }

    close() { this.closed = true; }

    /** Simulate a message arriving from another tab */
    emitFromOtherTab(data) { this.onmessage?.({ data }); }
}

const ORIGINAL_BROADCAST_CHANNEL = globalThis.BroadcastChannel;

const signIn = (role_id = 3) => {
    const auth = useAuthStore();
    auth.user = { user_id: 1, username: 'tester', role_id };
    return auth;
};

const mockBellResponse = (unreadCount = 3, notifications = [{ id: 1, is_read: false }]) => {
    api.get.mockResolvedValue({ data: { success: true, data: { notifications, unreadCount } } });
};

let store;

beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    FakeBroadcastChannel.instances = [];
    localStorage.clear();
    delete globalThis.BroadcastChannel;
    store = useNotificationStore();
    mockBellResponse();
});

afterEach(() => {
    store.stop();
    if (ORIGINAL_BROADCAST_CHANNEL) globalThis.BroadcastChannel = ORIGINAL_BROADCAST_CHANNEL;
    else delete globalThis.BroadcastChannel;
    vi.useRealTimers();
});

// ════════════════════════════════════════════════════════════════════════════════
//  Role-aware endpoints
// ════════════════════════════════════════════════════════════════════════════════

describe('notifications store — endpoints', () => {
    it('uses the customer endpoints for a customer', async () => {
        signIn(3);

        await store.refresh();

        expect(api.get).toHaveBeenCalledWith('/notifications/recent?limit=5');
        expect(store.endpoints().all).toBe('/notifications');
    });

    it('uses the dashboard endpoints for an admin', async () => {
        signIn(1);

        await store.refresh();

        expect(api.get).toHaveBeenCalledWith('/dashboard/notifications?limit=5');
        expect(store.endpoints().all).toBe('/admin/notifications');
    });

    it('treats role 2 as an admin', async () => {
        signIn(2);

        await store.refresh();

        expect(api.get).toHaveBeenCalledWith('/dashboard/notifications?limit=5');
    });

    it('reads the unread count and bell list from the response', async () => {
        signIn(3);

        await store.refresh();

        expect(store.unreadCount).toBe(3);
        expect(store.recent).toHaveLength(1);
        expect(store.hasUnread).toBe(true);
    });

    it('does not call the API when signed out', async () => {
        await store.refresh();

        expect(api.get).not.toHaveBeenCalled();
        expect(store.unreadCount).toBe(0);
    });

    it('keeps the last known count when the request fails', async () => {
        signIn(3);
        api.get.mockRejectedValueOnce(new Error('offline'));

        await store.refresh();

        expect(store.unreadCount).toBe(0);
        expect(api.get).toHaveBeenCalled();
    });
});

// ════════════════════════════════════════════════════════════════════════════════
//  Marking read
// ════════════════════════════════════════════════════════════════════════════════

describe('notifications store — markRead', () => {
    beforeEach(() => {
        api.put.mockResolvedValue({ data: { success: true } });
        store.unreadCount = 3;
        store.recent = [{ id: 1, is_read: false }, { id: 2, is_read: false }];
    });

    it('marks read through the customer route and decrements the badge', async () => {
        signIn(3);

        await store.markRead(1);

        expect(api.put).toHaveBeenCalledWith('/notifications/1/read');
        expect(store.unreadCount).toBe(2);
        expect(store.recent[0].is_read).toBe(true);
    });

    it('marks read through the admin route for admins', async () => {
        signIn(1);

        await store.markRead(1);

        expect(api.put).toHaveBeenCalledWith('/dashboard/notifications/1/read');
    });

    it('never decrements below zero', async () => {
        signIn(3);
        store.unreadCount = 1;

        await store.markRead(1);
        await store.markRead(2);

        expect(store.unreadCount).toBe(0);
    });

    it('skips the request for an already-read notification', async () => {
        signIn(3);
        store.recent = [{ id: 1, is_read: true }];

        await store.markRead(1);

        expect(api.put).not.toHaveBeenCalled();
    });

    it('leaves the badge untouched when the server rejects the request', async () => {
        signIn(3);
        api.put.mockRejectedValueOnce(new Error('403'));

        await store.markRead(1);

        expect(store.unreadCount).toBe(3);
        expect(store.recent[0].is_read).toBe(false);
    });

    it('markAllRead clears the badge and the list', async () => {
        signIn(3);

        await store.markAllRead();

        expect(api.put).toHaveBeenCalledWith('/notifications/read-all');
        expect(store.unreadCount).toBe(0);
        expect(store.recent.every(n => n.is_read)).toBe(true);
    });

    it('markAllRead uses the admin route for admins', async () => {
        signIn(1);

        await store.markAllRead();

        expect(api.put).toHaveBeenCalledWith('/dashboard/notifications/read-all');
    });
});

// ════════════════════════════════════════════════════════════════════════════════
//  Cross-tab sync
// ════════════════════════════════════════════════════════════════════════════════

describe('notifications store — cross-tab sync', () => {
    it('broadcasts the count to other tabs when it changes', async () => {
        globalThis.BroadcastChannel = FakeBroadcastChannel;
        signIn(3);
        store.start();
        await vi.waitFor(() => expect(store.unreadCount).toBe(3));

        const channel = FakeBroadcastChannel.instances[0];
        expect(channel.name).toBe('aliee-notifications');
        expect(channel.sent).toContainEqual({ type: 'unread', count: 3 });
    });

    it('applies an incoming count without calling the API', async () => {
        globalThis.BroadcastChannel = FakeBroadcastChannel;
        signIn(3);
        store.start();

        const channel = FakeBroadcastChannel.instances[0];
        api.get.mockClear();
        channel.emitFromOtherTab({ type: 'unread', count: 9 });

        expect(store.unreadCount).toBe(9);
        expect(api.get).not.toHaveBeenCalled();
    });

    it('ignores malformed messages from other tabs', () => {
        globalThis.BroadcastChannel = FakeBroadcastChannel;
        store.start();
        const channel = FakeBroadcastChannel.instances[0];

        channel.emitFromOtherTab(null);
        channel.emitFromOtherTab('nonsense');
        channel.emitFromOtherTab({ type: 'unknown', count: 5 });

        expect(store.unreadCount).toBe(0);
    });

    it('does not re-broadcast a count that did not change', () => {
        globalThis.BroadcastChannel = FakeBroadcastChannel;
        store.start();
        const channel = FakeBroadcastChannel.instances[0];

        store.setCount(0);
        store.setCount(0);

        expect(channel.sent).toHaveLength(0);
    });

    it('falls back to localStorage when BroadcastChannel is unavailable', () => {
        delete globalThis.BroadcastChannel;
        store.start();

        store.setCount(4);

        const raw = localStorage.getItem('aliee-notifications-unread');
        expect(raw).toBeTruthy();
        expect(JSON.parse(raw).count).toBe(4);
    });

    it('applies counts arriving through the storage event', () => {
        delete globalThis.BroadcastChannel;
        store.start();

        window.dispatchEvent(new StorageEvent('storage', {
            key: 'aliee-notifications-unread',
            newValue: JSON.stringify({ type: 'unread', count: 7 }),
        }));

        expect(store.unreadCount).toBe(7);
    });

    it('only registers one poll interval no matter how often start() is called', () => {
        vi.useFakeTimers();
        const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

        store.start();
        store.start();
        store.start();

        expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    });

    it('stops polling and closes the channel', () => {
        globalThis.BroadcastChannel = FakeBroadcastChannel;
        vi.useFakeTimers();
        const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

        store.start();
        store.stop();

        expect(clearIntervalSpy).toHaveBeenCalled();
        expect(FakeBroadcastChannel.instances[0].closed).toBe(true);
    });

    it('reset() clears the badge and tells the other tabs', () => {
        globalThis.BroadcastChannel = FakeBroadcastChannel;
        store.start();
        const channel = FakeBroadcastChannel.instances[0];
        store.setCount(5);
        channel.sent.length = 0;

        store.reset();

        expect(store.unreadCount).toBe(0);
        expect(store.recent).toEqual([]);
        expect(channel.sent).toContainEqual({ type: 'unread', count: 0 });
    });

    it('badgeText caps the display at 99+', () => {
        store.unreadCount = 150;
        expect(store.badgeText).toBe('99+');

        store.unreadCount = 7;
        expect(store.badgeText).toBe('7');
    });
});
