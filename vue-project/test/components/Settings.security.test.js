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

const mockPush = vi.hoisted(() => vi.fn());
vi.mock('vue-router', () => ({
    useRouter: () => ({ push: mockPush }),
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

const openSecurityTab = async () => {
    await fireEvent.click(screen.getByRole('button', { name: 'Security' }));
    return screen.findByLabelText('Current password');
};

const fill = async ({ current, next, confirm }) => {
    if (current !== undefined) await fireEvent.update(screen.getByLabelText('Current password'), current);
    if (next !== undefined) await fireEvent.update(screen.getByLabelText('New password'), next);
    if (confirm !== undefined) await fireEvent.update(screen.getByLabelText('Confirm new password'), confirm);
};

const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Update password' }));

beforeEach(() => {
    vi.clearAllMocks();
    pinia = createPinia();
    setActivePinia(pinia);
    authStore = useAuthStore();
    authStore.user = {
        user_id: 7,
        username: 'bobby',
        email: 'bobby@example.com',
        role_id: 1,
    };
    dashboardAPI.getNotificationPreferences.mockResolvedValue({ success: true, data: {} });
});

describe('Settings — Security tab password change', () => {
    it('sends the current and new password, then ends the session', async () => {
        userAPI.updateProfile.mockResolvedValue({ user_id: 7 });
        renderPage();
        await openSecurityTab();

        await fill({ current: 'oldpassword', next: 'newpassword123', confirm: 'newpassword123' });
        await submit();

        await waitFor(() => {
            expect(userAPI.updateProfile).toHaveBeenCalledWith({
                current_password: 'oldpassword',
                password: 'newpassword123',
            });
        });

        // The server revoked every session, so the client must not pretend to
        // still be signed in.
        expect(authStore.user).toBeNull();
        expect(mockPush).toHaveBeenCalledWith({
            name: 'login',
            query: { passwordChanged: '1' },
        });
    });

    it('clears the form after a successful change', async () => {
        userAPI.updateProfile.mockResolvedValue({ user_id: 7 });
        renderPage();
        await openSecurityTab();

        await fill({ current: 'oldpassword', next: 'newpassword123', confirm: 'newpassword123' });
        await submit();

        await waitFor(() => expect(mockPush).toHaveBeenCalled());
        expect(screen.getByLabelText('Current password').value).toBe('');
        expect(screen.getByLabelText('New password').value).toBe('');
        expect(screen.getByLabelText('Confirm new password').value).toBe('');
    });

    it('requires the current password before calling the API', async () => {
        renderPage();
        await openSecurityTab();

        await fill({ next: 'newpassword123', confirm: 'newpassword123' });
        await submit();

        expect(userAPI.updateProfile).not.toHaveBeenCalled();
        expect(screen.getByText('Enter your current password')).toBeTruthy();
    });

    it('rejects a new password below the server minimum', async () => {
        renderPage();
        await openSecurityTab();

        await fill({ current: 'oldpassword', next: 'short', confirm: 'short' });
        await submit();

        expect(userAPI.updateProfile).not.toHaveBeenCalled();
        expect(screen.getByText(/between 8 and 30 characters/)).toBeTruthy();
    });

    it('rejects mismatched confirmation', async () => {
        renderPage();
        await openSecurityTab();

        await fill({ current: 'oldpassword', next: 'newpassword123', confirm: 'newpassword124' });
        await submit();

        expect(userAPI.updateProfile).not.toHaveBeenCalled();
        expect(screen.getByText('New passwords do not match')).toBeTruthy();
    });

    it('rejects reusing the current password as the new one', async () => {
        renderPage();
        await openSecurityTab();

        await fill({ current: 'samepassword1', next: 'samepassword1', confirm: 'samepassword1' });
        await submit();

        expect(userAPI.updateProfile).not.toHaveBeenCalled();
        expect(screen.getByText(/must be different/)).toBeTruthy();
    });

    it('shows a wrong current password without signing the user out', async () => {
        userAPI.updateProfile.mockRejectedValue({
            response: { data: { message: 'Current password is incorrect' } },
        });

        renderPage();
        await openSecurityTab();

        await fill({ current: 'wrongpassword', next: 'newpassword123', confirm: 'newpassword123' });
        await submit();

        await waitFor(() => {
            expect(screen.getByText('Current password is incorrect')).toBeTruthy();
        });

        // A 400 must not be mistaken for an expired session
        expect(authStore.user).not.toBeNull();
        expect(mockPush).not.toHaveBeenCalled();
    });
});
