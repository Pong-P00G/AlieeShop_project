<script setup>
import { ref, computed, onMounted } from 'vue';
import { roleAPI } from '../api/roleApi';
import { useToast } from '../composables/useToast.js';
import {
    Shield, ShieldCheck, ShieldAlert,
    Loader2, AlertCircle, RefreshCw,
    Plus, Pencil, Trash2, X,
    Check, Minus, ChevronRight, Layers,
    SlidersHorizontal, Save, FileKey,
    Search, Settings2,
} from 'lucide-vue-next';

const emit = defineEmits(['roles-updated']);
const toast = useToast();

const roles = ref([]);
const permissions = ref([]);
const loadingRoles = ref(false);
const rolesError = ref(null);
const expandedRoleId = ref(null);
const selectedPermissions = ref({});
// Snapshot of the saved state so each role can show an "unsaved changes" hint.
const originalPermissions = ref({});
const savingPermissions = ref(false);
const permissionSearch = ref('');

const showRoleModal = ref(false);
const editingRole = ref(null);
const roleForm = ref({ role_name: '', description: '', level: 3 });
const savingRole = ref(false);

const showPermissionModal = ref(false);
const editingPermission = ref(null);
const permissionForm = ref({ permission_key: '', permission_name: '', module: '', description: '', type: 'backend' });
const savingPermission = ref(false);

const deleteTarget = ref(null);
const showDeleteRoleConfirm = ref(false);
const showDeletePermConfirm = ref(false);
const deletingTarget = ref(false);

const availableModules = computed(() => {
    const mods = new Set(permissions.value.map(p => p.module));
    return Array.from(mods).sort();
});

const totalPermissions = computed(() => permissions.value.length);

const permissionsByTypeAndModule = computed(() => {
    const grouped = {};
    for (const p of permissions.value) {
        const type = p.type || 'backend';
        if (!grouped[type]) grouped[type] = { type, modules: {} };
        if (!grouped[type].modules[p.module]) grouped[type].modules[p.module] = { module: p.module, permissions: [] };
        grouped[type].modules[p.module].permissions.push(p);
    }
    // Sort types: frontend first, then backend
    const sortedTypes = Object.values(grouped).sort((a, b) => {
        const order = { frontend: 0, backend: 1 };
        return (order[a.type] ?? 99) - (order[b.type] ?? 99);
    });
    // Sort modules within each type
    for (const t of sortedTypes) {
        t.modules = Object.values(t.modules).sort((a, b) => a.module.localeCompare(b.module));
    }
    return sortedTypes;
});

// Same grouping, narrowed by the search box. Empty modules/types drop out so the
// matrix never shows a card the admin cannot act on.
const filteredPermissionGroups = computed(() => {
    const q = permissionSearch.value.trim().toLowerCase();
    if (!q) return permissionsByTypeAndModule.value;

    return permissionsByTypeAndModule.value
        .map(typeGroup => ({
            ...typeGroup,
            modules: typeGroup.modules
                .map(moduleGroup => ({
                    ...moduleGroup,
                    permissions: moduleGroup.permissions.filter(p =>
                        p.permission_name?.toLowerCase().includes(q) ||
                        p.permission_key?.toLowerCase().includes(q) ||
                        p.module?.toLowerCase().includes(q)
                    ),
                }))
                .filter(m => m.permissions.length > 0),
        }))
        .filter(t => t.modules.length > 0);
});

