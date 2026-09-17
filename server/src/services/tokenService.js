import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import * as RefreshTokenModel from '../model/refreshTokenModel.js';

// ── Token lifetimes ───────────────────────────────────────────────────────────
// The access token (httpOnly cookie, sent on every request) is intentionally
// short-lived. Long sessions are kept alive by the refresh token, which is
// opaque, stored hashed in the database and rotated on every use.

const DEFAULT_ACCESS_TOKEN_TTL = '15m';
const DEFAULT_REFRESH_TOKEN_TTL = '7d';
const DEFAULT_REMEMBER_REFRESH_TOKEN_TTL = '30d';

const MS_PER_UNIT = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 };

// Parses 'ms' | 's' | 'm' | 'h' | 'd' durations (e.g. '15m', '7d') into
// milliseconds. A plain number is treated as seconds, matching jsonwebtoken.
export const parseDuration = (value, fallbackMs) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value * 1000;

    const match = /^\s*(\d+)\s*(ms|s|m|h|d)?\s*$/i.exec(String(value ?? ''));
    if (!match) return fallbackMs;

    const amount = Number(match[1]);
    const unit = (match[2] || 's').toLowerCase();
    return amount * MS_PER_UNIT[unit];
};

export const getAccessTokenTtl = () => process.env.ACCESS_TOKEN_EXPIRES_IN || DEFAULT_ACCESS_TOKEN_TTL;

export const getAccessTokenMaxAge = () => parseDuration(getAccessTokenTtl(), 15 * 60 * 1000);

export const getRefreshTokenMaxAge = (rememberMe = false) => parseDuration(
    rememberMe
        ? (process.env.REFRESH_TOKEN_REMEMBER_EXPIRES_IN || DEFAULT_REMEMBER_REFRESH_TOKEN_TTL)
        : (process.env.REFRESH_TOKEN_EXPIRES_IN || DEFAULT_REFRESH_TOKEN_TTL),
    rememberMe ? 30 * 86400000 : 7 * 86400000
);

// ── Helpers ───────────────────────────────────────────────────────────────────

// Refresh tokens are random 256-bit values — only their hash is ever persisted
export const hashRefreshToken = (rawToken) =>
    crypto.createHash('sha256').update(String(rawToken)).digest('hex');

const generateRefreshToken = () => crypto.randomBytes(32).toString('hex');

export const signAccessToken = (userId, roleId) => jwt.sign(
    { id: userId, role_id: roleId },
    process.env.JWT_SECRET,
    { expiresIn: getAccessTokenTtl() }
);

const toCookiePayload = (accessToken, refreshToken, accessTokenMaxAge, refreshTokenMaxAge) => ({
    accessToken,
    refreshToken,
    accessTokenMaxAge,
    refreshTokenMaxAge,
});

// ── Public API ────────────────────────────────────────────────────────────────

// Issue a short-lived access token plus a fresh stored refresh token
export const issueTokens = async (userId, roleId, rememberMe = false) => {
    const refreshTokenMaxAge = getRefreshTokenMaxAge(rememberMe);

    const refreshToken = generateRefreshToken();
    await RefreshTokenModel.createRefreshToken({
        userId,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + refreshTokenMaxAge),
        rememberMe: !!rememberMe,
    });

    return toCookiePayload(
        signAccessToken(userId, roleId),
        refreshToken,
        getAccessTokenMaxAge(),
        refreshTokenMaxAge
    );
};

// Exchange a valid refresh token for a new token pair. The presented token is
// revoked immediately (single use); reusing a revoked token revokes the whole
// session, which is the classic defence against a stolen refresh token.
export const rotateRefreshToken = async (rawToken) => {
    if (!rawToken) return null;

    const tokenHash = hashRefreshToken(rawToken);
    const stored = await RefreshTokenModel.findRefreshTokenByHash(tokenHash);

    if (!stored) return null;

    if (stored.revoked_at || new Date(stored.expires_at) <= new Date()) {
        // Reuse of an already-rotated (or expired) token — kill the session
        await RefreshTokenModel.revokeAllUserRefreshTokens(stored.user_id);
        return null;
    }

    if (stored.is_active === false) {
        await RefreshTokenModel.revokeAllUserRefreshTokens(stored.user_id);
        return null;
    }

    await RefreshTokenModel.revokeRefreshToken(tokenHash);

    return issueTokens(stored.user_id, stored.role_id, stored.remember_me);
};

// Revoke a refresh token (logout). The row is kept for reuse detection.
export const revokeRefreshToken = async (rawToken) => {
    if (!rawToken) return false;
    return RefreshTokenModel.revokeRefreshToken(hashRefreshToken(rawToken));
};

// Revoke every active session for a user (logout everywhere / password change)
export const revokeAllUserRefreshTokens = (userId) =>
    RefreshTokenModel.revokeAllUserRefreshTokens(userId);

// Housekeeping helper for expired rows
export const deleteExpiredRefreshTokens = () => RefreshTokenModel.deleteExpiredRefreshTokens();
