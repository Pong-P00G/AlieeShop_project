import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// ── Mock the refresh token model (no database in unit tests) ──────────────────
vi.mock('../src/model/refreshTokenModel.js', () => ({
    createRefreshToken: vi.fn(),
    findRefreshTokenByHash: vi.fn(),
    findActiveRefreshToken: vi.fn(),
    revokeRefreshToken: vi.fn(),
    revokeAllUserRefreshTokens: vi.fn(),
    deleteExpiredRefreshTokens: vi.fn(),
}));

const RefreshTokenModel = await import('../src/model/refreshTokenModel.js');
const tokenService = await import('../src/services/tokenService.js');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret-value-for-token-service';
    delete process.env.ACCESS_TOKEN_EXPIRES_IN;
    delete process.env.REFRESH_TOKEN_EXPIRES_IN;
    delete process.env.REFRESH_TOKEN_REMEMBER_EXPIRES_IN;
});

// ═══════════════════════════════════════════════════════════════════════════════
//  parseDuration / TTLs
// ═══════════════════════════════════════════════════════════════════════════════

describe('tokenService — durations', () => {
    it('parses minute, hour and day durations', () => {
        expect(tokenService.parseDuration('15m', 0)).toBe(15 * 60 * 1000);
        expect(tokenService.parseDuration('2h', 0)).toBe(2 * 60 * 60 * 1000);
        expect(tokenService.parseDuration('7d', 0)).toBe(7 * 24 * 60 * 60 * 1000);
        expect(tokenService.parseDuration('30s', 0)).toBe(30 * 1000);
    });

    it('treats a bare number as seconds, like jsonwebtoken does', () => {
        expect(tokenService.parseDuration('900', 0)).toBe(900 * 1000);
    });

    it('falls back when the value is missing or malformed', () => {
        expect(tokenService.parseDuration(undefined, 1234)).toBe(1234);
        expect(tokenService.parseDuration('not-a-duration', 4321)).toBe(4321);
        expect(tokenService.parseDuration('', 99)).toBe(99);
    });

    it('defaults the access token to a short lifetime', () => {
        expect(tokenService.getAccessTokenTtl()).toBe('15m');
        expect(tokenService.getAccessTokenMaxAge()).toBe(15 * 60 * 1000);
    });

    it('honours ACCESS_TOKEN_EXPIRES_IN', () => {
        process.env.ACCESS_TOKEN_EXPIRES_IN = '5m';
        expect(tokenService.getAccessTokenMaxAge()).toBe(5 * 60 * 1000);
    });

    it('uses a longer refresh lifetime only for remember me', () => {
        expect(tokenService.getRefreshTokenMaxAge(false)).toBe(7 * 24 * 60 * 60 * 1000);
        expect(tokenService.getRefreshTokenMaxAge(true)).toBe(30 * 24 * 60 * 60 * 1000);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  issueTokens
// ═══════════════════════════════════════════════════════════════════════════════

describe('tokenService — issueTokens', () => {
    it('signs a short-lived access token and stores only the refresh token hash', async () => {
        RefreshTokenModel.createRefreshToken.mockResolvedValue({ refresh_token_id: 1 });

        const tokens = await tokenService.issueTokens(7, 3);

        const decoded = jwt.verify(tokens.accessToken, process.env.JWT_SECRET);
        expect(decoded.id).toBe(7);
        expect(decoded.role_id).toBe(3);
        expect(decoded.exp - decoded.iat).toBe(15 * 60);

        // Raw token is 32 random bytes, stored value is its SHA-256 hash
        expect(tokens.refreshToken).toMatch(/^[0-9a-f]{64}$/);
        const stored = RefreshTokenModel.createRefreshToken.mock.calls[0][0];
        expect(stored.tokenHash).toBe(sha256(tokens.refreshToken));
        expect(stored.tokenHash).not.toBe(tokens.refreshToken);
        expect(stored.userId).toBe(7);
        expect(stored.rememberMe).toBe(false);
    });

    it('returns the cookie max ages alongside the tokens', async () => {
        RefreshTokenModel.createRefreshToken.mockResolvedValue({ refresh_token_id: 1 });

        const tokens = await tokenService.issueTokens(7, 3, true);

        expect(tokens.accessTokenMaxAge).toBe(15 * 60 * 1000);
        expect(tokens.refreshTokenMaxAge).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it('stores an expiry that matches the refresh lifetime', async () => {
        process.env.REFRESH_TOKEN_EXPIRES_IN = '15m';
        RefreshTokenModel.createRefreshToken.mockResolvedValue({ refresh_token_id: 1 });

        await tokenService.issueTokens(7, 3);

        const { expiresAt } = RefreshTokenModel.createRefreshToken.mock.calls[0][0];
        expect(expiresAt.getTime()).toBeGreaterThan(Date.now() + 14 * 60 * 1000);
        expect(expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 16 * 60 * 1000);
    });

    it('generates a different refresh token every time', async () => {
        RefreshTokenModel.createRefreshToken.mockResolvedValue({ refresh_token_id: 1 });

        const first = await tokenService.issueTokens(7, 3);
        const second = await tokenService.issueTokens(7, 3);

        expect(first.refreshToken).not.toBe(second.refreshToken);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  rotateRefreshToken
// ═══════════════════════════════════════════════════════════════════════════════

describe('tokenService — rotateRefreshToken', () => {
    const activeRow = {
        user_id: 7,
        role_id: 3,
        remember_me: false,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        revoked_at: null,
        is_active: true,
    };

    it('returns null when no token was presented', async () => {
        expect(await tokenService.rotateRefreshToken(undefined)).toBeNull();
        expect(RefreshTokenModel.findRefreshTokenByHash).not.toHaveBeenCalled();
    });

    it('returns null when the token is unknown', async () => {
        RefreshTokenModel.findRefreshTokenByHash.mockResolvedValue(undefined);

        expect(await tokenService.rotateRefreshToken('unknown')).toBeNull();
        expect(RefreshTokenModel.revokeAllUserRefreshTokens).not.toHaveBeenCalled();
    });

    it('looks the token up by hash, never by raw value', async () => {
        RefreshTokenModel.findRefreshTokenByHash.mockResolvedValue(activeRow);
        RefreshTokenModel.revokeRefreshToken.mockResolvedValue(true);
        RefreshTokenModel.createRefreshToken.mockResolvedValue({ refresh_token_id: 2 });

        await tokenService.rotateRefreshToken('raw-token');

        expect(RefreshTokenModel.findRefreshTokenByHash).toHaveBeenCalledWith(sha256('raw-token'));
    });

    it('revokes the presented token and issues a new pair', async () => {
        RefreshTokenModel.findRefreshTokenByHash.mockResolvedValue(activeRow);
        RefreshTokenModel.revokeRefreshToken.mockResolvedValue(true);
        RefreshTokenModel.createRefreshToken.mockResolvedValue({ refresh_token_id: 2 });

        const tokens = await tokenService.rotateRefreshToken('raw-token');

        expect(RefreshTokenModel.revokeRefreshToken).toHaveBeenCalledWith(sha256('raw-token'));
        expect(tokens.accessToken).toBeTruthy();
        expect(tokens.refreshToken).not.toBe('raw-token');
        expect(RefreshTokenModel.createRefreshToken).toHaveBeenCalledTimes(1);
    });

    it('keeps the remember-me session length across rotations', async () => {
        RefreshTokenModel.findRefreshTokenByHash.mockResolvedValue({ ...activeRow, remember_me: true });
        RefreshTokenModel.revokeRefreshToken.mockResolvedValue(true);
        RefreshTokenModel.createRefreshToken.mockResolvedValue({ refresh_token_id: 2 });

        const tokens = await tokenService.rotateRefreshToken('raw-token');

        expect(tokens.refreshTokenMaxAge).toBe(30 * 24 * 60 * 60 * 1000);
        expect(RefreshTokenModel.createRefreshToken.mock.calls[0][0].rememberMe).toBe(true);
    });

    it('rejects reuse of an already revoked token and kills the session', async () => {
        RefreshTokenModel.findRefreshTokenByHash.mockResolvedValue({
            ...activeRow,
            revoked_at: new Date(),
        });

        expect(await tokenService.rotateRefreshToken('reused-token')).toBeNull();
        expect(RefreshTokenModel.revokeAllUserRefreshTokens).toHaveBeenCalledWith(7);
        expect(RefreshTokenModel.createRefreshToken).not.toHaveBeenCalled();
    });

    it('rejects an expired token', async () => {
        RefreshTokenModel.findRefreshTokenByHash.mockResolvedValue({
            ...activeRow,
            expires_at: new Date(Date.now() - 1000),
        });

        expect(await tokenService.rotateRefreshToken('expired-token')).toBeNull();
        expect(RefreshTokenModel.revokeAllUserRefreshTokens).toHaveBeenCalledWith(7);
    });

    it('rejects tokens belonging to a deactivated user', async () => {
        RefreshTokenModel.findRefreshTokenByHash.mockResolvedValue({ ...activeRow, is_active: false });

        expect(await tokenService.rotateRefreshToken('raw-token')).toBeNull();
        expect(RefreshTokenModel.revokeAllUserRefreshTokens).toHaveBeenCalledWith(7);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  revokeRefreshToken
// ═══════════════════════════════════════════════════════════════════════════════

describe('tokenService — revokeRefreshToken', () => {
    it('revokes by hash on logout', async () => {
        RefreshTokenModel.revokeRefreshToken.mockResolvedValue(true);

        expect(await tokenService.revokeRefreshToken('raw-token')).toBe(true);
        expect(RefreshTokenModel.revokeRefreshToken).toHaveBeenCalledWith(sha256('raw-token'));
    });

    it('is a no-op when there is no token to revoke', async () => {
        expect(await tokenService.revokeRefreshToken(undefined)).toBe(false);
        expect(RefreshTokenModel.revokeRefreshToken).not.toHaveBeenCalled();
    });
});
