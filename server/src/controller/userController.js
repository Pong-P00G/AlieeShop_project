import * as userService from '../services/userService.js';
import * as tokenService from '../services/tokenService.js';

// ── Cookie helpers ────────────────────────────────────────────────────────────

const ACCESS_COOKIE_NAME = 'auth_token';
const REFRESH_COOKIE_NAME = 'refresh_token';

// The refresh token is only needed by the auth endpoints, so its cookie is
// scoped to /api/auth instead of being sent with every request.
const REFRESH_COOKIE_PATH = '/api/auth';

const cookieBaseOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
});

// Access cookie is short-lived (15m by default); the refresh cookie carries the
// long-lived session and is rotated on every /auth/refresh call.
const setAuthCookies = (res, { accessToken, refreshToken, accessTokenMaxAge, refreshTokenMaxAge }) => {
    res.cookie(ACCESS_COOKIE_NAME, accessToken, {
        ...cookieBaseOptions(),
        maxAge: accessTokenMaxAge,
        path: '/',
    });
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
        ...cookieBaseOptions(),
        maxAge: refreshTokenMaxAge,
        path: REFRESH_COOKIE_PATH,
    });
};

const clearAuthCookies = (res) => {
    res.clearCookie(ACCESS_COOKIE_NAME, { ...cookieBaseOptions(), path: '/' });
    res.clearCookie(REFRESH_COOKIE_NAME, { ...cookieBaseOptions(), path: REFRESH_COOKIE_PATH });
};

// ── Controller ────────────────────────────────────────────────────────────────

