import rateLimit from 'express-rate-limit';

// ── Brute-force protection for the credential endpoints ───────────────────────
// Login and register are the highest-value targets, so they get a tight budget
// per IP. /auth/refresh is called automatically by the SPA (once per expired
// access token, plus one attempt per page load for guests), so it needs a
// looser guard that still stops token guessing.
//
// Test runs are exempt: the suites deliberately exercise auth endpoints many
// times from the same IP.

const isTestEnv = () => process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

const buildLimiter = (max, message, { skipSuccessfulRequests = false } = {}) => rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    // Never let a limiter interfere with automated tests
    skip: isTestEnv,
    message: { success: false, message },
});

// 10 *failed* login/registration attempts per IP per 15 minutes. Successful
// logins are not counted, so users sharing an IP (office, campus, NAT) are not
// locked out by someone else's mistakes, while brute force is still capped.
export const authLimiter = buildLimiter(
    10,
    'Too many authentication attempts, please try again in 15 minutes.',
    { skipSuccessfulRequests: true }
);

// 60 refresh calls per IP per 15 minutes
export const refreshLimiter = buildLimiter(
    60,
    'Too many session refresh attempts, please try again later.'
);

export default { authLimiter, refreshLimiter };
