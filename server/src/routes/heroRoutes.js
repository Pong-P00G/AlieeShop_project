import express from 'express';
import * as heroController from '../controller/heroController.js';
import protect, { isAdmin } from '../middleware/authMiddleWare.js';
import {
    validateHeroSlide,
    validateSlideId,
    validateSlideActive,
    validateSlideOrder,
    validateHeroSectionSettings,
} from '../middleware/heroValidation.js';

const router = express.Router();

// ── Public: storefront hero ────────────────────────────────────────────────────
router.get('/', heroController.getHero);

// ── Admin: full slide list (includes hidden slides) ────────────────────────────
router.get('/admin', protect, isAdmin, heroController.getAdminHero);

// ── Admin: section-level settings ──────────────────────────────────────────────
// Declared before the /slides/:id routes so it can never be captured by them.
router.put('/settings', protect, isAdmin, validateHeroSectionSettings, heroController.updateSectionSettings);

// ── Admin: slide order ─────────────────────────────────────────────────────────
router.put('/slides/order', protect, isAdmin, validateSlideOrder, heroController.reorderSlides);

// ── Admin: slide CRUD ──────────────────────────────────────────────────────────
router.post('/slides', protect, isAdmin, validateHeroSlide, heroController.createSlide);
router.put('/slides/:id', protect, isAdmin, validateSlideId, validateHeroSlide, heroController.updateSlide);
router.patch('/slides/:id/active', protect, isAdmin, validateSlideId, validateSlideActive, heroController.setSlideActive);
router.delete('/slides/:id', protect, isAdmin, validateSlideId, heroController.deleteSlide);

export default router;
