import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '../../src/stores/auth.js';

// ── Mock authAPI ──────────────────────────────────────────────────────────────
vi.mock('../../src/api/authApi.js', () => {
    const mockAuthAPI = {
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        logoutAll: vi.fn(),
        getMe: vi.fn(),
        getUserPermissions: vi.fn(),
        storePermissions: vi.fn(),
        clearPermissions: vi.fn(),
    };
    return { authAPI: mockAuthAPI };
});

// ── Mock shop store (used by init/login for wishlist sync) ──────────────────
vi.mock('../../src/stores/shop.js', () => {
    const mockMergeAndSync = vi.fn().mockResolvedValue(undefined);
    const mockShop = {
        mergeAndSyncWishlistOnLogin: mockMergeAndSync,
        cart: [],
        wishlist: [],
    };
    return {
        useShopStore: () => mockShop,
    };
});

let authAPI;
const mockUser = {
    user_id: 1,
    username: 'testuser',
    email: 'test@example.com',
    role_id: 1,
    first_name: 'Test',
    last_name: 'User',
};

const mockPermissions = ['products.view', 'products.edit', 'orders.view'];

beforeEach(async () => {
    setActivePinia(createPinia());
    authAPI = (await import('../../src/api/authApi.js')).authAPI;
    // Clear sessionStorage between tests
    sessionStorage.clear();
});

// ════════════════════════════════════════════════════════════════════════════════
//  INIT — session restoration on page load
// ════════════════════════════════════════════════════════════════════════════════

describe('authStore — init() session restoration', () => {
    it('sets user, permissions, and initialized=true when getMe returns valid session', async () => {
        authAPI.getMe.mockResolvedValue({ success: true, user: mockUser });
        authAPI.getUserPermissions.mockResolvedValue(mockPermissions);

        const store = useAuthStore();
        await store.init();

        expect(store.user).toEqual(mockUser);
        expect(store.permissions).toEqual(mockPermissions);
        expect(store.initialized).toBe(true);
        // Permissions should have been stored
        expect(authAPI.storePermissions).toHaveBeenCalledWith(mockPermissions);
    });

    it('keeps user=null when getMe returns null (no session)', async () => {
        authAPI.getMe.mockResolvedValue(null);

        const store = useAuthStore();
        await store.init();

        expect(store.user).toBeNull();
        expect(store.permissions).toEqual([]);
        expect(store.initialized).toBe(true);
        // Should not fetch permissions or store them
        expect(authAPI.getUserPermissions).not.toHaveBeenCalled();
        expect(authAPI.storePermissions).not.toHaveBeenCalled();
    });

    it('keeps user=null when getMe returns no user field', async () => {
        authAPI.getMe.mockResolvedValue({ success: true }); // no user field

        const store = useAuthStore();
        await store.init();

        expect(store.user).toBeNull();
        expect(store.initialized).toBe(true);
    });

    it('keeps user=null when getMe has success=false', async () => {
        authAPI.getMe.mockResolvedValue({ success: false });

        const store = useAuthStore();
        await store.init();

        expect(store.user).toBeNull();
        expect(store.initialized).toBe(true);
    });

    it('sets initialized=true even when getMe throws', async () => {
        authAPI.getMe.mockRejectedValue(new Error('Network error'));

        const store = useAuthStore();
        await store.init();

        // initialized must be true regardless of errors (finally block)
        expect(store.initialized).toBe(true);
        expect(store.user).toBeNull();
    });

    it('sets initialized=true even when permissions fetch fails', async () => {
        authAPI.getMe.mockResolvedValue({ success: true, user: mockUser });
        authAPI.getUserPermissions.mockRejectedValue(new Error('Permissions error'));

        const store = useAuthStore();
        await store.init();

        expect(store.initialized).toBe(true);
        // getUserPermissions catches its own errors and returns [], so the store
        // should still have the user but empty permissions
        expect(store.user).toEqual(mockUser);
    });
});

// ════════════════════════════════════════════════════════════════════════════════
//  LOGIN
// ════════════════════════════════════════════════════════════════════════════════