const typeConfig = {
    frontend: { label: 'Front-end', color: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500' },
    backend:  { label: 'Back-end',  color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
};

const roleLevelConfig = {
    0: { label: 'Owner',      level: 'Level 0', color: 'bg-violet-100 text-violet-700', icon: ShieldAlert },
    1: { label: 'Superadmin', level: 'Level 1', color: 'bg-ink text-paper', icon: ShieldAlert },
    2: { label: 'Admin',      level: 'Level 2', color: 'bg-info/10 text-info', icon: ShieldCheck },
    3: { label: 'Customer',   level: 'Level 3', color: 'bg-accent/10 text-accent', icon: Shield },
};

const getRoleLevel = (role) => {
    if (!role) return { label: 'Unknown', level: '', color: 'bg-neutral-100 text-neutral-500', icon: Shield };
    const roleId = typeof role === 'object' ? role.role_id : role;
    if (typeof role === 'object' && role.level !== null && role.level !== undefined) {
        const levelNum = Number(role.level);
        if (roleLevelConfig[levelNum]) {
            return { ...roleLevelConfig[levelNum], label: roleLevelConfig[levelNum].label + (roleId > 3 ? ' (' + role.role_name + ')' : '') };
        }
        return { label: 'Level ' + levelNum, level: 'Level ' + levelNum, color: 'bg-neutral-100 text-neutral-600', icon: Shield };
    }
    return roleLevelConfig[roleId] || { label: 'Custom', level: 'Custom', color: 'bg-neutral-100 text-neutral-600', icon: Shield };
};

const snapshotPermissions = (permsMap) => {
    const snapshot = {};
    for (const [roleId, set] of Object.entries(permsMap)) {
        snapshot[roleId] = new Set(set);
    }
    return snapshot;
};

const fetchRoles = async () => {
    try {
        loadingRoles.value = true;
        rolesError.value = null;
        const [rolesData, permsData] = await Promise.all([roleAPI.getAllRoles(), roleAPI.getAllPermissions()]);
        roles.value = rolesData.sort((a, b) => (a.level || 99) - (b.level || 99));
        permissions.value = permsData;
        const permsMap = {};
        for (const role of rolesData) {
            // The API can return a role with no permission array at all — default
            // to an empty set so the tri-state controls still render correctly.
            const keys = role.permissions || [];
            const ids = keys.map(k => permsData.find(p => p.permission_key === k)?.permission_id).filter(Boolean);
            permsMap[role.role_id] = new Set(ids);
        }
        selectedPermissions.value = permsMap;
        originalPermissions.value = snapshotPermissions(permsMap);
        emit('roles-updated', roles.value);
    } catch (err) {
        rolesError.value = err.message || 'Failed to load roles';
    } finally {
        loadingRoles.value = false;
    }
};

const toggleRoleExpand = (roleId) => {
    expandedRoleId.value = expandedRoleId.value === roleId ? null : roleId;
    if (expandedRoleId.value === roleId) permissionSearch.value = '';
};

const togglePermission = (roleId, permissionId) => {
    if (!selectedPermissions.value[roleId]) selectedPermissions.value[roleId] = new Set();
    const set = selectedPermissions.value[roleId];
    set.has(permissionId) ? set.delete(permissionId) : set.add(permissionId);
    selectedPermissions.value = { ...selectedPermissions.value };
};

const toggleModule = (roleId, modulePerms) => {
    if (!selectedPermissions.value[roleId]) selectedPermissions.value[roleId] = new Set();
    const set = selectedPermissions.value[roleId];
    const allEnabled = modulePerms.every(p => set.has(p.permission_id));
    for (const p of modulePerms) allEnabled ? set.delete(p.permission_id) : set.add(p.permission_id);
    selectedPermissions.value = { ...selectedPermissions.value };
};

const isModuleFullyEnabled = (roleId, modulePerms) => {
    const set = selectedPermissions.value[roleId];
    if (!set || modulePerms.length === 0) return false;
    return modulePerms.every(p => set.has(p.permission_id));
};

const isModulePartiallyEnabled = (roleId, modulePerms) => {
    const set = selectedPermissions.value[roleId];
    if (!set) return false;
    const enabled = modulePerms.filter(p => set.has(p.permission_id));
    return enabled.length > 0 && enabled.length < modulePerms.length;
};

// ── Type-level select all (a type is just the flat list of its modules) ──
const permsOfType = (typeGroup) => typeGroup.modules.flatMap(m => m.permissions);
const toggleType = (roleId, typeGroup) => toggleModule(roleId, permsOfType(typeGroup));
const isTypeFullyEnabled = (roleId, typeGroup) => isModuleFullyEnabled(roleId, permsOfType(typeGroup));
const isTypePartiallyEnabled = (roleId, typeGroup) => isModulePartiallyEnabled(roleId, permsOfType(typeGroup));

// ── Role-level select all ──
const enabledCount = (roleId) => selectedPermissions.value[roleId]?.size || 0;
const isRoleFullyEnabled = (roleId) => {
    const set = selectedPermissions.value[roleId];
    if (!set || totalPermissions.value === 0) return false;
    return set.size === totalPermissions.value;
};
const isRoleEmpty = (roleId) => enabledCount(roleId) === 0;
const setAllForRole = (roleId, enable) => {
    const set = new Set(enable ? permissions.value.map(p => p.permission_id) : []);
    selectedPermissions.value = { ...selectedPermissions.value, [roleId]: set };
};

const isRoleDirty = (roleId) => {
    const current = selectedPermissions.value[roleId] || new Set();
    const original = originalPermissions.value[roleId] || new Set();
    if (current.size !== original.size) return true;
    for (const id of current) if (!original.has(id)) return true;
    return false;
};

const hasUnsavedChanges = computed(() =>
    roles.value.some(role => isRoleDirty(role.role_id))
);

const saveRolePermissions = async (roleId) => {
    try {
        savingPermissions.value = true;
        const permIds = Array.from(selectedPermissions.value[roleId] || []);
        await roleAPI.updateRolePermissions(roleId, permIds);
        toast.success('Permissions updated');
        await fetchRoles();
    } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to save permissions');
    } finally {
        savingPermissions.value = false;
    }
};

const openCreateRole = () => {
    editingRole.value = null;
    roleForm.value = { role_name: '', description: '', level: 3 };
    showRoleModal.value = true;
};

const openEditRole = (role) => {
    editingRole.value = { ...role };
    roleForm.value = { role_name: role.role_name, description: role.description || '', level: role.level || 3 };
    showRoleModal.value = true;
};

const closeRoleModal = () => {
    showRoleModal.value = false;
    editingRole.value = null;
    roleForm.value = { role_name: '', description: '', level: 3 };
};

const saveRole = async () => {
    try {
        savingRole.value = true;
        if (editingRole.value) {
            await roleAPI.updateRole(editingRole.value.role_id, roleForm.value);
            toast.success('Role updated successfully');
        } else {
            await roleAPI.createRole(roleForm.value);
            toast.success('Role created successfully');
        }
        closeRoleModal();
        await fetchRoles();
    } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to save role');
    } finally {
        savingRole.value = false;
    }
};

