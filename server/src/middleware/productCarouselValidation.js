import Joi from 'joi';
import {
    TAB_KEYS,
    AUTOPLAY_INTERVAL_MIN,
    AUTOPLAY_INTERVAL_MAX,
    MAX_PRODUCTS_PER_TAB,
    MIN_PRODUCTS_PER_TAB,
    MAX_PICKED_PRODUCTS,
} from '../services/productCarouselService.js';

// ==================== PRODUCT CAROUSEL VALIDATION ====================
// Structural validation only — business rules (link safety, allowed tab keys,
// duplicate tabs) live in productCarouselService so they are unit-testable.
// Responds 400 directly, matching validateHeroSectionSettings.

const fail = (res, error) => res.status(400).json({
    success: false,
    errors: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
    })),
});

/**
 * Validate `req.body` by default, or `req.params` for id-shaped routes.
 */
const runValidation = (schema, source = 'body') => (req, res, next) => {
    const { error } = schema.validate(source === 'params' ? req.params : req.body, { abortEarly: false });
    if (error) return fail(res, error);
    next();
};

// ==================== SECTION + TAB SETTINGS ====================

export const validateProductCarouselSettings = runValidation(
    Joi.object({
        product_carousel_section_enabled: Joi.boolean().optional(),
        product_carousel_eyebrow: Joi.string().trim().max(40).allow('').optional(),
        product_carousel_title: Joi.string().trim().max(80).allow('').optional(),
        product_carousel_view_all_label: Joi.string().trim().max(40).allow('').optional(),
        product_carousel_view_all_link: Joi.string().trim().max(500).allow('').optional(),
        product_carousel_autoplay_enabled: Joi.boolean().optional(),
        product_carousel_autoplay_interval: Joi.number()
            .integer()
            .min(AUTOPLAY_INTERVAL_MIN)
            .max(AUTOPLAY_INTERVAL_MAX)
            .optional(),
        product_carousel_tabs: Joi.array()
            .items(
                Joi.object({
                    key: Joi.string().valid(...TAB_KEYS).required(),
                    label: Joi.string().trim().max(40).allow('', null).optional(),
                    title: Joi.string().trim().max(80).allow('', null).optional(),
                    productsPerTab: Joi.number()
                        .integer()
                        .min(MIN_PRODUCTS_PER_TAB)
                        .max(MAX_PRODUCTS_PER_TAB)
                        .optional(),
                    isActive: Joi.boolean().optional(),
                    // Hand-picked products; empty means "use the automatic query".
                    productIds: Joi.array()
                        .items(Joi.number().integer().positive())
                        .max(MAX_PICKED_PRODUCTS)
                        .optional(),
                })
            )
            .min(1)
            .optional(),
    }).min(1)
);
