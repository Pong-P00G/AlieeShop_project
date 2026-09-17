import { describe, it, expect, vi } from 'vitest';

// The dashboard settings page (Settings.vue) was previously unreachable — no
// route imported it, so it could not be rendered at all. These tests fail if it
// is ever orphaned again.
vi.mock('../../src/stores/notifications.js', () => ({
    useNotificationStore: vi.fn(() => ({
        start: vi.fn(),
        stop: vi.fn(),
        unreadCount: 0,
        notifications: [],
        markRead: vi.fn(),
        markAllRead: vi.fn(),
        fetchNotifications: vi.fn(),
    })),
}));

import router from '../../src/router/index.js';

describe('router — reachable dashboard settings page', () => {
    it('resolves /admin/settings to the settings route', () => {
        const resolved = router.resolve('/admin/settings');

        expect(resolved.name).toBe('settings');
        expect(resolved.meta.page).toBe('settings');
    });

    it('mounts the settings page inside the admin dashboard layout', () => {
        const resolved = router.resolve('/admin/settings');

        // Dashboard children inherit the guard meta from the parent record
        expect(resolved.matched.some(r => r.meta.requiresAdmin)).toBe(true);
        expect(resolved.matched.some(r => r.meta.requiresAuth)).toBe(true);
    });

    it('sets page metadata so the route renders an SEO title', () => {
        const resolved = router.resolve({ name: 'settings' });

        expect(resolved.meta.page).toBe('settings');
    });
});
