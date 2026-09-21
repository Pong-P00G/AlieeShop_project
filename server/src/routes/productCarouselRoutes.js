import express from 'express';
import * as productCarouselController from '../controller/productCarouselController.js';
import protect, { isAdmin } from '../middleware/authMiddleWare.js';
import { validateProductCarouselSettings } from '../middleware/productCarouselValidation.js';

const router = express.Router();

// ── Public: storefront product carousel ────────────────────────────────────────
router.get('/', productCarouselController.getProductCarousel);

// ── Admin: full tab list (includes hidden tabs) ────────────────────────────────
router.get('/admin', protect, isAdmin, productCarouselController.getAdminProductCarousel);

// ── Admin: section behaviour + tab list ────────────────────────────────────────
router.put('/settings', protect, isAdmin, validateProductCarouselSettings, productCarouselController.updateSettings);

export default router;