// Register User
export const registerUser = async (req, res) => {
    try {
        const newUser = await userService.register(req.body);
        const { password_hash, ...userWithoutPassword } = newUser;

        // Issue a short-lived access token + a stored refresh token
        const tokens = await tokenService.issueTokens(
            userWithoutPassword.user_id,
            userWithoutPassword.role_id,
            false
        );

        // Set httpOnly cookies AND return the access token in body for backward compat
        setAuthCookies(res, tokens);

        res.status(201).json({
            success: true,
            token: tokens.accessToken,
            user: userWithoutPassword,
            message: 'Registration successful'
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// Login User - supports both email and username
export const loginUser = async (req, res) => {
    try {
        const { identifier, password, rememberMe } = req.body;
        
        if (!identifier || !password) {
            return res.status(400).json({ 
                success: false,
                message: 'Email/Username and password are required' 
            });
        }
        
        // Login with identifier (can be email or username)
        const user = await userService.login(identifier, password);
        
        // Issue a short-lived access token + a stored refresh token.
        // "Remember me" lengthens the refresh session, never the access token.
        const tokens = await tokenService.issueTokens(user.user_id, user.role_id, !!rememberMe);

        // Housekeeping: drop refresh rows that can no longer be used
        tokenService.deleteExpiredRefreshTokens().catch(() => {});
        
        // Remove password from response
        const { password_hash, ...userWithoutPassword } = user;
        
        // Set httpOnly cookie AND return token in body for backward compat
        setAuthCookies(res, tokens);
        
        res.json({ 
            success: true,
            token: tokens.accessToken,
            user: userWithoutPassword,
            message: 'Login successful'
        });
    } catch (error) {
        res.status(401).json({ success: false, message: error.message });
    }
};

// Logout - clear the auth cookie
export const logoutUser = async (req, res) => {
    try {
        // Revoke the stored refresh token so it cannot be replayed
        await tokenService.revokeRefreshToken(req.cookies?.[REFRESH_COOKIE_NAME]);
        clearAuthCookies(res);
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        clearAuthCookies(res);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Logout everywhere — revoke every stored refresh token for this user.
// Useful after a password change or a suspected compromise.
export const logoutAllSessions = async (req, res) => {
    try {
        await tokenService.revokeAllUserRefreshTokens(req.user.id);
        clearAuthCookies(res);
        res.json({ success: true, message: 'Logged out of all devices' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Refresh — exchange the refresh cookie for a new short-lived access token
// and a rotated refresh token (single use, stored hashed)
export const refreshAccessToken = async (req, res) => {
    try {
        const tokens = await tokenService.rotateRefreshToken(req.cookies?.[REFRESH_COOKIE_NAME]);

        if (!tokens) {
            clearAuthCookies(res);
            return res.status(401).json({
                success: false,
                message: 'Session expired, please log in again'
            });
        }

        setAuthCookies(res, tokens);

        res.json({
            success: true,
            token: tokens.accessToken,
            message: 'Session refreshed'
        });
    } catch (error) {
        clearAuthCookies(res);
        res.status(401).json({ success: false, message: 'Could not refresh session' });
    }
};

// Get current user from the cookie token
export const getMe = async (req, res) => {
    try {
        // Token should already be decoded and user attached by protect middleware
        if (!req.user || !req.user.id) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }
        const user = await userService.getUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const { password_hash, ...userWithoutPassword } = user;
        res.json({ success: true, user: userWithoutPassword });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Check username availability
export const checkUsername = async (req, res) => {
    try {
        const { username } = req.params;

        if (!username || username.length < 4) {
            return res.status(400).json({
                success: false,
                available: false,
                message: 'Username must be at least 4 characters'
            });
        }

        const existingUser = await userService.getUserByUsername(username);

        res.json({
            success: true,
            available: !existingUser,
            message: existingUser ? 'Username already taken' : 'Username available'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Check email availability
export const checkEmail = async (req, res) => {
    try {
        const { email } = req.params;

        if (!email) {
            return res.status(400).json({
                success: false,
                available: false,
                message: 'Email is required'
            });
        }

        const exists = await userService.emailExists(email);

        res.json({
            success: true,
            available: !exists,
            message: exists ? 'Email already registered' : 'Email available'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all users (admin only — enforced by the route)
export const getAllUsers = async (req, res) => {
    try {
        const users = await userService.getAllUsers();

        res.json({
            success: true,
            data: users.map(({ password_hash, ...user }) => user)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get user by ID (admin only — enforced by the route)
export const getUserById = async (req, res) => {
    try {
        const user = await userService.getUserById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const { password_hash, ...userWithoutPassword } = user;

        res.json({
            success: true,
            data: userWithoutPassword
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Create new user(s)
export const createUsers = async (req, res) => {
    try {
        const newUser = await userService.createUsers(req.body);
        const { password_hash, ...userWithoutPassword } = newUser;

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: userWithoutPassword
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Update user (admin only — enforced by the route)
export const updateUser = async (req, res) => {
    try {
        const updated = await userService.updateUser(req.params.id, req.body);

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const { password_hash, ...userWithoutPassword } = updated;

        res.json({
            success: true,
            message: 'User updated successfully',
            data: userWithoutPassword
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Update the authenticated user's own profile.
// The target is always the caller (req.user.id) and role_id is never taken from
// the body, so a user cannot promote themselves or edit somebody else.
// Unchanged fields are merged from the stored row so partial updates work.
export const updateProfile = async (req, res) => {
    try {
        const existing = await userService.getUserById(req.user.id);
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const {
            role_id: _ignoredRole,
            current_password: currentPassword,
            ...changes
        } = req.body;

        const updates = {
            username: changes.username ?? existing.username,
            email: changes.email ?? existing.email,
            first_name: changes.first_name ?? existing.first_name,
            last_name: changes.last_name ?? existing.last_name,
            mid_name: changes.mid_name !== undefined ? changes.mid_name : existing.mid_name,
            // Never from the request body — privilege escalation guard
            role_id: existing.role_id,
        };

        let sessionsRevoked = false;

        if (changes.password) {
            // Proving knowledge of the current password stops a stolen (but still
            // valid) access token from being used to take over the account.
            if (!currentPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Current password is required to set a new password'
                });
            }

            const matches = await userService.verifyPassword(req.user.id, currentPassword);
            if (!matches) {
                // Deliberately 400 and not 401: the client interceptor treats any
                // 401 as an expired session and redirects to /login, which would
                // sign the user out just for mistyping their password.
                return res.status(400).json({
                    success: false,
                    message: 'Current password is incorrect'
                });
            }

            updates.password = changes.password;
            sessionsRevoked = true;
        }

        const updated = await userService.updateUser(req.user.id, updates);
        const { password_hash, ...userWithoutPassword } = updated;

        // The password change revoked every refresh token, but the caller's access
        // cookie is still valid until it expires — clearing it here is what makes
        // the revocation actually take effect for this browser.
        if (sessionsRevoked) clearAuthCookies(res);

        res.json({
            success: true,
            message: sessionsRevoked
                ? 'Password updated. All sessions have been signed out.'
                : 'Profile updated successfully',
            sessionsRevoked,
            data: userWithoutPassword
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// Delete user (admin only — enforced by the route)
export const deleteUser = async (req, res) => {
    try {
        const deleted = await userService.deleteUser(req.params.id);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};