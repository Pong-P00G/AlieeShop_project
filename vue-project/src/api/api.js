import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
    timeout: 10000,
    withCredentials: true, // Send httpOnly cookie with every request
    headers: {
        "Content-Type": "application/json"
    },
});

// ── CSRF Protection ──────────────────────────────────────────────────────────
// Read the csrf-token cookie (httpOnly: false) and attach it as the
// x-csrf-token header on every state-changing request.
api.interceptors.request.use(config => {
    const isSafeMethod = ['get', 'head', 'options'].includes(config.method?.toLowerCase());
    if (!isSafeMethod) {
        const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]*)/);
        if (match) {
            config.headers['x-csrf-token'] = match[1];
        }
    }
    return config;
});

// ── Silent access-token renewal ─────────────────────────────────────────────
// The access token is short-lived (15 min by default, see server tokenService).
// When it expires any protected call answers 401, so we exchange the httpOnly
// refresh cookie for a new access token and replay the original request once.
// Concurrent 401s share a single refresh request.
let refreshPromise = null;

const refreshAccessToken = () => {
    if (!refreshPromise) {
        refreshPromise = api
            .post('/auth/refresh', null, { _skipAuthRefresh: true })
            .then(() => true)
            .catch(() => false)
            .finally(() => { refreshPromise = null; });
    }
    return refreshPromise;
};

const isAuthPage = () => ['/login', '/register', '/forgotPassword', '/forgot-password']
    .some(p => window.location.pathname.startsWith(p));

// Handle response errors globally
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const original = error.config || {};

        if (error.response?.status === 401) {
            // Never retry or redirect when:
            // - The request itself is for /auth/login or /auth/register (expected 401 for bad creds)
            // - The request is the refresh call itself (avoids an infinite loop)
            // Redirects are additionally skipped while already on an auth page
            const requestUrl = original.url || '';
            const isAuthRequest = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register');

            if (!isAuthRequest && !original._skipAuthRefresh && !original._retriedAfterRefresh) {
                // Access token expired — renew it and replay the request
                const refreshed = await refreshAccessToken();
                if (refreshed) {
                    original._retriedAfterRefresh = true;
                    return api(original);
                }
            }

            if (!isAuthRequest && !isAuthPage() && !original._skipAuthRefresh) {
                // Refresh token is gone or revoked — the session is over
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

// ── Newsletter API ───────────────────────────────────────────────────────────

export const subscribeNewsletter = async (email) => {
    const response = await api.post('/newsletter/subscribe', { email });
    return response.data;
};

export default api;