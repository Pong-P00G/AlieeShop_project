import { describe, it, expect, vi } from 'vitest';
import { validateProductCarouselSettings } from '../src/middleware/productCarouselValidation.js';

/**
 * Run a middleware and report what it did.
 * next() called → { next: true }; respond → { status, body }.
 */
const run = (middleware, req = {}) => {
    const res = {
        statusCode: 200,
        payload: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.payload = body; return this; },
    };
    const next = vi.fn();
    middleware(req, res, next);
    return { next, res };
};

// ═══════════════════════════════════════════════════════════════════════════════
//  validateProductCarouselSettings
// ═══════════════════════════════════════════════════════════════════════════════

describe('productCarouselValidation — validateProductCarouselSettings', () => {
    it('accepts the carousel-owned keys', () => {
        const { next, res } = run(validateProductCarouselSettings, {
            body: {
                product_carousel_section_enabled: false,
                product_carousel_eyebrow: 'Discover',
                product_carousel_title: 'Curated Collections',
                product_carousel_view_all_label: 'View all',
                product_carousel_view_all_link: '/product',
                product_carousel_autoplay_enabled: true,
                product_carousel_autoplay_interval: 4000,
            },
            params: {},
        });

        expect(next).toHaveBeenCalled();
        expect(res.payload).toBeNull();
    });

    it('accepts a tab list', () => {
        const { next } = run(validateProductCarouselSettings, {
            body: {
                product_carousel_tabs: [
                    { key: 'best-sellers', label: 'Hot', title: 'Best Sellers', productsPerTab: 4, isActive: true },
                    { key: 'featured', isActive: false },
                ],
            },
            params: {},
        });

        expect(next).toHaveBeenCalled();
    });

    it('does not allow settings the carousel does not own', () => {
        const { next, res } = run(validateProductCarouselSettings, { body: { tax_rate: '99' }, params: {} });

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(400);
    });

    it('rejects a tab source the storefront cannot render', () => {
        const { next, res } = run(validateProductCarouselSettings, {
            body: { product_carousel_tabs: [{ key: 'weekly-deals' }] },
            params: {},
        });

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(400);
        expect(res.payload.errors[0].field).toBe('product_carousel_tabs.0.key');
    });

    it('requires a key on every tab', () => {
        const { res } = run(validateProductCarouselSettings, {
            body: { product_carousel_tabs: [{ label: 'Hot' }] },
            params: {},
        });

        expect(res.statusCode).toBe(400);
    });

    it('rejects an empty tab list', () => {
        expect(run(validateProductCarouselSettings, { body: { product_carousel_tabs: [] }, params: {} }).res.statusCode)
            .toBe(400);
    });

    it('accepts hand-picked products on a tab', () => {
        const { next } = run(validateProductCarouselSettings, {
            body: { product_carousel_tabs: [{ key: 'featured', productIds: [3, 7] }] },
            params: {},
        });

        expect(next).toHaveBeenCalled();
    });

    it('accepts an empty picks list (that tab is automatic)', () => {
        const { next } = run(validateProductCarouselSettings, {
            body: { product_carousel_tabs: [{ key: 'featured', productIds: [] }] },
            params: {},
        });

        expect(next).toHaveBeenCalled();
    });

    it('coerces numeric strings, the way the rest of the schema does', () => {
        expect(run(validateProductCarouselSettings, {
            body: { product_carousel_tabs: [{ key: 'featured', productIds: ['3'] }] },
            params: {},
        }).next).toHaveBeenCalled();
    });

    it('rejects ids Joi cannot read as a number', () => {
        expect(run(validateProductCarouselSettings, {
            body: { product_carousel_tabs: [{ key: 'featured', productIds: ['abc'] }] },
            params: {},
        }).res.statusCode).toBe(400);
    });

    it('rejects non-positive product ids', () => {
        expect(run(validateProductCarouselSettings, {
            body: { product_carousel_tabs: [{ key: 'featured', productIds: [0] }] },
            params: {},
        }).res.statusCode).toBe(400);
    });

    it('rejects a picks list longer than a tab can show', () => {
        const tooMany = Array.from({ length: 25 }, (_, i) => i + 1);

        expect(run(validateProductCarouselSettings, {
            body: { product_carousel_tabs: [{ key: 'featured', productIds: tooMany }] },
            params: {},
        }).res.statusCode).toBe(400);
    });

    it('rejects a product count outside 1–24', () => {
        expect(run(validateProductCarouselSettings, {
            body: { product_carousel_tabs: [{ key: 'featured', productsPerTab: 0 }] },
            params: {},
        }).res.statusCode).toBe(400);

        expect(run(validateProductCarouselSettings, {
            body: { product_carousel_tabs: [{ key: 'featured', productsPerTab: 25 }] },
            params: {},
        }).res.statusCode).toBe(400);
    });

    it('rejects an interval outside 2000–60000 ms', () => {
        expect(run(validateProductCarouselSettings, { body: { product_carousel_autoplay_interval: 1999 }, params: {} }).res.statusCode)
            .toBe(400);
        expect(run(validateProductCarouselSettings, { body: { product_carousel_autoplay_interval: 60001 }, params: {} }).res.statusCode)
            .toBe(400);
    });

    it('rejects an over-long section title', () => {
        expect(run(validateProductCarouselSettings, {
            body: { product_carousel_title: 'x'.repeat(81) },
            params: {},
        }).res.statusCode).toBe(400);
    });

    it('allows blank headings so the admin can hide them', () => {
        expect(run(validateProductCarouselSettings, {
            body: { product_carousel_eyebrow: '', product_carousel_title: '' },
            params: {},
        }).next).toHaveBeenCalled();
    });

    it('requires at least one setting', () => {
        expect(run(validateProductCarouselSettings, { body: {}, params: {} }).res.statusCode).toBe(400);
    });
});
