import Joi from 'joi';

// ==================== HERO VALIDATION ====================
// Structural validation only — business rules (link safety, max slides,
// label/link pairing) live in heroService so they are unit-testable.
// Each middleware answers 400 directly, matching validateCompleteProduct.

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

// ==================== HERO SLIDE VALIDATION ====================

export const validateHeroSlide = runValidation(
    Joi.object({
        title: Joi.string().trim().min(1).max(150).required(),
        titleAccent: Joi.string().trim().max(150).allow('', null).optional(),
        eyebrow: Joi.string().trim().max(120).allow('', null).optional(),
        description: Joi.string().trim().max(500).allow('', null).optional(),
        image: Joi.string().trim().min(1).max(2000).required(),
        cta: Joi.string().trim().max(80).allow('', null).optional(),
        ctaLink: Joi.string().trim().max(500).allow('', null).optional(),
        badge: Joi.string().trim().max(60).allow('', null).optional(),
        isActive: Joi.boolean().optional(),
    })
);

// ==================== SLIDE ID PARAM ====================

export const validateSlideId = runValidation(
    Joi.object({
        id: Joi.number().integer().positive().required(),
    }),
    'params'
);

// ==================== SLIDE STATUS TOGGLE ====================

export const validateSlideActive = runValidation(
    Joi.object({
        isActive: Joi.boolean().required(),
    })
);

// ==================== REORDER ====================

export const validateSlideOrder = runValidation(
    Joi.object({
        orderedIds: Joi.array().items(Joi.number().integer().positive()).min(1).required(),
    })
);

// ==================== SECTION SETTINGS ====================

export const validateHeroSectionSettings = runValidation(
    Joi.object({
        hero_section_enabled: Joi.boolean().optional(),
        hero_autoplay_enabled: Joi.boolean().optional(),
        hero_autoplay_interval: Joi.number().integer().min(2000).max(60000).optional(),
        hero_secondary_label: Joi.string().trim().max(80).allow('').optional(),
        hero_secondary_link: Joi.string().trim().max(500).allow('').optional(),
    }).min(1)
);
