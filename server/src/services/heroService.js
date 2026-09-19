import * as HeroModel from '../model/heroModel.js';
import * as SettingsModel from '../model/settingsModel.js';

// ═══════════════════════════════════════════════════════════════════════════════
//  Constants
// ═══════════════════════════════════════════════════════════════════════════════

/** Hard cap so a runaway admin UI can't produce an unusable carousel. */
export const MAX_SLIDES = 12;

/** Section-level settings live in store_settings under these keys. */
export const SECTION_SETTING_KEYS = [
    'hero_section_enabled',
    'hero_autoplay_enabled',
    'hero_autoplay_interval',
    'hero_secondary_label',
    'hero_secondary_link',
];

export const DEFAULT_SECTION_SETTINGS = {
    sectionEnabled: true,
    autoplayEnabled: true,
    autoplayInterval: 5000,
    secondaryLabel: 'Our Story',
    secondaryLink: '/about',
};

const KEBAB_TO_CAMEL = {
    hero_section_enabled: 'sectionEnabled',
    hero_autoplay_enabled: 'autoplayEnabled',
    hero_autoplay_interval: 'autoplayInterval',
    hero_secondary_label: 'secondaryLabel',
    hero_secondary_link: 'secondaryLink',
};

export const AUTOPLAY_INTERVAL_MIN = 2000;
export const AUTOPLAY_INTERVAL_MAX = 60000;

const httpError = (status, message) => {
    const err = new Error(message);
    err.status = status;
    return err;
};

