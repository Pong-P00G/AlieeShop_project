<script setup>
import { ref, computed, onMounted } from 'vue';
import { userAPI } from '../../api/userApi';
import { roleAPI } from '../../api/roleApi';
import { useToast } from '../../composables/useToast.js';
import RolePermissionManager from '../../components/RolePermissionManager.vue';
import {
    Users,
    UserCheck,
    Shield,
    Search,
    Plus,
    AlertCircle,
    RefreshCw,
    Loader2,
    Trash2,
    Pencil,
    X,
    Eye,
    EyeOff,
} from 'lucide-vue-next';

const toast = useToast();
const activeTab = ref('users');

// User State
const users = ref([]);
const loading = ref(false);
const saving = ref(false);
const error = ref(null);
const searchQuery = ref('');
const filterRole = ref('all');
const filterStatus = ref('all');
const showUserModal = ref(false);
const selectedUser = ref(null);
const isEditMode = ref(false);
const showDeleteConfirm = ref(false);
const userToDelete = ref(null);
const deletingId = ref(null);
const showPassword = ref(false);
const clientErrors = ref({});

const newUser = ref({
  username: '',
  first_name: '',
  last_name: '',
  email: '',
  password: '',
  role_id: 3,
  status: 'active'
});

// Roles (shared with RolePermissionManager)
const roles = ref([]);

// Load roles for the form's role selector. RolePermissionManager only emits its
// list after the Roles tab has been visited, so fetch independently on mount —
// otherwise the Add User modal starts with an empty role dropdown.
const fetchRoles = async () => {
  try {
    const list = await roleAPI.getAllRoles();
    if (Array.isArray(list) && list.length) roles.value = list;
  } catch (err) {
    console.warn('Could not load roles for the user form:', err?.message);
  }
};

// Mirror the server's rules (validationMiddleWare.js) so obvious mistakes are
// caught locally instead of surfacing as a failed POST.
const validateForm = () => {
  const errors = {};
  const u = newUser.value;
  if (!/^[a-zA-Z0-9]{4,30}$/.test(u.username || '')) {
    errors.username = '4-30 characters, letters and numbers only';
  }
  if (!u.first_name || u.first_name.trim().length < 2) errors.first_name = 'At least 2 characters';
  if (!u.last_name || u.last_name.trim().length < 2) errors.last_name = 'At least 2 characters';
  if (!/^\S+@\S+\.\S+$/.test(u.email || '')) errors.email = 'Enter a valid email address';
  if (!isEditMode.value && (!u.password || u.password.length < 8 || u.password.length > 30)) {
    errors.password = 'Must be 8-30 characters';
  }
  clientErrors.value = errors;
  return Object.keys(errors).length === 0;
};

const onRolesUpdated = (updatedRoles) => {
    roles.value = updatedRoles;
};

const getRoleLevel = (role) => {
    if (!role) return { label: 'Unknown', level: '', color: 'bg-neutral-100 text-neutral-500', icon: Shield };
    const roleId = typeof role === 'object' ? role.role_id : role;
    const roleLevelConfig = {
        0: { label: 'Owner',      level: 'Level 0', color: 'bg-violet-600 text-white', icon: Shield },
        1: { label: 'Superadmin', level: 'Level 1', color: 'bg-ink text-paper', icon: Shield },
        2: { label: 'Admin',      level: 'Level 2', color: 'bg-info/10 text-info', icon: Shield },
        3: { label: 'Customer',   level: 'Level 3', color: 'bg-accent/10 text-accent', icon: Shield },
    };
    if (typeof role === 'object' && role.level) {
        const levelNum = Number(role.level);
        if (roleLevelConfig[levelNum]) {
            return { ...roleLevelConfig[levelNum], label: roleLevelConfig[levelNum].label + (roleId > 3 ? ' (' + role.role_name + ')' : '') };
        }
        return { label: 'Level ' + levelNum, level: 'Level ' + levelNum, color: 'bg-neutral-200 text-neutral-700', icon: Shield };
    }
    return roleLevelConfig[roleId] || { label: 'Custom', level: 'Custom', color: 'bg-neutral-200 text-neutral-700', icon: Shield };
};

