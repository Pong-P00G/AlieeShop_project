// ═══════════════════════════════════════════════════════════════════════════════
// Endpoint-level Integration Tests
// Uses supertest against the real Express app + real PostgreSQL database.
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as supertest from 'supertest';
const request = supertest.default || supertest;
import app from '../src/main.js';
import { db } from '../src/database/dbpool.js';

// ── Constants ───────────────────────────────────────────────────────────────

const TEST_MARKER = '_endpoint_test_';
const NONEXISTENT_ID = 999999;
const ADMIN_EMAIL = 'superadmin@super.com';
const ADMIN_PASSWORD = 'superadmin@123';

// ── Shared state ────────────────────────────────────────────────────────────

let adminToken;
let regularUserToken;
let testCategoryId;
let testProductId;
let testVariantId;
let testCartItemId;

// ── CSRF helpers ────────────────────────────────────────────────────────────
// The csrfProtection middleware requires the x-csrf-token header to match the
// csrf-token cookie. We obtain the token once in beforeAll.

let csrfToken = null;

async function fetchCsrfToken() {
    const res = await request(app).get('/');
    const cookies = res.headers['set-cookie'] || [];
    const csrfCookie = cookies.find(c => c.startsWith('csrf-token='));
    if (!csrfCookie) {
        // Fail loudly here instead of letting every later state-changing
        // request fail with a confusing 403
        throw new Error('Could not obtain a csrf-token cookie from GET /');
    }
    csrfToken = csrfCookie.split(';')[0].split('=')[1];
}

// csrfProtection is a double-submit check: the x-csrf-token header must match
// the csrf-token cookie. A bare request(app) does not persist cookies between
// calls (no agent), so BOTH have to be sent on every state-changing request.
function withCsrf(req) {
    if (!csrfToken) return req;
    return req
        .set('x-csrf-token', csrfToken)
        .set('Cookie', `csrf-token=${csrfToken}`);
}

// ── Auth request helpers ────────────────────────────────────────────────────
// supertest's request(app) returns a SuperTest instance (not a Test).
// .set() is only available on Test objects returned by .get()/.post() etc.
// These helpers correctly chain: request(app).method(path).set(...)
// State-changing methods include the CSRF token via withCsrf().

function authGet(token) {
    return (path) => request(app).get(path).set('Authorization', `Bearer ${token}`);
}
function authPost(token) {
    return (path) => withCsrf(request(app).post(path).set('Authorization', `Bearer ${token}`));
}
function authPut(token) {
    return (path) => withCsrf(request(app).put(path).set('Authorization', `Bearer ${token}`));
}
function authDelete(token) {
    return (path) => withCsrf(request(app).delete(path).set('Authorization', `Bearer ${token}`));
}

function createAuthRequest(token) {
    return {
        get:    authGet(token),
        post:   authPost(token),
        put:    authPut(token),
        delete: authDelete(token),
    };
}

let adminReq;   // set in beforeAll
let userReq;    // set in beforeAll

async function createTestProduct(categoryId) {
    const res = await adminReq
        .post('/api/products/complete')
        .send({
            product_name: `Endpoint Test Product ${Date.now()}`,
            descriptions: 'Created by endpoint integration test',
            base_price: 49.99,
            category_id: categoryId,
            product_status: 'active',
            tags: [TEST_MARKER, 'test_product'],
            images: [
                { image_url: 'https://example.com/img1.jpg', is_main: true, sort_order: 0 },
            ],
            variants: [
                {
                    sku: `EP-SKU-${Date.now()}`,
                    options: [{ attribute_name: 'Color', value: 'Red' }],
                    stock_quantity: 100,
                    reorder_level: 10,
                },
            ],
        });

    return res;
}

// ── Setup / Teardown ───────────────────────────────────────────────────────

