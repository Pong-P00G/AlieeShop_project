import { describe, it, expect, vi, beforeEach } from 'vitest';

// Both models are mocked so the tests never touch Postgres.
vi.mock('../src/model/heroModel.js', () => ({
    getAllSlides: vi.fn(async () => []),
    getSlideById: vi.fn(async () => undefined),
    countSlides: vi.fn(async () => 0),
    createSlide: vi.fn(async (row) => ({ slide_id: 99, sort_order: 3, is_active: true, ...row })),
    updateSlide: vi.fn(async (id, row) => ({ slide_id: id, sort_order: 0, is_active: true, ...row })),
    setSlideActive: vi.fn(async (id, isActive) => ({ slide_id: id, is_active: isActive })),
    deleteSlide: vi.fn(async () => true),
    reorderSlides: vi.fn(async () => undefined),
}));

vi.mock('../src/model/settingsModel.js', () => ({
    getAllSettings: vi.fn(async () => []),
    bulkUpsertSettings: vi.fn(async () => []),
}));

import * as HeroModel from '../src/model/heroModel.js';
import * as SettingsModel from '../src/model/settingsModel.js';
import * as heroService from '../src/services/heroService.js';

const ADMIN = 1;

const dbSlide = (overrides = {}) => ({
    slide_id: 1,
    eyebrow: 'Summer Collection 2024',
    title: 'Threads of',
    title_accent: 'Modernity',
    description: 'Curated apparel and essentials.',
    image_url: 'https://cdn.example.com/hero-1.jpg',
    cta_label: 'Shop Collection',
    cta_link: '/product',
    badge: 'New Season',
    sort_order: 0,
    is_active: true,
    updated_at: null,
    ...overrides,
});

const validPayload = (overrides = {}) => ({
    title: 'Threads of',
    titleAccent: 'Modernity',
    eyebrow: 'Summer',
    description: 'Curated apparel.',
    image: 'https://cdn.example.com/hero.jpg',
    cta: 'Shop Collection',
    ctaLink: '/product',
    badge: 'New Season',
    ...overrides,
});

