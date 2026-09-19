import api from './api';

export const heroAPI = {
    // ── Public: active slides + section settings, used by the storefront hero ──
    async getHero() {
        const { data } = await api.get('/hero');
        return data;
    },

    // ── Admin: every slide, including hidden ones ──
    async getAdminHero() {
        const { data } = await api.get('/hero/admin');
        return data;
    },

    async createSlide(slide) {
        const { data } = await api.post('/hero/slides', slide);
        return data;
    },

    async updateSlide(slideId, slide) {
        const { data } = await api.put(`/hero/slides/${slideId}`, slide);
        return data;
    },

    async setSlideActive(slideId, isActive) {
        const { data } = await api.patch(`/hero/slides/${slideId}/active`, { isActive });
        return data;
    },

    async deleteSlide(slideId) {
        const { data } = await api.delete(`/hero/slides/${slideId}`);
        return data;
    },

    async reorderSlides(orderedIds) {
        const { data } = await api.put('/hero/slides/order', { orderedIds });
        return data;
    },

    async updateSectionSettings(settings) {
        const { data } = await api.put('/hero/settings', settings);
        return data;
    },

    /**
     * Upload a hero image to object storage (R2) and return
     * { filename, url }. Same endpoint the product form uses.
     */
    async uploadImage(file) {
        const formData = new FormData();
        formData.append('images', file);
        const { data } = await api.post('/images/upload-multiple', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return data;
    },
};