const confirmDeleteRole = (role) => {
    if (role.role_id <= 3) {
        toast.error('Cannot delete default system roles');
        return;
    }
    deleteTarget.value = role;
    showDeleteRoleConfirm.value = true;
};

const executeDeleteRole = async () => {
    try {
        deletingTarget.value = true;
        await roleAPI.deleteRole(deleteTarget.value.role_id);
        toast.success('Role deleted');
        showDeleteRoleConfirm.value = false;
        deleteTarget.value = null;
        await fetchRoles();
    } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to delete role');
    } finally {
        deletingTarget.value = false;
    }
};

const openCreatePermission = () => {
    editingPermission.value = null;
    permissionForm.value = { permission_key: '', permission_name: '', module: '', description: '', type: 'backend' };
    showPermissionModal.value = true;
};

const openEditPermission = (perm) => {
    editingPermission.value = { ...perm };
    permissionForm.value = {
        permission_key: perm.permission_key,
        permission_name: perm.permission_name,
        module: perm.module,
        description: perm.description || '',
        type: perm.type || 'backend',
    };
    showPermissionModal.value = true;
};

const closePermissionModal = () => {
    showPermissionModal.value = false;
    editingPermission.value = null;
    permissionForm.value = { permission_key: '', permission_name: '', module: '', description: '', type: 'backend' };
};

const savePermission = async () => {
    try {
        savingPermission.value = true;
        if (editingPermission.value) {
            await roleAPI.updatePermission(editingPermission.value.permission_id, permissionForm.value);
            toast.success('Permission updated successfully');
        } else {
            await roleAPI.createPermission(permissionForm.value);
            toast.success('Permission created successfully');
        }
        closePermissionModal();
        await fetchRoles();
    } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to save permission');
    } finally {
        savingPermission.value = false;
    }
};

const confirmDeletePermission = (perm) => {
    deleteTarget.value = perm;
    showDeletePermConfirm.value = true;
};

const executeDeletePermission = async () => {
    try {
        deletingTarget.value = true;
        await roleAPI.deletePermission(deleteTarget.value.permission_id);
        toast.success('Permission deleted');
        showDeletePermConfirm.value = false;
        deleteTarget.value = null;
        await fetchRoles();
    } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to delete permission');
    } finally {
        deletingTarget.value = false;
    }
};

onMounted(() => {
    fetchRoles();
});
</script>