describe('authStore — login()', () => {
    const credentials = {
        identifier: 'testuser',
        password: 'password123',
        rememberMe: true,
    };

    it('sets user and permissions on successful login', async () => {
        authAPI.login.mockResolvedValue({ user: mockUser, message: 'Login successful' });
        authAPI.getUserPermissions.mockResolvedValue(mockPermissions);

        const store = useAuthStore();
        const result = await store.login(credentials);

        expect(result.success).toBe(true);
        expect(result.user).toEqual(mockUser);
        expect(store.user).toEqual(mockUser);
        expect(store.permissions).toEqual(mockPermissions);
        expect(store.loading).toBe(false);
        expect(store.error).toBeNull();
        expect(authAPI.login).toHaveBeenCalledWith('testuser', 'password123', true);
        expect(authAPI.storePermissions).toHaveBeenCalledWith(mockPermissions);
    });

    it('passes rememberMe=false when not provided', async () => {
        authAPI.login.mockResolvedValue({ user: mockUser });
        authAPI.getUserPermissions.mockResolvedValue([]);

        const store = useAuthStore();
        await store.login({ identifier: 'testuser', password: 'pass' });

        expect(authAPI.login).toHaveBeenCalledWith('testuser', 'pass', false);
    });

    it('sets error on API failure and returns success=false', async () => {
        const apiError = { response: { data: { message: 'Invalid credentials' } } };
        authAPI.login.mockRejectedValue(apiError);

        const store = useAuthStore();
        const result = await store.login(credentials);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid credentials');
        expect(store.error).toBe('Invalid credentials');
        expect(store.loading).toBe(false);
        expect(store.user).toBeNull();
    });

    it('falls back to error.message when no response data', async () => {
        authAPI.login.mockRejectedValue(new Error('Network error'));

        const store = useAuthStore();
        const result = await store.login(credentials);

        expect(result.error).toBe('Network error');
        expect(store.error).toBe('Network error');
    });

    it('falls back to generic message when no message provided', async () => {
        authAPI.login.mockRejectedValue({});

        const store = useAuthStore();
        const result = await store.login(credentials);

        expect(result.error).toBe('Login failed');
    });

    it('sets loading=true during login and false after', async () => {
        authAPI.login.mockResolvedValue({ user: mockUser });
        authAPI.getUserPermissions.mockResolvedValue([]);

        const store = useAuthStore();
        const loginPromise = store.login(credentials);

        expect(store.loading).toBe(true);
        await loginPromise;
        expect(store.loading).toBe(false);
    });

    it('clears previous error before new login attempt', async () => {
        authAPI.login
            .mockRejectedValueOnce({ response: { data: { message: 'First error' } } })
            .mockResolvedValueOnce({ user: mockUser });
        authAPI.getUserPermissions.mockResolvedValue([]);

        const store = useAuthStore();
        await store.login(credentials);
        expect(store.error).toBe('First error');

        await store.login(credentials);
        expect(store.error).toBeNull();
        expect(store.user).toEqual(mockUser);
    });
});

// ════════════════════════════════════════════════════════════════════════════════
//  REGISTER
// ════════════════════════════════════════════════════════════════════════════════

describe('authStore — register()', () => {
    const userData = {
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123',
    };

    it('sets user and permissions on successful registration', async () => {
        authAPI.register.mockResolvedValue({ user: mockUser, message: 'Registration successful' });
        authAPI.getUserPermissions.mockResolvedValue(mockPermissions);

        const store = useAuthStore();
        const result = await store.register(userData);

        expect(result.success).toBe(true);
        expect(result.user).toEqual(mockUser);
        expect(store.user).toEqual(mockUser);
        expect(store.permissions).toEqual(mockPermissions);
        expect(store.loading).toBe(false);
        expect(store.error).toBeNull();
        expect(authAPI.register).toHaveBeenCalledWith(userData);
    });

    it('sets error on API failure', async () => {
        authAPI.register.mockRejectedValue({ response: { data: { message: 'Email already registered' } } });

        const store = useAuthStore();
        const result = await store.register(userData);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Email already registered');
        expect(store.loading).toBe(false);
        expect(store.user).toBeNull();
    });

    it('clears previous error before new register attempt', async () => {
        authAPI.register
            .mockRejectedValueOnce({ response: { data: { message: 'Username taken' } } })
            .mockResolvedValueOnce({ user: mockUser });
        authAPI.getUserPermissions.mockResolvedValue([]);

        const store = useAuthStore();
        await store.register(userData);
        expect(store.error).toBe('Username taken');

        await store.register(userData);
        expect(store.error).toBeNull();
        expect(store.user).toEqual(mockUser);
    });

    it('sets loading state correctly', async () => {
        authAPI.register.mockResolvedValue({ user: mockUser });
        authAPI.getUserPermissions.mockResolvedValue([]);

        const store = useAuthStore();
        const registerPromise = store.register(userData);

        expect(store.loading).toBe(true);
        await registerPromise;
        expect(store.loading).toBe(false);
    });
});

