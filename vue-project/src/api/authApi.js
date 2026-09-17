import api from './api.js';

export const authAPI = {
  // Register — token is set as httpOnly cookie by the server
  async register(userData) {
    try {
      const { data } = await api.post('/auth/register', userData);
      return data;
    } catch (err) {
      console.error('Register API error:', err);
      throw err;
    }
  },

  // Login — token is set as httpOnly cookie by the server
  async login(identifier, password, rememberMe = false) {
    try {
      const { data } = await api.post('/auth/login', {
        identifier,
        password,
        rememberMe
      });
      return data;
    } catch (err) {
      console.error('Login API error full response:', err.response);
      console.error('Login API error message:', err.response?.data?.message || err.message);
      throw err;
    }
  },

  // Logout — tells the server to clear the httpOnly cookie
  async logout() {
    try {
      const { data } = await api.post('/auth/logout');
      return data;
    } catch (err) {
      console.error('Logout API error:', err);
      throw err;
    }
  },

  // Logout everywhere — revokes every refresh token for this user server-side
  async logoutAll() {
    try {
      const { data } = await api.post('/auth/logout-all');
      return data;
    } catch (err) {
      console.error('Logout all API error:', err);
      throw err;
    }
  },

  // Get current user from server (via httpOnly cookie)
  async getMe() {
    try {
      const { data } = await api.get('/auth/me');
      return data;
    } catch (err) {
      // 401 means cookie is expired or missing — expected on first load if not logged in
      return null;
    }
  },

  // Check if username is available
  async checkUsername(username) {
    try {
      const { data } = await api.get(`/auth/check-username/${username}`);
      return data;
    } catch (err) {
      console.error('Check username API error:', err);
      throw err;
    }
  },

  // Check if email is available
  async checkEmail(email) {
    try {
      const { data } = await api.get(`/auth/check-email/${email}`);
      return data;
    } catch (err) {
      console.error('Check email API error:', err);
      throw err;
    }
  },

  // Fetch current user's permissions from the server
  async getUserPermissions() {
    try {
      const { data } = await api.get('/auth/permissions');
      return data.data ?? [];
    } catch (err) {
      console.error('Failed to fetch permissions:', err);
      return [];
    }
  },

  // Store permissions in sessionStorage (not sensitive, not a token)
  storePermissions(permissions) {
    try {
      sessionStorage.setItem('auth_permissions', JSON.stringify(permissions));
    } catch { /* ignore */ }
  },

  getStoredPermissions() {
    try {
      const perms = sessionStorage.getItem('auth_permissions');
      return perms ? JSON.parse(perms) : [];
    } catch { return []; }
  },

  clearPermissions() {
    try {
      sessionStorage.removeItem('auth_permissions');
    } catch { /* ignore */ }
  }
};