// Fetch users from API
const fetchUsers = async () => {
  try {
    loading.value = true;
    error.value = null;
    const response = await userAPI.getAllUsers();
    users.value = response.map(user => ({
      ...user,
      status: 'active',
      created: user.created_at
    }));
  } catch (err) {
    error.value = err.message || 'Failed to load users';
  } finally {
    loading.value = false;
  }
};

// Computed
const filteredUsers = computed(() => {
  let result = users.value;

  // Search
  if (searchQuery.value) {
    const search = searchQuery.value.toLowerCase();
    result = result.filter(u =>
      u.username?.toLowerCase().includes(search) ||
      u.email?.toLowerCase().includes(search)
    );
  }

  // Role filter
  if (filterRole.value !== 'all') {
    result = result.filter(u => u.role_name === filterRole.value);
  }

  // Status filter
  if (filterStatus.value !== 'all') {
    result = result.filter(u => u.status === filterStatus.value);
  }

  return result;
});

const totalUsers = computed(() => users.value.length);
const activeUsers = computed(() => users.value.filter(u => u.status === 'active').length);
const adminCount = computed(() => users.value.filter(u => u.role_id <= 2).length);

const savingLabel = computed(() => isEditMode.value ? 'Updating...' : 'Creating...');

// Methods
const openCreateModal = () => {
  isEditMode.value = false;
  clientErrors.value = {};
  showPassword.value = false;
  newUser.value = {
    username: '',
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    role_id: roles.value.find(r => Number(r.role_id) === 3)?.role_id ?? roles.value[0]?.role_id ?? 3,
    status: 'active'
  };
  showUserModal.value = true;
};

const openEditModal = (user) => {
  isEditMode.value = true;
  clientErrors.value = {};
  showPassword.value = false;
  selectedUser.value = user;
  newUser.value = {
    username: user.username,
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    email: user.email,
    role_id: user.role_id,
    status: user.status,
    password: ''
  };
  showUserModal.value = true;
};

const closeModal = () => {
  showUserModal.value = false;
  selectedUser.value = null;
  isEditMode.value = false;
};

const saveUser = async () => {
  if (!validateForm()) return;
  try {
    saving.value = true;

    if (isEditMode.value) {
      const updateData = {
        username: newUser.value.username,
        first_name: newUser.value.first_name,
        last_name: newUser.value.last_name,
        email: newUser.value.email
      };

      await userAPI.updateUser(selectedUser.value.user_id, updateData);
      toast.success('User updated successfully!');
    } else {
      const createData = {
        username: newUser.value.username,
        first_name: newUser.value.first_name,
        last_name: newUser.value.last_name,
        email: newUser.value.email,
        password: newUser.value.password,
        role_id: newUser.value.role_id
      };

      await userAPI.createUser(createData);
      toast.success('User created successfully!');
    }

    await fetchUsers();
    closeModal();
  } catch (err) {
    console.error('Error saving user:', err);
    toast.error(err.response?.data?.message || 'Failed to save user');
  } finally {
    saving.value = false;
  }
};

const confirmDelete = (user) => {
  userToDelete.value = user;
  showDeleteConfirm.value = true;
};

const executeDelete = async () => {
  if (!userToDelete.value) return;
  const user = userToDelete.value;
  try {
    deletingId.value = user.user_id;
    await userAPI.deleteUser(user.user_id);
    toast.success(`User "${user.username}" deleted`);
    await fetchUsers();
  } catch (err) {
    console.error('Error deleting user:', err);
    toast.error(err.response?.data?.message || 'Failed to delete user');
  } finally {
    deletingId.value = null;
    showDeleteConfirm.value = false;
    userToDelete.value = null;
  }
};

