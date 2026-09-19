import * as heroService from '../services/heroService.js';

// GET /api/hero — public storefront payload (active slides + section settings)
export const getHero = async (req, res) => {
    try {
        const data = await heroService.getHero();
        res.json({ success: true, data });
    } catch (error) {
        res.status(error.status || 500).json({
            success: false,
            message: error.message,
        });
    }
};

// GET /api/hero/admin — every slide, active or not (admin only)
export const getAdminHero = async (req, res) => {
    try {
        const data = await heroService.getAdminHero(req.user.role_id);
        res.json({ success: true, data });
    } catch (error) {
        res.status(error.status || 500).json({
            success: false,
            message: error.message,
        });
    }
};

// POST /api/hero/slides
export const createSlide = async (req, res) => {
    try {
        const slide = await heroService.createSlide(req.body, req.user.role_id);
        res.status(201).json({
            success: true,
            message: 'Slide created',
            data: slide,
        });
    } catch (error) {
        res.status(error.status || 400).json({
            success: false,
            message: error.message,
        });
    }
};

// PUT /api/hero/slides/:id
export const updateSlide = async (req, res) => {
    try {
        const slide = await heroService.updateSlide(req.params.id, req.body, req.user.role_id);
        res.json({
            success: true,
            message: 'Slide updated',
            data: slide,
        });
    } catch (error) {
        res.status(error.status || 400).json({
            success: false,
            message: error.message,
        });
    }
};

// PATCH /api/hero/slides/:id/active
export const setSlideActive = async (req, res) => {
    try {
        const slide = await heroService.setSlideActive(req.params.id, req.body.isActive, req.user.role_id);
        res.json({
            success: true,
            message: slide.isActive ? 'Slide shown' : 'Slide hidden',
            data: slide,
        });
    } catch (error) {
        res.status(error.status || 400).json({
            success: false,
            message: error.message,
        });
    }
};

// DELETE /api/hero/slides/:id
export const deleteSlide = async (req, res) => {
    try {
        await heroService.deleteSlide(req.params.id, req.user.role_id);
        res.json({ success: true, message: 'Slide deleted' });
    } catch (error) {
        res.status(error.status || 400).json({
            success: false,
            message: error.message,
        });
    }
};

// PUT /api/hero/slides/order
export const reorderSlides = async (req, res) => {
    try {
        const data = await heroService.reorderSlides(req.body.orderedIds, req.user.role_id);
        res.json({ success: true, message: 'Slide order updated', data });
    } catch (error) {
        res.status(error.status || 400).json({
            success: false,
            message: error.message,
        });
    }
};

// PUT /api/hero/settings
export const updateSectionSettings = async (req, res) => {
    try {
        const settings = await heroService.updateSectionSettings(req.body, req.user.role_id);
        res.json({
            success: true,
            message: 'Hero settings updated',
            data: settings,
        });
    } catch (error) {
        res.status(error.status || 400).json({
            success: false,
            message: error.message,
        });
    }
};
