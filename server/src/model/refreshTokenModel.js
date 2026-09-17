import db from '../database/dbpool.js';

const REFRESH_SELECT = `
    SELECT
        rt.refresh_token_id AS refresh_token_id,
        rt.usersid          AS user_id,
        rt.rememberme       AS remember_me,
        rt.expiresat        AS expires_at,
        rt.revokedat        AS revoked_at,
        u.rolesid           AS role_id,
        u.isactive          AS is_active
    FROM refresh_tokens rt
    JOIN users u ON u.usersid = rt.usersid
`;

// Store a new refresh token (tokenHash must already be SHA-256 hashed)
export const createRefreshToken = async ({ userId, tokenHash, expiresAt, rememberMe = false }) => {
    const { rows } = await db.query(
        `INSERT INTO refresh_tokens (usersid, tokenhash, rememberme, expiresat)
         VALUES ($1, $2, $3, $4)
         RETURNING refresh_token_id`,
        [userId, tokenHash, rememberMe, expiresAt]
    );
    return rows[0];
};

// Look up a token regardless of state — used to detect reused/revoked tokens
export const findRefreshTokenByHash = async (tokenHash) => {
    const { rows } = await db.query(`${REFRESH_SELECT} WHERE rt.tokenhash = $1`, [tokenHash]);
    return rows[0];
};

// Look up a token that is still usable (not revoked, not expired)
export const findActiveRefreshToken = async (tokenHash) => {
    const { rows } = await db.query(
        `${REFRESH_SELECT}
         WHERE rt.tokenhash = $1
           AND rt.revokedat IS NULL
           AND rt.expiresat > NOW()`,
        [tokenHash]
    );
    return rows[0];
};

// Revoke a single token (rotation / logout)
export const revokeRefreshToken = async (tokenHash) => {
    const result = await db.query(
        `UPDATE refresh_tokens
         SET revokedat = NOW()
         WHERE tokenhash = $1 AND revokedat IS NULL`,
        [tokenHash]
    );
    return result.rowCount > 0;
};

// Revoke every active token for a user (reuse detected / password change)
export const revokeAllUserRefreshTokens = async (userId) => {
    const result = await db.query(
        `UPDATE refresh_tokens
         SET revokedat = NOW()
         WHERE usersid = $1 AND revokedat IS NULL`,
        [userId]
    );
    return result.rowCount > 0;
};

// Housekeeping — drop rows that can no longer be used
export const deleteExpiredRefreshTokens = async () => {
    const result = await db.query('DELETE FROM refresh_tokens WHERE expiresat < NOW()');
    return result.rowCount;
};