<template>
    <div class="space-y-6">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h2 class="text-xl font-bold text-ink flex items-center gap-2">
                    <ShieldCheck class="w-5 h-5 text-accent" />
                    Roles &amp; Permissions
                </h2>
                <p class="text-sm text-neutral-500 mt-1">
                    Define what each role can see and do across the storefront and API.
                </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
                <button @click="openCreatePermission" class="btn-outline text-sm gap-1.5">
                    <FileKey class="w-4 h-4" />
                    New Permission
                </button>
                <button @click="openCreateRole" class="btn-accent text-sm gap-1.5">
                    <Plus class="w-4 h-4" />
                    New Role
                </button>
            </div>
        </div>

        <!-- Loading skeleton -->
        <div v-if="loadingRoles && roles.length === 0" class="space-y-4">
            <div v-for="i in 3" :key="'role-sk-' + i" class="card-flat p-5 sm:p-6 flex items-center gap-4">
                <div class="w-12 h-12 rounded-2xl skeleton-shimmer shrink-0"></div>
                <div class="flex-1 space-y-3">
                    <div class="h-4 w-40 skeleton-shimmer rounded"></div>
                    <div class="h-3 w-64 skeleton-shimmer rounded"></div>
                    <div class="h-3 w-32 skeleton-shimmer rounded"></div>
                </div>
            </div>
        </div>

        <!-- Error -->
        <div v-else-if="rolesError" class="card-flat border-l-4 border-danger p-6 flex items-center gap-3">
            <AlertCircle class="w-6 h-6 text-danger shrink-0" />
            <div class="flex-1 min-w-0">
                <h3 class="font-bold text-ink text-sm">Could not load roles</h3>
                <p class="text-neutral-600 text-sm mt-0.5 truncate">{{ rolesError }}</p>
            </div>
            <button @click="fetchRoles" class="btn-primary text-sm shrink-0 gap-1.5">
                <RefreshCw class="w-3.5 h-3.5" /> Retry
            </button>
        </div>

        <!-- Empty -->
        <div v-else-if="roles.length === 0" class="card-flat p-12 text-center">
            <Shield class="w-12 h-12 text-neutral-300 mx-auto mb-4" />
            <p class="text-neutral-500 text-sm">No roles defined yet.</p>
            <button @click="openCreateRole" class="btn-accent text-sm gap-1.5 mt-5 mx-auto">
                <Plus class="w-4 h-4" /> Create the first role
            </button>
        </div>

        <!-- Role list -->
        <div v-else class="space-y-4">
            <article
                v-for="role in roles"
                :key="role.role_id"
                class="card-flat overflow-hidden transition-shadow duration-300 hover:shadow-[0_12px_32px_-12px_rgb(0_0_0_/0.14)]"
            >
                <!-- Role header -->
                <div class="flex items-start gap-4 p-5 sm:p-6">
                    <button
                        type="button"
                        @click="toggleRoleExpand(role.role_id)"
                        :class="['w-12 h-12 rounded-2xl inline-flex items-center justify-center shrink-0 transition-transform duration-200 hover:scale-105', getRoleLevel(role).color]"
                        :aria-label="'Toggle ' + role.role_name + ' permissions'"
                    >
                        <component :is="getRoleLevel(role).icon" class="w-6 h-6" />
                    </button>

                    <div class="flex-1 min-w-0 cursor-pointer" @click="toggleRoleExpand(role.role_id)">
                        <div class="flex items-center gap-2.5 flex-wrap">
                            <h3 class="font-bold text-ink text-lg truncate">{{ role.role_name }}</h3>
                            <span v-if="role.role_id <= 3" class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 border border-neutral-200">System</span>
                            <span
                                v-if="role.level !== null && role.level !== undefined"
                                :class="['inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider', getRoleLevel(role).color]"
                            >
                                <component :is="getRoleLevel(role).icon" class="w-3 h-3" />
                                {{ getRoleLevel(role).level }}
                            </span>
                            <span v-if="isRoleDirty(role.role_id)" class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-warning/10 text-warning">
                                <span class="w-1.5 h-1.5 rounded-full bg-warning pulse-dot"></span>
                                Unsaved
                            </span>
                        </div>
                        <p class="text-sm text-neutral-500 mt-1 truncate">{{ role.description || 'No description' }}</p>
                        <div class="flex items-center gap-3 mt-2.5 text-xs text-neutral-500">
                            <span class="inline-flex items-center gap-1.5">
                                <Shield class="w-3.5 h-3.5 text-neutral-400" />
                                {{ role.user_count }} user{{ role.user_count !== 1 ? 's' : '' }}
                            </span>
                            <span class="text-neutral-200">|</span>
                            <span class="inline-flex items-center gap-1.5">
                                <Layers class="w-3.5 h-3.5 text-neutral-400" />
                                {{ role.permissions?.length || 0 }} permission{{ role.permissions?.length !== 1 ? 's' : '' }}
                            </span>
                        </div>
                    </div>

                    <div class="flex items-center gap-1 shrink-0">
                        <button @click="openEditRole(role)" class="btn-ghost p-2" :title="'Edit ' + role.role_name">
                            <Pencil class="w-4 h-4" />
                        </button>
                        <button
                            v-if="role.role_id > 3"
                            @click="confirmDeleteRole(role)"
                            class="btn-ghost p-2 text-danger hover:bg-danger/10"
                            :title="'Delete ' + role.role_name"
                        >
                            <Trash2 class="w-4 h-4" />
                        </button>
                        <button @click="toggleRoleExpand(role.role_id)" class="btn-ghost p-2" :aria-label="'Toggle ' + role.role_name + ' permissions'">
                            <ChevronRight class="w-5 h-5 text-neutral-400 transition-transform duration-300" :class="{ 'rotate-90': expandedRoleId === role.role_id }" />
                        </button>
                    </div>
                </div>

                <!-- Permission matrix -->
                <div v-if="expandedRoleId === role.role_id" class="border-t border-neutral-100 bg-neutral-50/70 px-5 sm:px-6 py-6 animate-fade-up">
                    <!-- Panel header -->
                    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl bg-paper border border-neutral-200 inline-flex items-center justify-center shrink-0">
                                <SlidersHorizontal class="w-5 h-5 text-ink" />
                            </div>
                            <div>
                                <h4 class="font-bold text-ink text-sm">Permission Settings</h4>
                                <p class="text-xs text-neutral-500 mt-0.5">
                                    <span :class="enabledCount(role.role_id) === totalPermissions && totalPermissions > 0 ? 'text-success font-semibold' : ''">{{ enabledCount(role.role_id) }}</span>
                                    of {{ totalPermissions }} permissions enabled
                                </p>
                            </div>
                        </div>

                        <div class="flex flex-col sm:flex-row sm:items-center gap-2">
                            <div class="relative flex-1 sm:flex-none">
                                <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                                <input
                                    v-model="permissionSearch"
                                    type="text"
                                    class="input-base pl-9 pr-3 py-2 text-sm sm:w-56"
                                    placeholder="Search permissions…"
                                    aria-label="Search permissions"
                                />
                            </div>
                            <button
                                @click="setAllForRole(role.role_id, !isRoleFullyEnabled(role.role_id))"
                                class="btn-outline text-xs gap-1.5 py-2"
                                :disabled="totalPermissions === 0"
                            >
                                <Check v-if="!isRoleFullyEnabled(role.role_id)" class="w-3.5 h-3.5" />
                                <X v-else class="w-3.5 h-3.5" />
                                {{ isRoleFullyEnabled(role.role_id) ? 'Clear all' : 'Select all' }}
                            </button>
                            <button
                                @click="saveRolePermissions(role.role_id)"
                                :disabled="savingPermissions"
                                :class="['btn-accent text-sm gap-2', isRoleDirty(role.role_id) ? 'ring-2 ring-accent/30' : '']"
                            >
                                <Loader2 v-if="savingPermissions" class="w-4 h-4 animate-spin" />
                                <Save v-else class="w-4 h-4" />
                                {{ savingPermissions ? 'Saving…' : 'Save Permissions' }}
                            </button>
                        </div>
                    </div>

                    <!-- No permissions -->
                    <div v-if="permissionsByTypeAndModule.length === 0" class="text-center py-10 text-neutral-400 text-sm">
                        <FileKey class="w-10 h-10 mx-auto mb-3 text-neutral-300" />
                        No permissions defined yet.
                        <button @click="openCreatePermission" class="text-accent hover:underline font-medium">Add one</button>
                    </div>

                    <!-- No search results -->
                    <div v-else-if="filteredPermissionGroups.length === 0" class="text-center py-10 text-neutral-400 text-sm">
                        <Search class="w-10 h-10 mx-auto mb-3 text-neutral-300" />
                        No permissions match “{{ permissionSearch }}”.
                    </div>

                    <div v-else class="space-y-7">
                        <div v-for="typeGroup in filteredPermissionGroups" :key="typeGroup.type">
                            <!-- Type header -->
                            <div class="flex items-center justify-between gap-3 mb-3">
                                <div class="flex items-center gap-2.5">
                                    <span :class="['inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border', typeConfig[typeGroup.type]?.color || 'bg-neutral-100 text-neutral-600 border-neutral-200']">
                                        <Settings2 class="w-3 h-3" />
                                        {{ typeConfig[typeGroup.type]?.label || typeGroup.type }}
                                    </span>
                                    <span class="text-[11px] text-neutral-400">
                                        {{ permsOfType(typeGroup).length }} permission{{ permsOfType(typeGroup).length !== 1 ? 's' : '' }}
                                    </span>
                                </div>
                                <button
                                    @click="toggleType(role.role_id, typeGroup)"
                                    class="text-[11px] font-semibold text-neutral-500 hover:text-ink transition-colors"
                                >
                                    {{ isTypeFullyEnabled(role.role_id, typeGroup) ? 'Clear all' : 'Select all' }}
                                </button>
                            </div>

                            <!-- Module cards -->
                            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div v-for="moduleGroup in typeGroup.modules" :key="moduleGroup.module" class="bg-paper rounded-2xl border border-neutral-200 overflow-hidden">
                                    <!-- Module header -->
                                    <div
                                        @click="toggleModule(role.role_id, moduleGroup.permissions)"
                                        class="px-4 py-3 border-b border-neutral-100 flex items-center justify-between gap-3 cursor-pointer hover:bg-neutral-50 transition-colors"
                                    >
                                        <div class="flex items-center gap-2 min-w-0">
                                            <Layers class="w-4 h-4 text-neutral-400 shrink-0" />
                                            <span class="text-xs font-bold uppercase tracking-wider text-neutral-600 truncate">{{ moduleGroup.module }}</span>
                                        </div>
                                        <div class="flex items-center gap-2.5 shrink-0">
                                            <span class="text-[11px] font-medium text-neutral-400">
                                                {{ moduleGroup.permissions.filter(p => selectedPermissions[role.role_id]?.has(p.permission_id)).length }}/{{ moduleGroup.permissions.length }}
                                            </span>
                                            <div :class="['w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all', isModuleFullyEnabled(role.role_id, moduleGroup.permissions) ? 'bg-accent border-accent' : isModulePartiallyEnabled(role.role_id, moduleGroup.permissions) ? 'bg-accent/40 border-accent' : 'border-neutral-300']">
                                                <Check v-if="isModuleFullyEnabled(role.role_id, moduleGroup.permissions)" class="w-3 h-3 text-white" />
                                                <Minus v-else-if="isModulePartiallyEnabled(role.role_id, moduleGroup.permissions)" class="w-3 h-3 text-white" />
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Permission rows -->
                                    <div class="divide-y divide-neutral-100">
                                        <div
                                            v-for="perm in moduleGroup.permissions"
                                            :key="perm.permission_id"
                                            class="group flex items-start gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors"
                                        >
                                            <button
                                                type="button"
                                                @click="togglePermission(role.role_id, perm.permission_id)"
                                                :class="['mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0', selectedPermissions[role.role_id]?.has(perm.permission_id) ? 'bg-accent border-accent' : 'border-neutral-300 hover:border-neutral-400']"
                                                :aria-label="'Toggle ' + perm.permission_name"
                                                :aria-pressed="selectedPermissions[role.role_id]?.has(perm.permission_id)"
                                            >
                                                <Check v-if="selectedPermissions[role.role_id]?.has(perm.permission_id)" class="w-3 h-3 text-white" />
                                            </button>
                                            <div class="flex-1 min-w-0 cursor-pointer" @click="togglePermission(role.role_id, perm.permission_id)">
                                                <p class="text-sm font-semibold text-ink truncate">{{ perm.permission_name }}</p>
                                                <p class="text-[11px] text-neutral-400 font-mono truncate mt-0.5">{{ perm.permission_key }}</p>
                                            </div>
                                            <div class="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                                <button @click.stop="openEditPermission(perm)" class="btn-ghost p-1.5" title="Edit permission">
                                                    <Pencil class="w-3.5 h-3.5" />
                                                </button>
                                                <button @click.stop="confirmDeletePermission(perm)" class="btn-ghost p-1.5 text-danger hover:bg-danger/10" title="Delete permission">
                                                    <Trash2 class="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </article>
        </div>

        <!-- Sticky save bar: surfaces unsaved work without scrolling back to a role -->
        <Transition name="fade">
            <div v-if="hasUnsavedChanges" class="sticky bottom-4 z-30 mx-auto w-full max-w-md">
                <div class="card-flat shadow-[0_12px_32px_-10px_rgb(0_0_0_/0.25)] px-4 py-3 flex items-center gap-3">
                    <span class="w-2 h-2 rounded-full bg-warning pulse-dot shrink-0"></span>
                    <p class="text-xs text-neutral-600 flex-1">You have unsaved permission changes.</p>
                </div>
            </div>
        </Transition>

        <!-- Role modal -->
        <div v-if="showRoleModal" @click="closeRoleModal" class="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div @click.stop class="card-flat w-full max-w-md p-5 sm:p-8 animate-[scale-in_0.25s_ease-out]">
                <div class="flex items-start justify-between gap-4 mb-6">
                    <div>
                        <h3 class="text-xl font-bold text-ink">{{ editingRole ? 'Edit Role' : 'Add New Role' }}</h3>
                        <p class="text-xs text-neutral-500 mt-1">{{ editingRole ? 'Update this role’s details.' : 'Create a role and configure its access.' }}</p>
                    </div>
                    <button @click="closeRoleModal" class="btn-ghost p-1.5 -mr-1.5 -mt-1 shrink-0" aria-label="Close dialog">
                        <X class="w-5 h-5" />
                    </button>
                </div>
                <form @submit.prevent="saveRole" class="space-y-4">
                    <div>
                        <label class="block text-xs font-bold uppercase tracking-[0.15em] text-ink mb-2">Role Name</label>
                        <input v-model="roleForm.role_name" type="text" required class="input-base" placeholder="e.g. moderator" />
                    </div>
                    <div>
                        <label class="block text-xs font-bold uppercase tracking-[0.15em] text-ink mb-2">Description</label>
                        <textarea v-model="roleForm.description" rows="3" class="input-base resize-none" placeholder="What this role can do..."></textarea>
                    </div>
                    <div>
                        <label class="block text-xs font-bold uppercase tracking-[0.15em] text-ink mb-2">Level</label>
                        <select v-model="roleForm.level" class="input-base">
                            <option :value="0">Level 0 Owner</option>
                            <option :value="1">Level 1 Superadmin</option>
                            <option :value="2">Level 2 Admin</option>
                            <option :value="3">Level 3 Customer</option>
                        </select>
                    </div>
                    <div v-if="!editingRole" class="text-xs text-neutral-400">New roles start with read/view permissions by default.</div>
                    <div class="flex gap-3 pt-4">
                        <button type="button" @click="closeRoleModal" class="btn-outline flex-1" :disabled="savingRole">Cancel</button>
                        <button type="submit" :disabled="savingRole" class="btn-accent flex-1">
                            <Loader2 v-if="savingRole" class="w-4 h-4 animate-spin" />
                            {{ savingRole ? 'Saving…' : (editingRole ? 'Update Role' : 'Create Role') }}
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Delete role confirmation -->
        <div v-if="showDeleteRoleConfirm" @click="showDeleteRoleConfirm = false" class="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div @click.stop class="card-flat w-full max-w-sm p-6 sm:p-8 text-center animate-[scale-in_0.25s_ease-out]">
                <div class="w-12 h-12 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trash2 class="w-6 h-6 text-danger" />
                </div>
                <h3 class="text-lg font-bold text-ink mb-2">Delete Role</h3>
                <p class="text-sm text-neutral-600 mb-2">Are you sure you want to delete <strong class="text-ink">{{ deleteTarget?.role_name }}</strong>?</p>
                <p class="text-xs text-neutral-500 mb-6">Users assigned this role will be moved to the default Customer role.</p>
                <div class="flex gap-3">
                    <button @click="showDeleteRoleConfirm = false" class="btn-outline flex-1" :disabled="deletingTarget">Cancel</button>
                    <button @click="executeDeleteRole" :disabled="deletingTarget" class="btn-danger flex-1">
                        <Loader2 v-if="deletingTarget" class="w-4 h-4 animate-spin" />
                        {{ deletingTarget ? 'Deleting…' : 'Delete Role' }}
                    </button>
                </div>
            </div>
        </div>

        <!-- Permission modal -->
        <div v-if="showPermissionModal" @click="closePermissionModal" class="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div @click.stop class="card-flat w-full max-w-md max-h-[90vh] overflow-y-auto p-5 sm:p-8 animate-[scale-in_0.25s_ease-out]">
                <div class="flex items-start justify-between gap-4 mb-6">
                    <div>
                        <h3 class="text-xl font-bold text-ink">{{ editingPermission ? 'Edit Permission' : 'Add New Permission' }}</h3>
                        <p class="text-xs text-neutral-500 mt-1">Keys are stable identifiers — renaming one can break code that checks it.</p>
                    </div>
                    <button @click="closePermissionModal" class="btn-ghost p-1.5 -mr-1.5 -mt-1 shrink-0" aria-label="Close dialog">
                        <X class="w-5 h-5" />
                    </button>
                </div>
                <form @submit.prevent="savePermission" class="space-y-4">
                    <div>
                        <label class="block text-xs font-bold uppercase tracking-[0.15em] text-ink mb-2">Permission Key</label>
                        <input v-model="permissionForm.permission_key" type="text" required class="input-base font-mono text-sm" placeholder="e.g. products.publish" />
                    </div>
                    <div>
                        <label class="block text-xs font-bold uppercase tracking-[0.15em] text-ink mb-2">Display Name</label>
                        <input v-model="permissionForm.permission_name" type="text" required class="input-base" placeholder="e.g. Publish Products" />
                    </div>
                    <div>
                        <label class="block text-xs font-bold uppercase tracking-[0.15em] text-ink mb-2">Module</label>
                        <input v-model="permissionForm.module" type="text" required class="input-base" placeholder="e.g. products" list="module-suggestions" />
                        <datalist id="module-suggestions">
                            <option v-for="mod in availableModules" :key="mod" :value="mod" />
                        </datalist>
                    </div>
                    <div>
                        <label class="block text-xs font-bold uppercase tracking-[0.15em] text-ink mb-2">Type</label>
                        <select v-model="permissionForm.type" class="input-base">
                            <option value="frontend">Front-end — Page access / UI visibility</option>
                            <option value="backend">Back-end — API operations / CRUD actions</option>
                        </select>
                        <p class="text-[10px] text-neutral-400 mt-1">Front-end controls page visibility; Back-end controls data operations.</p>
                    </div>
                    <div>
                        <label class="block text-xs font-bold uppercase tracking-[0.15em] text-ink mb-2">Description</label>
                        <textarea v-model="permissionForm.description" rows="2" class="input-base resize-none" placeholder="What this permission allows..."></textarea>
                    </div>
                    <div class="flex gap-3 pt-4">
                        <button type="button" @click="closePermissionModal" class="btn-outline flex-1" :disabled="savingPermission">Cancel</button>
                        <button type="submit" :disabled="savingPermission" class="btn-accent flex-1">
                            <Loader2 v-if="savingPermission" class="w-4 h-4 animate-spin" />
                            {{ savingPermission ? 'Saving…' : (editingPermission ? 'Update Permission' : 'Create Permission') }}
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Delete permission confirmation -->
        <div v-if="showDeletePermConfirm" @click="showDeletePermConfirm = false" class="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div @click.stop class="card-flat w-full max-w-sm p-6 sm:p-8 text-center animate-[scale-in_0.25s_ease-out]">
                <div class="w-12 h-12 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trash2 class="w-6 h-6 text-danger" />
                </div>
                <h3 class="text-lg font-bold text-ink mb-2">Delete Permission</h3>
                <p class="text-sm text-neutral-600 mb-6">Are you sure you want to delete <strong class="text-ink">{{ deleteTarget?.permission_name }}</strong>? This will remove it from all roles.</p>
                <div class="flex gap-3">
                    <button @click="showDeletePermConfirm = false" class="btn-outline flex-1" :disabled="deletingTarget">Cancel</button>
                    <button @click="executeDeletePermission" :disabled="deletingTarget" class="btn-danger flex-1">
                        <Loader2 v-if="deletingTarget" class="w-4 h-4 animate-spin" />
                        {{ deletingTarget ? 'Deleting…' : 'Delete Permission' }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
