import Joi from 'joi';

// ==================== VALIDATION MIDDLEWARE ====================

export const validate = (req, res, next) => {
    if (req.validationErrors) {
        return res.status(400).json({
            success: false,
            errors: req.validationErrors
        });
    }
    next();
};

// ==================== COMPLETE PRODUCT VALIDATION ====================

export const validateCompleteProduct = (req, res, next) => {
    const schema = Joi.object({
        category_id: Joi.number().integer().positive().optional().allow(null),
        product_name: Joi.string().min(1).max(150).required(),
        base_price: Joi.number().positive().required(),
        descriptions: Joi.string().max(1000).allow('', null).optional(),
        product_status: Joi.string().valid('active', 'inactive', 'archived').optional().default('active'),
        tags: Joi.array().items(Joi.string()).optional(),

        images: Joi.array().items(
            Joi.object({
                image_url: Joi.string().uri({ allowRelative: true }).required(),
                is_main: Joi.boolean().optional(),
                alt_text: Joi.string().max(255).allow('', null).optional(),
                sort_order: Joi.number().integer().min(0).optional().default(0)
            })
        ).optional(),

        variants: Joi.array().items(
            Joi.object({
                sku: Joi.string().max(100).optional().allow('', null),
                variant_color: Joi.string().max(200).optional().allow('', null),
                variant_size: Joi.string().max(200).optional().allow('', null),
                variant_storage: Joi.string().max(200).optional().allow('', null),
                variant_price: Joi.number().min(0).optional().allow(null),
                options: Joi.array().items(
                    Joi.object({
                        attribute_name: Joi.string().max(100).required(),
                        value: Joi.string().max(100).required()
                    })
                ).optional(),
                stock_quantity: Joi.number().integer().min(0).optional().default(0),
                reorder_level: Joi.number().integer().min(0).optional().default(5)
            })
        ).optional()
    });

    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
        return res.status(400).json({
            success: false,
            errors: error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }))
        });
    }
    
    next();
};

// ==================== PAGINATION VALIDATION ====================

export const validatePagination = (req, res, next) => {
    const schema = Joi.object({
        page: Joi.number().integer().min(1).optional().default(1),
        pageSize: Joi.number().integer().min(1).max(100).optional().default(10),
        search: Joi.string().optional().allow(''),
        category: Joi.string().optional().allow(''),
        minPrice: Joi.number().min(0).optional(),
        maxPrice: Joi.number().min(0).optional(),
        status: Joi.string().valid('active', 'inactive', 'archived').optional(),
        stockStatus: Joi.string().valid('in_stock', 'low_stock', 'out_of_stock').optional(),
        sortField: Joi.string().valid('product_name', 'base_price', 'product_status', 'created_at', 'category_name', 'total_stock').optional(),
        sortDirection: Joi.string().valid('asc', 'desc').optional()
    });

    const { error } = schema.validate(req.query, { abortEarly: false });
    
    if (error) {
        return res.status(400).json({
            success: false,
            errors: error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }))
        });
    }
    
    next();
};

// ==================== PRODUCT VALIDATION ====================

export const validateProduct = (req, res, next) => {
    const schema = Joi.object({
        category_id: Joi.number().integer().positive().optional().allow(null),
        product_name: Joi.string().min(1).max(150).required(),
        base_price: Joi.number().positive().required(),
        descriptions: Joi.string().max(1000).allow('', null).optional(),
        product_status: Joi.string().valid('active', 'inactive', 'archived').required(),
        tags: Joi.array().items(Joi.string()).optional()
    });

    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
        req.validationErrors = error.details.map(detail => ({
            field: detail.path[0],
            message: detail.message
        }));
    }
    
    next();
};

// ==================== CATEGORY VALIDATION ====================

export const validateCategory = (req, res, next) => {
    const schema = Joi.object({
        name: Joi.string().min(2).max(150).required()
    });

    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
        req.validationErrors = error.details.map(detail => ({
            field: detail.path[0],
            message: detail.message
        }));
    }
    
    next();
};

// ==================== VARIANT VALIDATION ====================

export const validateVariant = (req, res, next) => {
    const schema = Joi.object({
        product_id: Joi.number().integer().positive().required(),
        sku: Joi.string().max(100).optional().allow('', null),
        variant_color: Joi.string().max(200).optional().allow('', null),
        variant_size: Joi.string().max(200).optional().allow('', null),
        variant_storage: Joi.string().max(200).optional().allow('', null),
        variant_price: Joi.number().min(0).optional().allow(null),
        options: Joi.array().items(
            Joi.object({
                attribute_name: Joi.string().max(100).required(),
                value: Joi.string().max(100).required()
            })
        ).optional(),
        initial_stock: Joi.number().integer().min(0).optional()
    });

    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
        req.validationErrors = error.details.map(detail => ({
            field: detail.path[0],
            message: detail.message
        }));
    }
    
    next();
};

// ==================== STOCK VALIDATION ====================

export const validateStock = (req, res, next) => {
    const schema = Joi.object({
        quantity: Joi.number().integer().min(0).required(),
        reorder_level: Joi.number().integer().min(0).optional().default(5),
        amount: Joi.number().integer().positive().optional(),
        reason: Joi.string().allow('', null).optional()
    });

    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
        req.validationErrors = error.details.map(detail => ({
            field: detail.path[0],
            message: detail.message
        }));
    }
    
    next();
};

// ==================== DISCOUNT VALIDATION ====================

export const validateDiscount = (req, res, next) => {
    const schema = Joi.object({
        discount_amount: Joi.number().positive().required(),
        start_date: Joi.date().required(),
        end_date: Joi.date().greater(Joi.ref('start_date')).required()
    });

    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
        req.validationErrors = error.details.map(detail => ({
            field: detail.path[0],
            message: detail.message
        }));
    }
    
    next();
};

// ==================== BULK VALIDATION ====================

export const validateBulkProducts = (req, res, next) => {
    const schema = Joi.object({
        products: Joi.array().items(
            Joi.object({
                category_id: Joi.number().integer().positive().optional().allow(null),
                product_name: Joi.string().min(1).max(150).required(),
                base_price: Joi.number().positive().required(),
                descriptions: Joi.string().max(1000).allow('', null).optional(),
                product_status: Joi.string().valid('active', 'inactive', 'archived').optional(),
                tags: Joi.array().items(Joi.string()).optional(),
                images: Joi.array().items(
                    Joi.object({
                        image_url: Joi.string().uri({ allowRelative: true }).required(),
                        is_main: Joi.boolean().optional(),
                        alt_text: Joi.string().max(255).allow('', null).optional(),
                        sort_order: Joi.number().integer().min(0).optional().default(0)
                    })
                ).optional(),
                variants: Joi.array().items(
                    Joi.object({
                        sku: Joi.string().max(100).optional().allow('', null),
                        variant_color: Joi.string().max(200).optional().allow('', null),
                        variant_size: Joi.string().max(200).optional().allow('', null),
                        variant_storage: Joi.string().max(200).optional().allow('', null),
                        variant_price: Joi.number().min(0).optional().allow(null),
                        options: Joi.array().items(
                            Joi.object({
                                attribute_name: Joi.string().max(100).required(),
                                value: Joi.string().max(100).required()
                            })
                        ).optional(),
                        stock_quantity: Joi.number().integer().min(0).optional(),
                        reorder_level: Joi.number().integer().min(0).optional()
                    })
                ).optional()
            })
        ).min(1).max(50).required()
    });

    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
        return res.status(400).json({
            success: false,
            errors: error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }))
        });
    }
    
    next();
};