// ════════════════════════════════════════════════════════════════════════════════
//  LOGOUT
// ════════════════════════════════════════════════════════════════════════════════

describe('authStore — logout()', () => {
    it('clears user, permissions, and error on logout', async () => {
        authAPI.logout.mockResolvedValue({ success: true });

        const store = useAuthStore();
        // Set some state first
        store.user = mockUser;
        store.permissions = mockPermissions;
        store.error = 'Some error';

        await store.logout();

        expect(store.user).toBeNull();
        expect(store.permissions).toEqual([]);
        expect(store.error).toBeNull();
        expect(authAPI.logout).toHaveBeenCalled();
        expect(authAPI.clearPermissions).toHaveBeenCalled();
    });

    it('still clears local state even when server logout fails', async () => {
        authAPI.logout.mockRejectedValue(new Error('Server error'));

        const store = useAuthStore();
        store.user = mockUser;
        store.permissions = mockPermissions;

        // Should not throw — the store catches the error
        await store.logout();

        expect(store.user).toBeNull();
        expect(store.permissions).toEqual([]);
        expect(authAPI.clearPermissions).toHaveBeenCalled();
    });

    it('clears error state on logout', async () => {
        authAPI.logout.mockResolvedValue({ success: true });

        const store = useAuthStore();
        store.error = 'Previous error';

        await store.logout();
        expect(store.error).toBeNull();
    });
});

// ════════════════════════════════════════════════════════════════════════════════
//  LOGOUT EVERYWHERE
// ════════════════════════════════════════════════════════════════════════════════

describe('authStore — logoutAll()', () => {
    it('asks the server to revoke every session and clears local state', async () => {
        authAPI.logoutAll.mockResolvedValue({ success: true });

        const store = useAuthStore();
        store.user = mockUser;
        store.permissions = mockPermissions;
        store.error = 'Some error';

        await store.logoutAll();

        expect(authAPI.logoutAll).toHaveBeenCalled();
        expect(authAPI.logout).not.toHaveBeenCalled();
        expect(authAPI.clearPermissions).toHaveBeenCalled();
        expect(store.user).toBeNull();
        expect(store.permissions).toEqual([]);
        expect(store.error).toBeNull();
    });

    it('still clears local state when the server call fails', async () => {
        authAPI.logoutAll.mockRejectedValue(new Error('Server error'));

        const store = useAuthStore();
        store.user = mockUser;
        store.permissions = mockPermissions;

        // Should not throw — the store catches the error
        await store.logoutAll();

        expect(store.user).toBeNull();
        expect(store.permissions).toEqual([]);
        expect(authAPI.clearPermissions).toHaveBeenCalled();
    });
});

// ════════════════════════════════════════════════════════════════════════════════
//  GETTERS
// ════════════════════════════════════════════════════════════════════════════════

