<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { dashboardAPI } from '../../api/dashboardApi.js';
import { useNotificationStore } from '../../stores/notifications.js';
import { useToast } from '../../composables/useToast.js';
import {
    Bell,
    Search,
    RefreshCw,
    AlertCircle,
    ShoppingBag,
    AlertTriangle,
    UserPlus,
    Package,
    CheckCheck,
    Check,
    ChevronLeft,
    ChevronRight,
    Filter,
    Calendar,
} from 'lucide-vue-next';

const router = useRouter();
const toast = useToast();
const notificationStore = useNotificationStore();

const notifications = ref([]);
const loading = ref(false);
const error = ref(null);
const searchQuery = ref('');
const typeFilter = ref('all');
const currentPage = ref(1);
const totalPages = ref(1);
const totalItems = ref(0);
const pageSize = 25;
const markingAll = ref(false);

const typeOptions = [
    { value: 'all', label: 'All' },
    { value: 'order', label: 'Orders' },
    { value: 'stock', label: 'Stock' },
    { value: 'user', label: 'Users' },
    { value: 'product', label: 'Products' },
    { value: 'system', label: 'System' },
];

const typeIcons = {
    order: ShoppingBag,
    stock: AlertTriangle,
    user: UserPlus,
    product: Package,
    system: Bell,
};

const typeStyles = {
    order: 'bg-accent/10 text-accent border-accent/20',
    stock: 'bg-warning/10 text-warning border-warning/20',
    user: 'bg-info/10 text-info border-info/20',
    product: 'bg-accent/10 text-accent border-accent/20',
    system: 'bg-neutral-100 text-neutral-600 border-neutral-200',
};

const typeLabels = {
    order: 'Order',
    stock: 'Stock',
    user: 'User',
    product: 'Product',
    system: 'System',
};

const filteredNotifications = computed(() => {
    if (!searchQuery.value) return notifications.value;
    const q = searchQuery.value.toLowerCase();
    return notifications.value.filter(n =>
        (n.message || '').toLowerCase().includes(q)
    );
});

const groupedNotifications = computed(() => {
    const groups = {};
    for (const n of filteredNotifications.value) {
        const label = formatDate(n.created_at);
        if (!groups[label]) groups[label] = [];
        groups[label].push(n);
    }
    return groups;
});

const groupKeys = computed(() => Object.keys(groupedNotifications.value));

const fetchNotifications = async () => {
    try {
        loading.value = true;
        error.value = null;
        const type = typeFilter.value !== 'all' ? typeFilter.value : null;
        const response = await dashboardAPI.getAllNotifications(
            currentPage.value, pageSize, type
        );
        if (response.success) {
            notifications.value = response.data.items || [];
            totalPages.value = response.data.totalPages || 1;
            totalItems.value = response.data.totalItems || 0;
        } else {
            error.value = response.message || 'Failed to load notifications';
        }
    } catch (err) {
        console.error('Error fetching notifications:', err);
        error.value = err.response?.data?.message || 'Failed to load notifications';
    } finally {
        loading.value = false;
    }
};

const goToPage = (page) => {
    if (page < 1 || page > totalPages.value) return;
    currentPage.value = page;
    fetchNotifications();
};

const changeTypeFilter = (type) => {
    typeFilter.value = type;
    currentPage.value = 1;
    fetchNotifications();
};

// Routed through the notifications store so the sidebar/navbar badge updates
// immediately and other tabs follow
const markAsRead = async (notification) => {
    if (notification.is_read) return;
    try {
        await notificationStore.markRead(notification.id);
        notification.is_read = true;
    } catch (err) {
        console.error('Error marking as read:', err);
        toast.error('Failed to mark as read');
    }
};

const markAllAsRead = async () => {
    markingAll.value = true;
    try {
        await notificationStore.markAllRead();
        notifications.value.forEach(n => n.is_read = true);
        toast.success('All notifications marked as read');
    } catch (err) {
        console.error('Error marking all as read:', err);
        toast.error('Failed to mark all as read');
    } finally {
        markingAll.value = false;
    }
};