const assertAdmin = (roleId) => {
    if (roleId !== 1 && roleId !== 2) {
        throw httpError(403, 'Admin privileges required');
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  Mapping helpers
// ═══════════════════════════════════════════════════════════════════════════════

/** DB row (snake_case) → API shape (camelCase). */
export const toSlide = (row) => ({
    id: row.slide_id,
    eyebrow: row.eyebrow ?? '',
    title: row.title ?? '',
    titleAccent: row.title_accent ?? '',
    description: row.description ?? '',
    image: row.image_url ?? '',
    cta: row.cta_label ?? '',
    ctaLink: row.cta_link ?? '',
    badge: row.badge ?? '',
    sortOrder: row.sort_order ?? 0,
    isActive: row.is_active !== false,
    updatedAt: row.updated_at ?? null,
});

const normalizeText = (value, max) => {
    if (value == null) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    return trimmed.slice(0, max);
};

/**
 * API shape → DB column shape. Required fields are validated first.
 */
export const toRow = (payload = {}) => ({
    eyebrow: normalizeText(payload.eyebrow, 120),
    title: String(payload.title ?? '').trim(),
    title_accent: normalizeText(payload.titleAccent, 150),
    description: normalizeText(payload.description, 500),
    image_url: normalizeText(payload.image, 2000) ?? '',
    cta_label: normalizeText(payload.cta, 80),
    cta_link: normalizeText(payload.ctaLink, 500),
    badge: normalizeText(payload.badge, 60),
    is_active: payload.isActive !== false,
});

/**
 * A CTA link must be safe to hand to RouterLink: either an in-app
 * absolute path or an external http(s) URL. Rejecting `javascript:` etc.
 */
const isSafeLink = (link) => /^(\/[^/]|https?:\/\/)/.test(link);

export const validateSlidePayload = (payload = {}) => {
    const row = toRow(payload);

    if (row.title.length === 0) {
        throw httpError(400, 'Slide title is required');
    }
    if (row.title.length > 150) {
        throw httpError(400, 'Slide title must be 150 characters or fewer');
    }
    if (!row.image_url) {
        throw httpError(400, 'Slide image is required');
    }
    if (row.cta_link && !isSafeLink(row.cta_link)) {
        throw httpError(400, 'CTA link must start with "/" or be a full http(s) URL');
    }
    if (row.cta_link && !row.cta_label) {
        throw httpError(400, 'A CTA link needs a button label');
    }
    if (row.cta_label && !row.cta_link) {
        throw httpError(400, 'A CTA button needs a link');
    }

    return row;
};

// ═══════════════════════════════════════════════════════════════════════════════
//  Section settings
// ═══════════════════════════════════════════════════════════════════════════════

const parseBoolean = (value, fallback) => {
    if (value == null) return fallback;
    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    return fallback;
};

/**
 * Map the stored flat rows onto a typed settings object.
 * Missing/invalid values fall back to defaults rather than throwing, so a
 * half-configured store still renders a working hero.
 */
export const toSectionSettings = (rows = []) => {
    const byKey = {};
    for (const row of rows) byKey[row.key] = row.value;

    const interval = Number(byKey.hero_autoplay_interval);
    const hasValidInterval = Number.isFinite(interval)
        && interval >= AUTOPLAY_INTERVAL_MIN
        && interval <= AUTOPLAY_INTERVAL_MAX;

    return {
        sectionEnabled: parseBoolean(byKey.hero_section_enabled, DEFAULT_SECTION_SETTINGS.sectionEnabled),
        autoplayEnabled: parseBoolean(byKey.hero_autoplay_enabled, DEFAULT_SECTION_SETTINGS.autoplayEnabled),
        autoplayInterval: hasValidInterval ? Math.round(interval) : DEFAULT_SECTION_SETTINGS.autoplayInterval,
        secondaryLabel: normalizeText(byKey.hero_secondary_label, 80) ?? DEFAULT_SECTION_SETTINGS.secondaryLabel,
        secondaryLink: normalizeText(byKey.hero_secondary_link, 500) ?? DEFAULT_SECTION_SETTINGS.secondaryLink,
    };
};

export const getSectionSettings = async () => {
    let rows = [];
    try {
        rows = await SettingsModel.getAllSettings();
    } catch {
        // store_settings unavailable — render with defaults.
        return { ...DEFAULT_SECTION_SETTINGS };
    }
    const mine = rows.filter(row => SECTION_SETTING_KEYS.includes(row.key));
    return toSectionSettings(mine);
};

/**
 * Persist section settings. Only the hero-owned keys are accepted.
 */
export const updateSectionSettings = async (settings = {}, roleId) => {
    assertAdmin(roleId);

    const unknown = Object.keys(settings).filter(key => !(key in KEBAB_TO_CAMEL));
    if (unknown.length > 0) {
        throw httpError(400, `Unknown setting: "${unknown[0]}"`);
    }
    if (Object.keys(settings).length === 0) {
        throw httpError(400, 'No settings provided');
    }

    const payload = {};

    for (const [key, value] of Object.entries(settings)) {
        const target = KEBAB_TO_CAMEL[key];
        if (target === 'sectionEnabled' || target === 'autoplayEnabled') {
            if (typeof value !== 'boolean') {
                throw httpError(400, `${key} must be true or false`);
            }
            payload[key] = String(value);
            continue;
        }
        if (target === 'autoplayInterval') {
            const num = Number(value);
            if (!Number.isFinite(num) || num < AUTOPLAY_INTERVAL_MIN || num > AUTOPLAY_INTERVAL_MAX) {
                throw httpError(400, `hero_autoplay_interval must be between ${AUTOPLAY_INTERVAL_MIN} and ${AUTOPLAY_INTERVAL_MAX} ms`);
            }
            payload[key] = String(Math.round(num));
            continue;
        }
        if (target === 'secondaryLink') {
            const link = String(value ?? '').trim();
            if (link && !isSafeLink(link)) {
                throw httpError(400, 'Secondary link must start with "/" or be a full http(s) URL');
            }
            payload[key] = link;
            continue;
        }
        payload[key] = String(value ?? '').trim().slice(0, 80);
    }

    await SettingsModel.bulkUpsertSettings(payload);
    return getSectionSettings();
};

// ═══════════════════════════════════════════════════════════════════════════════
//  Public read
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Storefront payload: active slides plus section behaviour.
 * Never throws on an empty/absent table — the frontend falls back to its
 * built-in defaults only when this returns zero slides.
 */
export const getHero = async () => {
    const [rows, settings] = await Promise.all([
        HeroModel.getAllSlides({ activeOnly: true }),
        getSectionSettings(),
    ]);

    return {
        slides: rows.map(toSlide),
        settings,
    };
};

// ═══════════════════════════════════════════════════════════════════════════════
//  Admin CRUD
// ═══════════════════════════════════════════════════════════════════════════════

export const getAdminHero = async (roleId) => {
    assertAdmin(roleId);

    const [rows, settings] = await Promise.all([
        HeroModel.getAllSlides(),
        getSectionSettings(),
    ]);

    return {
        slides: rows.map(toSlide),
        settings,
        maxSlides: MAX_SLIDES,
    };
};

export const createSlide = async (payload, roleId) => {
    assertAdmin(roleId);

    const total = await HeroModel.countSlides();
    if (total >= MAX_SLIDES) {
        throw httpError(400, `A maximum of ${MAX_SLIDES} hero slides is allowed`);
    }

    const row = validateSlidePayload(payload);
    const created = await HeroModel.createSlide(row);
    return toSlide(created);
};

export const updateSlide = async (slideId, payload, roleId) => {
    assertAdmin(roleId);

    const id = Number(slideId);
    if (!Number.isInteger(id) || id <= 0) {
        throw httpError(400, 'Invalid slide id');
    }

    const existing = await HeroModel.getSlideById(id);
    if (!existing) {
        throw httpError(404, 'Slide not found');
    }

    const row = validateSlidePayload(payload);
    const updated = await HeroModel.updateSlide(id, row);
    return toSlide(updated);
};

export const setSlideActive = async (slideId, isActive, roleId) => {
    assertAdmin(roleId);

    const id = Number(slideId);
    if (!Number.isInteger(id) || id <= 0) {
        throw httpError(400, 'Invalid slide id');
    }
    if (typeof isActive !== 'boolean') {
        throw httpError(400, 'isActive must be true or false');
    }

    const updated = await HeroModel.setSlideActive(id, isActive);
    if (!updated) {
        throw httpError(404, 'Slide not found');
    }
    return toSlide(updated);
};

export const deleteSlide = async (slideId, roleId) => {
    assertAdmin(roleId);

    const id = Number(slideId);
    if (!Number.isInteger(id) || id <= 0) {
        throw httpError(400, 'Invalid slide id');
    }

    const existing = await HeroModel.getSlideById(id);
    if (!existing) {
        throw httpError(404, 'Slide not found');
    }

    await HeroModel.deleteSlide(id);
    return { id };
};

/**
 * Reorder slides. The payload must list every existing slide exactly once —
 * a partial list would leave duplicate sort_order values behind.
 */
export const reorderSlides = async (orderedIds, roleId) => {
    assertAdmin(roleId);

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
        throw httpError(400, 'orderedIds must be a non-empty array');
    }

    const ids = orderedIds.map((value) => {
        const num = Number(value);
        if (!Number.isInteger(num) || num <= 0) {
            throw httpError(400, `Invalid slide id: ${value}`);
        }
        return num;
    });

    if (new Set(ids).size !== ids.length) {
        throw httpError(400, 'orderedIds contains duplicates');
    }

    const existing = await HeroModel.getAllSlides();
    const existingIds = new Set(existing.map(row => row.slide_id));

    if (ids.length !== existingIds.size || ids.some(id => !existingIds.has(id))) {
        throw httpError(400, 'orderedIds must contain every slide exactly once');
    }

    await HeroModel.reorderSlides(ids);
    return getAdminHero(roleId);
};
