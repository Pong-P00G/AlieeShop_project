import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/vue';
import { createPinia, setActivePinia } from 'pinia';
import Settings from '../../src/views/Settings.vue';
import { dashboardAPI } from '../../src/api/dashboardApi.js';
import { userAPI } from '../../src/api/userApi.js';
import { useAuthStore } from '../../src/stores/auth.js';

vi.mock('../../src/api/dashboardApi.js', () => ({
    dashboardAPI: {
        getNotificationPreferences: vi.fn(),
        updateNotificationPreferences: vi.fn(),
        getVapidPublicKey: vi.fn(),
        savePushSubscription: vi.fn(),
        removePushSubscription: vi.fn(),
    }
}));

vi.mock('../../src/api/userApi.js', () => ({
    userAPI: {
        updateProfile: vi.fn(),
    }
}));

const mockToast = vi.hoisted(() => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
}));

vi.mock('../../src/composables/useToast.js', () => ({
    useToast: () => mockToast,
}));

let pinia;
let authStore;

const renderPage = () => render(Settings, { global: { plugins: [pinia] } });
const saveButton = () => screen.getByRole('button', { name: 'Save changes' });

beforeEach(() => {
    vi.clearAllMocks();
    pinia = createPinia();
    setActivePinia(pinia);
    authStore = useAuthStore();
    // Note: the server requires usernames of at least 4 characters, so a
    // shorter fixture would fail the local validation before the real check.
    authStore.user = {
        user_id: 7,
        username: 'bobby',
        email: 'bobby@example.com',
        first_name: 'Bob',
        last_name: 'Builder',
        role_id: 1,
    };
    dashboardAPI.getNotificationPreferences.mockResolvedValue({ success: true, data: {} });
});

describe('Settings — Account tab', () => {
    it('seeds the form from the authenticated user and keeps save disabled', () => {
        renderPage();

        expect(screen.getByLabelText('Display name').value).toBe('bobby');
        expect(screen.getByLabelText('Email').value).toBe('bobby@example.com');
        expect(saveButton().disabled).toBe(true);
    });

    it('no longer renders the Bio field', () => {
        renderPage();

        expect(screen.queryByText('Bio')).toBeNull();
    });

    it('saves through the user API and syncs the auth store', async () => {
        userAPI.updateProfile.mockResolvedValue({
            user_id: 7,
            username: 'bobbynew',
            email: 'bobbynew@example.com',
        });

        renderPage();

        await fireEvent.update(screen.getByLabelText('Display name'), 'bobbynew');
        await fireEvent.update(screen.getByLabelText('Email'), 'bobbynew@example.com');
        await fireEvent.click(saveButton());

        await waitFor(() => {
            expect(userAPI.updateProfile).toHaveBeenCalledWith({
                username: 'bobbynew',
                email: 'bobbynew@example.com',
            });
        });

        // The dashboard header reads username/initials from the store
        expect(authStore.user.username).toBe('bobbynew');
        expect(authStore.user.email).toBe('bobbynew@example.com');
        expect(mockToast.success).toHaveBeenCalled();
    });

    it('sends only the changed field', async () => {
        userAPI.updateProfile.mockResolvedValue({ user_id: 7, username: 'bobbynew' });

        renderPage();

        expect(saveButton().disabled).toBe(true);
        await fireEvent.update(screen.getByLabelText('Display name'), 'bobbynew');
        expect(saveButton().disabled).toBe(false);

        await fireEvent.click(saveButton());

        await waitFor(() => expect(userAPI.updateProfile).toHaveBeenCalledTimes(1));
        // A partial payload: the server merges anything omitted from the stored
        // row, so the untouched email is preserved rather than blanked out.
        expect(userAPI.updateProfile.mock.calls[0][0]).toEqual({ username: 'bobbynew' });
    });

    it('lets an account with a legacy short username save an unrelated change', async () => {
        // A username that predates the current 4-character rule must not block a
        // change to another field, because it is never re-sent for validation.
        authStore.user = { user_id: 7, username: 'bob', email: 'bob@example.com', role_id: 1 };
        userAPI.updateProfile.mockResolvedValue({ user_id: 7, email: 'new@example.com' });

        renderPage();

        expect(screen.getByLabelText('Display name').value).toBe('bob');
        await fireEvent.update(screen.getByLabelText('Email'), 'new@example.com');
        await fireEvent.click(saveButton());

        await waitFor(() => {
            expect(userAPI.updateProfile).toHaveBeenCalledWith({ email: 'new@example.com' });
        });
        expect(screen.queryByText(/Username must be 4-30/)).toBeNull();
    });

    it('still rejects a newly typed username that is too short', async () => {
        authStore.user = { user_id: 7, username: 'bob', email: 'bob@example.com', role_id: 1 };

        renderPage();

        await fireEvent.update(screen.getByLabelText('Display name'), 'bo');
        await fireEvent.click(saveButton());

        expect(userAPI.updateProfile).not.toHaveBeenCalled();
        expect(screen.getByText(/Username must be 4-30 characters/)).toBeTruthy();
    });

    it('rejects a too-short username locally without calling the API', async () => {
        renderPage();

        await fireEvent.update(screen.getByLabelText('Display name'), 'bo');
        await fireEvent.click(saveButton());

        expect(userAPI.updateProfile).not.toHaveBeenCalled();
        expect(screen.getByText(/Username must be 4-30 characters/)).toBeTruthy();
    });

    it('rejects an invalid email locally without calling the API', async () => {
        renderPage();

        await fireEvent.update(screen.getByLabelText('Email'), 'not-an-email');
        await fireEvent.click(saveButton());

        expect(userAPI.updateProfile).not.toHaveBeenCalled();
        expect(screen.getByText(/valid email address/)).toBeTruthy();
    });

    it("surfaces the server's duplicate-username message", async () => {
        userAPI.updateProfile.mockRejectedValue({
            response: { data: { message: 'Username already taken' } },
        });

        renderPage();

        await fireEvent.update(screen.getByLabelText('Display name'), 'alice');
        await fireEvent.click(saveButton());

        await waitFor(() => {
            expect(screen.getByText('Username already taken')).toBeTruthy();
        });
        expect(mockToast.error).toHaveBeenCalledWith('Username already taken');
        // A failed save must not silently rewrite the store
        expect(authStore.user.username).toBe('bobby');
    });
});
