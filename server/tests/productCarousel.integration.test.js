// ═══════════════════════════════════════════════════════════════════════════════
// Product carousel endpoint Integration Tests
// supertest against the real Express app + real PostgreSQL database.
//
// Covers all three routes:
//   GET  /api/product-carousel          (public)
//   GET  /api/product-carousel/admin    (admin)
//   PUT  /api/product-carousel/settings (admin)
//
// The suite provisions its own accounts instead of relying on a seeded
// superadmin: a customer is registered through the API, and an admin is made by
// promoting a second registration and logging in again (the role travels inside
// the JWT). Setup throws — rather than skipping — when an account cannot be
// created, so the suite can never pass without exercising the admin routes.
//
// It writes real rows into store_settings, so it snapshots the
// product_carousel_* keys up front and restores them in afterAll.
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as supertest from 'supertest';
const request = supertest.default || supertest;
import app from '../src/main.js';
import { db } from '../src/database/dbpool.js';
import { MAX_TABS, MAX_CUSTOM_TABS } from '../src/services/productCarouselService.js';

// ── Constants ───────────────────────────────────────────────────────────────

const SETTING_PREFIX = 'product_carousel_';
const TEST_EMAIL_LIKE = 'product_carousel_test_%';
const TEST_PASSWORD = 'carouselpass123';

const DEFAULT_TAB_KEYS = ['featured', 'new-arrivals', 'best-sellers', 'coming-soon'];

// ── Shared state ────────────────────────────────────────────────────────────

let adminToken = null;
let customerToken = null;
let storedSettings = [];   // product_carousel_* rows as they were before the suite

// ── CSRF helpers ────────────────────────────────────────────────────────────
// csrfProtection is a double-submit check: the x-csrf-token header must match
// the csrf-token cookie. A bare request(app) does not persist cookies between
// calls (no agent), so BOTH have to be sent on every state-changing request.

let csrfToken = null;

async function fetchCsrfToken() {
    const res = await request(app).get('/');
    const cookies = res.headers['set-cookie'] || [];
    const csrfCookie = cookies.find(c => c.startsWith('csrf-token='));
    if (!csrfCookie) {
        throw new Error('Could not obtain a csrf-token cookie from GET /');
    }
    csrfToken = csrfCookie.split(';')[0].split('=')[1];
}

function withCsrf(req) {
    if (!csrfToken) return req;
    return req
        .set('x-csrf-token', csrfToken)
        .set('Cookie', `csrf-token=${csrfToken}`);
}

const authGet = (token) => (path) => request(app).get(path).set('Authorization', `Bearer ${token}`);
const authPut = (token) => (path) => withCsrf(request(app).put(path).set('Authorization', `Bearer ${token}`));

// ── Account helpers ─────────────────────────────────────────────────────────

const registerAccount = async (label) => {
    const email = `product_carousel_test_${label}_${Date.now()}@test.com`;
    const res = await withCsrf(
        request(app).post('/api/auth/register').send({
            username: `pc${label}${Date.now()}`,
            email,
            password: TEST_PASSWORD,
            first_name: 'Carousel',
            last_name: 'Test',
        })
    );

    if (res.status !== 201 || !res.body?.token) {
        throw new Error(`Could not register the ${label} test account (status ${res.status}): ${res.body?.message || 'no token returned'}`);
    }

    return { email, token: res.body.token };
};

// ── Setup / Teardown ────────────────────────────────────────────────────────

beforeAll(async () => {
    await fetchCsrfToken();

    // Snapshot whatever the running store has configured for the carousel.
    const { rows } = await db.query(
        `SELECT setting_key, setting_value FROM store_settings WHERE setting_key LIKE $1`,
        [`${SETTING_PREFIX}%`]
    );
    storedSettings = rows;

    // A signed-in customer, used to prove the admin routes are actually gated.
    const customer = await registerAccount('customer');
    customerToken = customer.token;

    // Promote a second account to an admin role, then log in again so the
    // issued JWT carries that role.
    const candidate = await registerAccount('admin');
    const { rows: roleRows } = await db.query(
        `SELECT rolesid FROM roles WHERE rolesid <= 2 ORDER BY rolesid LIMIT 1`
    );
    const adminRoleId = roleRows[0]?.rolesid ?? 1;
    await db.query(`UPDATE users SET rolesid = $1 WHERE email = $2`, [adminRoleId, candidate.email]);

    const loginRes = await withCsrf(
        request(app).post('/api/auth/login').send({ identifier: candidate.email, password: TEST_PASSWORD })
    );
    adminToken = loginRes.body?.token || null;

    if (!adminToken) {
        throw new Error(`Could not log in as the promoted test admin (status ${loginRes.status}): ${loginRes.body?.message || 'no token returned'}`);
    }
});

