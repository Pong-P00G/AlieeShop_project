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
const userService = await import('../src/services/userService.js');

const caller = {
    user_id: 7,
    username: 'bob',
    email: 'bob@example.com',
    first_name: 'Bob',
    mid_name: null,
    last_name: 'Builder',
    role_id: 3,
    password_hash: '$2b$12$stored',
};

const otherUser = { ...caller, user_id: 9, username: 'alice', email: 'alice@example.com' };

beforeEach(() => {
    vi.clearAllMocks();
    UserModel.updateUsers.mockResolvedValue(caller);
});

describe('userService.updateUser — username/email uniqueness', () => {
    it("accepts the caller's own username and email without a false collision", async () => {
        UserModel.getUserByUsername.mockResolvedValue(caller);
        UserModel.getUserByEmail.mockResolvedValue(caller);

        await expect(
            userService.updateUser(7, { username: 'bob', email: 'bob@example.com', role_id: 3 })
        ).resolves.toEqual(caller);

        expect(UserModel.updateUsers).toHaveBeenCalledTimes(1);
    });

    it('rejects a username owned by somebody else', async () => {
        UserModel.getUserByUsername.mockResolvedValue(otherUser);
        UserModel.getUserByEmail.mockResolvedValue(caller);

        await expect(
            userService.updateUser(7, { username: 'alice', email: 'bob@example.com', role_id: 3 })
        ).rejects.toThrow('Username already taken');

        expect(UserModel.updateUsers).not.toHaveBeenCalled();
    });

    it('rejects an email owned by somebody else', async () => {
        UserModel.getUserByUsername.mockResolvedValue(caller);
        UserModel.getUserByEmail.mockResolvedValue(otherUser);

        await expect(
            userService.updateUser(7, { username: 'bob', email: 'alice@example.com', role_id: 3 })
        ).rejects.toThrow('Email already exists');

        expect(UserModel.updateUsers).not.toHaveBeenCalled();
    });

    it('skips the lookups entirely when neither field is being changed', async () => {
        await userService.updateUser(7, { first_name: 'Bobby', role_id: 3 });

        expect(UserModel.getUserByUsername).not.toHaveBeenCalled();
        expect(UserModel.getUserByEmail).not.toHaveBeenCalled();
        expect(UserModel.updateUsers).toHaveBeenCalledTimes(1);
    });

    it('tolerates an id type mismatch between the route param and the stored row', async () => {
        // getUserByUsername returns user_id as a number while the caller is
        // passed as a string — the same account must not be seen as a collision.
        UserModel.getUserByUsername.mockResolvedValue(caller);
        UserModel.getUserByEmail.mockResolvedValue(caller);

        await expect(
            userService.updateUser('7', { username: 'bob', email: 'bob@example.com', role_id: 3 })
        ).resolves.toEqual(caller);

        expect(UserModel.updateUsers).toHaveBeenCalledTimes(1);
    });
});
