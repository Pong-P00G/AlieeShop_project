import db from '../database/dbpool.js';

export const calculateRates = async ({ subtotal, itemCount, country, state, zipCode }) => {
    if (!country || !state || !zipCode) {
        const err = new Error('Country, state, and zipCode are required');
        err.status = 400;
        throw err;
    }

    const numericSubtotal = Number(subtotal) || 0;
    const isInternational = country !== 'US' && country !== 'CA';
    const isCanada = country === 'CA';

    // Free-shipping threshold comes from store settings (admin Config page);
    // fall back to 50 only when the setting is missing. An explicit 0 means
    // free shipping is disabled entirely.
    let freeShippingThreshold = 50;
    try {
        const { rows } = await db.query(
            `SELECT setting_value FROM store_settings WHERE setting_key = 'free_shipping_threshold'`
        );
        if (rows[0]?.setting_value != null && String(rows[0].setting_value).trim() !== '') {
            const parsed = Number(rows[0].setting_value);
            if (Number.isFinite(parsed) && parsed >= 0) {
                freeShippingThreshold = parsed;
            }
        }
    } catch {
        // Settings table unavailable — keep the 50 default.
    }

    const methods = [];

    let standardPrice = 0;
    if (isInternational) {
        standardPrice = Math.max(9.99, numericSubtotal * 0.15);
    } else if (isCanada) {
        standardPrice = Math.max(5.99, numericSubtotal * 0.08);
    } else {
        standardPrice = freeShippingThreshold > 0 && numericSubtotal >= freeShippingThreshold
            ? 0
            : 5.99;
    }

    methods.push({
        id: 'standard',
        name: 'Standard Shipping',
        description: isInternational ? '10-15 business days' : '5-7 business days',
        price: Math.round(standardPrice * 100) / 100,
        estimatedDays: isInternational ? '10-15' : '5-7',
    });

    let expressPrice = isInternational
        ? Math.max(19.99, numericSubtotal * 0.25)
        : Math.max(12.99, numericSubtotal * 0.12);

    methods.push({
        id: 'express',
        name: 'Express Shipping',
        description: isInternational ? '5-8 business days' : '2-3 business days',
        price: Math.round(expressPrice * 100) / 100,
        estimatedDays: isInternational ? '5-8' : '2-3',
    });

    if (!isInternational) {
        const overnightPrice = Math.max(24.99, numericSubtotal * 0.18);
        methods.push({
            id: 'overnight',
            name: 'Overnight Shipping',
            description: 'Next business day',
            price: Math.round(overnightPrice * 100) / 100,
            estimatedDays: '1',
        });
    }

    return methods;
};

export const validateShippingAddress = async ({ country, state, zipCode }) => {
    if (!country || !state || !zipCode) {
        return { valid: false, message: 'Incomplete address' };
    }
    const supportedCountries = ['US', 'CA', 'UK', 'AU', 'DE', 'FR', 'JP'];
    if (!supportedCountries.includes(country)) {
        return { valid: false, message: 'We currently do not ship to ' + country };
    }
    return { valid: true };
};
