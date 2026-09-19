import * as RoleModel from '../model/roleModel.js';
import * as NotificationModel from '../model/notificationModel.js';

export const getAllRoles = async () => {
    const roles = await RoleModel.getAllRoles();
    const result = [];
    for (const role of roles) {
        const permissions = await RoleModel.getRolePermissions(role.role_id);
        const users = await RoleModel.getUsersByRole(role.role_id);
        result.push({
            ...role,
            permissions: permissions.map(p => p.permission_key),
            user_count: users.length
        });
    }
    return result.sort((a, b) => (a.level || 99) - (b.level || 99));
};

export const getRoleDetail = async (roleId) => {
    const role = await RoleModel.getRoleById(roleId);
    if (!role) return null;
    const permissions = await RoleModel.getRolePermissions(roleId);
    const users = await RoleModel.getUsersByRole(roleId);
    return {
        ...role,
        permissions: permissions.map(p => ({
            permission_id: p.permission_id,
            permission_key: p.permission_key,
            permission_name: p.permission_name,
            module: p.module
        })),
        user_count: users.length
    };
};

export const createRole = async (roleName, description, performedBy = 'system', level = 3) => {
    const role = await RoleModel.createRole(roleName, description, level);
    // Give new role default view permissions
    const allPerms = await RoleModel.getAllPermissions();
    const basicIds = allPerms
        .filter(p => p.permission_key.endsWith('.read') || p.permission_key.endsWith('.view'))
        .map(p => p.permission_id);
    if (basicIds.length > 0) {
        await RoleModel.setRolePermissions(role.role_id, basicIds);
    }
    // Audit log
    try {
        await NotificationModel.createAuditLog({
            action: 'create',
            entity_type: 'role',
            entity_id: role.role_id,
            entity_name: roleName,
            performed_by: performedBy,
            details: `Created role "${roleName}"`
        });
    } catch (err) {
        console.warn('Failed to audit log:', err.message);
    }
    return role;
};

export const updateRole = async (roleId, roleName, description, performedBy = 'system', level) => {
    const oldRole = await RoleModel.getRoleById(roleId);
    const result = await RoleModel.updateRole(roleId, roleName, description, level);
    // Audit log
    try {
        const oldName = oldRole?.role_name || 'Unknown';
        await NotificationModel.createAuditLog({
            action: 'update',
            entity_type: 'role',
            entity_id: roleId,
            entity_name: roleName,
            performed_by: performedBy,
            details: `Updated role "${oldName}" → "${roleName}"`
        });
    } catch (err) {
        console.warn('Failed to audit log:', err.message);
    }
    return result;
};

export const deleteRole = async (roleId, performedBy = 'system') => {
    const oldRole = await RoleModel.getRoleById(roleId);
    const result = await RoleModel.deleteRole(roleId);
    // Audit log
    try {
        await NotificationModel.createAuditLog({
            action: 'delete',
            entity_type: 'role',
            entity_id: roleId,
            entity_name: oldRole?.role_name || 'Unknown',
            performed_by: performedBy,
            details: `Deleted role "${oldRole?.role_name || 'Unknown'}"`
        });
    } catch (err) {
        console.warn('Failed to audit log:', err.message);
    }
    return result;
};

export const getAllPermissions = async () => {
    return await RoleModel.getAllPermissions();
};

export const createPermission = async (permissionKey, permissionName, module, description, performedBy = 'system', type = 'backend') => {
    const result = await RoleModel.createPermission(permissionKey, permissionName, module, description, type);
    // Audit log
    try {
        await NotificationModel.createAuditLog({
            action: 'create',
            entity_type: 'permission',
            entity_id: result.permission_id,
            entity_name: permissionName,
            performed_by: performedBy,
            details: `Created permission "${permissionName}" (${permissionKey}) in module "${module}" [${type}]`
        });
    } catch (err) {
        console.warn('Failed to audit log:', err.message);
    }
    return result;
};

export const updatePermission = async (permissionId, permissionKey, permissionName, module, description, performedBy = 'system', type) => {
    const result = await RoleModel.updatePermission(permissionId, permissionKey, permissionName, module, description, type);
    // Audit log
    try {
        await NotificationModel.createAuditLog({
            action: 'update',
            entity_type: 'permission',
            entity_id: permissionId,
            entity_name: permissionName,
            performed_by: performedBy,
            details: `Updated permission to "${permissionName}" (${permissionKey}) in module "${module}"${type ? ' [' + type + ']' : ''}`
        });
    } catch (err) {
        console.warn('Failed to audit log:', err.message);
    }
    return result;
};

export const deletePermission = async (permissionId, performedBy = 'system') => {
    // Get name before deletion
    const allPerms = await RoleModel.getAllPermissions();
    const perm = allPerms.find(p => p.permission_id === permissionId);
    const result = await RoleModel.deletePermission(permissionId);
    // Audit log
    try {
        await NotificationModel.createAuditLog({
            action: 'delete',
            entity_type: 'permission',
            entity_id: permissionId,
            entity_name: perm?.permission_name || 'Unknown',
            performed_by: performedBy,
            details: `Deleted permission "${perm?.permission_name || 'Unknown'}" (${perm?.permission_key || ''})`
        });
    } catch (err) {
        console.warn('Failed to audit log:', err.message);
    }
    return result;
};

export const updateRolePermissions = async (roleId, permissionIds, performedBy = 'system') => {
    const oldRole = await RoleModel.getRoleById(roleId);
    const result = await RoleModel.setRolePermissions(roleId, permissionIds);
    // Audit log
    try {
        await NotificationModel.createAuditLog({
            action: 'update_permissions',
            entity_type: 'role',
            entity_id: roleId,
            entity_name: oldRole?.role_name || 'Unknown',
            performed_by: performedBy,
            details: `Updated permissions for role "${oldRole?.role_name || 'Unknown'}" (${permissionIds.length} permissions assigned)`
        });
    } catch (err) {
        console.warn('Failed to audit log:', err.message);
    }
    return result;
};