beforeAll(async () => {
    // 0. Fetch CSRF token for state-changing requests
    await fetchCsrfToken();

    // 1. Get admin token via login
    const loginRes = await withCsrf(
        request(app)
            .post('/api/auth/login')
            .send({ identifier: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    );

    adminToken = loginRes.body.token || null;

    if (!adminToken) {
        console.warn('Could not obtain admin token — admin-only tests will fail');
    }

    // Initialize auth request helpers
    adminReq = createAuthRequest(adminToken);
    userReq = createAuthRequest(null); // will be updated when regular user registers

    // 2. Create a test category for product tests
    const catRes = await db.query(
        `INSERT INTO category (categoryname) VALUES ($1) RETURNING categoriesid`,
        [`Endpoint Test Cat ${Date.now()}`]
    );
    testCategoryId = catRes.rows[0].categoriesid;

    // 3. Create a test product for cart/endpoint tests
    const createRes = await createTestProduct(testCategoryId);
    if (createRes.body.success && createRes.body.data?.product_id) {
        testProductId = createRes.body.data.product_id;
        // Grab the first variant ID
        if (createRes.body.data.variants && createRes.body.data.variants.length > 0) {
            testVariantId = createRes.body.data.variants[0].variant_id;
        }
    }
});

afterAll(async () => {
    try {
        // Clean up in FK-safe order
        // 1. Cart items for test users
        await db.query(
            `DELETE FROM cartitems WHERE cartid IN (
                SELECT cartid FROM cart WHERE usersid IN (
                    SELECT usersid FROM users WHERE email LIKE $1
                )
            )`,
            ['endpoint_test_%']
        );
        await db.query(
            'DELETE FROM cart WHERE usersid IN (SELECT usersid FROM users WHERE email LIKE $1)',
            ['endpoint_test_%']
        );

        // 2. Discounts (RESTRICT on products, safe to delete before products)
        await db.query(
            'DELETE FROM discounts WHERE productsid IN (SELECT productsid FROM products WHERE $1 = ANY(tags))',
            [TEST_MARKER]
        );

        // 3. Stock logs (RESTRICT on stock)
        await db.query(
            'DELETE FROM stocklog WHERE stockid IN (SELECT stockid FROM stock WHERE productsid IN (SELECT productsid FROM products WHERE $1 = ANY(tags)))',
            [TEST_MARKER]
        );

        // 4. Stock
        await db.query(
            'DELETE FROM stock WHERE productsid IN (SELECT productsid FROM products WHERE $1 = ANY(tags))',
            [TEST_MARKER]
        );

        // 5. Order items (RESTRICT on variants — must delete before variants)
        await db.query(
            `DELETE FROM orderitems WHERE productsid IN (
                SELECT productsid FROM products WHERE $1 = ANY(tags)
            )`,
            [TEST_MARKER]
        );

        // 6. Payments referencing test orders
        await db.query(
            `DELETE FROM payments WHERE ordersid IN (
                SELECT ordersid FROM orders WHERE usersid IN (
                    SELECT usersid FROM users WHERE email LIKE 'endpoint_test_%'
                )
            )`
        );

        // 7. Orders referencing test users
        await db.query(
            `DELETE FROM orders WHERE usersid IN (
                SELECT usersid FROM users WHERE email LIKE 'endpoint_test_%'
            )`
        );

        // 8. Variant option values
        await db.query(
            'DELETE FROM variantoptionvalue WHERE variantid IN (SELECT variantid FROM variants WHERE productsid IN (SELECT productsid FROM products WHERE $1 = ANY(tags)))',
            [TEST_MARKER]
        );

        // 9. Variants (RESTRICT on products)
        await db.query(
            'DELETE FROM variants WHERE productsid IN (SELECT productsid FROM products WHERE $1 = ANY(tags))',
            [TEST_MARKER]
        );

        // 10. Product images
        await db.query(
            'DELETE FROM productimages WHERE productsid IN (SELECT productsid FROM products WHERE $1 = ANY(tags))',
            [TEST_MARKER]
        );

        // 11. Reviews
        await db.query(
            'DELETE FROM reviews WHERE productsid IN (SELECT productsid FROM products WHERE $1 = ANY(tags))',
            [TEST_MARKER]
        );

        // 12. Wishlist items (RESTRICT / CASCADE on products — be explicit)
        await db.query(
            'DELETE FROM wishlist_items WHERE productsid IN (SELECT productsid FROM products WHERE $1 = ANY(tags))',
            [TEST_MARKER]
        );

        // 13. Products
        await db.query(
            'DELETE FROM products WHERE $1 = ANY(tags)',
            [TEST_MARKER]
        );

        // 12. Test category
        if (testCategoryId) {
            await db.query('DELETE FROM category WHERE categoriesid = $1', [testCategoryId]);
        }

        // 13. Test users created during register/cart tests
        await db.query(
            "DELETE FROM users WHERE email LIKE 'endpoint_test_%'",
            []
        );
    } finally {
        // Don't close the pool — other test files may still need it
        // Pool is managed by the test runner's lifecycle
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1. HEALTH & ROOT
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /health', () => {
    it('returns 200 with status OK', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('OK');
        expect(res.body.message).toContain('Server is running');
    });
});

describe('GET /', () => {
    it('returns 200 with API info', async () => {
        const res = await request(app).get('/');
        expect(res.status).toBe(200);
        expect(res.body.message).toContain('Aliee Shop');
        expect(res.body.endpoints).toBeDefined();
        expect(res.body.endpoints.auth).toBe('/api/auth');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. 404 HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

describe('404 handler', () => {
    it('returns 404 for unknown routes', async () => {
        const res = await request(app).get('/api/nonexistent-route');
        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain('Route not found');
    });

    it('returns 404 for unknown methods on known paths', async () => {
        // PATCH is state-changing, so it must clear the CSRF check to reach routing
        const res = await withCsrf(request(app).patch('/api/products'));
        expect(res.status).toBe(404);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. AUTH ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/auth/login', () => {
    it('logs in with valid email/password and returns token + user', async () => {
        const res = await withCsrf(
            request(app)
                .post('/api/auth/login')
                .send({ identifier: ADMIN_EMAIL, password: ADMIN_PASSWORD })
        );

        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
        expect(res.body.user).toBeDefined();
        expect(res.body.user.email).toBe(ADMIN_EMAIL);
    });

    it('rejects wrong password with 401', async () => {
        const res = await withCsrf(
            request(app)
                .post('/api/auth/login')
                .send({ identifier: ADMIN_EMAIL, password: 'wrongpassword123' })
        );

        expect(res.status).toBe(401);
        expect(res.body.token).toBeUndefined();
    });

    it('rejects missing identifier with 400', async () => {
        const res = await withCsrf(
            request(app)
                .post('/api/auth/login')
                .send({ password: ADMIN_PASSWORD })
        );

        expect(res.status).toBe(400);
    });

    it('rejects missing password with 400', async () => {
        const res = await withCsrf(
            request(app)
                .post('/api/auth/login')
                .send({ identifier: ADMIN_EMAIL })
        );

        expect(res.status).toBe(400);
    });
});

describe('POST /api/auth/register', () => {
    const testEmail = `endpoint_test_register_${Date.now()}@test.com`;

    it('registers a new user and returns token + user', async () => {
        const res = await withCsrf(
            request(app)
                .post('/api/auth/register')
                .send({
                    username: `testuser${Date.now()}`,
                    email: testEmail,
                    password: 'testpass123',
                    first_name: 'Test',
                    last_name: 'User',
                })
        );

        expect(res.status).toBe(201);
        expect(res.body.token).toBeDefined();
        expect(res.body.user).toBeDefined();
        expect(res.body.user.email).toBe(testEmail);
    });

    it('rejects duplicate email with 400', async () => {
        const res = await withCsrf(
            request(app)
                .post('/api/auth/register')
                .send({
                    username: `dupuser${Date.now()}`,
                    email: testEmail,
                    password: 'testpass123',
                    first_name: 'Dup',
                    last_name: 'User',
                })
        );

        expect(res.status).toBe(400);
    });

    it('rejects short password with 400', async () => {
        const res = await withCsrf(
            request(app)
                .post('/api/auth/register')
                .send({
                    username: `shortpass${Date.now()}`,
                    email: `endpoint_test_short_${Date.now()}@test.com`,
                    password: 'short',
                    first_name: 'Short',
                    last_name: 'Pass',
                })
        );

        expect(res.status).toBe(400);
    });

    it('rejects missing required fields with 400', async () => {
        const res = await withCsrf(
            request(app)
                .post('/api/auth/register')
                .send({ email: 'test@test.com' })
        );

        expect(res.status).toBe(400);
    });
});

describe('GET /api/auth/check-username/:username', () => {
    it('returns available:true for unused username', async () => {
        const res = await request(app)
            .get(`/api/auth/check-username/zzz_unique_${Date.now()}`);

        expect(res.status).toBe(200);
        expect(res.body.available).toBe(true);
    });

    it('rejects too-short username with 400', async () => {
        const res = await request(app)
            .get('/api/auth/check-username/ab');

        expect(res.status).toBe(400);
        expect(res.body.available).toBe(false);
    });
});

describe('GET /api/auth/check-email/:email', () => {
    it('returns available:false for registered email', async () => {
        const res = await request(app)
            .get(`/api/auth/check-email/${encodeURIComponent(ADMIN_EMAIL)}`);

        expect(res.status).toBe(200);
        expect(res.body.available).toBe(false);
    });

    it('returns available:true for unused email', async () => {
        const res = await request(app)
            .get(`/api/auth/check-email/nonexistent_${Date.now()}@test.com`);

        expect(res.status).toBe(200);
        expect(res.body.available).toBe(true);
    });
});

describe('GET /api/auth/permissions', () => {
    it('returns permissions for authenticated admin user', async () => {
        const res = await adminReq.get('/api/auth/permissions');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns 401 without token', async () => {
        const res = await request(app).get('/api/auth/permissions');
        expect(res.status).toBe(401);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. PRODUCT ENDPOINTS — PUBLIC
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/products', () => {
    it('returns all products with success:true', async () => {
        const res = await request(app).get('/api/products');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
        if (res.body.data.length > 0) {
            expect(res.body.data[0]).toHaveProperty('product_id');
            expect(res.body.data[0]).toHaveProperty('product_name');
        }
    });
});

describe('GET /api/products/:id', () => {
    it('returns a product by ID', async () => {
        if (!testProductId) return;

        const res = await request(app).get(`/api/products/${testProductId}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.product_id).toBe(testProductId);
        expect(res.body.data.product_name).toContain('Endpoint Test Product');
        expect(res.body.data.images).toBeDefined();
        expect(res.body.data.variants).toBeDefined();
    });

    it('returns 404 for non-existent product', async () => {
        const res = await request(app).get(`/api/products/${NONEXISTENT_ID}`);
        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
    });
});

describe('GET /api/products/paginated', () => {
    it('returns paginated results with correct structure', async () => {
        const res = await request(app)
            .get('/api/products/paginated')
            .query({ page: 1, pageSize: 5 });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('page', 1);
        expect(res.body.data).toHaveProperty('pageSize', 5);
        expect(res.body.data).toHaveProperty('totalItems');
        expect(res.body.data).toHaveProperty('totalPages');
        expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('filters by status', async () => {
        const res = await request(app)
            .get('/api/products/paginated')
            .query({ status: 'active' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        res.body.data.items.forEach(p => {
            expect(p.product_status).toBe('active');
        });
    });

    it('filters by search term', async () => {
        const res = await request(app)
            .get('/api/products/paginated')
            .query({ search: TEST_MARKER });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('handles empty search result gracefully', async () => {
        const res = await request(app)
            .get('/api/products/paginated')
            .query({ search: 'ZZZZ_NonExistent_Search', status: 'archived' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.items).toHaveLength(0);
        expect(res.body.data.totalItems).toBe(0);
    });

    it('sorts by price ascending', async () => {
        const res = await request(app)
            .get('/api/products/paginated')
            .query({ sortField: 'base_price', sortDirection: 'asc', pageSize: 20 });

        expect(res.status).toBe(200);
        const prices = res.body.data.items.map(p => parseFloat(p.base_price));
        for (let i = 1; i < prices.length; i++) {
            expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
        }
    });
});

describe('GET /api/products/search', () => {
    it('searches products by term', async () => {
        const res = await request(app)
            .get('/api/products/search')
            .query({ search: 'Endpoint' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('searches with price range filter', async () => {
        const res = await request(app)
            .get('/api/products/search')
            .query({ minPrice: 10, maxPrice: 100 });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('returns empty array for non-matching search', async () => {
        const res = await request(app)
            .get('/api/products/search')
            .query({ search: 'ZZZZ_NonExistent' });

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(0);
    });
});

// ── Tag-based / Feature endpoints ───────────────────────────────────────────

describe('GET /api/products/featured', () => {
    it('returns featured products with count', async () => {
        const res = await request(app).get('/api/products/featured');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body).toHaveProperty('count');
    });

    it('respects limit query parameter', async () => {
        const res = await request(app).get('/api/products/featured?limit=1');
        expect(res.status).toBe(200);
        expect(res.body.data.length).toBeLessThanOrEqual(1);
    });
});

describe('GET /api/products/new-arrivals', () => {
    it('returns new arrivals', async () => {
        const res = await request(app).get('/api/products/new-arrivals');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
    });
});

describe('GET /api/products/coming-soon', () => {
    it('returns coming soon products', async () => {
        const res = await request(app).get('/api/products/coming-soon');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
    });
});

describe('GET /api/products/best-sellers', () => {
    it('returns best sellers', async () => {
        const res = await request(app).get('/api/products/best-sellers');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
    });
});

describe('GET /api/products/by-tag', () => {
    it('returns products by tag', async () => {
        const res = await request(app)
            .get('/api/products/by-tag')
            .query({ tag: 'test_product', limit: 5 });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns 400 when tag is missing', async () => {
        const res = await request(app).get('/api/products/by-tag');
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain('Tag');
    });
});

describe('GET /api/products/category/:category', () => {
    it('returns products in the test category', async () => {
        const catRes = await db.query(
            'SELECT categoryname FROM category WHERE categoriesid = $1',
            [testCategoryId]
        );
        const catName = catRes.rows[0].categoryname;

        const res = await request(app).get(`/api/products/category/${encodeURIComponent(catName)}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const found = res.body.data.some(p => p.product_id === testProductId);
        expect(found).toBe(true);
    });
});

// ── Categories ──────────────────────────────────────────────────────────────

describe('GET /api/products/categories', () => {
    it('returns all categories', async () => {
        const res = await request(app).get('/api/products/categories');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
});

describe('GET /api/products/categories/:id', () => {
    it('returns category by ID', async () => {
        const res = await request(app).get(`/api/products/categories/${testCategoryId}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.categoriesid || res.body.data.category_id || res.body.data.id)
            .toBe(testCategoryId);
    });

    it('returns 404 for non-existent category', async () => {
        const res = await request(app).get(`/api/products/categories/${NONEXISTENT_ID}`);
        expect(res.status).toBe(404);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. PRODUCT ENDPOINTS — ADMIN (Protected)
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/products — admin', () => {
    it('creates a basic product (admin)', async () => {
        const res = await adminReq
            .post('/api/products')
            .send({
                category_id: testCategoryId,
                product_name: `Admin Created ${TEST_MARKER}`,
                base_price: 19.99,
                descriptions: 'Created via admin endpoint',
                product_status: 'active',
                tags: [TEST_MARKER, 'admin_created'],
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.product_id).toBeGreaterThan(0);
    });

    it('rejects unauthorized requests with 401', async () => {
        const res = await withCsrf(
            request(app)
                .post('/api/products')
                .send({
                    category_id: testCategoryId,
                    product_name: 'Should Not Create',
                    base_price: 10.00,
                    product_status: 'active',
                })
        );

        expect(res.status).toBe(401);
    });
});

describe('PUT /api/products/:id — admin', () => {
    it('updates a product (admin)', async () => {
        if (!testProductId) return;

        const res = await adminReq
            .put(`/api/products/${testProductId}`)
            .send({
                category_id: testCategoryId,
                product_name: `Updated Endpoint Test ${TEST_MARKER}`,
                base_price: 59.99,
                descriptions: 'Updated by endpoint integration test',
                product_status: 'active',
                tags: [TEST_MARKER, 'test_product', 'updated'],
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.product_name).toContain('Updated');
    });

    it('returns 400 for non-existent product (controller returns 400 for all errors)', async () => {
        const res = await adminReq
            .put(`/api/products/${NONEXISTENT_ID}`)
            .send({
                category_id: testCategoryId,
                product_name: 'No Exists',
                base_price: 10.00,
                product_status: 'active',
            });

        // The controller catches all errors as 400, even "Product not found"
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('not found');
    });
});

describe('DELETE /api/products/:id — admin', () => {
    it('deletes a basic product (admin) — product must not have variants (ON DELETE RESTRICT)', async () => {
        // Create a basic product WITHOUT variants, then delete it
        // Products with variants cannot be deleted due to ON DELETE RESTRICT FK
        const createRes = await adminReq
            .post('/api/products')
            .send({
                category_id: testCategoryId,
                product_name: `To Delete ${TEST_MARKER}`,
                base_price: 9.99,
                descriptions: 'Will be deleted by endpoint test',
                product_status: 'active',
                tags: [TEST_MARKER, 'to_delete'],
            });

        if (!createRes.body.success) return;

        const pid = createRes.body.data.product_id;

        const res = await adminReq.delete(`/api/products/${pid}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain('deleted');
    });

    it('returns 404 for non-existent product', async () => {
        const res = await adminReq.delete(`/api/products/${NONEXISTENT_ID}`);
        expect(res.status).toBe(404);
    });

    it('force-deletes a complete product with variants via ?force=true', async () => {
        // Create a complete product with variants (which normally can't be deleted)
        const createRes = await adminReq
            .post('/api/products/complete')
            .send({
                category_id: testCategoryId,
                product_name: `Force Delete Test ${TEST_MARKER}`,
                base_price: 29.99,
                descriptions: 'Will be force-deleted',
                product_status: 'active',
                tags: [TEST_MARKER, 'force_delete_test'],
                images: [
                    { image_url: 'https://example.com/force-delete.jpg', is_main: true, sort_order: 0 },
                ],
                variants: [
                    {
                        sku: `FORCE-EP-${Date.now()}`,
                        options: [{ attribute_name: 'Color', value: 'Blue' }],
                        stock_quantity: 50,
                        reorder_level: 5,
                    },
                ],
            });

        if (!createRes.body.success || !createRes.body.data?.product_id) return;

        const pid = createRes.body.data.product_id;

        // Force delete with ?force=true
        const res = await adminReq.delete(`/api/products/${pid}?force=true`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain('force-deleted');

        // Verify it's actually gone
        const getRes = await request(app).get(`/api/products/${pid}`);
        expect(getRes.status).toBe(404);
    });
});

describe('POST /api/products/complete — admin', () => {
    it('creates a complete product with images, variants, stock', async () => {
        const res = await createTestProduct(testCategoryId);

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.product_id).toBeGreaterThan(0);
        expect(res.body.data.images).toBeDefined();
        expect(res.body.data.images.length).toBeGreaterThanOrEqual(1);
        expect(res.body.data.variants).toBeDefined();
        expect(res.body.data.variants.length).toBeGreaterThanOrEqual(1);
        expect(res.body.data.variants[0].sku).toContain('EP-SKU');
        expect(res.body.data.variants[0].quantity).toBe(100);
    });

    it('rejects with 400 when missing required fields', async () => {
        const res = await adminReq
            .post('/api/products/complete')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });
});

describe('POST /api/products/bulk — admin', () => {
    it('creates multiple products in bulk', async () => {
        const sku1 = `BULK-${Date.now()}-A`;
        const sku2 = `BULK-${Date.now()}-B`;

        const res = await adminReq
            .post('/api/products/bulk')
            .send({
                products: [
                    {
                        category_id: testCategoryId,
                        product_name: `Bulk Product A ${TEST_MARKER}`,
                        base_price: 15.00,
                        product_status: 'active',
                        tags: [TEST_MARKER, 'bulk_test'],
                        variants: [{ sku: sku1, stock_quantity: 20 }],
                    },
                    {
                        category_id: testCategoryId,
                        product_name: `Bulk Product B ${TEST_MARKER}`,
                        base_price: 25.00,
                        product_status: 'active',
                        tags: [TEST_MARKER, 'bulk_test'],
                        variants: [{ sku: sku2, stock_quantity: 30 }],
                    },
                ],
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.created).toBeGreaterThanOrEqual(1);
    });

    it('returns 400 for missing products array', async () => {
        const res = await adminReq
            .post('/api/products/bulk')
            .send({});

        expect(res.status).toBe(400);
    });
});

// ── Product Images via API ──────────────────────────────────────────────────

describe('POST /api/products/:id/images — admin', () => {
    it('adds an image to a product', async () => {
        if (!testProductId) return;

        const res = await adminReq
            .post(`/api/products/${testProductId}/images`)
            .send({
                image_url: 'https://example.com/api-test.jpg',
                is_main: false,
                alt_text: 'API test image',
                sort_order: 5,
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
    });
});

describe('GET /api/products/:id/images', () => {
    it('returns product images', async () => {
        if (!testProductId) return;

        const res = await request(app).get(`/api/products/${testProductId}/images`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
    });
});

// ── Variants via API ────────────────────────────────────────────────────────

describe('POST /api/variants — admin', () => {
    it('creates a variant for a product', async () => {
        if (!testProductId) return;

        const res = await adminReq
            .post('/api/products/variants')
            .send({
                product_id: testProductId,
                sku: `API-VAR-${Date.now()}`,
                variant_color: 'Blue',
                variant_size: 'M',
                initial_stock: 50,
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.variant_id).toBeGreaterThan(0);
        expect(res.body.data.sku).toContain('API-VAR');
    });
});

describe('GET /api/products/:id/variants', () => {
    it('returns variants for a product', async () => {
        if (!testProductId) return;

        const res = await request(app).get(`/api/products/${testProductId}/variants`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
});

// ── Stock via API ───────────────────────────────────────────────────────────

describe('PUT /api/variants/:variantId/stock — admin', () => {
    it('updates variant stock', async () => {
        if (!testProductId || !testVariantId) return;

        const res = await adminReq
            .put(`/api/products/variants/${testVariantId}/stock`)
            .send({ quantity: 200, reorder_level: 20, reason: 'API bulk restock' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.quantity).toBe(200);
    });

    it('rejects negative stock', async () => {
        if (!testVariantId) return;

        const res = await adminReq
            .put(`/api/products/variants/${testVariantId}/stock`)
            .send({ quantity: -5 });

        expect(res.status).toBe(400);
    });
});

describe('POST /api/variants/:variantId/stock/increment — admin', () => {
    it('increments variant stock', async () => {
        if (!testVariantId) return;

        const res = await adminReq
            .post(`/api/products/variants/${testVariantId}/stock/increment`)
            .send({ amount: 15, reason: 'API increment test' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('rejects zero increment', async () => {
        if (!testVariantId) return;

        const res = await adminReq
            .post(`/api/products/variants/${testVariantId}/stock/increment`)
            .send({ amount: 0 });

        expect(res.status).toBe(400);
    });
});

describe('POST /api/variants/:variantId/stock/decrement — admin', () => {
    it('decrements variant stock', async () => {
        if (!testVariantId) return;

        const res = await adminReq
            .post(`/api/products/variants/${testVariantId}/stock/decrement`)
            .send({ amount: 5, reason: 'API decrement test' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('rejects decrement below zero', async () => {
        if (!testVariantId) return;

        const res = await adminReq
            .post(`/api/products/variants/${testVariantId}/stock/decrement`)
            .send({ amount: 999999 });

        expect(res.status).toBe(400);
    });
});

describe('GET /api/products/:id/stock/history — admin', () => {
    it('returns stock change history for a product', async () => {
        if (!testProductId) return;

        const res = await adminReq.get(`/api/products/${testProductId}/stock/history`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBeGreaterThanOrEqual(1);
        expect(res.body.data[0]).toHaveProperty('change_type');
        expect(res.body.data[0]).toHaveProperty('quantity');
    });

    it('returns 401 without auth token', async () => {
        const res = await request(app).get(`/api/products/${testProductId}/stock/history`);
        expect(res.status).toBe(401);
    });
});

describe('GET /api/variants/stock/low — admin', () => {
    it('returns low stock products', async () => {
        const res = await adminReq.get('/api/products/stock/low');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns 401 without auth', async () => {
        const res = await request(app).get('/api/products/stock/low');
        expect(res.status).toBe(401);
    });
});

// ── Discounts via API ───────────────────────────────────────────────────────

describe('POST /api/products/:id/discount — admin', () => {
    it('applies a discount to a product', async () => {
        if (!testProductId) return;

        const res = await adminReq
            .post(`/api/products/${testProductId}/discount`)
            .send({
                discount_amount: 25.00,
                start_date: new Date(Date.now() - 86400000).toISOString(),
                end_date: new Date(Date.now() + 604800000).toISOString(),
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
    });

    it('rejects invalid discount with 400', async () => {
        if (!testProductId) return;

        const res = await adminReq
            .post(`/api/products/${testProductId}/discount`)
            .send({
                discount_amount: -10,
                start_date: new Date().toISOString(),
                end_date: new Date().toISOString(),
            });

        expect(res.status).toBe(400);
    });
});

describe('GET /api/products/:id/discounts', () => {
    it('returns discounts for a product', async () => {
        if (!testProductId) return;

        const res = await request(app).get(`/api/products/${testProductId}/discounts`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
    });
});

describe('GET /api/products/discounts — admin', () => {
    it('returns all discounts across products', async () => {
        const res = await adminReq.get('/api/products/discounts');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
        if (res.body.data.length > 0) {
            expect(res.body.data[0]).toHaveProperty('product_name');
        }
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. CART ENDPOINTS — USER (Protected)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Cart endpoints — require auth', () => {
    beforeAll(async () => {
        if (!regularUserToken) {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    username: `cartuser${Date.now()}`,
                    email: `endpoint_test_cart_${Date.now()}@test.com`,
                    password: 'cartpass123',
                    first_name: 'Cart',
                    last_name: 'Test',
                });

            if (res.status === 201) {
                regularUserToken = res.body.token;
                userReq = createAuthRequest(regularUserToken);
            }
        }
    });

    it('GET /api/cart returns empty cart for new user (or creates one)', async () => {
        if (!regularUserToken) return;

        const res = await userReq.get('/api/cart');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('GET /api/cart returns 401 without token', async () => {
        const res = await request(app).get('/api/cart');
        expect(res.status).toBe(401);
    });

    it('POST /api/cart/items adds an item to cart', async () => {
        if (!regularUserToken || !testProductId) return;

        const res = await userReq
            .post('/api/cart/items')
            .send({
                product_id: testProductId,
                variant_id: testVariantId,
                quantity: 2,
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        if (res.body.data && res.body.data.cart_item_id) {
            testCartItemId = res.body.data.cart_item_id;
        }
    });

    it('POST /api/cart/items adds same product+variant and increases quantity', async () => {
        if (!regularUserToken || !testProductId) return;

        const res = await userReq
            .post('/api/cart/items')
            .send({
                product_id: testProductId,
                variant_id: testVariantId,
                quantity: 3,
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
    });

    it('PUT /api/cart/items/:cartItemId updates cart item quantity', async () => {
        if (!regularUserToken || !testCartItemId) return;

        const res = await userReq
            .put(`/api/cart/items/${testCartItemId}`)
            .send({ quantity: 5 });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('DELETE /api/cart/items/:cartItemId removes cart item', async () => {
        if (!regularUserToken || !testCartItemId) return;

        const res = await userReq.delete(`/api/cart/items/${testCartItemId}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('DELETE /api/cart clears the cart', async () => {
        if (!regularUserToken) return;

        const res = await userReq.delete('/api/cart');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. AUTHENTICATION & AUTHORIZATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Protected route behavior', () => {
    it('returns 401 for routes requiring auth without a token', async () => {
        const endpoints = [
            { method: 'get', path: '/api/cart' },
            { method: 'post', path: '/api/products' },
            { method: 'put', path: `/api/products/${testProductId || 1}` },
            { method: 'delete', path: `/api/products/${testProductId || 1}` },
            { method: 'post', path: '/api/cart/items' },
            { method: 'get', path: '/api/auth/permissions' },
        ];

        for (const ep of endpoints) {
            let res;
            switch (ep.method) {
                case 'get':    res = await request(app).get(ep.path); break;
            case 'post':   res = await withCsrf(request(app).post(ep.path)); break;
            case 'put':    res = await withCsrf(request(app).put(ep.path)); break;
            case 'delete': res = await withCsrf(request(app).delete(ep.path)); break;
            }
            expect(res.status).toBe(401);
        }
    });

    it('returns 401 with invalid token', async () => {
        const res = await request(app)
            .get('/api/cart')
            .set('Authorization', 'Bearer invalid_token_here');

        expect(res.status).toBe(401);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. VALIDATION ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

describe('Validation error responses', () => {
    it('returns structured error on empty product fields', async () => {
        const res = await adminReq
            .post('/api/products')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.message || res.body.errors).toBeTruthy();
    });

    it('returns 400 for invalid pagination params', async () => {
        const res = await request(app)
            .get('/api/products/paginated')
            .query({ page: -1, pageSize: 'abc' });

        expect(res.status).toBe(400);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. ORDER ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/orders — create order from cart', () => {
    // Ensure cart has items before creating order
    beforeAll(async () => {
        if (!regularUserToken) {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    username: `orderuser${Date.now()}`,
                    email: `endpoint_test_order_${Date.now()}@test.com`,
                    password: 'orderpass123',
                    first_name: 'Order',
                    last_name: 'Test',
                });

            if (res.status === 201) {
                regularUserToken = res.body.token;
                userReq = createAuthRequest(regularUserToken);
            }
        }

        // Add item to cart before creating order
        if (regularUserToken && testProductId && testVariantId) {
            const cartRes = await userReq
                .post('/api/cart/items')
                .send({
                    product_id: testProductId,
                    variant_id: testVariantId,
                    quantity: 1,
                });
            if (cartRes.body.success && cartRes.body.data && cartRes.body.data.cart_item_id) {
                testCartItemId = cartRes.body.data.cart_item_id;
            }
        }
    });

    it('creates an order from cart items', async () => {
        if (!regularUserToken) return;

        const res = await userReq.post('/api/orders');
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('orderId');
        expect(res.body.data.status).toBe('pending');
        expect(res.body.data.items).toBeDefined();
        expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    });

    it('returns 401 without auth token', async () => {
        const res = await withCsrf(request(app).post('/api/orders'));
        expect(res.status).toBe(401);
    });

    it('returns 400 when cart is empty', async () => {
        // Register a fresh user with empty cart
        const registerRes = await request(app)
            .post('/api/auth/register')
            .send({
                username: `emptyuser${Date.now()}`,
                email: `endpoint_test_empty_${Date.now()}@test.com`,
                password: 'emptypass123',
                first_name: 'Empty',
                last_name: 'Cart',
            });

        if (registerRes.status !== 201) return;
        const emptyUserReq = createAuthRequest(registerRes.body.token);

        const res = await emptyUserReq.post('/api/orders');
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('empty');
    });
});

describe('GET /api/orders — list orders', () => {
    it('returns orders for authenticated user', async () => {
        if (!regularUserToken) return;

        const res = await userReq.get('/api/orders');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
        if (res.body.data.length > 0) {
            expect(res.body.data[0]).toHaveProperty('orderId');
            expect(res.body.data[0]).toHaveProperty('status');
        }
    });

    it('returns 401 without token', async () => {
        const res = await request(app).get('/api/orders');
        expect(res.status).toBe(401);
    });
});

describe('GET /api/orders/:id — get order detail', () => {
    let orderId;

    beforeAll(async () => {
        // Create a fresh order to get a known ID
        if (regularUserToken && testProductId && testVariantId) {
            // Ensure cart has items
            await userReq.post('/api/cart/items').send({
                product_id: testProductId,
                variant_id: testVariantId,
                quantity: 1,
            });
            const orderRes = await userReq.post('/api/orders');
            if (orderRes.body.success) {
                orderId = orderRes.body.data.orderId;
            }
        }
    });

    it('returns order detail with items', async () => {
        if (!regularUserToken || !orderId) return;

        const res = await userReq.get(`/api/orders/${orderId}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.orderId).toBe(orderId);
        expect(res.body.data.items).toBeDefined();
        expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
        expect(res.body.data.items[0]).toHaveProperty('productName');
        expect(res.body.data.items[0]).toHaveProperty('unitPrice');
    });

    it('returns 404 for non-existent order', async () => {
        if (!regularUserToken) return;

        const res = await userReq.get(`/api/orders/${NONEXISTENT_ID}`);
        expect(res.status).toBe(404);
    });

    it('returns 401 without token', async () => {
        const res = await request(app).get(`/api/orders/${orderId || 1}`);
        expect(res.status).toBe(401);
    });
});

describe('PUT /api/orders/:id/status — admin', () => {
    let orderId;

    beforeAll(async () => {
        if (regularUserToken && testProductId && testVariantId) {
            await userReq.post('/api/cart/items').send({
                product_id: testProductId,
                variant_id: testVariantId,
                quantity: 1,
            });
            const orderRes = await userReq.post('/api/orders');
            if (orderRes.body.success) {
                orderId = orderRes.body.data.orderId;
            }
        }
    });

    it('updates order status to confirmed', async () => {
        if (!orderId) return;

        const res = await adminReq.put(`/api/orders/${orderId}/status`).send({ status: 'confirmed' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe('confirmed');
    });

    it('updates order status to shipped', async () => {
        if (!orderId) return;

        const res = await adminReq.put(`/api/orders/${orderId}/status`).send({ status: 'shipped' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe('shipped');
    });

    it('updates order status to delivered', async () => {
        if (!orderId) return;

        const res = await adminReq.put(`/api/orders/${orderId}/status`).send({ status: 'delivered' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe('delivered');
    });

    it('returns 400 for invalid status', async () => {
        if (!orderId) return;

        const res = await adminReq.put(`/api/orders/${orderId}/status`).send({ status: 'invalid_status' });
        expect(res.status).toBe(400);
    });

    it('returns 403 for non-admin user', async () => {
        if (!orderId || !regularUserToken) return;

        const res = await userReq.put(`/api/orders/${orderId}/status`).send({ status: 'confirmed' });
        expect(res.status).toBe(403);
    });

    it('returns 401 without token', async () => {
        const res = await withCsrf(request(app).put(`/api/orders/${orderId || 1}/status`).send({ status: 'confirmed' }));
        expect(res.status).toBe(401);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. PAYMENT ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/payments/methods', () => {
    it('returns payment methods', async () => {
        if (!regularUserToken) return;

        const res = await userReq.get('/api/payments/methods');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns 401 without token', async () => {
        const res = await request(app).get('/api/payments/methods');
        expect(res.status).toBe(401);
    });
});

describe('POST /api/payments/orders/:id/pay — record payment', () => {
    let orderId;
    let paymentMethodId;

    beforeAll(async () => {
        // Create a non-COD payment method for testing (COD has a fee that changes expected total)
        const pmRes = await adminReq.post('/api/payments/methods').send({
            method_name: `Bank Transfer ${Date.now()}`,
            description: 'Test payment method',
            is_active: true,
        });
        if (pmRes.body.success) {
            paymentMethodId = pmRes.body.data.methodId;
        } else {
            // Fallback: try creating via direct SQL
            const { rows } = await db.query(
                `INSERT INTO paymentmethod (methodname, description, isactive, fee)
                 VALUES ($1, $2, TRUE, 0.00) RETURNING methodsid`,
                [`Test Card ${Date.now()}`, 'Test payment method via SQL']
            );
            paymentMethodId = rows[0].methodsid;
        }

        if (regularUserToken && testProductId && testVariantId) {
            await userReq.post('/api/cart/items').send({
                product_id: testProductId,
                variant_id: testVariantId,
                quantity: 1,
            });
            const orderRes = await userReq.post('/api/orders');
            if (orderRes.body.success) {
                orderId = orderRes.body.data.orderId;
            }
        }
    });

    it('records a payment for an order', async () => {
        if (!regularUserToken || !orderId || !paymentMethodId) return;

        // Use the order's actual total amount (may have changed due to previous tests)
        const orderDetail = await userReq.get(`/api/orders/${orderId}`);
        const orderTotal = orderDetail.body?.data?.totalAmount || 49.99;

        const res = await userReq
            .post(`/api/orders/${orderId}/pay`)
            .send({
                method_id: paymentMethodId,
                amount: Number(orderTotal),
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe('paid');
    });

    it('returns 401 without token', async () => {
        if (!orderId) return;

        const res = await withCsrf(request(app).post(`/api/orders/${orderId}/pay`).send({ method_id: 1, amount: 10 }));
        expect(res.status).toBe(401);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. PRODUCT-LEVEL STOCK ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Product-level stock endpoints', () => {
    it('GET /api/products/:id/stock returns product stock', async () => {
        if (!testProductId) return;

        const res = await request(app).get(`/api/products/${testProductId}/stock`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('PUT /api/products/:id/stock — admin upserts product-level stock', async () => {
        if (!testProductId) return;

        const res = await adminReq
            .put(`/api/products/${testProductId}/stock`)
            .send({ quantity: 300, reorder_level: 50, reason: 'Endpoint test stock' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.quantity).toBe(300);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. BULK STOCK UPDATE
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/products/stock/bulk-update — admin', () => {
    it('bulk updates stock for multiple products', async () => {
        if (!testProductId) return;

        const res = await adminReq
            .post('/api/products/stock/bulk-update')
            .send({
                updates: [
                    { product_id: testProductId, quantity: 500, reorder_level: 25, reason: 'Bulk endpoint test' },
                ],
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.updated).toBeGreaterThanOrEqual(1);
    });

    it('returns 400 for empty updates array', async () => {
        const res = await adminReq
            .post('/api/products/stock/bulk-update')
            .send({ updates: [] });

        expect(res.status).toBe(400);
    });
});