afterAll(async () => {
    // Put the store back the way it was: drop whatever the suite wrote, then
    // re-insert the snapshot.
    await db.query(`DELETE FROM store_settings WHERE setting_key LIKE $1`, [`${SETTING_PREFIX}%`]);

    for (const row of storedSettings) {
        await db.query(
            `INSERT INTO store_settings (setting_key, setting_value) VALUES ($1, $2)
             ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
            [row.setting_key, row.setting_value]
        );
    }

    // Remove the provisioned accounts (refresh tokens and notifications cascade).
    try {
        await db.query(
            `DELETE FROM cart WHERE usersid IN (SELECT usersid FROM users WHERE email LIKE $1)`,
            [TEST_EMAIL_LIKE]
        );
        await db.query(`DELETE FROM users WHERE email LIKE $1`, [TEST_EMAIL_LIKE]);
    } catch (error) {
        console.warn('Could not remove the integration test accounts:', error.message);
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/product-carousel — public
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/product-carousel — public storefront config', () => {
    it('answers without authentication', async () => {
        const res = await request(app).get('/api/product-carousel');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('returns the section settings with the documented shape', async () => {
        const res = await request(app).get('/api/product-carousel');
        const settings = res.body.data.settings;

        expect(Object.keys(settings).sort()).toEqual([
            'autoplayEnabled',
            'autoplayInterval',
            'eyebrow',
            'sectionEnabled',
            'title',
            'viewAllLabel',
            'viewAllLink',
        ]);
        expect(typeof settings.sectionEnabled).toBe('boolean');
        expect(typeof settings.autoplayEnabled).toBe('boolean');
        expect(typeof settings.eyebrow).toBe('string');
        expect(typeof settings.title).toBe('string');
        expect(typeof settings.viewAllLink).toBe('string');
    });

    it('keeps the tabs out of the settings object (mirrors /api/hero)', async () => {
        const res = await request(app).get('/api/product-carousel');

        expect(res.body.data.settings).not.toHaveProperty('tabs');
        expect(Array.isArray(res.body.data.tabs)).toBe(true);
    });

    it('returns every tab, in order, with typed fields', async () => {
        const res = await request(app).get('/api/product-carousel');
        const tabs = res.body.data.tabs;

        expect(tabs).toHaveLength(DEFAULT_TAB_KEYS.length);

        for (const tab of tabs) {
            expect(DEFAULT_TAB_KEYS).toContain(tab.key);
            expect(typeof tab.label).toBe('string');
            expect(typeof tab.title).toBe('string');
            expect(Number.isInteger(tab.productsPerTab)).toBe(true);
            expect(tab.isActive).toBe(true); // the public payload only carries visible tabs
        }

        expect(new Set(tabs.map(tab => tab.key)).size).toBe(tabs.length);
    });

    it('clamps the autoplay interval into the 2–60s window', async () => {
        const res = await request(app).get('/api/product-carousel');

        expect(res.body.data.settings.autoplayInterval).toBeGreaterThanOrEqual(2000);
        expect(res.body.data.settings.autoplayInterval).toBeLessThanOrEqual(60000);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/product-carousel/admin — admin only
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/product-carousel/admin — admin only', () => {
    it('rejects anonymous requests', async () => {
        const res = await request(app).get('/api/product-carousel/admin');

        expect(res.status).toBe(401);
    });

    it('rejects a signed-in non-admin', async () => {
        const res = await authGet(customerToken)('/api/product-carousel/admin');

        expect(res.status).toBe(403);
    });

    it('returns the full tab list plus the editable limits for an admin', async () => {
        const res = await authGet(adminToken)('/api/product-carousel/admin');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.tabs).toHaveLength(DEFAULT_TAB_KEYS.length);
        expect(res.body.data.tabKeys).toEqual(DEFAULT_TAB_KEYS);
        expect(res.body.data.maxTabs).toBe(MAX_TABS);
        expect(res.body.data.maxCustomTabs).toBe(MAX_CUSTOM_TABS);
        expect(res.body.data.maxProductsPerTab).toBe(24);
        expect(res.body.data.minProductsPerTab).toBe(1);
        expect(res.body.data.settings).not.toHaveProperty('tabs');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUT /api/product-carousel/settings — admin only
// ═══════════════════════════════════════════════════════════════════════════════

describe('PUT /api/product-carousel/settings — authorisation', () => {
    it('rejects anonymous requests', async () => {
        const res = await withCsrf(request(app).put('/api/product-carousel/settings'))
            .send({ product_carousel_title: 'Nope' });

        expect(res.status).toBe(401);
    });

    it('rejects a signed-in non-admin', async () => {
        const res = await authPut(customerToken)('/api/product-carousel/settings')
            .send({ product_carousel_title: 'Nope' });

        expect(res.status).toBe(403);
    });
});

describe('PUT /api/product-carousel/settings — validation', () => {
    const put = (body) => withCsrf(request(app).put('/api/product-carousel/settings'))
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body);

    it('rejects an empty payload', async () => {
        const res = await put({});

        expect(res.status).toBe(400);
    });

    it('rejects settings the carousel does not own', async () => {
        const res = await put({ tax_rate: '99' });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('rejects an autoplay interval outside the allowed range', async () => {
        const res = await put({ product_carousel_autoplay_interval: 100 });

        expect(res.status).toBe(400);
    });

    it('rejects an unsafe View-all link', async () => {
        const res = await put({ product_carousel_view_all_link: 'javascript:alert(1)' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/must start with/);
    });

    it('rejects a tab key that is not a slug', async () => {
        const res = await put({ product_carousel_tabs: [{ key: 'Weekly Deals' }] });

        expect(res.status).toBe(400);
    });

    it('accepts an admin-created custom tab', async () => {
        const res = await put({
            product_carousel_tabs: [
                { key: 'weekly-deals', label: 'Deals', title: 'Weekly deals', productsPerTab: 6, isActive: true },
            ],
        });

        expect(res.status).toBe(200);
    });

    it('rejects duplicate tabs', async () => {
        const res = await put({
            product_carousel_tabs: [{ key: 'featured' }, { key: 'featured' }],
        });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/duplicate/);
    });

    it('leaves the stored config untouched when a payload is rejected', async () => {
        const readTitle = async () => {
            const { rows } = await db.query(
                `SELECT setting_value FROM store_settings WHERE setting_key = 'product_carousel_title'`
            );
            return rows[0]?.setting_value ?? null;
        };

        const before = await readTitle();

        // A valid title next to an invalid interval: the whole payload is rejected.
        const res = await put({
            product_carousel_title: 'Rejected Title',
            product_carousel_autoplay_interval: 100,
        });

        expect(res.status).toBe(400);
        expect(await readTitle()).toBe(before);
    });
});

// Two real product ids, used to verify that hand-picked ordering survives the
// round trip. Resolved once, in the setup below.
const handPicked = { productIds: null };

describe('PUT /api/product-carousel/settings — persistence', () => {
    beforeAll(async () => {
        const { rows } = await db.query(
            `SELECT productsid FROM products WHERE status = 'active' ORDER BY productsid LIMIT 2`
        );
        if (rows.length < 2) {
            throw new Error('This suite needs at least two active products to verify picked ordering');
        }
        handPicked.productIds = rows.map(row => row.productsid);
    });

    const put = (body) => withCsrf(request(app).put('/api/product-carousel/settings'))
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body);

    it('stores a valid payload and serves it back through the public endpoint', async () => {
        const payload = {
            product_carousel_section_enabled: true,
            product_carousel_eyebrow: 'IT Eyebrow',
            product_carousel_title: 'Integration Test Carousel',
            product_carousel_view_all_label: 'See all',
            product_carousel_view_all_link: '/product?sort=new',
            product_carousel_autoplay_enabled: false,
            product_carousel_autoplay_interval: 9000,
            product_carousel_tabs: [
                { key: 'best-sellers', label: 'Hot right now', title: 'Best Sellers', productsPerTab: 4, isActive: true },
                { key: 'new-arrivals', label: 'Just landed', title: 'New Arrivals', productsPerTab: 6, isActive: true },
                { key: 'coming-soon', label: 'Coming up', title: 'Coming Soon', productsPerTab: 8, isActive: true },
                { key: 'featured', label: 'Hand-picked', title: 'Featured this week', productsPerTab: 8, isActive: false },
            ],
        };

        const putRes = await put(payload);

        expect(putRes.status).toBe(200);
        expect(putRes.body.success).toBe(true);

        const publicRes = await request(app).get('/api/product-carousel');
        expect(publicRes.body.data.settings).toMatchObject({
            sectionEnabled: true,
            eyebrow: 'IT Eyebrow',
            title: 'Integration Test Carousel',
            viewAllLabel: 'See all',
            viewAllLink: '/product?sort=new',
            autoplayEnabled: false,
            autoplayInterval: 9000,
        });

        // The hidden tab must not reach the storefront, and order must survive.
        expect(publicRes.body.data.tabs.map(tab => tab.key))
            .toEqual(['best-sellers', 'new-arrivals', 'coming-soon']);
        expect(publicRes.body.data.tabs[0]).toMatchObject({
            label: 'Hot right now',
            productsPerTab: 4,
        });
    });

    it('writes the values through to store_settings', async () => {
        const { rows } = await db.query(
            `SELECT setting_key, setting_value FROM store_settings WHERE setting_key LIKE $1 ORDER BY setting_key`,
            [`${SETTING_PREFIX}%`]
        );
        const byKey = Object.fromEntries(rows.map(row => [row.setting_key, row.setting_value]));

        expect(byKey.product_carousel_title).toBe('Integration Test Carousel');
        expect(byKey.product_carousel_autoplay_interval).toBe('9000');
        expect(byKey.product_carousel_autoplay_enabled).toBe('false');

        const storedTabs = JSON.parse(byKey.product_carousel_tabs);
        expect(storedTabs.map(tab => tab.key))
            .toEqual(['best-sellers', 'new-arrivals', 'coming-soon', 'featured']);
        expect(storedTabs.find(tab => tab.key === 'featured').isActive).toBe(false);
    });

    it('keeps the hidden tab visible to the admin endpoint', async () => {
        const res = await authGet(adminToken)('/api/product-carousel/admin');
        const featured = res.body.data.tabs.find(tab => tab.key === 'featured');

        expect(res.body.data.tabs).toHaveLength(DEFAULT_TAB_KEYS.length);
        expect(featured.isActive).toBe(false);
    });

    it('re-appends a tab omitted from the payload instead of dropping it', async () => {
        const res = await put({ product_carousel_tabs: [
            { key: 'best-sellers', label: 'Hot right now', title: 'Best Sellers', productsPerTab: 24, isActive: true },
            { key: 'new-arrivals', label: 'Just landed', title: 'New Arrivals', productsPerTab: 6, isActive: true },
            { key: 'coming-soon', label: 'Coming up', title: 'Coming Soon', productsPerTab: 8, isActive: true },
        ] });

        expect(res.status).toBe(200);

        const publicRes = await request(app).get('/api/product-carousel');
        // Section settings are untouched by a tab-only payload.
        expect(publicRes.body.data.settings.title).toBe('Integration Test Carousel');
        expect(publicRes.body.data.tabs[0].productsPerTab).toBe(24);
        expect(publicRes.body.data.tabs.map(tab => tab.key))
            .toEqual(['best-sellers', 'new-arrivals', 'coming-soon', 'featured']);
    });

    it('honours a deliberately blank heading instead of restoring the default', async () => {
        const res = await put({ product_carousel_eyebrow: '', product_carousel_title: '' });

        expect(res.status).toBe(200);

        const publicRes = await request(app).get('/api/product-carousel');
        expect(publicRes.body.data.settings.eyebrow).toBe('');
        expect(publicRes.body.data.settings.title).toBe('');
    });

    it('serves a tab’s picked products in the chosen order', async () => {
        if (!handPicked.productIds) return;

        const [first, second] = handPicked.productIds;
        await put({ product_carousel_tabs: [
            { key: 'featured', label: 'Staff picks', title: 'Picked by us', productsPerTab: 8, isActive: true, productIds: [second, first] },
        ] });

        const publicRes = await request(app).get('/api/product-carousel');
        const featured = publicRes.body.data.tabs.find(tab => tab.key === 'featured');

        expect(featured.productIds).toEqual([second, first]);
        expect(featured.products.map(product => product.product_id)).toEqual([second, first]);
        expect(featured.products[0]).toHaveProperty('product_name');
        expect(featured.products[0]).toHaveProperty('thumbnail');
    });

    it('round-trips an admin-created custom tab to the storefront', async () => {
        const picks = handPicked.productIds ? [handPicked.productIds[0]] : [];

        const res = await put({ product_carousel_tabs: [
            { key: 'weekly-deals', label: 'Deals', title: 'Weekly deals', productsPerTab: 6, isActive: true, productIds: picks },
        ] });

        expect(res.status).toBe(200);

        const publicRes = await request(app).get('/api/product-carousel');
        const custom = publicRes.body.data.tabs.find(tab => tab.key === 'weekly-deals');

        expect(custom).toMatchObject({ label: 'Deals', productsPerTab: 6, isCustom: true });
        expect(custom.products.map(product => product.product_id)).toEqual(picks);
        // The built-ins are re-appended after the custom tab, never dropped.
        expect(publicRes.body.data.tabs.map(tab => tab.key))
            .toEqual(['weekly-deals', ...DEFAULT_TAB_KEYS]);
    });

    it('removes a custom tab that is omitted from the payload, while keeping the built-ins', async () => {
        const res = await put({ product_carousel_tabs: [{ key: 'featured' }] });

        expect(res.status).toBe(200);

        const publicRes = await request(app).get('/api/product-carousel');
        expect(publicRes.body.data.tabs.map(tab => tab.key)).toEqual(DEFAULT_TAB_KEYS);
    });

    it('leaves a tab with no picks empty, so the storefront runs its automatic query', async () => {
        await put({ product_carousel_tabs: [
            { key: 'featured', label: 'Hand-picked', title: 'Featured this week', productsPerTab: 8, isActive: true, productIds: [] },
        ] });

        const publicRes = await request(app).get('/api/product-carousel');
        const featured = publicRes.body.data.tabs.find(tab => tab.key === 'featured');

        expect(featured.productIds).toEqual([]);
        expect(featured.products).toEqual([]);
    });

    it('skips a pick whose product no longer exists', async () => {
        if (!handPicked.productIds) return;

        const [first] = handPicked.productIds;
        await put({ product_carousel_tabs: [
            { key: 'featured', label: 'Staff picks', title: 'Picked by us', productsPerTab: 8, isActive: true, productIds: [first, 999999] },
        ] });

        const publicRes = await request(app).get('/api/product-carousel');
        const featured = publicRes.body.data.tabs.find(tab => tab.key === 'featured');

        // Only the product that still exists is rendered; the dangling id is
        // dropped on the next save because the admin sends back what it resolved.
        expect(featured.products.map(product => product.product_id)).toEqual([first]);
    });

    it('rejects a non-positive product id', async () => {
        const res = await put({
            product_carousel_tabs: [{ key: 'featured', productIds: [0] }],
        });

        expect(res.status).toBe(400);
    });

    it('falls back to the built-in defaults when nothing is configured', async () => {
        await db.query(`DELETE FROM store_settings WHERE setting_key LIKE $1`, [`${SETTING_PREFIX}%`]);

        const res = await request(app).get('/api/product-carousel');

        expect(res.status).toBe(200);
        expect(res.body.data.settings).toMatchObject({
            sectionEnabled: true,
            eyebrow: 'Discover',
            title: 'Curated Collections',
            viewAllLabel: 'View all',
            viewAllLink: '/product',
            autoplayEnabled: true,
            autoplayInterval: 4000,
        });
        expect(res.body.data.tabs.map(tab => tab.key)).toEqual(DEFAULT_TAB_KEYS);
    });
});
