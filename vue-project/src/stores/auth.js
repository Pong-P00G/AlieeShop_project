import { defineStore } from 'pinia';
import { authAPI } from '../api/authApi.js';
import { useShopStore } from './shop.js';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    permissions: [],
    error: null,
    loading: false,
    initialized: false
  }),

  getters: {
    isAuthenticated: (state) => !!state.user,
    currentUser: (state) => state.user,
    hasError: (state) => !!state.error,

    // Check if user has a specific permission key
    can: (state) => {
      return (permissionKey) => {
        return state.permissions.includes(permissionKey);
      };
    },

    // Check if user can access any of the given permissions
    canAny: (state) => {
      return (permissionKeys) => {
        if (!permissionKeys || permissionKeys.length === 0) return false;
        return permissionKeys.some(k => state.permissions.includes(k));
      };
    },

    // Check if user can access all of the given permissions
    canAll: (state) => {
      return (permissionKeys) => {
        if (!permissionKeys || permissionKeys.length === 0) return false;
        return permissionKeys.every(k => state.permissions.includes(k));
      };
    },

    isSuperadmin: (state) => state.user?.role_id === 1,
    isAdmin: (state) => Number(state.user?.role_id) <= 2,
  },

  actions: {
    async init() {
      try {
        // Verify session via httpOnly cookie — calls /auth/me
        const result = await authAPI.getMe();
        if (result && result.success && result.user) {
          this.user = result.user;

          // Fetch permissions
          const permissions = await authAPI.getUserPermissions();
          this.permissions = permissions;
          authAPI.storePermissions(permissions);

          // Merge wishlist
          const shop = useShopStore();
          await shop.mergeAndSyncWishlistOnLogin();
        }
      } catch {
        // API methods (getMe, getUserPermissions) already handle errors gracefully
        // and return null/[] — but this catch ensures resilience if that ever changes,
        // preventing errors from escaping init() and breaking the initialized flag.
      } finally {
        this.initialized = true;
      }
    },

    async login(credentials) {
      this.loading = true;
      this.error = null;

      try {
        const response = await authAPI.login(
          credentials.identifier,
          credentials.password,
          credentials.rememberMe ?? false
        );

        this.user = response.user;

        // Fetch permissions for the user's role
        const permissions = await authAPI.getUserPermissions();
        this.permissions = permissions;
        authAPI.storePermissions(permissions);

        // Merge wishlist: combine local (anonymous) items with server items
        const shop = useShopStore();
        await shop.mergeAndSyncWishlistOnLogin();

        return { success: true, user: response.user };
      } catch (err) {
        this.error = err.response?.data?.message || err.message || 'Login failed';
        console.error('Store login error:', this.error);
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async register(userData) {
      this.loading = true;
      this.error = null;

      try {
        const response = await authAPI.register(userData);

        this.user = response.user;

        // Customer role (3) - fetch limited permissions
        const permissions = await authAPI.getUserPermissions();
        this.permissions = permissions;
        authAPI.storePermissions(permissions);

        // Merge wishlist: combine local (anonymous) items with server items
        const shop = useShopStore();
        await shop.mergeAndSyncWishlistOnLogin();

        return { success: true, user: response.user };
      } catch (err) {
        this.error = err.response?.data?.message || 'Registration failed';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async logout() {
      try {
        await authAPI.logout();
      } catch (err) {
        console.error('Logout error:', err);
      }
      this.resetLocalSession();
    },

    // Revoke every session for this user (all devices), not just this browser.
    // Worth using after a password change or a suspected compromise.
    async logoutAll() {
      try {
        await authAPI.logoutAll();
      } catch (err) {
        console.error('Logout all error:', err);
      }
      this.resetLocalSession();
    },

    // Clear everything stored client-side. The httpOnly cookies themselves are
    // cleared server-side by the logout endpoints.
    resetLocalSession() {
      authAPI.clearPermissions();
      this.user = null;
      this.permissions = [];
      this.error = null;
    },

    clearError() {
      this.error = null;
    },

    hasPermission(key) {
      return this.permissions.includes(key);
    }
  }
});
