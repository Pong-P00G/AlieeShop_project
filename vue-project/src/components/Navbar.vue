<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import {
    ShoppingCart,
    Search,
    User,
    Heart,
    Menu,
    X,
    Home,
    Package,
    Phone,
    Info,
    Sparkles,
    LogOut,
    LayoutDashboard,
    ChevronDown,
    Bell
} from 'lucide-vue-next';
import { useAuthStore } from '../stores/auth.js';
import { useShopStore } from '../stores/shop.js';
import { useUIStore } from '../stores/ui.js';
import { useNotificationStore } from '../stores/notifications.js';
import ThemeToggle from './ThemeToggle.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const shop = useShopStore();
const ui = useUIStore();
const notificationStore = useNotificationStore();
const isMenuOpen = ref(false);
const scrolled = ref(false);
const isDropdownOpen = ref(false);

// Notification bell state (the list itself lives in the notifications store)
const showNotifications = ref(false);

const cartCount = computed(() => shop.cartCount || 0);

// Badge state is owned by the notifications store so every surface (both bells
// and both notification pages) and every tab agree on the unread count.
const notifications = computed(() => notificationStore.recent);
const unreadCount = computed(() => notificationStore.unreadCount);
const allNotificationsLink = computed(() => notificationStore.endpoints().all);

const markRead = (id) => notificationStore.markRead(id);

// Clear the badge as soon as the session ends (broadcasts to the other tabs)
watch(() => authStore.isAuthenticated, (isAuthed) => {
    if (!isAuthed) notificationStore.reset();
});

const toggleNotifications = () => {
    showNotifications.value = !showNotifications.value;
    if (showNotifications.value && isAuthenticated.value) {
        // Refresh on open so the dropdown never shows a stale list
        notificationStore.refresh();
    }
};

const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
};

onMounted(() => {
    // The store owns the 60s poll and the cross-tab channel (idempotent, so the
    // dashboard layout can start it too)
    notificationStore.start();
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('click', handleClickOutside);
    window.addEventListener('scroll', handleScroll);
});

onUnmounted(() => {
    // Note: the store's poll is intentionally left running — it is app-lifetime
    // so the badge keeps updating on pages that do not render a navbar.
    document.removeEventListener('keydown', handleKeydown);
    document.removeEventListener('click', handleClickOutside);
    window.removeEventListener('scroll', handleScroll);
    document.body.style.overflow = '';
});

const user = computed(() => authStore.user);
const isAuthenticated = computed(() => authStore.isAuthenticated);

const initials = computed(() => {
    if (!user.value) return '';
    const name = user.value.username || user.value.email || 'U';
    return name.charAt(0).toUpperCase();
});

const toggleDropdown = () => {
    isDropdownOpen.value = !isDropdownOpen.value;
};

const closeDropdown = () => {
    isDropdownOpen.value = false;
};

const handleLogout = () => {
    authStore.logout();
    closeDropdown();
    closeMenu();
    router.push('/');
};

const toggleMenu = () => {
    isMenuOpen.value = !isMenuOpen.value;
    document.body.style.overflow = isMenuOpen.value ? 'hidden' : '';
};

const closeMenu = () => {
    isMenuOpen.value = false;
    document.body.style.overflow = '';
};

const openSearch = () => {
    ui.openSearch();
};

const Navlinks = ref([
    { to: '/', label: 'Home', icon: Home, ariaLabel: 'Home' },
    { to: '/product', label: 'Product', icon: Package, ariaLabel: 'Browse Product' },
    { to: '/contact', label: 'Contact', icon: Phone, ariaLabel: 'Contact' },
    { to: '/about', label: 'About', icon: Info, ariaLabel: 'About' },
]);

const isActiveRoute = computed(() => (linkTo) =>
    route.path === linkTo || (linkTo !== '/' && route.path.startsWith(linkTo + '/'))
);

const handleScroll = () => {
    scrolled.value = window.scrollY > 20;
};

const handleKeydown = (event) => {
    if (event.key === 'Escape') {
        if (isMenuOpen.value) closeMenu();
    }
    // Cmd+K or Ctrl+K — open search
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        ui.openSearch();
    }
};



const handleClickOutside = (event) => {
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown && !dropdown.contains(event.target)) {
        isDropdownOpen.value = false;
    }
};

watch(route, () => {
    closeMenu();
    closeDropdown();
});
</script>

