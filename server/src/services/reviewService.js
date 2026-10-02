import * as ReviewModel from '../model/reviewModel.js';
import * as NotificationModel from '../model/notificationModel.js';
import { notifyReviewModerated } from './dashboardService.js';
import { toCsv } from '../utils/csv.js';

export const createReview = async ({ product_id, user_id, rating, title, comment }) => {
    if (!product_id || !user_id) {
        throw new Error('Product ID and User ID are required');
    }

    if (!rating || rating < 1 || rating > 5) {
        throw new Error('Rating must be between 1 and 5');
    }

    const hasReviewed = await ReviewModel.userHasReviewed(product_id, user_id);
    if (hasReviewed) {
        throw new Error('You have already reviewed this product');
    }

    const reviewId = await ReviewModel.createReview({
        product_id,
        user_id,
        rating,
        title: title || null,
        comment: comment || null,
    });

    return await getReviewById(reviewId);
};

export const getReviewById = async (reviewId) => {
    const review = await ReviewModel.getReviewById(reviewId);
    if (!review) {
        throw new Error('Review not found');
    }
    return review;
};

export const getProductReviews = async (productId, options = {}) => {
    // Only pass the options argument through when the caller actually asked for
    // a filter/sort, so the simple call shape stays `(productId, 'approved')`.
    const hasOptions = Boolean(options.rating) || (options.sort && options.sort !== 'newest');
    const reviewsPromise = hasOptions
        ? ReviewModel.getReviewsByProduct(productId, 'approved', options)
        : ReviewModel.getReviewsByProduct(productId, 'approved');

    const [reviews, summary] = await Promise.all([
        reviewsPromise,
        ReviewModel.getProductRatingSummary(productId),
    ]);
    return { reviews, summary };
};

export const getUserHelpfulReviewIds = async (userId, productId) => {
    if (!userId || !productId) {
        throw new Error('User ID and Product ID are required');
    }
    return await ReviewModel.getUserHelpfulReviewIds(userId, productId);
};

export const markHelpful = async (reviewId, userId) => {
    const review = await ReviewModel.getReviewById(reviewId);
    if (!review || review.status !== 'approved') {
        throw new Error('Review not found');
    }
    if (review.user_id === userId) {
        throw new Error('You cannot mark your own review as helpful');
    }

    const created = await ReviewModel.markHelpful(reviewId, userId);
    return { voted: true, created };
};

export const unmarkHelpful = async (reviewId, userId) => {
    const review = await ReviewModel.getReviewById(reviewId);
    if (!review) {
        throw new Error('Review not found');
    }
    await ReviewModel.unmarkHelpful(reviewId, userId);
    return { voted: false };
};

export const getUserReviews = async (userId) => {
    return await ReviewModel.getReviewsByUser(userId);
};

export const getPendingReviews = async (page = 1, pageSize = 20) => {
    return await ReviewModel.getPendingReviews(page, pageSize);
};

export const getAllReviews = async (page = 1, pageSize = 20, statusFilter = null) => {
    return await ReviewModel.getAllReviews(page, pageSize, statusFilter);
};

export const moderateReview = async (reviewId, status, moderationNote = null, performedBy = null) => {
    if (!['approved', 'rejected'].includes(status)) {
        throw new Error('Status must be "approved" or "rejected"');
    }

    const review = await ReviewModel.getReviewById(reviewId);
    if (!review) {
        throw new Error('Review not found');
    }

    await ReviewModel.moderateReview(reviewId, status, moderationNote);
    const updated = await getReviewById(reviewId);

    // Audit + author notification only when we know who performed the action
    // (i.e. an admin context). Both are best-effort and never fail the request.
    if (performedBy) {
        await recordModeration([updated], status, moderationNote, performedBy);
    }

    return updated;
};

/**
 * Bulk approve/reject several reviews in one statement. Returns the number of
 * rows changed plus the ids that were actually found.
 */
