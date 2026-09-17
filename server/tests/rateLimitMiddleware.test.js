import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// The limiters deliberately no-op while vitest is running, so these tests flip
// the environment for their duration to exercise the real behaviour.
const ORIGINAL_VITEST = process.env.VITEST;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

// `status` lets a test simulate rejected credentials (401) vs a real login (200)
const buildApp = (middleware, status = 200) => {
    const app = express();
    app.use(express.json());
    app.post('/login', middleware, (req, res) => res.status(status).json({
        success: status === 200,
    }));
    return app;
};

// vi.resetModules() gives each test a limiter with a fresh in-memory store
const loadLimiters = async () => {
    vi.resetModules();
    return await import('../src/middleware/rateLimitMiddleware.js');
};

afterEach(() => {
    process.env.VITEST = ORIGINAL_VITEST;
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
});

describe('auth rate limiters', () => {
    beforeEach(() => {
        process.env.VITEST = 'false';
        process.env.NODE_ENV = 'development';
    });

    it('blocks after 10 failed login attempts', async () => {
        const { authLimiter } = await loadLimiters();
        const app = buildApp(authLimiter, 401);

        for (let i = 0; i < 10; i++) {
            const res = await request(app).post('/login').send({});
            expect(res.status).toBe(401);
        }

        const blocked = await request(app).post('/login').send({});
        expect(blocked.status).toBe(429);
        expect(blocked.body.success).toBe(false);
        expect(blocked.body.message).toMatch(/too many/i);
    });

    it('does not count successful logins against the budget', async () => {
        const { authLimiter } = await loadLimiters();
        const app = buildApp(authLimiter, 200);

        // Well past the failed-attempt cap of 10 — all should still succeed
        for (let i = 0; i < 15; i++) {
            const res = await request(app).post('/login').send({});
            expect(res.status).toBe(200);
        }
    });

    it('gives refresh a looser budget than login', async () => {
        const { refreshLimiter } = await loadLimiters();
        const app = buildApp(refreshLimiter, 401);

        // 20 failed refreshes: past the login budget of 10, under the refresh budget
        for (let i = 0; i < 20; i++) {
            const res = await request(app).post('/login').send({});
            expect(res.status).toBe(401);
        }
    });

    it('is skipped entirely while tests are running', async () => {
        process.env.VITEST = 'true';
        const { authLimiter } = await loadLimiters();
        const app = buildApp(authLimiter, 401);

        // Far past the login budget — every request should still go through
        for (let i = 0; i < 15; i++) {
            const res = await request(app).post('/login').send({});
            expect(res.status).toBe(401);
        }
    });

    it('is skipped when NODE_ENV=test even without VITEST', async () => {
        process.env.VITEST = 'false';
        process.env.NODE_ENV = 'test';
        const { authLimiter } = await loadLimiters();
        const app = buildApp(authLimiter, 401);

        for (let i = 0; i < 12; i++) {
            const res = await request(app).post('/login').send({});
            expect(res.status).toBe(401);
        }
    });
});
