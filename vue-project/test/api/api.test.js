import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Minimal axios double ──────────────────────────────────────────────────────
// api.js builds one instance with interceptors and calls it again to replay a
// request. We capture the registered handlers so they can be driven directly.
const requestHandlers = [];
const responseHandlers = [];
const postMock = vi.fn();
const replayMock = vi.fn();

vi.mock('axios', () => ({
    default: {
        create: () => {
            const instance = (config) => replayMock(config);
            instance.interceptors = {
                request: { use: (fn) => requestHandlers.push(fn) },
                response: { use: (onFulfilled, onRejected) => responseHandlers.push({ onFulfilled, onRejected }) },
            };
            instance.post = postMock;
            return instance;
        },
    },
}));

const { default: api } = await import('../../src/api/api.js');

const responseError = responseHandlers[0].onRejected;

const unauthorized = (config) => Object.assign(new Error('Unauthorized'), {
    response: { status: 401 },
    config,
});

beforeEach(() => {
    postMock.mockReset();
    replayMock.mockReset();
    // jsdom starts every test at '/' (not an auth page)
    window.history.replaceState({}, '', '/');
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Silent refresh + replay
// ═══════════════════════════════════════════════════════════════════════════════

describe('api response interceptor — 401 handling', () => {
    it('refreshes the session and replays the failed request once', async () => {
        postMock.mockResolvedValue({ data: { success: true } });

        const config = { url: '/orders', method: 'get' };
        await responseError(unauthorized(config));

        expect(postMock).toHaveBeenCalledWith('/auth/refresh', null, { _skipAuthRefresh: true });
        expect(replayMock).toHaveBeenCalledTimes(1);
        expect(replayMock.mock.calls[0][0]).toMatchObject({ url: '/orders', _retriedAfterRefresh: true });
    });

    it('never replays a request twice (no refresh loop)', async () => {
        // jsdom cannot perform a real navigation, so park on an auth page: the
        // "session over" redirect becomes a no-op while the retry logic is unchanged
        window.history.replaceState({}, '', '/login');
        postMock.mockResolvedValue({ data: { success: true } });

        const config = { url: '/orders', method: 'get', _retriedAfterRefresh: true };
        await expect(responseError(unauthorized(config))).rejects.toThrow('Unauthorized');

        expect(postMock).not.toHaveBeenCalled();
        expect(replayMock).not.toHaveBeenCalled();
    });

    it('does not refresh when the refresh call itself fails', async () => {
        postMock.mockRejectedValue(unauthorized({ url: '/auth/refresh', _skipAuthRefresh: true }));

        const config = { url: '/auth/refresh', method: 'post', _skipAuthRefresh: true };
        await expect(responseError(unauthorized(config))).rejects.toThrow('Unauthorized');

        expect(replayMock).not.toHaveBeenCalled();
    });

    it('does not treat a bad login as an expired session', async () => {
        const config = { url: '/auth/login', method: 'post' };
        await expect(responseError(unauthorized(config))).rejects.toThrow('Unauthorized');

        expect(postMock).not.toHaveBeenCalled();
        expect(replayMock).not.toHaveBeenCalled();
    });

    it('does not refresh requests to /auth/register', async () => {
        const config = { url: '/auth/register', method: 'post' };
        await expect(responseError(unauthorized(config))).rejects.toThrow('Unauthorized');

        expect(postMock).not.toHaveBeenCalled();
    });

    it('leaves non-401 errors untouched', async () => {
        const config = { url: '/orders', method: 'get' };
        const error = Object.assign(new Error('Server error'), { response: { status: 500 }, config });

        await expect(responseError(error)).rejects.toThrow('Server error');
        expect(postMock).not.toHaveBeenCalled();
    });

    it('shares a single refresh request across concurrent 401s', async () => {
        let resolveRefresh;
        postMock.mockImplementation(() => new Promise((resolve) => { resolveRefresh = resolve; }));

        const pending = Promise.all([
            responseError(unauthorized({ url: '/cart', method: 'get' })),
            responseError(unauthorized({ url: '/wishlist', method: 'get' })),
        ]);

        resolveRefresh({ data: { success: true } });
        await pending;

        expect(postMock).toHaveBeenCalledTimes(1);
        expect(replayMock).toHaveBeenCalledTimes(2);
    });

    it('rejects the request when the refresh token is gone', async () => {
        window.history.replaceState({}, '', '/login');
        postMock.mockRejectedValue(unauthorized({ url: '/auth/refresh' }));

        const config = { url: '/orders', method: 'get' };
        await expect(responseError(unauthorized(config))).rejects.toThrow('Unauthorized');

        expect(replayMock).not.toHaveBeenCalled();
    });

    it('registers the CSRF header interceptor', () => {
        expect(requestHandlers).toHaveLength(1);
        expect(api.interceptors.response.use).toBeDefined();
    });
});
