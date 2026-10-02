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

    // Upload (or replace) the current user's profile picture.
    // Returns the full response envelope: { success, message, data: user }.
    // A longer timeout than the default since this streams a file body.
    async uploadProfilePicture(file) {
        const formData = new FormData();
        formData.append('image', file);
        const { data } = await api.post('/users/profile/picture', formData, {
            timeout: 30000,
        });
        return data;
    },

    // Remove the current user's profile picture.
    async deleteProfilePicture() {
        const { data } = await api.delete('/users/profile/picture');
        return data;
    },

    // Delete user (Protected - requires auth)
    async deleteUser(id) {
        const { data } = await api.delete(`/users/${id}`);
        return data.data ?? data;
    }
};