import express from 'express';
import * as reviewController from '../controller/reviewController.js';
import protect from '../middleware/authMiddleWare.js';
import { isAdmin } from '../middleware/authMiddleWare.js';

const router = express.Router();

// ═════════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ═════════════════════════════════════════════════════════════════════════════

// @route   GET /api/reviews/product/:id
// @desc    Get all approved reviews for a product (with rating summary)
// @access  Public
router.get('/product/:id', reviewController.getProductReviews);

// ═════════════════════════════════════════════════════════════════════════════
// AUTHENTICATED USER ROUTES
// ═════════════════════════════════════════════════════════════════════════════

// @route   POST /api/reviews/product/:id
// @desc    Submit a review for a product (requires auth)
// @access  Private
router.post('/product/:id', protect, reviewController.submitReview);

// @route   GET /api/reviews/mine
// @desc    Get current user's reviews
// @access  Private
router.get('/mine', protect, reviewController.getUserReviews);

// @route   GET /api/reviews/helpful-mine?productId=
// @desc    Review ids the current user has voted helpful for a product
// @access  Private
router.get('/helpful-mine', protect, reviewController.getMyHelpful);

// @route   DELETE /api/reviews/:reviewId
// @desc    Delete own review (admin can delete any)
// @access  Private
router.delete('/:reviewId', protect, reviewController.deleteReview);

// @route   POST /api/reviews/:reviewId/helpful
// @desc    Mark a review as helpful
// @access  Private
router.post('/:reviewId/helpful', protect, reviewController.markHelpful);

// @route   DELETE /api/reviews/:reviewId/helpful
// @desc    Remove a helpful vote from a review
// @access  Private
router.delete('/:reviewId/helpful', protect, reviewController.unmarkHelpful);

// @route   PUT /api/reviews/bulk-moderate
// @desc    Approve or reject several reviews at once
// @access  Private/Admin
// NOTE: declared before PUT /:reviewId so "bulk-moderate" is not read as an id.
router.put('/bulk-moderate', protect, isAdmin, reviewController.bulkModerateReviews);

// @route   PUT /api/reviews/:reviewId/moderate
// @desc    Approve or reject a review
// @access  Private/Admin
router.put('/:reviewId/moderate', protect, isAdmin, reviewController.moderateReview);

// @route   PUT /api/reviews/:reviewId
// @desc    Update own review (resets to pending)
// @access  Private
router.put('/:reviewId', protect, reviewController.updateReview);

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ═════════════════════════════════════════════════════════════════════════════

// @route   GET /api/reviews/all
// @desc    Get all reviews with optional status filter
// @access  Private/Admin
router.get('/all', protect, isAdmin, reviewController.getAllReviews);

// @route   GET /api/reviews/pending
// @desc    Get pending reviews for moderation
// @access  Private/Admin
router.get('/pending', protect, isAdmin, reviewController.getPendingReviews);

// @route   GET /api/reviews/export
// @desc    Export reviews as CSV (optional ?status= filter)
// @access  Private/Admin
router.get('/export', protect, isAdmin, reviewController.exportReviews);

export default router;
