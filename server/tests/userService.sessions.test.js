import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('bcrypt', () => ({
    default: {
        hash: vi.fn(async (value) => `hashed:${value}`),
        compare: vi.fn(async () => true),
    },
}));

vi.mock('../src/model/userModel.js', () => ({
    getAllUsers: vi.fn(),
    getUserById: vi.fn(),
    getUserByEmail: vi.fn(),
    getUserByUsername: vi.fn(),
    getUserByEmailOrUsername: vi.fn(),
    createUsers: vi.fn(),
    updateUsers: vi.fn(),
    deleteUser: vi.fn(),
    emailExists: vi.fn(),
    usernameExists: vi.fn(),
}));

vi.mock('../src/model/refreshTokenModel.js', () => ({
    createRefreshToken: vi.fn(),
    findRefreshTokenByHash: vi.fn(),
    findActiveRefreshToken: vi.fn(),
    revokeRefreshToken: vi.fn(),
    revokeAllUserRefreshTokens: vi.fn(),
    deleteExpiredRefreshTokens: vi.fn(),
}));

vi.mock('../src/services/dashboardService.js', () => ({
    notifyNewUser: vi.fn().mockResolvedValue(undefined),
    notifyNewOrder: vi.fn().mockResolvedValue(undefined),
    notifyOrderStatusChange: vi.fn().mockResolvedValue(undefined),
}));

const UserModel = await import('../src/model/userModel.js');
const RefreshTokenModel = await import('../src/model/refreshTokenModel.js');
const userService = await import('../src/services/userService.js');

const storedUser = {
    user_id: 7,
    username: 'bob',
    email: 'bob@example.com',
    first_name: 'Bob',
    mid_name: null,
    last_name: 'Builder',
    role_id: 3,
    password_hash: '$2b$12$old',
};

beforeEach(() => {
    vi.clearAllMocks();
    UserModel.updateUsers.mockResolvedValue(storedUser);
    RefreshTokenModel.revokeAllUserRefreshTokens.mockResolvedValue(true);
});

describe('userService.updateUser — session revocation', () => {
    it('revokes every refresh token when the password changes', async () => {
        await userService.updateUser(7, {
            username: 'bob',
            email: 'bob@example.com',
            first_name: 'Bob',
            last_name: 'Builder',
            role_id: 3,
            password: 'brand-new-password',
        });

        expect(RefreshTokenModel.revokeAllUserRefreshTokens).toHaveBeenCalledWith(7);
    });

    it('hashes the new password before storing it', async () => {
        await userService.updateUser(7, { role_id: 3, password: 'brand-new-password' });

        const [, data] = UserModel.updateUsers.mock.calls[0];
        expect(data.password_hash).toBe('hashed:brand-new-password');
        expect(data.password).toBeUndefined();
    });

    it('leaves sessions alone when no password is supplied', async () => {
        await userService.updateUser(7, {
            username: 'bob',
            email: 'bob@example.com',
            first_name: 'Bobby',
            last_name: 'Builder',
            role_id: 3,
        });

        expect(RefreshTokenModel.revokeAllUserRefreshTokens).not.toHaveBeenCalled();
    });

    it('still returns the updated user when revocation fails', async () => {
        RefreshTokenModel.revokeAllUserRefreshTokens.mockRejectedValue(new Error('db down'));

        const result = await userService.updateUser(7, { role_id: 3, password: 'brand-new-password' });

        expect(result).toEqual(storedUser);
    });
});
