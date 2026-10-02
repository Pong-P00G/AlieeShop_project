import db from '../database/dbpool.js';

const USER_SELECT = `
    SELECT
        u.usersid      AS user_id,
        u.username,
        u.firstname    AS first_name,
        u.midname      AS mid_name,
        u.lastname     AS last_name,
        u.fullname     AS full_name,
        u.email,
        u.profilepictureurl AS profile_picture_url,
        u.passwordhash AS password_hash,
        u.isactive     AS is_active,
        u.createdat    AS created_at,
        r.rolesid      AS role_id,
        r.rolename     AS role_name
    FROM users u
    LEFT JOIN roles r ON u.rolesid = r.rolesid
`;

export const getAllUsers = async () => {
    const { rows } = await db.query(`${USER_SELECT} ORDER BY u.createdat DESC`);
    return rows;
};

export const getUserById = async (id) => {
    const { rows } = await db.query(`${USER_SELECT} WHERE u.usersid = $1`, [id]);
    return rows[0];
};

export const getUserByEmail = async (email) => {
    const { rows } = await db.query(`${USER_SELECT} WHERE u.email = $1`, [email]);
    return rows[0];
};

export const getUserByUsername = async (username) => {
    const { rows } = await db.query(`${USER_SELECT} WHERE u.username = $1`, [username]);
    return rows[0];
};

export const getUserByEmailOrUsername = async (identifier) => {
    const { rows } = await db.query(
        `${USER_SELECT} WHERE u.email = $1 OR u.username = $1`,
        [identifier]
    );
    return rows[0];
};

// Password must be pre-hashed by the service layer before calling this
export const createUsers = async (userData) => {
    const {
        role_id = 3,
        username,
        first_name,
        mid_name = null,
        last_name,
        email,
        password_hash
    } = userData;

    if (!username || !email || !password_hash || !first_name || !last_name) {
        throw new Error('Missing required fields: username, email, password, first_name, or last_name');
    }

    const { rows } = await db.query(
        `INSERT INTO users (rolesid, username, firstname, midname, lastname, email, passwordhash)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING usersid`,
        [role_id, username, first_name, mid_name, last_name, email, password_hash]
    );

    return getUserById(rows[0].usersid);
};

// If password_hash is provided it must already be hashed by the service layer
export const updateUsers = async (id, userData) => {
    const { username, email, password_hash, first_name, mid_name, last_name, role_id } = userData;

    let query;
    let values;

    if (password_hash) {
        query = `
            UPDATE users
            SET username = $1, email = $2, passwordhash = $3,
                firstname = $4, midname = $5, lastname = $6, rolesid = $7
            WHERE usersid = $8
        `;
        values = [username, email, password_hash, first_name, mid_name, last_name, role_id, id];
    } else {
        query = `
            UPDATE users
            SET username = $1, email = $2,
                firstname = $3, midname = $4, lastname = $5, rolesid = $6
            WHERE usersid = $7
        `;
        values = [username, email, first_name, mid_name, last_name, role_id, id];
    }

    await db.query(query, values);
    return getUserById(id);
};

export const deleteUser = async (id) => {
    const result = await db.query('DELETE FROM users WHERE usersid = $1', [id]);
    return result.rowCount > 0;
};

// Set (or clear, with url = null) the user's profile picture URL.
export const updateProfilePicture = async (id, url) => {
    await db.query(
        'UPDATE users SET profilepictureurl = $1, updatedat = NOW() WHERE usersid = $2',
        [url, id]
    );
    return getUserById(id);
};

export const emailExists = async (email) => {
    const { rows } = await db.query('SELECT usersid FROM users WHERE email = $1', [email]);
    return rows.length > 0;
};

export const usernameExists = async (username) => {
    const { rows } = await db.query('SELECT usersid FROM users WHERE username = $1', [username]);
    return rows.length > 0;
};