<template>
    <header
        class="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
        :class="scrolled ? 'py-3' : 'py-5'"
        role="banner"
    >
        <!-- Background -->
        <div
            class="absolute inset-0 transition-all duration-500"
            :class="scrolled
                ? 'bg-paper/95 backdrop-blur-xl border-b border-neutral-200 shadow-sm'
                : 'bg-paper/80 backdrop-blur-md'"
        ></div>

        <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between items-center">
                <!-- Logo -->
                <RouterLink
                    to="/"
                    class="flex items-center gap-2 group transition-all duration-300 hover:opacity-80 z-10"
                    aria-label="AlieeShop Home"
                >
                    <div class="relative">
                        <span class="text-2xl tracking-tight text-ink font-elegant">
                            <span class="font-light">ALIE</span><span class="font-bold text-orange-400 text-3xl">SHOP</span>
                        </span>
                    </div>
                </RouterLink>

                <!-- Desktop Navigation -->
                <nav
                    class="hidden lg:flex items-center bg-neutral-100 rounded-full p-1"
                    role="navigation"
                    aria-label="Main navigation"
                >
                    <RouterLink
                        v-for="link in Navlinks"
                        :key="link.label"
                        :to="link.to"
                        class="relative px-6 py-2 rounded-full font-medium text-sm transition-all duration-300 flex items-center gap-2 group/link"
                        :class="isActiveRoute(link.to)
                            ? 'bg-ink text-paper shadow-md'
                            : 'text-neutral-600 hover:text-ink hover:bg-paper'"
                        :aria-label="link.ariaLabel"
                    >
                        <component :is="link.icon" class="w-4 h-4" />
                        <span>{{ link.label }}</span>
                        <span
                            v-if="isActiveRoute(link.to)"
                            class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-accent rounded-full"
                        ></span>
                        <span
                            v-else
                            class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-accent rounded-full transition-all duration-300 group-hover/link:w-1/2"
                        ></span>
                    </RouterLink>
                </nav>

                <!-- Desktop Actions -->
                <div class="hidden lg:flex items-center gap-2">
                    <button
                        @click="openSearch"
                        class="w-10 h-10 rounded-full hover:bg-neutral-100 transition-all duration-300 text-ink flex items-center justify-center"
                        aria-label="Search (Cmd+K)"
                    >
                        <Search class="w-5 h-5" />
                    </button>

                    <!-- Notification Bell -->
                    <div class="relative" v-if="isAuthenticated">
                        <button
                            @click="toggleNotifications"
                            class="relative w-10 h-10 rounded-full hover:bg-neutral-100 transition-all duration-300 text-ink flex items-center justify-center"
                            aria-label="Notifications"
                        >
                            <Bell class="w-5 h-5" />
                            <span
                                v-if="unreadCount > 0"
                                class="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-paper animate-pulse"
                            >
                                {{ unreadCount > 9 ? '9+' : unreadCount }}
                            </span>
                        </button>

                        <!-- Notification Dropdown -->
                        <transition enter-active-class="transition-opacity duration-150 ease-out" enter-from-class="opacity-0" leave-active-class="transition-opacity duration-100 ease-in" leave-to-class="opacity-0">
                            <div
                                v-if="showNotifications"
                                class="absolute right-0 top-full mt-2 w-80 bg-paper border border-neutral-200 rounded-2xl shadow-xl overflow-hidden z-50"
                            >
                                <div class="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
                                    <p class="text-sm font-bold text-ink">Notifications</p>
                                    <span v-if="unreadCount > 0" class="text-xs text-neutral-500 tabular-nums">{{ unreadCount }} new</span>
                                </div>
                                <div class="max-h-64 overflow-y-auto">
                                    <div v-if="notifications.length === 0" class="px-4 py-8 text-center text-sm text-neutral-500">
                                        <Bell class="w-6 h-6 mx-auto mb-2 text-neutral-300" />
                                        No notifications yet
                                    </div>
                                    <div
                                        v-for="n in notifications"
                                        :key="n.id"
                                        @click="markRead(n.id)"
                                        class="px-4 py-3 hover:bg-neutral-50 transition-colors cursor-pointer border-b border-neutral-100 last:border-0"
                                        :class="{ 'bg-accent/5': !n.is_read }"
                                    >
                                        <p class="text-sm text-ink" :class="{ 'font-semibold': !n.is_read }">{{ n.message }}</p>
                                        <p class="text-xs text-neutral-400 mt-0.5">{{ timeAgo(n.created_at) }}</p>
                                    </div>
                                </div>
                                <div class="px-4 py-2 border-t border-neutral-100 text-center">
                                    <router-link :to="allNotificationsLink" @click="showNotifications = false" class="text-xs text-accent font-medium hover:underline">
                                        View all
                                    </router-link>
                                </div>
                            </div>
                        </transition>
                    </div>

                    <RouterLink
                        to="/wishlist"
                        class="w-10 h-10 rounded-full hover:bg-neutral-100 transition-all duration-300 text-ink flex items-center justify-center"
                        aria-label="Wishlist"
                    >
                        <Heart class="w-5 h-5" />
                    </RouterLink>

                    <RouterLink
                        to="/checkout"
                        class="relative w-10 h-10 rounded-full hover:bg-neutral-100 transition-all duration-300 text-ink flex items-center justify-center"
                        aria-label="Checkout Cart"
                    >
                        <ShoppingCart class="w-5 h-5" />
                        <span
                            v-if="cartCount > 0"
                            class="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 bg-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-paper"
                            :class="{ 'animate-cart-bounce': shop.cartBouncing }"
                        >
                            {{ cartCount }}
                        </span>
                    </RouterLink>

                    <div class="w-px h-6 bg-neutral-300 mx-2"></div>

                    <!-- Desktop User Area -->
                    <div class="relative" id="user-dropdown">
                        <template v-if="isAuthenticated && user">
                            <button
                                @click="toggleDropdown"
                                class="ml-1 inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-bold text-paper bg-ink rounded-full hover:bg-neutral-800 transition-all duration-300 shadow-sm hover:shadow-md"
                                :aria-expanded="isDropdownOpen"
                                aria-haspopup="true"
                                aria-label="User menu"
                            >
                                <div class="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-white">
                                    {{ initials }}
                                </div>
                                <span class="max-w-25 truncate">{{ user.username || user.email || 'User' }}</span>
                                <ChevronDown class="w-3.5 h-3.5 transition-transform duration-200" :class="{ 'rotate-180': isDropdownOpen }" />
                            </button>

                            <!-- Dropdown -->
                            <transition name="dropdown-fade">
                                <div
                                    v-if="isDropdownOpen"
                                    class="absolute right-0 top-full mt-2 w-56 bg-paper border border-neutral-200 rounded-2xl shadow-xl overflow-hidden z-50"
                                >
                                    <!-- User info header -->
                                    <div class="px-4 py-3 border-b border-neutral-100">
                                        <p class="text-sm font-bold text-ink truncate">{{ user.username || 'User' }}</p>
                                        <p class="text-xs text-neutral-500 truncate">{{ user.email || '' }}</p>
                                    </div>

                                    <div class="py-1">
                                        <RouterLink
                                            to="/userprofile"
                                            @click="closeDropdown"
                                            class="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 hover:text-ink transition-colors"
                                        >
                                            <User class="w-4 h-4" />
                                            My Profile
                                        </RouterLink>

                                        <RouterLink
                                            v-if="Number(user.role_id) === 1"
                                            to="/admin/dashboard"
                                            @click="closeDropdown"
                                            class="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 hover:text-ink transition-colors"
                                        >
                                            <LayoutDashboard class="w-4 h-4" />
                                            Admin Dashboard
                                        </RouterLink>
                                    </div>

                                    <div class="border-t border-neutral-100 py-1">
                                        <button
                                            @click="handleLogout"
                                            class="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                        >
                                            <LogOut class="w-4 h-4" />
                                            Sign Out
                                        </button>
                                    </div>
                                </div>
                            </transition>
                        </template>

                        <template v-else>
                            <RouterLink
                                to="/login"
                                class="ml-1 inline-flex items-center justify-center gap-2 h-10 px-5 text-sm font-bold text-paper bg-ink rounded-full hover:bg-neutral-800 transition-all duration-300 shadow-sm hover:shadow-md"
                            >
                                <User class="w-4 h-4" />
                                Sign In
                            </RouterLink>
                        </template>
                    </div>
                </div>

                <!-- Mobile Menu Button -->
                <button
                    @click="toggleMenu"
                    class="lg:hidden w-10 h-10 rounded-full hover:bg-neutral-100 transition-all duration-300 flex items-center justify-center"
                    :aria-expanded="isMenuOpen"
                    aria-controls="mobile-menu"
                    aria-label="Toggle menu"
                >
                    <component :is="isMenuOpen ? X : Menu" class="w-6 h-6 text-ink" />
                </button>
            </div>


        </div>

        <!-- Mobile Menu -->
        <transition enter-active-class="transition-opacity duration-300 ease-out" enter-from-class="opacity-0" leave-active-class="transition-opacity duration-200 ease-in" leave-to-class="opacity-0">
            <div
                v-if="isMenuOpen"
                id="mobile-menu"
                class="lg:hidden fixed inset-0 z-40"
                aria-label="Mobile navigation"
                role="region"
            >
                <!-- Backdrop (fades in via parent transition) -->
                <div
                    class="absolute inset-0 bg-ink/40 backdrop-blur-sm"
                    @click="closeMenu"
                    aria-hidden="true"
                ></div>

                <!-- Sidebar -->
                <div class="absolute top-0 right-0 w-80 max-w-[85vw] h-full bg-paper shadow-2xl overflow-y-auto flex flex-col">
                    <!-- Header -->
                    <div class="flex justify-between items-center p-6 border-b border-neutral-200">
                        <div class="flex items-center gap-2">
                            <span class="text-xl font-elegant text-ink">
                                <span class="font-light">ALIE</span><span class="font-bold">SHOP</span>
                            </span>
                            <span class="w-1.5 h-1.5 bg-accent rounded-full pulse-dot"></span>
                        </div>
                        <button
                            @click="closeMenu"
                            class="w-9 h-9 rounded-full hover:bg-neutral-100 transition-colors flex items-center justify-center"
                            aria-label="Close navigation menu"
                        >
                            <X class="w-5 h-5 text-ink" />
                        </button>
                    </div>

                    <!-- Welcome strip -->
                    <div class="px-6 py-4 bg-neutral-50 border-b border-neutral-200 flex items-center gap-2">
                        <Sparkles class="w-4 h-4 text-accent" />
                        <p class="text-xs text-neutral-600 font-medium">
                            New arrivals this week — <span class="text-ink font-bold">up to 30% off</span>
                        </p>
                    </div>

                    <!-- Mobile Search -->
                    <div class="p-6 border-b border-neutral-200">
                        <button @click="openSearch" class="w-full text-left">
                            <div class="relative">
                                <input
                                    type="text"
                                    placeholder="Search products..."
                                    class="w-full px-4 py-3 pl-11 rounded-xl bg-neutral-100 border border-transparent focus:border-ink focus:bg-paper focus:outline-none transition-all cursor-pointer"
                                    readonly
                                />
                                <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                                <kbd class="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-paper border border-neutral-200 text-[10px] font-bold text-neutral-500">⌘K</kbd>
                            </div>
                        </button>
                    </div>

                    <!-- Navigation Links -->
                    <nav class="p-6 flex-1">
                        <p class="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400 mb-3">Menu</p>
                        <ul class="space-y-1">
                            <li v-for="link in Navlinks" :key="link.label + '-mobile'">
                                <RouterLink
                                    :to="link.to"
                                    class="flex items-center gap-4 p-3 rounded-xl transition-all duration-300"
                                    :class="isActiveRoute(link.to)
                                        ? 'bg-ink text-paper'
                                        : 'text-neutral-700 hover:bg-neutral-100'"
                                    @click="closeMenu"
                                    :aria-label="link.ariaLabel"
                                >
                                    <div
                                        class="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
                                        :class="isActiveRoute(link.to)
                                            ? 'bg-paper/15 text-paper'
                                            : 'bg-neutral-100 text-ink'"
                                    >
                                        <component :is="link.icon" class="w-4 h-4" />
                                    </div>
                                    <span class="font-medium flex-1">{{ link.label }}</span>
                                    <span
                                        v-if="isActiveRoute(link.to)"
                                        class="w-1.5 h-1.5 bg-accent rounded-full"
                                    ></span>
                                </RouterLink>
                            </li>
                        </ul>
                    </nav>

                    <!-- Mobile Actions -->
                    <div class="p-6 space-y-4 border-t border-neutral-200 bg-neutral-50">
                        <div class="grid grid-cols-2 gap-3">
                            <RouterLink
                                to="/wishlist"
                                @click="closeMenu"
                                class="flex items-center justify-center gap-2 p-3 rounded-xl bg-paper border border-neutral-200 hover:border-ink transition-colors"
                            >
                                <Heart class="w-4 h-4 text-ink" />
                                <span class="text-xs font-bold uppercase tracking-wider text-ink">Wishlist</span>
                            </RouterLink>
                            <RouterLink
                                to="/checkout"
                                @click="closeMenu"
                                class="relative flex items-center justify-center gap-2 p-3 rounded-xl bg-paper border border-neutral-200 hover:border-ink transition-colors"
                            >
                                <ShoppingCart class="w-4 h-4 text-ink" />
                                <span class="text-xs font-bold uppercase tracking-wider text-ink">Cart</span>
                                <span
                                    v-if="cartCount > 0"
                                    class="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 bg-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-paper"
                                    :class="{ 'animate-cart-bounce': shop.cartBouncing }"
                                >{{ cartCount }}</span>
                            </RouterLink>
                        </div>
                        <button @click="toggleNotifications" class="flex items-center justify-center gap-2 p-3 rounded-xl bg-paper border border-neutral-200 hover:border-ink transition-colors w-full">
                                <Bell class="w-4 h-4 text-ink" />
                                <span class="text-xs font-bold uppercase tracking-wider text-ink">
                                    Notifications
                                    <span v-if="unreadCount > 0" class="ml-1 text-accent">({{ unreadCount }})</span>
                                </span>
                            </button>
                        </div>
                        <div class="space-y-2 mt-3">
                            <!-- Mobile User Area -->
                        <template v-if="isAuthenticated && user">
                            <div class="space-y-2">
                                <div class="flex items-center gap-3 px-3 py-2.5 bg-paper border border-neutral-200 rounded-xl">
                                    <div class="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-sm font-bold text-white shrink-0">
                                        {{ initials }}
                                    </div>
                                    <div class="min-w-0 flex-1">
                                        <p class="text-sm font-bold text-ink truncate">{{ user.username || 'User' }}</p>
                                        <p class="text-xs text-neutral-500 truncate">{{ user.email || '' }}</p>
                                    </div>
                                </div>
                                <RouterLink
                                    to="/userprofile"
                                    @click="closeMenu"
                                    class="flex items-center justify-center gap-2 w-full px-6 py-3.5 text-sm font-bold text-paper bg-ink rounded-xl hover:bg-neutral-800 transition-all duration-300"
                                >
                                    <User class="w-4 h-4" />
                                    My Profile
                                </RouterLink>
                                <RouterLink
                                    v-if="Number(user.role_id) === 1"
                                    to="/admin/dashboard"
                                    @click="closeMenu"
                                    class="flex items-center justify-center gap-2 w-full px-6 py-3.5 text-sm font-bold text-ink bg-neutral-100 rounded-xl hover:bg-neutral-200 transition-all duration-300"
                                >
                                    <LayoutDashboard class="w-4 h-4" />
                                    Admin Dashboard
                                </RouterLink>
                                <button
                                    @click="handleLogout"
                                    class="flex items-center justify-center gap-2 w-full px-6 py-3.5 text-sm font-bold text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-all duration-300"
                                >
                                    <LogOut class="w-4 h-4" />
                                    Sign Out
                                </button>
                            </div>
                        </template>
                        <template v-else>
                            <RouterLink
                                to="/login"
                                @click="closeMenu"
                                class="flex items-center justify-center gap-2 w-full px-6 py-3.5 text-sm font-bold text-paper bg-ink rounded-xl hover:bg-neutral-800 transition-all duration-300"
                            >
                                <User class="w-4 h-4" />
                                Sign In / Join Now
                            </RouterLink>
                        </template>
                    </div>
                </div>
            </div>
        </transition>
    </header>
</template>

<style scoped>
header {
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
}

/* Cart badge bounce animation */
@keyframes cart-bounce {
    0%   { transform: scale(1); }
    15%  { transform: scale(1.35); }
    30%  { transform: scale(0.9); }
    45%  { transform: scale(1.15); }
    60%  { transform: scale(0.95); }
    80%  { transform: scale(1.05); }
    100% { transform: scale(1); }
}
:deep(.animate-cart-bounce),
.animate-cart-bounce {
    animation: cart-bounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
</style>
