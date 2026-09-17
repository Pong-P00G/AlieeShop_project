import api from './api';

export const userAPI = {

    // Get all user (Protected - requires auth)
    async getAllUsers() {
        const { data } = await api.get('/users');
        return data.data ?? data;
    },

    // Get user by ID (Protected - requires auth)
    async getUserById(id) {
        const { data } = await api.get(`/users/${id}`);
        return data.data ?? data;
    },

    // Create user (Protected - requires auth/admin)
    async createUser(userData) {
        const { data } = await api.post('/users', userData);
        return data.data ?? data;
    },

    // Update user (Protected - requires auth)
    async updateUser(id, userData) {
        const { data } = await api.put(`/users/${id}`, userData);
        return data.data ?? data;
    },

    // Update current user profile (Protected - requires auth).
    // Self-service lives on /users/profile — PUT /users has no handler.
    async updateProfile(userData) {
        const { data } = await api.put('/users/profile', userData);
        return data.data ?? data;
    },

    // Delete user (Protected - requires auth)
    async deleteUser(id) {
        const { data } = await api.delete(`/users/${id}`);
        return data.data ?? data;
    }
};