const navigateToLink = (notification) => {
    if (notification.link) {
        router.push(notification.link);
    }
};

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    if (dateOnly.getTime() === today.getTime()) return 'Today';
    if (dateOnly.getTime() === yesterday.getTime()) return 'Yesterday';

    const diffDays = Math.floor((today - dateOnly) / (1000 * 60 * 60 * 24));
    if (diffDays < 7) {
        const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        return days[d.getDay()];
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const pageNumbers = computed(() => {
    const total = totalPages.value;
    const current = currentPage.value;
    const maxVisible = 5;
    if (total <= maxVisible) {
        return Array.from({ length: total }, (_, i) => i + 1);
    }
    let start = Math.max(1, current - 2);
    let end = Math.min(total, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
        start = Math.max(1, end - maxVisible + 1);
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
});

onMounted(() => {
    fetchNotifications();
});
</script>

<template>
    <div class="min-h-screen bg-neutral-100">
        <div class="section py-6 sm:py-8">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                    <span class="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-accent mb-2">
                        <Bell class="w-3.5 h-3.5" />
                        Notifications
                    </span>
                    <h1 class="text-2xl sm:text-3xl font-bold text-ink">Notifications</h1>
                    <p class="text-neutral-500 mt-1 text-sm">View and manage all system notifications</p>
                </div>
                <div class="flex items-center gap-3">
                    <button @click="markAllAsRead" :disabled="markingAll" class="btn-ghost text-sm gap-2">
                        <CheckCheck class="w-4 h-4" />
                        {{ markingAll ? 'Marking...' : 'Mark all read' }}
                    </button>
                    <button @click="fetchNotifications" class="btn-ghost text-sm gap-2" :disabled="loading">
                        <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': loading }" />
                        Refresh
                    </button>
                </div>
            </div>

            <!-- Filter Bar -->
            <div class="card-flat p-4 mb-6">
                <div class="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    <div class="flex-1 w-full sm:max-w-xs">
                        <div class="relative">
                            <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                            <input v-model="searchQuery" type="text" placeholder="Search notifications..." class="input-base pl-11 py-2.5 text-sm" />
                        </div>
                    </div>
                    <div class="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
                        <Filter class="w-4 h-4 text-neutral-400 shrink-0" />
                        <button v-for="opt in typeOptions" :key="opt.value" @click="changeTypeFilter(opt.value)"
                            :class="[
                                'px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-[0.1em] whitespace-nowrap transition-all',
                                typeFilter === opt.value ? 'bg-ink text-paper' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                            ]">
                            {{ opt.label }}
                        </button>
                    </div>
                </div>
            </div>

            <!-- Error -->
            <div v-if="error && notifications.length === 0" class="card-flat border-l-4 border-danger p-6 mb-6">
                <div class="flex items-center gap-4">
                    <AlertCircle class="w-10 h-10 text-danger shrink-0" />
                    <div class="flex-1">
                        <p class="font-bold text-ink">Failed to load notifications</p>
                        <p class="text-sm text-neutral-500 mt-1">{{ error }}</p>
                    </div>
                    <button @click="fetchNotifications" class="btn-primary text-sm gap-2">
                        <RefreshCw class="w-4 h-4" /> Retry
                    </button>
                </div>
            </div>

            <!-- Loading -->
            <div v-if="loading && notifications.length === 0" class="space-y-6 animate-pulse">
                <div class="card-flat p-4">
                    <div class="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                        <div class="flex-1 w-full sm:max-w-xs">
                            <div class="h-11 bg-neutral-200 rounded-xl"></div>
                        </div>
                        <div class="flex items-center gap-2">
                            <div v-for="i in 6" :key="i" class="h-8 w-16 bg-neutral-200 rounded-lg"></div>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-3 mb-3">
                    <div class="h-4 w-16 bg-neutral-200 rounded"></div>
                    <div class="flex-1 h-px bg-neutral-200"></div>
                </div>
                <div class="card-flat divide-y divide-neutral-100">
                    <div v-for="item in 5" :key="item" class="px-5 sm:px-6 py-4">
                        <div class="flex items-start gap-4">
                            <div class="w-10 h-10 bg-neutral-200 rounded-full shrink-0"></div>
                            <div class="flex-1 space-y-2 min-w-0">
                                <div class="flex items-center gap-2">
                                    <div class="h-5 bg-neutral-200 rounded w-16"></div>
                                    <div class="w-1.5 h-1.5 bg-neutral-200 rounded-full"></div>
                                </div>
                                <div class="space-y-1.5">
                                    <div class="h-3.5 bg-neutral-200 rounded w-3/4"></div>
                                    <div class="h-3 bg-neutral-200 rounded w-1/2"></div>
                                </div>
                                <div class="flex items-center gap-3">
                                    <div class="h-3 bg-neutral-200 rounded w-20"></div>
                                    <div class="h-3 bg-neutral-200 rounded w-24"></div>
                                </div>
                            </div>
                            <div class="w-8 h-8 bg-neutral-200 rounded-lg shrink-0"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Empty -->
            <div v-else-if="!loading && filteredNotifications.length === 0" class="card-flat p-16">
                <div class="flex flex-col items-center justify-center gap-4">
                    <Bell class="w-16 h-16 text-neutral-300" />
                    <div class="text-center">
                        <h3 class="text-lg font-bold text-ink">{{ searchQuery ? 'No matching notifications' : 'No notifications yet' }}</h3>
                        <p class="text-sm text-neutral-500 mt-1">{{ searchQuery ? 'Try a different search' : 'Notifications will appear here as events happen' }}</p>
                    </div>
                </div>
            </div>

            <!-- Notification List with Date Grouping -->
            <div v-else class="space-y-6">
                <div v-for="group in groupKeys" :key="group">
                    <div class="flex items-center gap-3 mb-3">
                        <Calendar class="w-4 h-4 text-neutral-400" />
                        <h3 class="text-xs font-bold uppercase tracking-[0.15em] text-neutral-500">{{ group }}</h3>
                        <div class="flex-1 h-px bg-neutral-200"></div>
                    </div>

                    <div class="card-flat divide-y divide-neutral-100">
                        <div
                            v-for="notification in groupedNotifications[group]"
                            :key="notification.id"
                            @click="markAsRead(notification)"
                            :class="['px-5 sm:px-6 py-4 flex items-start gap-4 cursor-pointer transition-colors', !notification.is_read ? 'bg-accent-50/30 hover:bg-accent-50/60' : 'hover:bg-neutral-50']"
                        >
                            <div :class="['w-10 h-10 rounded-full inline-flex items-center justify-center shrink-0', typeStyles[notification.type] || 'bg-neutral-100 text-neutral-500']">
                                <component :is="typeIcons[notification.type] || Bell" class="w-5 h-5" />
                            </div>

                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2 mb-1">
                                    <span :class="['px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-[0.1em] border', typeStyles[notification.type] || 'bg-neutral-100 text-neutral-500 border-neutral-200']">
                                        {{ typeLabels[notification.type] || notification.type }}
                                    </span>
                                    <span v-if="!notification.is_read" class="w-1.5 h-1.5 rounded-full bg-accent"></span>
                                </div>
                                <p class="text-sm text-ink font-medium">{{ notification.message }}</p>
                                <div class="flex items-center gap-3 mt-1.5">
                                    <span class="text-xs text-neutral-500">{{ formatTime(notification.created_at) }}</span>
                                    <button v-if="notification.link" @click.stop="navigateToLink(notification)"
                                        class="text-xs font-bold text-accent hover:text-accent-600 transition-colors">
                                        View details
                                    </button>
                                </div>
                            </div>

                            <div class="flex items-center gap-2 shrink-0">
                                <button v-if="!notification.is_read" @click.stop="markAsRead(notification)"
                                    class="btn-ghost p-2" title="Mark as read">
                                    <Check class="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Pagination -->
            <div v-if="totalPages > 1" class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-6">
                <p class="text-xs text-neutral-500 text-center sm:text-left">
                    Showing <span class="font-semibold text-ink">{{ (currentPage - 1) * 25 + 1 }}</span>
                    to <span class="font-semibold text-ink">{{ Math.min(currentPage * 25, totalItems) }}</span>
                    of <span class="font-semibold text-ink">{{ totalItems }}</span> notifications
                </p>
                <div class="flex items-center justify-center gap-1">
                    <button @click="goToPage(currentPage - 1)" :disabled="currentPage <= 1"
                        class="w-9 h-9 rounded-lg flex items-center justify-center text-neutral-500 hover:bg-neutral-100 hover:text-ink transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
                        aria-label="Previous page">
                        <ChevronLeft class="w-4 h-4" />
                    </button>
                    <button v-for="p in pageNumbers" :key="p" @click="goToPage(p)"
                        class="min-w-9 h-9 rounded-lg text-sm font-bold transition-all duration-150 active:scale-90"
                        :class="p === currentPage ? 'bg-ink text-paper shadow-sm scale-105' : 'text-neutral-500 hover:bg-neutral-100 hover:text-ink'">
                        {{ p }}
                    </button>
                    <button @click="goToPage(currentPage + 1)" :disabled="currentPage >= totalPages"
                        class="w-9 h-9 rounded-lg flex items-center justify-center text-neutral-500 hover:bg-neutral-100 hover:text-ink transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
                        aria-label="Next page">
                        <ChevronRight class="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
