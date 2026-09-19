import db from '../database/dbpool.js';

export const getAllRoles = async () => {
    const { rows } = await db.query(
        `SELECT rolesid AS role_id, rolename AS role_name, description, level, createdat AS created_at
         FROM roles ORDER BY rolesid`
    );
    return rows;
};

export const getRoleById = async (id) => {
    const { rows } = await db.query(
        `SELECT rolesid AS role_id, rolename AS role_name, description, level, createdat AS created_at
         FROM roles WHERE rolesid = $1`,
        [id]
    );
    return rows[0];
};

export const createRole = async (roleName, description, level = 3) => {
    const { rows } = await db.query(
        `INSERT INTO roles (rolename, description, level) VALUES ($1, $2, $3) RETURNING rolesid AS role_id, rolename AS role_name, description, level`,
        [roleName, description, level]
    );
    return rows[0];
};

export const updateRole = async (roleId, roleName, description, level) => {
    const { rows } = await db.query(
        `UPDATE roles SET rolename = $1, description = $2, level = COALESCE($3, level) WHERE rolesid = $4 RETURNING rolesid AS role_id, rolename AS role_name, description, level`,
        [roleName, description, level, roleId]
    );
    return rows[0];
};

export const deleteRole = async (roleId) => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        // Delete role_permissions references
        await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
        // Set users with this role to default role 3 (customer)
        await client.query('UPDATE users SET rolesid = 3 WHERE rolesid = $1', [roleId]);
        // Delete the role
        await client.query('DELETE FROM roles WHERE rolesid = $1', [roleId]);
        await client.query('COMMIT');
        return true;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

export const createPermission = async (permissionKey, permissionName, module, description, type = 'backend') => {
    const { rows } = await db.query(
        `INSERT INTO permissions (permission_key, permission_name, module, description, type)
         VALUES ($1, $2, $3, $4, $5) RETURNING permission_id, permission_key, permission_name, module, description, type`,
        [permissionKey, permissionName, module, description, type]
    );
    return rows[0];
};

export const updatePermission = async (permissionId, permissionKey, permissionName, module, description, type) => {
    const { rows } = await db.query(
        `UPDATE permissions SET permission_key = $1, permission_name = $2, module = $3, description = $4,
         type = COALESCE($5, type)
         WHERE permission_id = $6 RETURNING permission_id, permission_key, permission_name, module, description, type`,
        [permissionKey, permissionName, module, description, type, permissionId]
    );
    return rows[0];
};

export const deletePermission = async (permissionId) => {
    await db.query('DELETE FROM role_permissions WHERE permission_id = $1', [permissionId]);
    await db.query('DELETE FROM permissions WHERE permission_id = $1', [permissionId]);
    return true;
};

export const getAllPermissions = async () => {
    const { rows } = await db.query(
        `SELECT permission_id, permission_key, permission_name, module, description, type
         FROM permissions ORDER BY type, module, permission_id`
    );
    return rows;
};

export const getRolePermissions = async (roleId) => {
    const { rows } = await db.query(
        `SELECT p.permission_id, p.permission_key, p.permission_name, p.module, p.description, p.type
         FROM permissions p
         JOIN role_permissions rp ON p.permission_id = rp.permission_id
         WHERE rp.role_id = $1
         ORDER BY p.type, p.module, p.permission_id`,
        [roleId]
    );
    return rows;
};

export const setRolePermissions = async (roleId, permissionIds) => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
        if (permissionIds && permissionIds.length > 0) {
            const values = permissionIds.map((_, i) => `($1, $${i + 2})`).join(', ');
            await client.query(
                `INSERT INTO role_permissions (role_id, permission_id) VALUES ${values}`,
                [roleId, ...permissionIds]
            );
        }
        await client.query('COMMIT');
        return true;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

export const getUsersByRole = async (roleId) => {
    const { rows } = await db.query(
        `SELECT usersid AS user_id, username, email, firstname AS first_name,
                lastname AS last_name, isactive AS is_active, createdat AS created_at
         FROM users WHERE rolesid = $1 ORDER BY createdat DESC`,
        [roleId]
    );
    return rows;
};