describe('authStore — getters', () => {
    it('isAuthenticated returns false when no user', () => {
        const store = useAuthStore();
        expect(store.isAuthenticated).toBe(false);
    });

    it('isAuthenticated returns true when user is set', () => {
        const store = useAuthStore();
        store.user = mockUser;
        expect(store.isAuthenticated).toBe(true);
    });

    it('currentUser returns the user object', () => {
        const store = useAuthStore();
        expect(store.currentUser).toBeNull();

        store.user = mockUser;
        expect(store.currentUser).toEqual(mockUser);
    });

    it('hasError returns true when error is set', () => {
        const store = useAuthStore();
        expect(store.hasError).toBe(false);

        store.error = 'Some error';
        expect(store.hasError).toBe(true);
    });

    it('hasError returns false when error is empty string', () => {
        const store = useAuthStore();
        store.error = '';
        expect(store.hasError).toBe(false);
    });

    it('isSuperadmin returns true for role_id=1', () => {
        const store = useAuthStore();
        store.user = { ...mockUser, role_id: 1 };
        expect(store.isSuperadmin).toBe(true);
    });

    it('isSuperadmin returns false for non-superadmin roles', () => {
        const store = useAuthStore();
        store.user = { ...mockUser, role_id: 2 };
        expect(store.isSuperadmin).toBe(false);

        store.user = { ...mockUser, role_id: 3 };
        expect(store.isSuperadmin).toBe(false);
    });

    it('isAdmin returns true for role_id=1 or 2', () => {
        const store = useAuthStore();
        store.user = { ...mockUser, role_id: 1 };
        expect(store.isAdmin).toBe(true);

        store.user = { ...mockUser, role_id: 2 };
        expect(store.isAdmin).toBe(true);
    });

    it('isAdmin returns false for role_id=3', () => {
        const store = useAuthStore();
        store.user = { ...mockUser, role_id: 3 };
        expect(store.isAdmin).toBe(false);
    });

    it('isAdmin returns false when user is null', () => {
        const store = useAuthStore();
        store.user = null;
        expect(store.isAdmin).toBe(false);
    });

    it('can() checks single permission', () => {
        const store = useAuthStore();
        store.permissions = ['products.view', 'products.edit'];

        expect(store.can('products.view')).toBe(true);
        expect(store.can('products.edit')).toBe(true);
        expect(store.can('products.delete')).toBe(false);
        expect(store.can('orders.view')).toBe(false);
    });

    it('canAny() returns true if user has any of the permissions', () => {
        const store = useAuthStore();
        store.permissions = ['products.view'];

        expect(store.canAny(['products.view', 'products.delete'])).toBe(true);
        expect(store.canAny(['orders.view', 'products.view'])).toBe(true);
        expect(store.canAny(['orders.view', 'users.manage'])).toBe(false);
    });

    it('canAny() returns false for empty array', () => {
        const store = useAuthStore();
        store.permissions = ['products.view'];

        expect(store.canAny([])).toBe(false);
    });

    it('canAll() returns true only if user has all permissions', () => {
        const store = useAuthStore();
        store.permissions = ['products.view', 'products.edit', 'orders.view'];

        expect(store.canAll(['products.view', 'orders.view'])).toBe(true);
        expect(store.canAll(['products.view', 'products.edit', 'orders.view'])).toBe(true);
        expect(store.canAll(['products.view', 'products.delete'])).toBe(false);
    });

    it('canAll() returns false for empty array', () => {
        const store = useAuthStore();
        store.permissions = ['products.view'];

        expect(store.canAll([])).toBe(false);
    });
});

// ════════════════════════════════════════════════════════════════════════════════
//  STATE MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════════

describe('authStore — state management', () => {
    it('initialized starts as false', () => {
        const store = useAuthStore();
        expect(store.initialized).toBe(false);
    });

    it('clearError clears the error message', () => {
        const store = useAuthStore();
        store.error = 'Some error';

        store.clearError();
        expect(store.error).toBeNull();
    });

    it('clearError does nothing when error is already null', () => {
        const store = useAuthStore();
        store.clearError();
        expect(store.error).toBeNull();
    });

    it('hasPermission checks if a key is in permissions', () => {
        const store = useAuthStore();
        store.permissions = ['products.view', 'products.edit'];

        expect(store.hasPermission('products.view')).toBe(true);
        expect(store.hasPermission('products.delete')).toBe(false);
    });

    it('hasPermission returns false for empty permissions', () => {
        const store = useAuthStore();
        expect(store.hasPermission('anything')).toBe(false);
    });
});

// ════════════════════════════════════════════════════════════════════════════════
//  INTEGRATION: full auth lifecycle
// ════════════════════════════════════════════════════════════════════════════════

describe('authStore — full lifecycle', () => {
    it('login → logout → init restores nothing', async () => {
        // 1. Login
        authAPI.login.mockResolvedValue({ user: mockUser });
        authAPI.getUserPermissions.mockResolvedValue(mockPermissions);

        const store = useAuthStore();
        await store.login({ identifier: 'testuser', password: 'pass', rememberMe: true });

        expect(store.isAuthenticated).toBe(true);
        expect(store.isSuperadmin).toBe(true);

        // 2. Logout
        authAPI.logout.mockResolvedValue({ success: true });
        await store.logout();

        expect(store.isAuthenticated).toBe(false);
        expect(store.user).toBeNull();

        // 3. Re-init (simulating page reload)
        authAPI.getMe.mockResolvedValue(null); // No session cookie after logout
        await store.init();

        expect(store.isAuthenticated).toBe(false);
        expect(store.user).toBeNull();
        expect(store.initialized).toBe(true);
    });

    it('tracks loading through the full login flow', async () => {
        authAPI.login.mockResolvedValue({ user: mockUser });
        authAPI.getUserPermissions.mockResolvedValue(mockPermissions);

        const store = useAuthStore();
        expect(store.loading).toBe(false);

        const loginPromise = store.login({ identifier: 'u', password: 'p' });
        expect(store.loading).toBe(true);

        await loginPromise;
        expect(store.loading).toBe(false);
        expect(store.isAuthenticated).toBe(true);
    });
});