export const bulkModerate = async (reviewIds = [], status, moderationNote = null, performedBy = null) => {
    if (!['approved', 'rejected'].includes(status)) {
        throw new Error('Status must be "approved" or "rejected"');
    }

    const ids = [...new Set(reviewIds.map((id) => parseInt(id, 10)))].filter(Number.isInteger);
    if (ids.length === 0) {
        throw new Error('At least one review id is required');
    }

    // Read the rows first so we can notify each author after the update.
    const reviews = await ReviewModel.getReviewsByIds(ids);
    if (reviews.length === 0) {
        throw new Error('No matching reviews found');
    }

    const updatedCount = await ReviewModel.bulkModerate(ids, status, moderationNote);

    if (performedBy) {
        await recordModeration(reviews, status, moderationNote, performedBy).catch(() => {});
    }

    return { updated: updatedCount, review_ids: reviews.map((r) => r.review_id) };
};

/**
 * Write one audit row per review and notify each author. Kept separate so the
 * single and bulk paths share the same side effects. Never throws.
 */
const recordModeration = async (reviews, status, moderationNote, performedBy) => {
    for (const review of reviews) {
        try {
            await NotificationModel.createAuditLog({
                action: 'moderate',
                entity_type: 'review',
                entity_id: review.review_id,
                entity_name: review.product_name || `Review #${review.review_id}`,
                performed_by: performedBy,
                details: `Review ${review.review_id} ${status}${moderationNote ? `: ${moderationNote}` : ''}`,
            });
        } catch (err) {
            console.warn('Failed to audit review moderation:', err.message);
        }

        try {
            await notifyReviewModerated({
                userId: review.user_id,
                productName: review.product_name || `product #${review.product_id}`,
                status,
                moderationNote,
            });
        } catch (err) {
            console.warn('Failed to notify review author:', err.message);
        }
    }
};

// ── EXPORT ──────────────────────────────────────────────────────────────────

export const exportReviewsCsv = async (statusFilter = null) => {
    const rows = await ReviewModel.getReviewsForExport(statusFilter);

    return toCsv(rows, [
        { label: 'Review ID', value: 'review_id' },
        { label: 'Product', value: 'product_name' },
        { label: 'Customer', value: 'username' },
        { label: 'Rating', value: 'rating' },
        { label: 'Title', value: 'title' },
        { label: 'Comment', value: 'comment' },
        { label: 'Status', value: 'status' },
        { label: 'Verified Purchase', value: (r) => (r.verified_purchase ? 'yes' : 'no') },
        { label: 'Helpful Votes', value: 'helpful_count' },
        { label: 'Moderation Note', value: 'moderation_note' },
        { label: 'Created At', value: (r) => (r.created_at ? new Date(r.created_at).toISOString() : '') },
    ]);
};

export const updateReview = async (reviewId, userId, data) => {
    const review = await ReviewModel.getReviewById(reviewId);
    if (!review) {
        throw new Error('Review not found');
    }

    if (review.user_id !== userId) {
        throw new Error('Not authorized to update this review');
    }

    if (data.rating && (data.rating < 1 || data.rating > 5)) {
        throw new Error('Rating must be between 1 and 5');
    }

    // Reset to pending on edit
    await ReviewModel.updateReview(reviewId, {
        rating: data.rating || review.rating,
        title: data.title !== undefined ? data.title : review.title,
        comment: data.comment !== undefined ? data.comment : review.comment,
    });

    await ReviewModel.moderateReview(reviewId, 'pending', null);

    return await getReviewById(reviewId);
};

export const deleteReview = async (reviewId, userId, isAdmin = false) => {
    const review = await ReviewModel.getReviewById(reviewId);
    if (!review) {
        throw new Error('Review not found');
    }

    if (!isAdmin && review.user_id !== userId) {
        throw new Error('Not authorized to delete this review');
    }

    return await ReviewModel.deleteReview(reviewId);
};

