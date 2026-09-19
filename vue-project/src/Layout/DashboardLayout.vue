<script setup>
import { ref, computed, watch, onUnmounted, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth.js';
import { useNotificationStore } from '@/stores/notifications.js';
import { dashboardAPI } from '@/api/dashboardApi.js';
import {
    LayoutDashboard,
    Package,
    Boxes,
    Users,
    BarChart3,
    FileText,
    Search,
    Bell,
    ChevronDown,
    LogOut,
    User as UserIcon,
    Settings,
    Menu,
    X,
    ShoppingBag,
    DollarSign,
    Tag,
    Activity,
    MessageSquare,
    Loader2,
    AlertTriangle,
    UserPlus,
    Sparkles,
} from 'lucide-vue-next';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();

const sidebarOpen = ref(true);
const showUserMenu = ref(false);
const showNotifications = ref(false);

// ── Global Search ────────────────────────────────────────────────────────────

const searchQuery = ref('');
const searchResults = ref({ products: [], orders: [], users: [] });
const searchLoading = ref(false);
const showSearchDropdown = ref(false);
let searchDebounce = null;

const hasSearchResults = computed(() =>
    searchResults.value.products.length > 0 ||
    searchResults.value.orders.length > 0 ||
    searchResults.value.users.length > 0
);

const totalSearchResults = computed(() =>
    searchResults.value.products.length +
    searchResults.value.orders.length +
    searchResults.value.users.length
);

watch(searchQuery, (val) => {
    if (searchDebounce) clearTimeout(searchDebounce);
    if (!val || val.trim().length < 2) {
        searchResults.value = { products: [], orders: [], users: [] };
        searchLoading.value = false;
        return;
    }
    searchLoading.value = true;
    showSearchDropdown.value = true;
    searchDebounce = setTimeout(async () => {
        try {
            const response = await dashboardAPI.globalSearch(val.trim());
            if (response.success) {
                searchResults.value = response.data;
            }
        } catch (err) {
            console.error('Search error:', err);
            searchResults.value = { products: [], orders: [], users: [] };
        } finally {
            searchLoading.value = false;
        }
    }, 300);
});

onUnmounted(() => {
    if (searchDebounce) clearTimeout(searchDebounce);
});

const clearSearch = () => {
    searchQuery.value = '';
    searchResults.value = { products: [], orders: [], users: [] };
    showSearchDropdown.value = false;
    searchLoading.value = false;
    if (searchDebounce) clearTimeout(searchDebounce);
};

const onSearchInputFocus = () => {
    if (searchQuery.value.trim().length >= 2) {
        showSearchDropdown.value = true;
    }
};

const navigateToSearch = (type, id) => {
    const paths = {
        product: `/admin/manage-products`,
        order: `/admin/orders`,
        user: `/admin/manage-user`,
    };
    clearSearch();
    router.push(paths[type] || '/admin/dashboard');
};

// Close dropdown on Escape
const onSearchKeydown = (e) => {
    if (e.key === 'Escape') {
        showSearchDropdown.value = false;
        e.target.blur();
    }
};

// ── Live Notifications ────────────────────────────────────────────────────────

const notifications = ref([]);
// The unread count lives in the notifications store so this bell, the public
// navbar and every tab share one source of truth
const unreadCount = computed(() => notificationStore.unreadCount);
let notificationPoll = null;

const notificationIconMap = {
    order: ShoppingBag,
    stock: AlertTriangle,
    user: UserPlus,
    product: Package,
    system: Bell,
};

const fetchNotifications = async () => {
    try {
        const response = await dashboardAPI.getNotifications(20);
        if (response.success) {
            notifications.value = response.data.notifications || [];
            // Publish to the store so the navbar badge and other tabs follow
            notificationStore.setCount(response.data.unreadCount || 0);
        }
    } catch (err) {
        console.error('Failed to fetch notifications:', err);
    }
};

const handleNotificationClick = async (notification) => {
    if (!notification.is_read) {
        // Goes through the store: updates the badge everywhere and broadcast
        await notificationStore.markRead(notification.id);
        notification.is_read = true;
    }
    if (notification.link) {
        router.push(notification.link);
    }
    showNotifications.value = false;
};

const handleMarkAllRead = async () => {
    await notificationStore.markAllRead();
    notifications.value.forEach(n => n.is_read = true);
};

const formatNotificationTime = (createdAt) => {
    if (!createdAt) return '';
    const diff = Math.floor((Date.now() - new Date(createdAt)) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

onMounted(() => {
    // Shared badge state + cross-tab sync (idempotent — the navbar starts it too)
    notificationStore.start();
    fetchNotifications();
    // Poll every 30 seconds
    notificationPoll = setInterval(fetchNotifications, 30000);
});

onUnmounted(() => {
    if (notificationPoll) {
        clearInterval(notificationPoll);
        notificationPoll = null;
    }
});

const navigation = [
    { label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
    { label: 'Products', to: '/admin/manage-products', icon: Package, permission: ['products.read', 'products.create', 'products.update'] },
    { label: 'Orders', to: '/admin/orders', icon: ShoppingBag, permission: ['orders.read', 'orders.create', 'orders.update'] },
    { label: 'Inventory', to: '/admin/manage-stock', icon: Boxes, permission: 'stock.view' },
    { label: 'Users', to: '/admin/manage-user', icon: Users, permission: ['users.read', 'users.create', 'users.update'] },
    { label: 'Analytics', to: '/admin/analytics', icon: BarChart3, permission: 'reports.view' },
    { label: 'Notifications', to: '/admin/notifications', icon: Bell, permission: 'dashboard.view' },
    { label: 'Activity', to: '/admin/activity-log', icon: Activity, permission: 'dashboard.view' },
    { label: 'Reviews', to: '/admin/reviews', icon: MessageSquare, permission: 'reviews.moderate' },
    { label: 'Categories', to: '/admin/manage-categories', icon: Tag, permission: 'dashboard.view' },
    { label: 'Payments', to: '/admin/payment-methods', icon: DollarSign, permission: 'dashboard.view' },
    { label: 'Config', to: '/admin/config', icon: Settings, permission: 'dashboard.view' },
    { label: 'Reports', to: '/admin/report', icon: FileText, permission: 'reports.view' }
];

const isActive = (path) => route.path === path;

const visibleNavigation = computed(() => {
    if (!authStore.permissions || authStore.permissions.length === 0) {
        return navigation;
    }
    return navigation.filter(item => {
        if (!item.permission) return true;
        const perms = Array.isArray(item.permission) ? item.permission : [item.permission];
        return perms.some(p => authStore.hasPermission(p));
    });
});

// Avatar menu navigation. Close the dropdown first so it does not stay
// open behind the destination page.
const goTo = (name) => {
    showUserMenu.value = false;
    router.push({ name });
};

const logout = () => {
    authStore.logout();
    router.push('/login');
};

const toggleSidebar = () => {
    sidebarOpen.value = !sidebarOpen.value;
};
</script>

<template>
    <div class="flex h-screen overflow-hidden bg-neutral-100">
        <!-- Sidebar (Desktop) -->
        <aside
            :class="sidebarOpen ? 'w-64' : 'w-20'"
            class="hidden lg:flex lg:shrink-0 transition-all duration-300"
        >
            <div class="flex flex-col w-full">
                <!-- Logo -->
                <div class="flex items-center justify-between h-16 px-5 bg-paper text-ink border-b border-paper">
                    <div v-if="sidebarOpen" class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
                            <Sparkles class="w-5 h-5 text-paper" />
                        </div>
                        <div>
                            <h1 class="text-base font-bold tracking-tight">Admin</h1>
                            <p class="text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-semibold">Dashboard</p>
                        </div>
                    </div>
                    <div v-else class="w-full flex justify-center">
                        <div class="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
                            <Sparkles class="w-5 h-5 text-paper" />
                        </div>
                    </div>
                </div>

                <!-- Navigation -->
                <nav class="flex-1 px-3 py-6 bg-paper overflow-y-auto">
                    <div class="space-y-1">
                        <router-link
                            v-for="item in visibleNavigation"
                            :key="item.to"
                            :to="item.to"
                            :class="[
                                'group flex items-center rounded-xl text-sm font-semibold transition-all duration-200',
                                sidebarOpen ? 'px-3 py-3' : 'px-0 py-3 justify-center',
                                isActive(item.to)
                                    ? 'bg-ink text-paper shadow-sm'
                                    : 'text-neutral-700 hover:bg-neutral-100'
                            ]"
                        >
                            <component :is="item.icon" :class="['shrink-0 w-5 h-5', sidebarOpen ? 'mr-3' : '']" />
                            <span v-if="sidebarOpen" class="flex-1">{{ item.label }}</span>
                            <span
                                v-if="sidebarOpen && item.badge"
                                class="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 bg-accent text-paper text-[10px] font-bold rounded-full"
                            >
                                {{ item.badge }}
                            </span>
                        </router-link>
                    </div>
                </nav>

                <!-- Sidebar Footer -->
                <div class="shrink-0 p-3 bg-neutral-50 border-t border-neutral-200">
                    <div
                        v-if="sidebarOpen"
                        class="flex items-center gap-3 p-2.5 bg-paper rounded-xl"
                    >
                        <div class="w-9 h-9 rounded-full bg-ink text-paper flex items-center justify-center font-bold text-sm shrink-0">
                            {{ authStore.user?.username?.charAt(0).toUpperCase() }}
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-bold text-ink truncate">{{ authStore.user?.username }}</p>
                            <p class="text-[10px] uppercase tracking-[0.15em] text-neutral-500 font-semibold">Administrator</p>
                        </div>
                    </div>
                    <div v-else class="flex justify-center">
                        <div class="w-9 h-9 rounded-full bg-ink text-paper flex items-center justify-center font-bold text-sm">
                            {{ authStore.user?.username?.charAt(0).toUpperCase() }}
                        </div>
                    </div>
                </div>
            </div>
        </aside>

        <!-- Mobile Sidebar Overlay -->
        <div
            v-if="sidebarOpen"
            @click="sidebarOpen = false"
            class="lg:hidden fixed inset-0 bg-ink/50 backdrop-blur-sm z-40"
        ></div>

        <!-- Mobile Sidebar -->
        <aside
            :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'"
            class="lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-paper transform transition-transform duration-300 flex flex-col"
        >
            <div class="flex items-center justify-between h-16 px-5 bg-ink text-paper border-b border-neutral-800">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
                        <Sparkles class="w-5 h-5 text-paper" />
                    </div>
                    <div>
                        <h1 class="text-base font-bold">Admin</h1>
                        <p class="text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-semibold">Dashboard</p>
                    </div>
                </div>
                <button @click="sidebarOpen = false" class="text-neutral-400 hover:text-paper">
                    <X class="w-5 h-5" />
                </button>
            </div>

            <nav class="flex-1 px-3 py-4 overflow-y-auto">
                <div class="space-y-1">
                    <router-link
                        v-for="item in visibleNavigation"
                        :key="item.to"
                        :to="item.to"
                        @click="sidebarOpen = false"
                        :class="[
                            'flex items-center px-3 py-3 rounded-xl text-sm font-semibold transition-all',
                            isActive(item.to)
                                ? 'bg-ink text-paper'
                                : 'text-neutral-700 hover:bg-neutral-100'
                        ]"
                    >
                        <component :is="item.icon" class="w-5 h-5 mr-3 shrink-0" />
                        <span class="flex-1">{{ item.label }}</span>
                        <span v-if="item.badge" class="ml-auto min-w-5 h-5 px-1.5 bg-accent text-paper text-[10px] font-bold rounded-full inline-flex items-center justify-center">
                            {{ item.badge }}
                        </span>
                    </router-link>
                </div>
            </nav>
        </aside>

        <!-- Main Content -->
        <div class="flex-1 flex flex-col overflow-hidden">
            <!-- Top Bar -->
            <header class="shrink-0 bg-paper border-b border-neutral-200">
                <div class="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8 gap-4">
                    <!-- Left: Menu Toggle + Search -->
                    <div class="flex items-center gap-4 flex-1">
                        <button @click="toggleSidebar" class="btn-icon">
                            <Menu class="w-5 h-5" />
                        </button>

                        <div class="hidden md:block flex-1 max-w-md relative">
                            <div class="relative">
                                <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                                <input
                                    v-model="searchQuery"
                                    type="text"
                                    placeholder="Search anything..."
                                    @focus="onSearchInputFocus"
                                    @keydown="onSearchKeydown"
                                    class="input-base pl-11 py-2.5 pr-10 text-sm bg-neutral-50 border-transparent focus:bg-paper"
                                />
                                <button
                                    v-if="searchQuery"
                                    @click="clearSearch"
                                    class="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-ink transition-colors"
                                >
                                    <X class="w-4 h-4" />
                                </button>
                            </div>

                            <!-- Search Dropdown -->
                            <div
                                v-if="showSearchDropdown && (searchQuery.trim().length >= 2 || searchLoading)"
                                @click.stop
                                class="absolute left-0 right-0 mt-2 card-flat shadow-xl z-50 max-h-96 overflow-y-auto"
                            >
                                <!-- Loading -->
                                <div v-if="searchLoading" class="p-6 flex items-center justify-center gap-3">
                                    <Loader2 class="w-5 h-5 text-accent animate-spin" />
                                    <span class="text-sm text-neutral-500 font-medium">Searching...</span>
                                </div>

                                <!-- No results -->
                                <div v-else-if="!hasSearchResults && !searchLoading && searchQuery.trim().length >= 2" class="p-8 text-center">
                                    <Search class="w-10 h-10 text-neutral-300 mx-auto mb-3" />
                                    <p class="text-sm font-semibold text-ink">No results found</p>
                                    <p class="text-xs text-neutral-500 mt-1">Try a different search term</p>
                                </div>

                                <!-- Results -->
                                <div v-else class="py-2">
                                    <!-- Products -->
                                    <div v-if="searchResults.products.length > 0">
                                        <div class="px-4 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-400">
                                            Products ({{ searchResults.products.length }})
                                        </div>
                                        <button
                                            v-for="product in searchResults.products"
                                            :key="'p-' + product.id"
                                            @click="navigateToSearch('product', product.id)"
                                            class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 transition-colors text-left"
                                        >
                                            <Package class="w-4 h-4 text-accent shrink-0" />
                                            <div class="flex-1 min-w-0">
                                                <p class="text-sm font-semibold text-ink truncate">{{ product.name }}</p>
                                                <p class="text-xs text-neutral-500">${{ parseFloat(product.price || 0).toFixed(2) }}</p>
                                            </div>
                                            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wedest"
                                                :class="product.status === 'active' ? 'bg-accent/10 text-accent' : 'bg-neutral-100 text-neutral-500'">
                                                {{ product.status }}
                                            </span>
                                        </button>
                                    </div>

                                    <!-- Orders -->
                                    <div v-if="searchResults.orders.length > 0" class="border-t border-neutral-100">
                                        <div class="px-4 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-400">
                                            Orders ({{ searchResults.orders.length }})
                                        </div>
                                        <button
                                            v-for="order in searchResults.orders"
                                            :key="'o-' + order.id"
                                            @click="navigateToSearch('order', order.id)"
                                            class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 transition-colors text-left"
                                        >
                                            <ShoppingBag class="w-4 h-4 text-accent shrink-0" />
                                            <div class="flex-1 min-w-0">
                                                <p class="text-sm font-semibold text-ink">Order #{{ order.id }}</p>
                                                <p class="text-xs text-neutral-500">{{ order.username }} &middot; ${{ parseFloat(order.amount || 0).toFixed(2) }}</p>
                                            </div>
                                            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                                                :class="{
                                                    'bg-warning/10 text-warning': order.status === 'pending',
                                                    'bg-info/10 text-info': order.status === 'confirmed',
                                                    'bg-accent/10 text-accent': order.status === 'shipped',
                                                    'bg-success/10 text-success': order.status === 'delivered',
                                                    'bg-danger/10 text-danger': order.status === 'cancelled',
                                                }">
                                                {{ order.status }}
                                            </span>
                                        </button>
                                    </div>

                                    <!-- Users -->
                                    <div v-if="searchResults.users.length > 0" class="border-t border-neutral-100">
                                        <div class="px-4 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-400">
                                            Users ({{ searchResults.users.length }})
                                        </div>
                                        <button
                                            v-for="user in searchResults.users"
                                            :key="'u-' + user.id"
                                            @click="navigateToSearch('user', user.id)"
                                            class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 transition-colors text-left"
                                        >
                                            <div class="w-7 h-7 rounded-full bg-neutral-100 text-neutral-600 flex items-center justify-center text-xs font-bold shrink-0">
                                                {{ (user.username || '?').charAt(0).toUpperCase() }}
                                            </div>
                                            <div class="flex-1 min-w-0">
                                                <p class="text-sm font-semibold text-ink truncate">{{ user.username }}</p>
                                                <p class="text-xs text-neutral-500 truncate">{{ user.email }}</p>
                                            </div>
                                            <span class="text-[10px] font-bold uppercase tracking-widest"
                                                :class="user.role_id <= 2 ? 'text-info' : 'text-neutral-500'">
                                                {{ user.role_id <= 2 ? 'Admin' : 'User' }}
                                            </span>
                                        </button>
                                    </div>

                                    <!-- View all -->
                                    <div class="border-t border-neutral-100 px-4 py-3 text-center">
                                        <p class="text-xs text-neutral-500">
                                            {{ totalSearchResults }} result{{ totalSearchResults !== 1 ? 's' : '' }} found
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Right: Notifications + User -->
                    <div class="flex items-center gap-2">
                        <!-- Notifications -->
                        <div class="relative">
                            <button
                                @click="showNotifications = !showNotifications"
                                class="btn-icon relative"
                            >
                                <Bell class="w-5 h-5" />
                                <span v-if="unreadCount > 0"
                                    class="absolute -top-1 -right-1 min-w-4.5 h-4.5 px-1 bg-accent text-paper text-[10px] font-bold rounded-full inline-flex items-center justify-center shadow-sm"
                                >
                                    {{ unreadCount > 99 ? '99+' : unreadCount }}
                                </span>
                            </button>

                            <div
                                v-if="showNotifications"
                                @click.stop
                                class="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-sm card-flat shadow-xl z-50 overflow-hidden"
                            >
                                <div class="p-4 border-b border-neutral-200 flex items-center justify-between">
                                    <h3 class="text-base font-bold text-ink">Notifications</h3>
                                    <div class="flex items-center gap-2">
                                        <span class="badge-ghost">{{ unreadCount }} new</span>
                                    </div>
                                </div>
                                <div class="max-h-96 overflow-y-auto">
                                    <div v-if="notifications.length === 0" class="p-8 text-center">
                                        <Bell class="w-10 h-10 text-neutral-300 mx-auto mb-3" />
                                        <p class="text-sm font-semibold text-ink">No notifications yet</p>
                                        <p class="text-xs text-neutral-500 mt-1">They'll appear here as events happen</p>
                                    </div>
                                    <div
                                        v-for="notification in notifications"
                                        :key="notification.id"
                                        @click="handleNotificationClick(notification)"
                                        :class="['p-4 border-b border-neutral-100 hover:bg-neutral-50 transition-colors cursor-pointer', !notification.is_read ? 'bg-accent-50/40' : '']"
                                    >
                                        <div class="flex items-start gap-3">
                                            <div :class="['w-9 h-9 rounded-full inline-flex items-center justify-center shrink-0', !notification.is_read ? 'bg-accent text-paper' : 'bg-neutral-100 text-neutral-500']">
                                                <component :is="notificationIconMap[notification.type] || Bell" class="w-4 h-4" />
                                            </div>
                                            <div class="flex-1 min-w-0">
                                                <p class="text-sm text-ink leading-relaxed">{{ notification.message }}</p>
                                                <p class="text-xs text-neutral-500 mt-1">{{ formatNotificationTime(notification.created_at) }}</p>
                                            </div>
                                            <div v-if="!notification.is_read" class="w-2 h-2 bg-accent rounded-full mt-2 shrink-0"></div>
                                        </div>
                                    </div>
                                </div>
                                <div class="p-3 border-t border-neutral-200 flex gap-2">
                                    <router-link
                                        to="/admin/notifications"
                                        @click.stop="showNotifications = false"
                                        class="flex-1 text-center text-sm font-bold text-accent hover:text-accent-600 transition-colors"
                                    >
                                        View all notifications
                                    </router-link>
                                    <button
                                        v-if="unreadCount > 0"
                                        @click.stop="handleMarkAllRead"
                                        class="flex-1 text-center text-sm font-bold text-neutral-600 hover:text-ink transition-colors"
                                    >
                                        Mark all read
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- User Menu -->
                        <div class="relative">
                            <button
                                @click="showUserMenu = !showUserMenu"
                                class="flex items-center gap-3 p-2 rounded-xl hover:bg-neutral-100 transition-colors"
                            >
                                <div class="w-9 h-9 rounded-full bg-ink text-paper flex items-center justify-center font-bold text-sm shrink-0">
                                    {{ authStore.user?.username?.charAt(0).toUpperCase() }}
                                </div>
                                <div class="hidden md:block text-left">
                                    <p class="text-sm font-bold text-ink">{{ authStore.user?.username }}</p>
                                    <p class="text-[10px] uppercase tracking-[0.15em] text-neutral-500 font-semibold">Admin</p>
                                </div>
                                <ChevronDown class="w-4 h-4 text-neutral-500 hidden md:block" />
                            </button>

                            <div
                                v-if="showUserMenu"
                                @click.stop
                                class="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-56 max-w-sm card-flat shadow-xl z-50 overflow-hidden"
                            >
                                <div class="p-2">
                                    <button
                                        type="button"
                                        @click="goTo('userprofile')"
                                        class="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-ink hover:bg-neutral-100 rounded-lg transition-colors"
                                    >
                                        <UserIcon class="w-4 h-4" />
                                        Profile
                                    </button>
                                    <button
                                        type="button"
                                        @click="goTo('settings')"
                                        class="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-ink hover:bg-neutral-100 rounded-lg transition-colors"
                                    >
                                        <Settings class="w-4 h-4" />
                                        Settings
                                    </button>
                                </div>
                                <div class="border-t border-neutral-200 p-2">
                                    <button
                                        @click="logout"
                                        class="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-danger hover:bg-danger/10 rounded-lg transition-colors"
                                    >
                                        <LogOut class="w-4 h-4" />
                                        Logout
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <!-- Main Content Area -->
            <main class="flex-1 overflow-y-auto bg-neutral-100">
                <router-view />
            </main>
        </div>

        <!-- Click outside to close dropdowns -->
        <div
            v-if="showUserMenu || showNotifications || showSearchDropdown"
            @click="showUserMenu = false; showNotifications = false; showSearchDropdown = false"
            class="fixed inset-0 z-30"
        ></div>
    </div>
</template>
