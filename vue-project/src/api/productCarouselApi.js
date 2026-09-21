import api from './api';

export const productCarouselAPI = {
    // ── Public: section settings + visible tabs, used by the home page carousel ──
    async getConfig() {
        const { data } = await api.get('/product-carousel');
        return data;
    },

    // ── Admin: every tab, including hidden ones, plus editable limits ──
    async getAdminConfig() {
        const { data } = await api.get('/product-carousel/admin');
        return data;
    },

    async updateSettings(settings) {
        const { data } = await api.put('/product-carousel/settings', settings);
        return data;
    },
};
