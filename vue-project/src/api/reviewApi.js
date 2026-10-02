import api from './api';

export const reviewAPI = {
    // ── Public ────────────────────────────────────────────────────────────────

    /** Get all approved reviews for a product (with rating summary) */
    async getProductReviews(productId, { rating = null, sort = null } = {}) {
        const params = {};
        if (rating) params.rating = rating;
        if (sort) params.sort = sort;
        const { data } = await api.get(`/reviews/product/${productId}`, { params });
        return data;
    },

    /** Get review ids the current user has marked helpful for a product */
    async getMyHelpful(productId) {
        const { data } = await api.get('/reviews/helpful-mine', { params: { productId } });
        return data;
    },

    /** Mark a review as helpful */
    async markHelpful(reviewId) {
        const { data } = await api.post(`/reviews/${reviewId}/helpful`);
        return data;
    },

    /** Remove a helpful vote from a review */
    async unmarkHelpful(reviewId) {
        const { data } = await api.delete(`/reviews/${reviewId}/helpful`);
        return data;
    },

    // ── Authenticated User ────────────────────────────────────────────────────

    /** Submit a review for a product */
    async submitReview(productId, { rating, title, comment }) {
        const { data } = await api.post(`/reviews/product/${productId}`, {
            rating,
            title,
            comment,
        });
        return data;
    },

    /** Get current user's reviews */
    async getMyReviews() {
        const { data } = await api.get('/reviews/mine');
        return data;
    },

    /** Update own review */
    async updateReview(reviewId, { rating, title, comment }) {
        const { data } = await api.put(`/reviews/${reviewId}`, {
            rating,
            title,
            comment,
        });
        return data;
    },

    /** Delete own review */
    async deleteReview(reviewId) {
        const { data } = await api.delete(`/reviews/${reviewId}`);
        return data;
    },

    // ── Admin ─────────────────────────────────────────────────────────────────

    /** Get all reviews (with optional status filter) */
    async getAllReviews(page = 1, pageSize = 20, status = null) {
        let url = `/reviews/all?page=${page}&pageSize=${pageSize}`;
        if (status) url += `&status=${status}`;
        const { data } = await api.get(url);
        return data;
    },

    /** Get pending reviews for moderation */
    async getPendingReviews(page = 1, pageSize = 20) {
        const { data } = await api.get(`/reviews/pending?page=${page}&pageSize=${pageSize}`);
        return data;
    },

    /** Approve or reject a review */
    async moderateReview(reviewId, { status, moderation_note }) {
        const { data } = await api.put(`/reviews/${reviewId}/moderate`, {
            status,
            moderation_note,
        });
        return data;
    },

    /** Approve or reject several reviews at once */
    async bulkModerate(reviewIds, { status, moderation_note }) {
        const { data } = await api.put('/reviews/bulk-moderate', {
            review_ids: reviewIds,
            status,
            moderation_note,
        });
        return data;
    },

    /** Download reviews as a CSV blob (optional status filter) */
    async exportReviewsCsv(status = null) {
        const params = {};
        if (status && status !== 'all') params.status = status;
        const { data } = await api.get('/reviews/export', { params, responseType: 'blob' });
        return data;
    },
};
