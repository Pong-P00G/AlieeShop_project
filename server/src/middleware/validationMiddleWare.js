import Joi from 'joi';

// Validate user registration
export const validateRegister = (req, res, next) => {
    const schema = Joi.object({
        username: Joi.string().alphanum().min(4).max(30).required()
            .messages({
                'string.min': 'Username must be at least 4 characters',
                'string.max': 'Username must not exceed 30 characters',
                'string.alphanum': 'Username must contain only letters and numbers',
                'any.required': 'Username is required'
            }),
        password: Joi.string().min(8).max(30).required()
            .messages({
                'string.min': 'Password must be at least 8 characters',
                'string.max': 'Password must not exceed 30 characters',
                'any.required': 'Password is required'
            }),
        email: Joi.string().email().required()
            .messages({
                'string.email': 'Please provide a valid email address',
                'any.required': 'Email is required'
            }),
        first_name: Joi.string().min(2).max(75).required()
            .messages({
                'string.min': 'First name must be at least 2 characters',
                'any.required': 'First name is required'
            }),
        mid_name: Joi.string().max(75).allow(null, '')
            .messages({
                'string.max': 'Middle name must not exceed 75 characters'
            }),
        last_name: Joi.string().min(2).max(75).required()
            .messages({
                'string.min': 'Last name must be at least 2 characters',
                'any.required': 'Last name is required'
            }),
    });

    const { error } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({ message: error.details[0].message });
    }
    next();
};

// Validate user login - accepts email or username
export const validateLogin = (req, res, next) => {
    const schema = Joi.object({
        identifier: Joi.string().required()
            .messages({
                'any.required': 'Email or username is required',
                'string.empty': 'Email or username cannot be empty'
            }),
        password: Joi.string().required()
            .messages({
                'any.required': 'Password is required',
                'string.empty': 'Password cannot be empty'
            }),
        rememberMe: Joi.boolean().optional().default(false)
            .messages({
                'boolean.base': 'rememberMe must be a boolean value'
            })
    });
    
    const { error, value } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({ message: error.details[0].message });
    }
    // Preserve the validated body (includes rememberMe default)
    req.body = value;
    next();
};

// Validate user update
export const validateUpdate = (req, res, next) => {
    const schema = Joi.object({
        username: Joi.string().alphanum().min(4).max(30).optional(),
        email: Joi.string().email().optional(),
        password: Joi.string().min(8).max(30).optional(),
        first_name: Joi.string().min(2).max(75).optional(),
        mid_name: Joi.string().max(75).allow(null, '').optional(),
        last_name: Joi.string().min(2).max(75).optional(),
        role_id: Joi.number().integer().min(1).optional(),
        // Only consumed by the self-service profile endpoint, which verifies it
        // before accepting a new password. Required there, optional here.
        current_password: Joi.string().min(1).max(75).optional()
    }).min(1); // At least one field must be provided
    
    const { error } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({ message: error.details[0].message });
    }
    next();
};