const cancelDelete = () => {
  showDeleteConfirm.value = false;
  userToDelete.value = null;
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

onMounted(() => {
  fetchUsers();
  fetchRoles();
});


</script>

<template>
  <div class="min-h-screen bg-neutral-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 class="text-2xl sm:text-3xl font-bold text-ink">User Management</h1>
          <p class="text-neutral-600 mt-1 text-sm">Manage accounts, roles, and permissions</p>
        </div>
        <div class="flex items-center gap-3">
          <button v-if="activeTab === 'users'" @click="openCreateModal" class="btn-accent text-sm gap-2">
            <Plus class="w-4 h-4" /> Add User
          </button>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex items-center gap-1 border-b border-neutral-200 mb-6">
        <button v-for="tab in [{ id: 'users', label: 'Users', icon: Users }, { id: 'roles', label: 'Roles & Permissions', icon: Shield }]"
            :key="tab.id" @click="activeTab = tab.id"
            :class="['inline-flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors', activeTab === tab.id ? 'border-ink text-ink' : 'border-transparent text-neutral-500 hover:text-ink']">
            <component :is="tab.icon" class="w-4 h-4" /> {{ tab.label }}
        </button>
      </div>

      <!-- USERS TAB -->
      <div v-if="activeTab === 'users'">

      <!-- Stats -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
        <div class="card-flat p-6 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <div class="flex items-center justify-between mb-4">
            <div class="w-12 h-12 bg-info/10 rounded-lg flex items-center justify-center transition-transform hover:scale-110">
              <Users class="w-6 h-6 text-info" />
            </div>
          </div>
          <p class="text-neutral-600 text-sm mb-1">Total Users</p>
          <p class="text-3xl font-bold text-ink">{{ totalUsers }}</p>
        </div>

        <div class="card-flat p-6 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <div class="flex items-center justify-between mb-4">
            <div class="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center transition-transform hover:scale-110">
              <UserCheck class="w-6 h-6 text-accent" />
            </div>
          </div>
          <p class="text-neutral-600 text-sm mb-1">Active Users</p>
          <p class="text-3xl font-bold text-ink">{{ activeUsers }}</p>
        </div>

        <div class="card-flat p-6 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <div class="flex items-center justify-between mb-4">
            <div class="w-12 h-12 bg-ink/10 rounded-lg flex items-center justify-center transition-transform hover:scale-110">
              <Shield class="w-6 h-6 text-ink" />
            </div>
          </div>
          <p class="text-neutral-600 text-sm mb-1">Administrators</p>
          <p class="text-3xl font-bold text-ink">{{ adminCount }}</p>
        </div>
      </div>

      <!-- Filters -->
      <div class="card-flat p-6 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Search -->
          <div class="md:col-span-1">
            <div class="relative">
              <input v-model="searchQuery" type="text" placeholder="Search users..." :disabled="loading" aria-label="Search users"
                class="input-base pl-10 disabled:opacity-50" />
              <Search class="absolute left-3 top-3.5 w-5 h-5 text-neutral-400" />
            </div>
          </div>

          <!-- Role Filter -->
          <select v-model="filterRole" :disabled="loading" class="input-base disabled:opacity-50" aria-label="Filter by role">
            <option value="all">All Roles</option>
            <option value="superadmin">Superadmin</option>
            <option value="admin">Admin</option>
            <option value="user">Customer</option>
          </select>

          <!-- Status Filter -->
          <select v-model="filterStatus" :disabled="loading" class="input-base disabled:opacity-50" aria-label="Filter by status">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <!-- Error State -->
      <div v-if="error" class="card-flat border-l-4 border-danger p-6 mb-6">
        <div class="flex items-center gap-3">
          <AlertCircle class="w-6 h-6 text-danger shrink-0" />
          <div class="flex-1 min-w-0">
            <h3 class="font-bold text-ink text-sm">Error Loading Users</h3>
            <p class="text-neutral-600 text-sm mt-0.5 truncate">{{ error }}</p>
          </div>
          <button @click="fetchUsers" class="btn-primary text-sm shrink-0 gap-1.5">
            <RefreshCw class="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading && users.length === 0" class="card-flat overflow-hidden">
        <div class="p-6 sm:p-8 space-y-6">
          <!-- Skeleton Header -->
          <div class="flex items-center justify-between">
            <div class="space-y-3">
              <div class="h-3 w-24 skeleton-shimmer rounded"></div>
              <div class="h-7 w-48 skeleton-shimmer rounded-lg"></div>
              <div class="h-4 w-36 skeleton-shimmer rounded"></div>
            </div>
          </div>

          <!-- Skeleton Stats -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div v-for="i in 3" :key="'sk-stat-' + i" class="rounded-2xl border border-neutral-200 p-5 space-y-4">
              <div class="w-12 h-12 skeleton-shimmer rounded-lg"></div>
              <div class="space-y-2">
                <div class="h-3 w-20 skeleton-shimmer rounded"></div>
                <div class="h-7 w-16 skeleton-shimmer rounded"></div>
              </div>
            </div>
          </div>

          <!-- Skeleton Filters -->
          <div class="rounded-2xl border border-neutral-200 p-5">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div v-for="i in 3" :key="'sk-filt-' + i" class="h-10 skeleton-shimmer rounded-xl"></div>
            </div>
          </div>

          <!-- Skeleton Table -->
          <div class="rounded-2xl border border-neutral-200 overflow-hidden">
            <div class="px-6 py-4 bg-neutral-50 border-b border-neutral-200">
              <div class="grid grid-cols-6 gap-4">
                <div v-for="i in 6" :key="'sk-th-' + i" class="h-3 skeleton-shimmer rounded w-3/4"></div>
              </div>
            </div>
            <div v-for="i in 4" :key="'sk-row-' + i" class="px-6 py-4 border-b border-neutral-200 last:border-b-0">
              <div class="grid grid-cols-6 gap-4 items-center">
                <div class="space-y-2">
                  <div class="h-4 w-32 skeleton-shimmer rounded"></div>
                  <div class="h-3 w-24 skeleton-shimmer rounded"></div>
                </div>
                <div><div class="h-5 w-20 skeleton-shimmer rounded-full"></div></div>
                <div><div class="h-3 w-16 skeleton-shimmer rounded"></div></div>
                <div><div class="h-5 w-16 skeleton-shimmer rounded-full"></div></div>
                <div><div class="h-3 w-20 skeleton-shimmer rounded"></div></div>
                <div class="flex justify-end gap-2">
                  <div class="h-8 w-14 skeleton-shimmer rounded-lg"></div>
                  <div class="h-8 w-14 skeleton-shimmer rounded-lg"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Users Table -->
      <div v-else class="card-flat overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full min-w-200">
            <thead class="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th class="px-6 py-4 text-left text-[10px] font-bold text-neutral-500 uppercase tracking-[0.15em]">User</th>
                <th class="px-6 py-4 text-left text-[10px] font-bold text-neutral-500 uppercase tracking-[0.15em]">Role</th>
                <th class="px-6 py-4 text-left text-[10px] font-bold text-neutral-500 uppercase tracking-[0.15em]">Level</th>
                <th class="px-6 py-4 text-left text-[10px] font-bold text-neutral-500 uppercase tracking-[0.15em]">Status</th>
                <th class="px-6 py-4 text-left text-[10px] font-bold text-neutral-500 uppercase tracking-[0.15em]">Joined</th>
                <th class="px-6 py-4 text-right text-[10px] font-bold text-neutral-500 uppercase tracking-[0.15em]">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-200">
              <tr v-for="user in filteredUsers" :key="user.user_id" class="hover:bg-neutral-50 transition-colors">
                <!-- User -->
                <td class="px-6 py-4">
                  <div>
                    <p class="font-semibold text-ink">{{ user.username }}</p>
                    <p class="text-sm text-neutral-500">{{ user.email }}</p>
                  </div>
                </td>

                <!-- Role -->
                <td class="px-6 py-4">                    <span :class="user.role_id <= 2 ? 'bg-ink/10 text-ink' : 'bg-info/10 text-info'"
                    class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                    <component :is="getRoleLevel(user).icon" class="w-3 h-3" />
                    {{ getRoleLevel(user).label }}
                  </span>
                </td>

                <!-- Level -->
                <td class="px-6 py-4">
                  <span class="text-xs font-semibold text-neutral-500">{{ getRoleLevel(user).level }}</span>
                </td>

                <!-- Status -->
                <td class="px-6 py-4">
                  <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-accent/10 text-accent">
                    <span class="w-1.5 h-1.5 rounded-full bg-accent"></span>
                    Active
                  </span>
                </td>

                <!-- Joined -->
                <td class="px-6 py-4">
                  <span class="text-sm text-neutral-600">{{ formatDate(user.created) }}</span>
                </td>

                <!-- Actions -->
                <td class="px-6 py-4 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <button @click="openEditModal(user)" class="btn-ghost text-xs gap-1.5" :disabled="deletingId === user.user_id">
                      <Pencil class="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button @click="confirmDelete(user)" class="btn-ghost text-xs gap-1.5 text-danger hover:bg-danger/10"
                      :disabled="deletingId === user.user_id">
                      <Trash2 class="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Empty State -->
        <div v-if="filteredUsers.length === 0" class="text-center py-16">
          <Users class="mx-auto w-12 h-12 text-neutral-300 mb-4" />
          <p class="text-neutral-500 text-sm">No users found</p>
        </div>
      </div>
    </div>
    </div><!-- end users tab -->

      <!-- ROLES & PERMISSIONS TAB -->
      <div v-if="activeTab === 'roles'">
        <RolePermissionManager @roles-updated="onRolesUpdated" />
      </div>

    <!-- User Modal (Create/Edit) -->
    <div v-if="showUserModal" @click="closeModal"
      class="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div @click.stop
        class="card-flat w-full max-w-lg max-h-[90vh] flex flex-col animate-[scale-in_0.25s_ease-out]">
        <!-- Modal header -->
        <div class="flex items-start justify-between gap-4 px-5 sm:px-8 pt-6 pb-4 border-b border-neutral-100">
          <div>
            <h3 class="text-xl font-bold text-ink">
              {{ isEditMode ? 'Edit User' : 'Add New User' }}
            </h3>
            <p class="text-xs text-neutral-500 mt-1">
              {{ isEditMode ? 'Update the account details below.' : 'Create an account and assign its role.' }}
            </p>
          </div>
          <button @click="closeModal" class="btn-ghost p-1.5 -mr-1.5 shrink-0" aria-label="Close dialog">
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Scrollable body -->
        <form @submit.prevent="saveUser" class="overflow-y-auto px-5 sm:px-8 py-6 space-y-5">
          <!-- Name row -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold uppercase tracking-[0.15em] text-ink mb-2">First Name *</label>
              <input v-model="newUser.first_name" type="text" required class="input-base" placeholder="John"
                :class="{ 'border-danger': clientErrors.first_name }" />
              <p v-if="clientErrors.first_name" class="text-[11px] text-danger mt-1">{{ clientErrors.first_name }}</p>
            </div>
            <div>
              <label class="block text-xs font-bold uppercase tracking-[0.15em] text-ink mb-2">Last Name *</label>
              <input v-model="newUser.last_name" type="text" required class="input-base" placeholder="Doe"
                :class="{ 'border-danger': clientErrors.last_name }" />
              <p v-if="clientErrors.last_name" class="text-[11px] text-danger mt-1">{{ clientErrors.last_name }}</p>
            </div>
          </div>

          <!-- Username + Email row -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold uppercase tracking-[0.15em] text-ink mb-2">Username *</label>
              <input v-model="newUser.username" type="text" required class="input-base" placeholder="johndoe"
                :class="{ 'border-danger': clientErrors.username }" />
              <p v-if="clientErrors.username" class="text-[11px] text-danger mt-1">{{ clientErrors.username }}</p>
              <p v-else class="text-[10px] text-neutral-400 mt-1">Letters and numbers only, 4-30 characters. Also used to sign in.</p>
            </div>
            <div>
              <label class="block text-xs font-bold uppercase tracking-[0.15em] text-ink mb-2">Email *</label>
              <input v-model="newUser.email" type="email" required class="input-base" placeholder="john@example.com"
                :class="{ 'border-danger': clientErrors.email }" />
              <p v-if="clientErrors.email" class="text-[11px] text-danger mt-1">{{ clientErrors.email }}</p>
            </div>
          </div>

          <!-- Password (only for create) -->
          <div v-if="!isEditMode">
            <label class="block text-xs font-bold uppercase tracking-[0.15em] text-ink mb-2">Password *</label>
            <div class="relative">
              <input v-model="newUser.password" :type="showPassword ? 'text' : 'password'" required
                class="input-base pr-10" placeholder="••••••••" autocomplete="new-password"
                :class="{ 'border-danger': clientErrors.password }" />
              <button type="button" @click="showPassword = !showPassword"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-ink"
                :aria-label="showPassword ? 'Hide password' : 'Show password'">
                <EyeOff v-if="showPassword" class="w-4 h-4" />
                <Eye v-else class="w-4 h-4" />
              </button>
            </div>
            <p v-if="clientErrors.password" class="text-[11px] text-danger mt-1">{{ clientErrors.password }}</p>
            <p v-else class="text-[10px] text-neutral-400 mt-1">8-30 characters.</p>
          </div>

          <!-- Role + Status row -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold uppercase tracking-[0.15em] text-ink mb-2">Role</label>
              <select v-model="newUser.role_id" class="input-base">
                <option v-if="roles.length === 0" :value="3">Customer — Level 3</option>
                <option v-for="r in roles" :key="r.role_id" :value="r.role_id">
                  {{ r.role_name }} — {{ getRoleLevel(r).label }}
                </option>
              </select>
              <p class="text-[10px] text-neutral-400 mt-1">Determines the user's permissions and level.</p>
            </div>
            <div>
              <label class="block text-xs font-bold uppercase tracking-[0.15em] text-ink mb-2">Status</label>
              <select v-model="newUser.status" class="input-base">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex gap-3 pt-2 pb-1">
            <button type="button" @click="closeModal" class="btn-outline flex-1" :disabled="saving">
              Cancel
            </button>
            <button type="submit" :disabled="saving" class="btn-accent flex-1">
              <Loader2 v-if="saving" class="w-4 h-4 animate-spin" />
              {{ saving ? savingLabel : (isEditMode ? 'Update' : 'Create') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteConfirm" @click="cancelDelete"
      class="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div @click.stop class="card-flat p-6 sm:p-8 max-w-sm w-full text-center animate-[scale-in_0.25s_ease-out]">
        <div class="w-12 h-12 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 class="w-6 h-6 text-danger" />
        </div>
        <h3 class="text-lg font-bold text-ink mb-2">Delete User</h3>
        <p class="text-sm text-neutral-600 mb-6">
          Are you sure you want to delete <strong class="text-ink">{{ userToDelete?.username }}</strong>? This action cannot be undone.
        </p>
        <div class="flex gap-3">
          <button @click="cancelDelete" class="btn-outline flex-1" :disabled="deletingId">Cancel</button>
          <button @click="executeDelete" :disabled="deletingId" class="btn-danger flex-1">
            <Loader2 v-if="deletingId === userToDelete?.user_id" class="w-4 h-4 animate-spin" />
            {{ deletingId === userToDelete?.user_id ? 'Deleting...' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>


  </div>
</template>