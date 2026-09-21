import * as productCarouselService from '../services/productCarouselService.js';

// GET /api/product-carousel — public storefront payload (section settings + visible tabs)
export const getProductCarousel = async (req, res) => {
    try {
        const data = await productCarouselService.getProductCarousel();
        res.json({ success: true, data });
    } catch (error) {
        res.status(error.status || 500).json({
            success: false,
            message: error.message,
        });
    }
};

// GET /api/product-carousel/admin — every tab, hidden ones included (admin only)
export const getAdminProductCarousel = async (req, res) => {
    try {
        const data = await productCarouselService.getAdminProductCarousel(req.user.role_id);
        res.json({ success: true, data });
    } catch (error) {
        res.status(error.status || 500).json({
            success: false,
            message: error.message,
        });
    }
};

// PUT /api/product-carousel/settings
export const updateSettings = async (req, res) => {
    try {
        const settings = await productCarouselService.updateCarouselSettings(req.body, req.user.role_id);
        res.json({
            success: true,
            message: 'Product carousel settings updated',
            data: settings,
        });
    } catch (error) {
        res.status(error.status || 400).json({
            success: false,
            message: error.message,
        });
    }
};
