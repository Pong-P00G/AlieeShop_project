import { describe, it, expect, vi } from 'vitest';
import {
    validateHeroSlide,
    validateSlideId,
    validateSlideActive,
    validateSlideOrder,
    validateHeroSectionSettings,
} from '../src/middleware/heroValidation.js';

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

const validSlide = {
    title: 'Threads of',
    titleAccent: 'Modernity',
    image: 'https://cdn.example.com/hero.jpg',
    cta: 'Shop',
    ctaLink: '/product',
};

// ═══════════════════════════════════════════════════════════════════════════════
//  validateHeroSlide
// ═══════════════════════════════════════════════════════════════════════════════

describe('heroValidation — validateHeroSlide', () => {
    it('passes a valid body through', () => {
        const { next, res } = run(validateHeroSlide, { body: validSlide, params: {} });
        expect(next).toHaveBeenCalled();
        expect(res.payload).toBeNull();
    });

    it('validates req.body, not req.params (regression)', () => {
        // Route handlers declare `:id`, so req.params is populated. An earlier
        // version validated params here and rejected every valid slide body.
        const { next } = run(validateHeroSlide, { body: validSlide, params: { id: '1' } });
        expect(next).toHaveBeenCalled();
    });

    it('rejects a missing title', () => {
        const { next, res } = run(validateHeroSlide, { body: { ...validSlide, title: '' }, params: {} });
        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(400);
        expect(res.payload.errors[0].field).toBe('title');
    });

    it('rejects a missing image', () => {
        const { next, res } = run(validateHeroSlide, { body: { title: 'Only a title' }, params: {} });
        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(400);
        expect(res.payload.errors.some(e => e.field === 'image')).toBe(true);
    });

    it('allows blank optional fields', () => {
        const { next } = run(validateHeroSlide, {
            body: { ...validSlide, eyebrow: '', badge: '', description: '', cta: '', ctaLink: '' },
            params: {},
        });
        expect(next).toHaveBeenCalled();
    });

    it('rejects an over-long title', () => {
        const { res } = run(validateHeroSlide, { body: { ...validSlide, title: 'x'.repeat(151) }, params: {} });
        expect(res.statusCode).toBe(400);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  validateSlideId
// ═══════════════════════════════════════════════════════════════════════════════

describe('heroValidation — validateSlideId', () => {
    it('accepts a numeric id from the route params', () => {
        const { next } = run(validateSlideId, { params: { id: '12' }, body: {} });
        expect(next).toHaveBeenCalled();
    });

    it('rejects a non-numeric id', () => {
        const { next, res } = run(validateSlideId, { params: { id: 'abc' }, body: {} });
        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(400);
    });

    it('rejects a negative or zero id', () => {
        expect(run(validateSlideId, { params: { id: '0' }, body: {} }).res.statusCode).toBe(400);
        expect(run(validateSlideId, { params: { id: '-3' }, body: {} }).res.statusCode).toBe(400);
    });

    it('validates params rather than the body', () => {
        // A valid body must not rescue an invalid id.
        const { res } = run(validateSlideId, { params: { id: 'nope' }, body: validSlide });
        expect(res.statusCode).toBe(400);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  validateSlideActive / validateSlideOrder
// ═══════════════════════════════════════════════════════════════════════════════

describe('heroValidation — validateSlideActive', () => {
    it('accepts a boolean flag', () => {
        expect(run(validateSlideActive, { body: { isActive: false }, params: {} }).next).toHaveBeenCalled();
    });

    it.each([['yes'], [1], [null]])('rejects the non-boolean flag %s', (value) => {
        const { res, next } = run(validateSlideActive, { body: { isActive: value }, params: {} });
        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(400);
    });

    it('requires the flag', () => {
        expect(run(validateSlideActive, { body: {}, params: {} }).res.statusCode).toBe(400);
    });
});

describe('heroValidation — validateSlideOrder', () => {
    it('accepts a list of ids', () => {
        expect(run(validateSlideOrder, { body: { orderedIds: [3, 1, 2] }, params: {} }).next).toHaveBeenCalled();
    });

    it('rejects an empty list', () => {
        expect(run(validateSlideOrder, { body: { orderedIds: [] }, params: {} }).res.statusCode).toBe(400);
    });

    it('rejects non-numeric ids', () => {
        expect(run(validateSlideOrder, { body: { orderedIds: ['a'] }, params: {} }).res.statusCode).toBe(400);
    });

    it('requires orderedIds', () => {
        expect(run(validateSlideOrder, { body: {}, params: {} }).res.statusCode).toBe(400);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  validateHeroSectionSettings
// ═══════════════════════════════════════════════════════════════════════════════

describe('heroValidation — validateHeroSectionSettings', () => {
    it('accepts the hero-owned keys', () => {
        const { next } = run(validateHeroSectionSettings, {
            body: {
                hero_section_enabled: false,
                hero_autoplay_enabled: true,
                hero_autoplay_interval: 7000,
                hero_secondary_label: 'Read More',
                hero_secondary_link: '/about',
            },
            params: {},
        });
        expect(next).toHaveBeenCalled();
    });

    it('does not allow settings the hero does not own', () => {
        const { next, res } = run(validateHeroSectionSettings, { body: { tax_rate: '99' }, params: {} });
        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(400);
    });

    it('rejects an interval outside 2000–60000 ms', () => {
        expect(run(validateHeroSectionSettings, { body: { hero_autoplay_interval: 1999 }, params: {} }).res.statusCode).toBe(400);
        expect(run(validateHeroSectionSettings, { body: { hero_autoplay_interval: 60001 }, params: {} }).res.statusCode).toBe(400);
    });

    it('requires at least one setting', () => {
        expect(run(validateHeroSectionSettings, { body: {}, params: {} }).res.statusCode).toBe(400);
    });
});