beforeEach(() => {
    vi.clearAllMocks();
    HeroModel.getAllSlides.mockResolvedValue([]);
    HeroModel.getSlideById.mockResolvedValue(undefined);
    HeroModel.countSlides.mockResolvedValue(0);
    HeroModel.createSlide.mockImplementation(async (row) => ({ slide_id: 99, sort_order: 3, is_active: true, ...row }));
    HeroModel.updateSlide.mockImplementation(async (id, row) => ({ slide_id: id, sort_order: 0, is_active: true, ...row }));
    HeroModel.setSlideActive.mockImplementation(async (id, isActive) => ({ slide_id: id, is_active: isActive }));
    HeroModel.deleteSlide.mockResolvedValue(true);
    HeroModel.reorderSlides.mockResolvedValue(undefined);
    SettingsModel.getAllSettings.mockResolvedValue([]);
    SettingsModel.bulkUpsertSettings.mockResolvedValue([]);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  getHero (public)
// ═══════════════════════════════════════════════════════════════════════════════

describe('heroService — getHero', () => {
    it('maps DB rows to the camelCase storefront shape', async () => {
        HeroModel.getAllSlides.mockResolvedValue([dbSlide()]);

        const { slides } = await heroService.getHero();

        expect(slides).toHaveLength(1);
        expect(slides[0]).toMatchObject({
            id: 1,
            title: 'Threads of',
            titleAccent: 'Modernity',
            image: 'https://cdn.example.com/hero-1.jpg',
            cta: 'Shop Collection',
            ctaLink: '/product',
            badge: 'New Season',
            isActive: true,
        });
    });

    it('only asks the model for active slides', async () => {
        await heroService.getHero();
        expect(HeroModel.getAllSlides).toHaveBeenCalledWith({ activeOnly: true });
    });

    it('coerces NULL text columns to empty strings so the template cannot render "null"', async () => {
        HeroModel.getAllSlides.mockResolvedValue([
            dbSlide({ eyebrow: null, title_accent: null, description: null, badge: null, cta_label: null }),
        ]);

        const { slides } = await heroService.getHero();

        expect(slides[0].eyebrow).toBe('');
        expect(slides[0].titleAccent).toBe('');
        expect(slides[0].description).toBe('');
        expect(slides[0].badge).toBe('');
        expect(slides[0].cta).toBe('');
    });

    it('returns the built-in defaults when no hero settings are stored', async () => {
        const { settings } = await heroService.getHero();

        expect(settings).toEqual({
            sectionEnabled: true,
            autoplayEnabled: true,
            autoplayInterval: 5000,
            secondaryLabel: 'Our Story',
            secondaryLink: '/about',
        });
    });

    it('returns defaults (rather than throwing) when the settings table is unavailable', async () => {
        SettingsModel.getAllSettings.mockRejectedValue(new Error('relation "store_settings" does not exist'));

        const { settings, slides } = await heroService.getHero();

        expect(slides).toEqual([]);
        expect(settings.autoplayInterval).toBe(5000);
    });

    it('ignores unrelated store settings', async () => {
        SettingsModel.getAllSettings.mockResolvedValue([
            { key: 'tax_rate', value: '8' },
            { key: 'hero_autoplay_interval', value: '7000' },
        ]);

        const { settings } = await heroService.getHero();

        expect(settings.autoplayInterval).toBe(7000);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  toSectionSettings
// ═══════════════════════════════════════════════════════════════════════════════

describe('heroService — toSectionSettings', () => {
    const rows = (overrides = {}) => [
        { key: 'hero_section_enabled', value: 'false' },
        { key: 'hero_autoplay_enabled', value: 'false' },
        { key: 'hero_autoplay_interval', value: '3000' },
        { key: 'hero_secondary_label', value: 'Our Story' },
        { key: 'hero_secondary_link', value: '/about' },
    ].filter(row => !(row.key in overrides)).concat(
        Object.entries(overrides).map(([key, value]) => ({ key, value }))
    );

    it('parses stored strings into typed values', () => {
        const settings = heroService.toSectionSettings(rows());

        expect(settings.sectionEnabled).toBe(false);
        expect(settings.autoplayEnabled).toBe(false);
        expect(settings.autoplayInterval).toBe(3000);
    });

    it.each([
        ['true', true],
        ['1', true],
        ['yes', true],
        ['on', true],
        ['false', false],
        ['0', false],
        ['off', false],
    ])('parses the boolean form %s', (stored, expected) => {
        expect(heroService.toSectionSettings(rows({ hero_section_enabled: stored })).sectionEnabled).toBe(expected);
    });

    it('falls back to the default when a boolean is unparseable', () => {
        expect(heroService.toSectionSettings(rows({ hero_autoplay_enabled: 'maybe' })).autoplayEnabled).toBe(true);
    });

    it.each([
        ['500', 500],       // below the 2000ms floor
        ['999999', 999999], // above the 60000ms ceiling
        ['abc', 0],
        ['', 0],
    ])('rejects the out-of-range interval %s', (stored, _ignored) => {
        expect(heroService.toSectionSettings(rows({ hero_autoplay_interval: stored })).autoplayInterval).toBe(5000);
    });

    it('blank labels fall back to defaults instead of rendering an empty button', () => {
        const settings = heroService.toSectionSettings(rows({ hero_secondary_label: '   ' }));
        expect(settings.secondaryLabel).toBe('Our Story');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  updateSectionSettings
// ═══════════════════════════════════════════════════════════════════════════════

describe('heroService — updateSectionSettings', () => {
    it('rejects non-admin callers', async () => {
        await expect(
            heroService.updateSectionSettings({ hero_autoplay_enabled: true }, 5)
        ).rejects.toMatchObject({ status: 403 });
        expect(SettingsModel.bulkUpsertSettings).not.toHaveBeenCalled();
    });

    it('rejects an empty payload', async () => {
        await expect(heroService.updateSectionSettings({}, ADMIN)).rejects.toMatchObject({ status: 400 });
    });

    it('rejects keys the hero section does not own', async () => {
        await expect(
            heroService.updateSectionSettings({ tax_rate: '5' }, ADMIN)
        ).rejects.toMatchObject({ status: 400, message: /Unknown setting/ });
        expect(SettingsModel.bulkUpsertSettings).not.toHaveBeenCalled();
    });

    it('rejects a non-boolean flag', async () => {
        await expect(
            heroService.updateSectionSettings({ hero_section_enabled: 'yes' }, ADMIN)
        ).rejects.toMatchObject({ status: 400 });
    });

    it('rejects an autoplay interval outside the allowed range', async () => {
        await expect(
            heroService.updateSectionSettings({ hero_autoplay_interval: 100 }, ADMIN)
        ).rejects.toMatchObject({ status: 400, message: /between 2000 and 60000/ });
    });

    it('rejects an unsafe secondary link', async () => {
        await expect(
            heroService.updateSectionSettings({ hero_secondary_link: 'javascript:alert(1)' }, ADMIN)
        ).rejects.toMatchObject({ status: 400 });
    });

    it('persists valid values as strings and echoes the stored result', async () => {
        SettingsModel.getAllSettings.mockResolvedValue([
            { key: 'hero_section_enabled', value: 'false' },
            { key: 'hero_autoplay_enabled', value: 'true' },
            { key: 'hero_autoplay_interval', value: '8000' },
            { key: 'hero_secondary_label', value: 'Read More' },
            { key: 'hero_secondary_link', value: '/about' },
        ]);

        const result = await heroService.updateSectionSettings({
            hero_section_enabled: false,
            hero_autoplay_interval: 8000,
            hero_secondary_label: 'Read More',
        }, ADMIN);

        expect(SettingsModel.bulkUpsertSettings).toHaveBeenCalledWith({
            hero_section_enabled: 'false',
            hero_autoplay_interval: '8000',
            hero_secondary_label: 'Read More',
        });
        expect(result).toMatchObject({
            sectionEnabled: false,
            autoplayInterval: 8000,
            secondaryLabel: 'Read More',
        });
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  createSlide
// ═══════════════════════════════════════════════════════════════════════════════

describe('heroService — createSlide', () => {
    it('rejects non-admin callers', async () => {
        await expect(heroService.createSlide(validPayload(), 5)).rejects.toMatchObject({ status: 403 });
        expect(HeroModel.createSlide).not.toHaveBeenCalled();
    });

    it('rejects a slide without a title', async () => {
        await expect(
            heroService.createSlide(validPayload({ title: '   ' }), ADMIN)
        ).rejects.toMatchObject({ status: 400, message: /title is required/i });
    });

    it('rejects a slide without an image', async () => {
        await expect(
            heroService.createSlide(validPayload({ image: '' }), ADMIN)
        ).rejects.toMatchObject({ status: 400, message: /image is required/i });
    });

    it('rejects an unsafe CTA link', async () => {
        await expect(
            heroService.createSlide(validPayload({ ctaLink: 'javascript:alert(1)' }), ADMIN)
        ).rejects.toMatchObject({ status: 400, message: /must start with/ });
    });

    it('rejects a relative link that is not rooted', async () => {
        await expect(
            heroService.createSlide(validPayload({ ctaLink: 'product' }), ADMIN)
        ).rejects.toMatchObject({ status: 400 });
    });

    it('rejects a CTA label with no link and a link with no label', async () => {
        await expect(
            heroService.createSlide(validPayload({ ctaLink: '' }), ADMIN)
        ).rejects.toMatchObject({ status: 400, message: /needs a link/ });

        await expect(
            heroService.createSlide(validPayload({ cta: '' }), ADMIN)
        ).rejects.toMatchObject({ status: 400, message: /needs a button label/ });
    });

    it('accepts an external https link', async () => {
        await expect(
            heroService.createSlide(validPayload({ ctaLink: 'https://example.com/sale' }), ADMIN)
        ).resolves.toMatchObject({ ctaLink: 'https://example.com/sale' });
    });

    it('refuses to exceed the slide cap', async () => {
        HeroModel.countSlides.mockResolvedValue(heroService.MAX_SLIDES);

        await expect(heroService.createSlide(validPayload(), ADMIN))
            .rejects.toMatchObject({ status: 400, message: /maximum of 12/ });
        expect(HeroModel.createSlide).not.toHaveBeenCalled();
    });

    it('stores NULL (not empty strings) for blank optional fields', async () => {
        await heroService.createSlide(validPayload({ eyebrow: '  ', badge: '', cta: '', ctaLink: '' }), ADMIN);

        const row = HeroModel.createSlide.mock.calls[0][0];
        expect(row.eyebrow).toBeNull();
        expect(row.badge).toBeNull();
        expect(row.cta_label).toBeNull();
        expect(row.cta_link).toBeNull();
    });

    it('returns the created slide in API shape', async () => {
        const created = await heroService.createSlide(validPayload(), ADMIN);

        expect(created).toMatchObject({
            id: 99,
            title: 'Threads of',
            image: 'https://cdn.example.com/hero.jpg',
            isActive: true,
        });
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  updateSlide / setSlideActive / deleteSlide
// ═══════════════════════════════════════════════════════════════════════════════

describe('heroService — updateSlide', () => {
    it('rejects non-admin callers', async () => {
        await expect(heroService.updateSlide(1, validPayload(), 5)).rejects.toMatchObject({ status: 403 });
    });

    it('rejects a non-numeric id', async () => {
        await expect(heroService.updateSlide('abc', validPayload(), ADMIN))
            .rejects.toMatchObject({ status: 400, message: /Invalid slide id/ });
    });

    it('404s when the slide does not exist', async () => {
        HeroModel.getSlideById.mockResolvedValue(undefined);

        await expect(heroService.updateSlide(42, validPayload(), ADMIN))
            .rejects.toMatchObject({ status: 404 });
        expect(HeroModel.updateSlide).not.toHaveBeenCalled();
    });

    it('updates an existing slide', async () => {
        HeroModel.getSlideById.mockResolvedValue(dbSlide());

        const updated = await heroService.updateSlide(1, validPayload({ title: 'New Title' }), ADMIN);

        expect(HeroModel.updateSlide).toHaveBeenCalledWith(1, expect.objectContaining({ title: 'New Title' }));
        expect(updated.title).toBe('New Title');
    });
});

describe('heroService — setSlideActive', () => {
    it('rejects non-admin callers', async () => {
        await expect(heroService.setSlideActive(1, false, 5)).rejects.toMatchObject({ status: 403 });
    });

    it('rejects a non-boolean flag', async () => {
        await expect(heroService.setSlideActive(1, 'false', ADMIN))
            .rejects.toMatchObject({ status: 400 });
    });

    it('404s when the model finds no matching row', async () => {
        HeroModel.setSlideActive.mockResolvedValue(undefined);

        await expect(heroService.setSlideActive(7, false, ADMIN)).rejects.toMatchObject({ status: 404 });
    });

    it('toggles the slide and reports the new state', async () => {
        const slide = await heroService.setSlideActive(1, false, ADMIN);

        expect(HeroModel.setSlideActive).toHaveBeenCalledWith(1, false);
        expect(slide.isActive).toBe(false);
    });
});

describe('heroService — deleteSlide', () => {
    it('rejects non-admin callers', async () => {
        await expect(heroService.deleteSlide(1, 5)).rejects.toMatchObject({ status: 403 });
    });

    it('404s when the slide does not exist', async () => {
        await expect(heroService.deleteSlide(42, ADMIN)).rejects.toMatchObject({ status: 404 });
        expect(HeroModel.deleteSlide).not.toHaveBeenCalled();
    });

    it('deletes an existing slide', async () => {
        HeroModel.getSlideById.mockResolvedValue(dbSlide());

        await expect(heroService.deleteSlide(1, ADMIN)).resolves.toEqual({ id: 1 });
        expect(HeroModel.deleteSlide).toHaveBeenCalledWith(1);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  reorderSlides
// ═══════════════════════════════════════════════════════════════════════════════

describe('heroService — reorderSlides', () => {
    const threeSlides = () => [
        dbSlide({ slide_id: 1, sort_order: 0 }),
        dbSlide({ slide_id: 2, sort_order: 1 }),
        dbSlide({ slide_id: 3, sort_order: 2 }),
    ];

    it('rejects non-admin callers', async () => {
        await expect(heroService.reorderSlides([1, 2], 5)).rejects.toMatchObject({ status: 403 });
    });

    it('rejects an empty array', async () => {
        await expect(heroService.reorderSlides([], ADMIN)).rejects.toMatchObject({ status: 400 });
    });

    it('rejects duplicate ids', async () => {
        HeroModel.getAllSlides.mockResolvedValue(threeSlides());

        await expect(heroService.reorderSlides([1, 1, 2], ADMIN))
            .rejects.toMatchObject({ status: 400, message: /duplicates/ });
    });

    it('rejects a partial list so sort_order cannot be left duplicated', async () => {
        HeroModel.getAllSlides.mockResolvedValue(threeSlides());

        await expect(heroService.reorderSlides([1, 2], ADMIN))
            .rejects.toMatchObject({ status: 400, message: /every slide exactly once/ });
        expect(HeroModel.reorderSlides).not.toHaveBeenCalled();
    });

    it('rejects an id that does not exist', async () => {
        HeroModel.getAllSlides.mockResolvedValue(threeSlides());

        await expect(heroService.reorderSlides([1, 2, 99], ADMIN))
            .rejects.toMatchObject({ status: 400 });
    });

    it('persists the new order in the submitted sequence', async () => {
        HeroModel.getAllSlides.mockResolvedValue(threeSlides());

        await heroService.reorderSlides([3, 1, 2], ADMIN);

        expect(HeroModel.reorderSlides).toHaveBeenCalledWith([3, 1, 2]);
    });

    it('returns the refreshed admin payload', async () => {
        HeroModel.getAllSlides.mockResolvedValue(threeSlides());

        const result = await heroService.reorderSlides([2, 3, 1], ADMIN);

        expect(result.slides).toHaveLength(3);
        expect(result.maxSlides).toBe(heroService.MAX_SLIDES);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  getAdminHero
// ═══════════════════════════════════════════════════════════════════════════════

describe('heroService — getAdminHero', () => {
    it('rejects non-admin callers', async () => {
        await expect(heroService.getAdminHero(5)).rejects.toMatchObject({ status: 403 });
    });

    it('includes hidden slides', async () => {
        HeroModel.getAllSlides.mockResolvedValue([dbSlide({ is_active: false })]);

        const { slides } = await heroService.getAdminHero(ADMIN);

        expect(HeroModel.getAllSlides).toHaveBeenCalledWith();
        expect(slides[0].isActive).toBe(false);
    });
});
