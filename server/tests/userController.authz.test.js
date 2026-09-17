import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/services/userService.js', () => ({
    register: vi.fn(),
    login: vi.fn(),
    getAllUsers: vi.fn(),
    getUserById: vi.fn(),
    createUsers: vi.fn(),
    updateUser: vi.fn(),
    verifyPassword: vi.fn(),
    deleteUser: vi.fn(),
}));

vi.mock('../src/services/tokenService.js', () => ({
    issueTokens: vi.fn(),
    rotateRefreshToken: vi.fn(),
    revokeRefreshToken: vi.fn(),
    revokeAllUserRefreshTokens: vi.fn(),
    deleteExpiredRefreshTokens: vi.fn(),
}));

const userService = await import('../src/services/userService.js');
const tokenService = await import('../src/services/tokenService.js');
const {
    updateProfile,
    getAllUsers,
    getUserById,
    updateUser,
    logoutAllSessions,
} = await import('../src/controller/userController.js');

// ── Minimal req/res doubles ───────────────────────────────────────────────────
const mockRes = () => {
    const res = {};
    res.status = vi.fn(() => res);
    res.json = vi.fn(() => res);
    res.cookie = vi.fn(() => res);
    res.clearCookie = vi.fn(() => res);
    return res;
};

const customerRow = {
    user_id: 5,
    username: 'bob',
    email: 'bob@example.com',
    first_name: 'Bob',
    mid_name: null,
    last_name: 'Builder',
    role_id: 3,
    password_hash: '$2b$12$storedhash',
};

