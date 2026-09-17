import { defineStore } from 'pinia';
import { useAuthStore } from './auth.js';
import api from '../api/api.js';

// ── Notification badge state, shared by every surface ─────────────────────────
// One store owns the unread count so the navbar bell, the dashboard bell and the
// two notification pages can never disagree. Tabs stay in sync through a
// BroadcastChannel, with a localStorage fallback whose `storage` event is only
// delivered to *other* tabs (the semantics we want).

const CHANNEL_NAME = 'aliee-notifications';
const STORAGE_KEY = 'aliee-notifications-unread';
const POLL_INTERVAL_MS = 60000;
const BELL_LIMIT = 5;

// Module-level (not per-store) so they survive component remounts
let channel = null;
let detachSync = null;
let pollTimer = null;
let started = false;

const publish = (message) => {
    try {
        if (channel) {
            channel.postMessage(message);
            return;
        }
        // Fallback: any change to the stored value fires `storage` in other tabs
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...message, at: Date.now() }));
    } catch {
        /* storage unavailable (private mode) — stays single-tab */
    }
};

const subscribe = (handler) => {
    if (typeof BroadcastChannel !== 'undefined') {
        try {
            channel = new BroadcastChannel(CHANNEL_NAME);
            channel.onmessage = (event) => handler(event.data);
            return () => {
                channel?.close();
                channel = null;
            };
        } catch {
            channel = null;
        }
    }

    const onStorage = (event) => {
        if (event.key !== STORAGE_KEY || !event.newValue) return;
        try {
            handler(JSON.parse(event.newValue));
        } catch { /* ignore malformed payloads */ }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
};

export const useNotificationStore = defineStore('notifications', {
    state: () => ({
        recent: [],
        unreadCount: 0,
        lastSyncedAt: null,
    }),

    getters: {
        hasUnread: (state) => state.unreadCount > 0,
        badgeText: (state) => (state.unreadCount > 99 ? '99+' : String(state.unreadCount)),
    },

    actions: {
        // Admins read the global dashboard feed, everyone else their own rows.
        // Both the fetch and the read endpoints must come from this one branch.
        isAdmin() {
            const auth = useAuthStore();
            return Number(auth.user?.role_id) <= 2;
        },

        endpoints() {
            return this.isAdmin()
                ? {
                    recent: `/dashboard/notifications?limit=${BELL_LIMIT}`,
                    markRead: (id) => `/dashboard/notifications/${id}/read`,
                    markAll: '/dashboard/notifications/read-all',
                    all: '/admin/notifications',
                }
                : {
                    recent: `/notifications/recent?limit=${BELL_LIMIT}`,
                    markRead: (id) => `/notifications/${id}/read`,
                    markAll: '/notifications/read-all',
                    all: '/notifications',
                };
        },

        // Update the count and tell the other tabs. Only a real change is
        // published, so tabs cannot ping-pong messages at each other.
        setCount(count, { broadcast = true } = {}) {
            const next = Math.max(0, Number(count) || 0);
            const changed = next !== this.unreadCount;

            this.unreadCount = next;
            this.lastSyncedAt = Date.now();

            if (broadcast && changed) publish({ type: 'unread', count: next });
        },

        async refresh() {
            const auth = useAuthStore();

            if (!auth.isAuthenticated) {
                this.recent = [];
                this.setCount(0);
                return;
            }

            try {
                const { data } = await api.get(this.endpoints().recent);
                if (data?.success) {
                    this.recent = data.data?.notifications || [];
                    this.setCount(data.data?.unreadCount || 0);
                }
            } catch {
                // Offline or not authorized — keep the last known count
            }
        },

        async markRead(id) {
            const notification = this.recent.find(n => n.id === id);
            if (notification?.is_read) return;

            try {
                await api.put(this.endpoints().markRead(id));
            } catch {
                // Leave the badge alone when the server rejected the request
                return;
            }

            if (notification) notification.is_read = true;
            this.setCount(this.unreadCount - 1);
        },

        async markAllRead() {
            try {
                await api.put(this.endpoints().markAll);
            } catch {
                return;
            }

            this.recent.forEach((n) => { n.is_read = true; });
            this.setCount(0);
        },

        /** Message received from another tab */
        applyRemote(message) {
            if (!message || typeof message !== 'object') return;

            if (message.type === 'unread') {
                this.unreadCount = Math.max(0, Number(message.count) || 0);
                this.lastSyncedAt = Date.now();
            }

            if (message.type === 'refresh') this.refresh();
        },

        /** Clear the badge without asking the server (used on logout) */
        reset() {
            this.recent = [];
            this.setCount(0);
        },

        /** Start polling + cross-tab sync. Safe to call from several components. */
        start() {
            if (started) return;
            started = true;

            detachSync = subscribe((message) => this.applyRemote(message));
            pollTimer = setInterval(() => this.refresh(), POLL_INTERVAL_MS);

            // Background tabs throttle timers, and a tab may have been closed
            // while notifications were read elsewhere — resync on focus.
            document.addEventListener('visibilitychange', this.handleVisibility);

            this.refresh();
        },

        handleVisibility() {
            if (document.visibilityState === 'visible') this.refresh();
        },

        stop() {
            if (detachSync) { detachSync(); detachSync = null; }
            if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
            document.removeEventListener('visibilitychange', this.handleVisibility);
            started = false;
        },
    },
});

export default useNotificationStore;