beforeEach(() => {
    vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  updateProfile — always self, never self-promoting
// ═══════════════════════════════════════════════════════════════════════════════

describe('updateProfile', () => {
    it('updates the caller and ignores role_id coming from the request body', async () => {
        userService.getUserById.mockResolvedValue(customerRow);
        userService.updateUser.mockResolvedValue({ ...customerRow, first_name: 'Bobby' });

        const req = {
            user: { id: 5, role_id: 3 },
            // A customer trying to promote themselves to admin
            body: { first_name: 'Bobby', role_id: 1 },
        };
        const res = mockRes();

        await updateProfile(req, res);

        const [targetId, updates] = userService.updateUser.mock.calls[0];
        expect(targetId).toBe(5);
        expect(updates.first_name).toBe('Bobby');
        expect(updates.role_id).toBe(3);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('never returns the password hash', async () => {
        userService.getUserById.mockResolvedValue(customerRow);
        userService.updateUser.mockResolvedValue({ ...customerRow, email: 'new@example.com' });

        const res = mockRes();
        await updateProfile({ user: { id: 5, role_id: 3 }, body: { email: 'new@example.com' } }, res);

        const payload = res.json.mock.calls[0][0];
        expect(payload.data.password_hash).toBeUndefined();
        expect(payload.data.email).toBe('new@example.com');
    });

    it('keeps existing values for fields the request omits', async () => {
        userService.getUserById.mockResolvedValue(customerRow);
        userService.updateUser.mockResolvedValue({ ...customerRow, last_name: 'New' });

        await updateProfile({ user: { id: 5, role_id: 3 }, body: { last_name: 'New' } }, mockRes());

        const updates = userService.updateUser.mock.calls[0][1];
        expect(updates).toMatchObject({
            username: 'bob',
            email: 'bob@example.com',
            first_name: 'Bob',
            last_name: 'New',
            role_id: 3,
        });
    });

    it('forwards a password change so userService can re-hash it', async () => {
        userService.getUserById.mockResolvedValue(customerRow);
        userService.updateUser.mockResolvedValue(customerRow);
        userService.verifyPassword.mockResolvedValue(true);

        await updateProfile(
            {
                user: { id: 5, role_id: 3 },
                body: { current_password: 'oldpassword123', password: 'newpassword123' },
            },
            mockRes()
        );

        expect(userService.verifyPassword).toHaveBeenCalledWith(5, 'oldpassword123');
        expect(userService.updateUser.mock.calls[0][1].password).toBe('newpassword123');
    });

    it('404s when the caller no longer exists', async () => {
        userService.getUserById.mockResolvedValue(undefined);
        const res = mockRes();

        await updateProfile({ user: { id: 99, role_id: 3 }, body: { first_name: 'Ghost' } }, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(userService.updateUser).not.toHaveBeenCalled();
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Password hashes never leave the API
// ═══════════════════════════════════════════════════════════════════════════════

describe('password hash exposure', () => {
    it('getAllUsers strips password_hash from every row', async () => {
        userService.getAllUsers.mockResolvedValue([customerRow, { ...customerRow, user_id: 6 }]);

        const res = mockRes();
        await getAllUsers({}, res);

        const payload = res.json.mock.calls[0][0];
        expect(payload.data).toHaveLength(2);
        payload.data.forEach((user) => expect(user.password_hash).toBeUndefined());
        expect(payload.data[0].username).toBe('bob');
    });

    it('getUserById strips password_hash', async () => {
        userService.getUserById.mockResolvedValue(customerRow);

        const res = mockRes();
        await getUserById({ params: { id: '5' } }, res);

        expect(res.json.mock.calls[0][0].data.password_hash).toBeUndefined();
    });

    it('updateUser strips password_hash', async () => {
        userService.updateUser.mockResolvedValue(customerRow);

        const res = mockRes();
        await updateUser({ params: { id: '5' }, body: {} }, res);

        expect(res.json.mock.calls[0][0].data.password_hash).toBeUndefined();
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Logout everywhere
// ═══════════════════════════════════════════════════════════════════════════════

describe('logoutAllSessions', () => {
    it('revokes every refresh token for the caller and clears both cookies', async () => {
        tokenService.revokeAllUserRefreshTokens.mockResolvedValue(true);

        const res = mockRes();
        await logoutAllSessions({ user: { id: 5 }, cookies: { refresh_token: 'raw' } }, res);

        expect(tokenService.revokeAllUserRefreshTokens).toHaveBeenCalledWith(5);
        expect(res.clearCookie).toHaveBeenCalledTimes(2);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('reports 500 when revocation fails', async () => {
        tokenService.revokeAllUserRefreshTokens.mockRejectedValue(new Error('db down'));

        const res = mockRes();
        await logoutAllSessions({ user: { id: 5 } }, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Password change — requires the current password and ends every session
// ═══════════════════════════════════════════════════════════════════════════════

describe('updateProfile — password change', () => {
    beforeEach(() => {
        userService.getUserById.mockResolvedValue(customerRow);
        userService.updateUser.mockResolvedValue(customerRow);
    });

    const changeBody = {
        current_password: 'oldpassword123',
        password: 'newpassword123',
    };

    it('refuses a password change when no current password is supplied', async () => {
        const res = mockRes();

        await updateProfile({ user: { id: 5, role_id: 3 }, body: { password: 'newpassword123' } }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'Current password is required to set a new password' })
        );
        expect(userService.updateUser).not.toHaveBeenCalled();
    });

    it('refuses a password change when the current password is wrong', async () => {
        userService.verifyPassword.mockResolvedValue(false);
        const res = mockRes();

        await updateProfile(
            { user: { id: 5, role_id: 3 }, body: { current_password: 'wrong', password: 'newpassword123' } },
            res
        );

        expect(userService.verifyPassword).toHaveBeenCalledWith(5, 'wrong');
        expect(userService.updateUser).not.toHaveBeenCalled();
        // 400 rather than 401: a 401 would make the client treat the session as
        // expired and sign the user out for a mere typo.
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json.mock.calls[0][0].message).toBe('Current password is incorrect');
    });

    it('clears the auth cookies and reports the revocation on success', async () => {
        userService.verifyPassword.mockResolvedValue(true);
        const res = mockRes();

        await updateProfile({ user: { id: 5, role_id: 3 }, body: changeBody }, res);

        expect(res.clearCookie).toHaveBeenCalledTimes(2);

        const payload = res.json.mock.calls[0][0];
        expect(payload.sessionsRevoked).toBe(true);
        expect(payload.data.password_hash).toBeUndefined();
    });

    it('never forwards current_password into the update payload', async () => {
        userService.verifyPassword.mockResolvedValue(true);

        await updateProfile({ user: { id: 5, role_id: 3 }, body: changeBody }, mockRes());

        expect(userService.updateUser.mock.calls[0][1].current_password).toBeUndefined();
    });

    it('leaves cookies alone for an ordinary profile update', async () => {
        const res = mockRes();

        await updateProfile({ user: { id: 5, role_id: 3 }, body: { first_name: 'Bobby' } }, res);

        expect(userService.verifyPassword).not.toHaveBeenCalled();
        expect(res.clearCookie).not.toHaveBeenCalled();
        expect(res.json.mock.calls[0][0].sessionsRevoked).toBe(false);
    });
});
