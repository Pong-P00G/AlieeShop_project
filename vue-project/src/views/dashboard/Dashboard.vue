<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth.js';
import { dashboardAPI } from '../../api/dashboardApi.js';
import draggable from 'vuedraggable';
import LazyImage from '../../components/LazyImage.vue';
import {
    Plus,
    Boxes,
    BarChart3,
    Users,
    DollarSign,
    TrendingUp,
    ArrowRight,
    ShoppingBag,
    Clock,
    Sparkles,
    Package,
    RefreshCw,
    AlertCircle,
    GripVertical,
    Settings2,
    X,
    Check,
    LayoutGrid,
    MessageSquare,
    Star,
} from 'lucide-vue-next';

const router = useRouter();
const authStore = useAuthStore();

// ── Time ─────────────────────────────────────────────────────────────────────
const currentTime = ref(new Date());
const selectedPeriod = ref('today');
let timeInterval = null;
let pollInterval = null;

// ── Data state ───────────────────────────────────────────────────────────────
const dashboardLoading = ref(false);
const error = ref(null);
const dashboardStats = ref(null);
const activitiesLog = ref([]);

const revenueData = computed(() => dashboardStats.value?.revenue || { today: 0, week: 0, month: 0, growth: 0 });

// ── Computed ─────────────────────────────────────────────────────────────────
const totalProducts   = computed(() => dashboardStats.value?.products?.total_products ?? 0);
const activeProducts  = computed(() => dashboardStats.value?.products?.active_products ?? 0);
const lowStockCount   = computed(() => dashboardStats.value?.products?.low_stock_count ?? 0);

// Review computed
const reviewStats       = computed(() => dashboardStats.value?.reviews ?? {});
const totalReviews      = computed(() => reviewStats.value.total_reviews ?? 0);
const pendingReviews    = computed(() => reviewStats.value.pending_count ?? 0);
const avgRating         = computed(() => reviewStats.value.average_rating ?? 0);
const approvalRate      = computed(() => reviewStats.value.approval_rate ?? 0);
const recentReviews     = computed(() => reviewStats.value.recent_reviews ?? []);
const totalRevenue    = computed(() => revenueData.value[selectedPeriod.value] || 0);
const totalOrders     = computed(() => dashboardStats.value?.orders?.total ?? 0);
const pendingOrders   = computed(() => dashboardStats.value?.orders?.pending ?? 0);
const recentOrders    = computed(() => dashboardStats.value?.recent_orders ?? []);
const topProducts     = computed(() => dashboardStats.value?.top_products ?? []);

// ── Widget System ────────────────────────────────────────────────────────────

const LS_WIDGET_KEY = 'alie_dashboard_widgets_v1';

const ALL_WIDGETS = [
    { id: 'revenue',  label: 'Revenue Overview',  icon: DollarSign,    cols: 3, desc: 'Revenue, orders, and pending count' },
    { id: 'actions',  label: 'Quick Actions',     icon: Plus,          cols: 3, desc: 'Add product, manage stock, analytics, users' },
    { id: 'orders',   label: 'Recent Orders',     icon: ShoppingBag,   cols: 2, desc: 'Latest orders with status and amount' },
    { id: 'reviews',  label: 'Reviews & Ratings', icon: MessageSquare, cols: 3, desc: 'Review stats, avg rating, pending' },
    { id: 'activity', label: 'Activity Feed',     icon: Clock,         cols: 1, desc: 'Recent store activity timeline' },
    { id: 'products', label: 'Top Products',      icon: Package,       cols: 3, desc: 'Best-selling products this period' },
];

const DEFAULT_WIDGET_IDS = ['revenue', 'actions', 'reviews', 'orders', 'activity', 'products'];

function loadWidgetIds() {
    try {
        const raw = localStorage.getItem(LS_WIDGET_KEY);
        if (!raw) return [...DEFAULT_WIDGET_IDS];
        const parsed = JSON.parse(raw);
        const validIds = new Set(ALL_WIDGETS.map(w => w.id));
        const filtered = parsed.filter(id => validIds.has(id));
        DEFAULT_WIDGET_IDS.forEach(id => {
            if (!filtered.includes(id)) filtered.push(id);
        });
        return filtered;
    } catch {
        return [...DEFAULT_WIDGET_IDS];
    }
}

function saveWidgetIds(ids) {
    try {
        localStorage.setItem(LS_WIDGET_KEY, JSON.stringify(ids));
    } catch { /* ignore */ }
}

const widgetOrder = ref(loadWidgetIds());
const editMode = ref(false);
const showWidgetCatalog = ref(false);
const dragOptions = {
    animation: 200,
    ghostClass: 'opacity-40',
    dragClass: 'drag-active',
    handle: '.drag-handle',
};

const availableWidgets = computed(() => {
    const active = new Set(widgetOrder.value);
    return ALL_WIDGETS.filter(w => !active.has(w.id));
});

function toggleEditMode() {
    editMode.value = !editMode.value;
    if (!editMode.value) saveWidgetIds(widgetOrder.value);
}

function removeWidget(widgetId) {
    widgetOrder.value = widgetOrder.value.filter(id => id !== widgetId);
    saveWidgetIds(widgetOrder.value);
}

function addWidget(widgetId) {
    widgetOrder.value.push(widgetId);
    showWidgetCatalog.value = false;
    saveWidgetIds(widgetOrder.value);
}

function onDragChange() {
    saveWidgetIds(widgetOrder.value);
}

// ── Greeting ─────────────────────────────────────────────────────────────────
const greeting = computed(() => {
    const hour = currentTime.value.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
});

const formattedTime = computed(() =>
    currentTime.value.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
);

const formattedDate = computed(() =>
    currentTime.value.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
);

// ── Helpers ──────────────────────────────────────────────────────────────────
const formatPrice = (price) => parseFloat(price || 0).toFixed(2);

const getStatusBadge = (status) => {
    const map = {
        delivered:  'bg-emerald-50 text-emerald-700',
        confirmed:  'bg-sky-50 text-sky-700',
        processing: 'bg-sky-50 text-sky-700',
        shipped:    'bg-amber-50 text-amber-700',
        pending:    'bg-amber-50 text-amber-700',
        cancelled:  'bg-danger/10 text-danger',
    };
    return map[status] || 'bg-neutral-100 text-neutral-700';
};

const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60)      return 'Just now';
    if (diff < 3600)    return Math.floor(diff / 60) + ' min ago';
    if (diff < 86400)   return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800)  return Math.floor(diff / 86400) + 'd ago';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const navigateTo = (path) => router.push(path);

const handleImageError = (event) => {
    event.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"%3E%3Crect width="80" height="80" fill="%23f4f4f5"/%3E%3C/svg%3E';
};

// ── Data loading ─────────────────────────────────────────────────────────────
const loadDashboard = async () => {
    try {
        dashboardLoading.value = true;
        error.value = null;

        const [statsResponse, activitiesResponse] = await Promise.all([
            dashboardAPI.getDashboardStats(),
            dashboardAPI.getRecentActivities(10)
        ]);

        if (statsResponse.success) dashboardStats.value = statsResponse.data;
        if (activitiesResponse.success) activitiesLog.value = activitiesResponse.data;
    } catch (err) {
        console.error('Error loading dashboard:', err);
        error.value = err.message || 'Failed to load dashboard data';
    } finally {
        dashboardLoading.value = false;
    }
};

onMounted(() => {
    loadDashboard();
    timeInterval = setInterval(() => { currentTime.value = new Date(); }, 60000);
    pollInterval = setInterval(loadDashboard, 30000);
});

onUnmounted(() => {
    clearInterval(timeInterval);
    clearInterval(pollInterval);
});
</script>

<template>
    <div class="bg-neutral-50 min-h-screen">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">

            <!-- ── Header ──────────────────────────────────────── -->
            <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
                <div>
                    <span class="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-700 mb-2">
                        <Sparkles class="w-3.5 h-3.5" />
                        {{ formattedDate }}
                    </span>
                    <h1 class="text-2xl sm:text-3xl font-bold text-neutral-900">
                        {{ greeting }}, {{ authStore.user?.username || 'Admin' }}
                    </h1>
                </div>
                <div class="flex items-center gap-3">
                    <button
                        @click="toggleEditMode"
                        :class="[
                            'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all',
                            editMode
                                ? 'bg-neutral-900 text-white shadow-sm hover:bg-neutral-800'
                                : 'bg-paper border border-neutral-200 text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50'
                        ]"
                    >
                        <Settings2 v-if="!editMode" class="w-4 h-4" />
                        <Check v-else class="w-4 h-4" />
                        {{ editMode ? 'Done' : 'Customize' }}
                    </button>
                    <div v-if="editMode" class="relative">
                        <button
                            @click="showWidgetCatalog = !showWidgetCatalog"
                            class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-paper border border-neutral-200 text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 transition-all"
                        >
                            <Plus class="w-4 h-4" />
                            Add Widget
                        </button>
                        <!-- Widget Catalog Dropdown -->
                        <div
                            v-if="showWidgetCatalog"
                            class="absolute top-full right-0 mt-2 w-72 card-flat shadow-xl z-40 overflow-hidden"
                        >
                            <div class="p-4 border-b border-neutral-100">
                                <p class="text-xs font-bold uppercase tracking-wider text-neutral-500">Available Widgets</p>
                            </div>
                            <div v-if="availableWidgets.length === 0" class="p-6 text-center text-sm text-neutral-400">
                                All widgets are already on the dashboard.
                            </div>
                            <div v-else class="p-2 space-y-1">
                                <button
                                    v-for="widget in availableWidgets"
                                    :key="widget.id"
                                    @click="addWidget(widget.id)"
                                    class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-50 transition-colors text-left"
                                >
                                    <div class="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                                        <component :is="widget.icon" class="w-4 h-4 text-neutral-600" />
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <p class="text-sm font-semibold text-neutral-900">{{ widget.label }}</p>
                                        <p class="text-xs text-neutral-500">{{ widget.desc }}</p>
                                    </div>
                                    <Plus class="w-4 h-4 text-neutral-400 shrink-0" />
                                </button>
                            </div>
                        </div>
                    </div>
                    <p v-else class="text-xs uppercase tracking-[0.2em] font-bold text-neutral-500">Live dashboard</p>
                </div>
            </div>

            <!-- ── Edit mode banner ─────────────────────────────── -->
            <div v-if="editMode" class="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 mb-6 flex items-center gap-3 text-sm">
                <LayoutGrid class="w-5 h-5 text-amber-600 shrink-0" />
                <p class="text-amber-800">
                    Drag widgets by the <span class="font-semibold">⠿ handle</span> to reorder.
                    <span class="text-amber-600">Hover a widget and click ✕ to remove it.</span>
                </p>
            </div>

            <!-- ── Loading State ────────────────────────────────── -->
            <div v-if="dashboardLoading && !dashboardStats" class="space-y-6">
                <!-- Skeleton Header -->
                <div class="flex items-center justify-between">
                    <div class="space-y-3">
                        <div class="h-3 w-32 skeleton-shimmer rounded"></div>
                        <div class="h-7 w-64 skeleton-shimmer rounded-lg"></div>
                    </div>
                </div>

                <!-- Skeleton Revenue Card -->
                <div class="bg-neutral-200/60 rounded-2xl p-8">
                    <div class="space-y-4">
                        <div class="flex items-center gap-4">
                            <div class="w-11 h-11 skeleton-shimmer rounded-xl"></div>
                            <div class="space-y-2">
                                <div class="h-3 w-24 skeleton-shimmer rounded"></div>
                                <div class="h-8 w-48 skeleton-shimmer rounded-lg"></div>
                            </div>
                        </div>
                        <div class="grid grid-cols-3 gap-4 pt-4 border-t border-neutral-300/30">
                            <div v-for="i in 3" :key="'sk-rev-' + i" class="space-y-2">
                                <div class="h-3 w-16 skeleton-shimmer rounded"></div>
                                <div class="h-6 w-12 skeleton-shimmer rounded"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Skeleton Actions Grid -->
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div v-for="i in 4" :key="'sk-act-' + i" class="card-flat p-5 space-y-4">
                        <div class="w-12 h-12 skeleton-shimmer rounded-xl"></div>
                        <div class="space-y-2">
                            <div class="h-3 w-16 skeleton-shimmer rounded"></div>
                            <div class="h-4 w-20 skeleton-shimmer rounded"></div>
                        </div>
                    </div>
                </div>

                <!-- Skeleton Widgets (Orders + Reviews side by side) -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div v-for="i in 2" :key="'sk-wid-' + i" class="card-flat p-6 space-y-4">
                        <div class="flex items-center justify-between">
                            <div class="space-y-1">
                                <div class="h-3 w-20 skeleton-shimmer rounded"></div>
                                <div class="h-5 w-32 skeleton-shimmer rounded"></div>
                            </div>
                            <div class="h-4 w-16 skeleton-shimmer rounded"></div>
                        </div>
                        <div v-for="j in 3" :key="'sk-row-' + i + '-' + j" class="flex items-center justify-between p-3 bg-neutral-50 rounded-xl">
                            <div class="flex items-center gap-3">
                                <div class="w-11 h-11 skeleton-shimmer rounded-xl"></div>
                                <div class="space-y-2">
                                    <div class="h-3.5 w-28 skeleton-shimmer rounded"></div>
                                    <div class="h-3 w-20 skeleton-shimmer rounded"></div>
                                </div>
                            </div>
                            <div class="h-4 w-14 skeleton-shimmer rounded"></div>
                        </div>
                    </div>
                </div>

                <!-- Skeleton Products Grid -->
                <div class="card-flat p-6 space-y-4">
                    <div class="flex items-center justify-between">
                        <div class="space-y-1">
                            <div class="h-3 w-20 skeleton-shimmer rounded"></div>
                            <div class="h-5 w-24 skeleton-shimmer rounded"></div>
                        </div>
                        <div class="h-4 w-16 skeleton-shimmer rounded"></div>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
                        <div v-for="i in 3" :key="'sk-prod-' + i" class="bg-neutral-50 rounded-2xl p-5 space-y-3">
                            <div class="aspect-square skeleton-shimmer rounded-xl"></div>
                            <div class="h-3 w-16 skeleton-shimmer rounded"></div>
                            <div class="h-4 w-32 skeleton-shimmer rounded"></div>
                            <div class="flex items-center justify-between">
                                <div class="h-5 w-16 skeleton-shimmer rounded"></div>
                                <div class="h-3 w-12 skeleton-shimmer rounded"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Skeleton Activity Widget -->
                <div class="card-flat p-6 space-y-4">
                    <div class="space-y-1">
                        <div class="h-3 w-16 skeleton-shimmer rounded"></div>
                        <div class="h-5 w-28 skeleton-shimmer rounded"></div>
                    </div>
                    <div v-for="i in 3" :key="'sk-act-' + i" class="flex items-start gap-3 p-3">
                        <div class="w-9 h-9 skeleton-shimmer rounded-xl"></div>
                        <div class="flex-1 space-y-2">
                            <div class="h-3.5 w-3/4 skeleton-shimmer rounded"></div>
                            <div class="h-3 w-1/4 skeleton-shimmer rounded"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ── Error State ──────────────────────────────────── -->
            <div v-else-if="error && !dashboardStats"
                class="bg-paper rounded-2xl p-6 border border-danger/20 shadow-sm mb-6">
                <div class="flex items-start gap-4">
                    <div class="w-12 h-12 rounded-2xl bg-danger/10 flex items-center justify-center shrink-0">
                        <AlertCircle class="h-6 w-6 text-danger" />
                    </div>
                    <div class="flex-1 min-w-0">
                        <h3 class="text-lg font-bold text-neutral-900">Failed to load dashboard</h3>
                        <p class="text-neutral-500 text-sm mt-1">{{ error }}</p>
                    </div>
                    <button @click="loadDashboard"
                        class="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-xl hover:bg-neutral-800 transition-colors">
                        <RefreshCw class="w-4 h-4" />
                        Retry
                    </button>
                </div>
            </div>

            <!-- ── Dashboard Content ────────────────────────────── -->
            <div v-else class="space-y-6">

                <!-- Draggable Widget List -->
                <draggable
                    v-model="widgetOrder"
                    :group="{ name: 'widgets', pull: false, put: false }"
                    item-key="id"
                    v-bind="dragOptions"
                    @change="onDragChange"
                    tag="div"
                    class="space-y-6"
                >
                    <template #item="{ element: widgetId }">
                        <div
                            :class="[
                                'relative transition-all duration-200',
                                editMode ? 'ring-2 ring-dashed ring-neutral-300 ring-offset-2 rounded-2xl' : '',
                            ]"
                        >
                            <!-- Remove button (edit mode) -->
                            <button
                                v-if="editMode"
                                @click="removeWidget(widgetId)"
                                class="absolute -top-3 -right-3 w-8 h-8 bg-paper border border-neutral-200 rounded-full shadow-md flex items-center justify-center hover:bg-danger/10 hover:border-danger/30 hover:text-danger transition-all z-10"
                                title="Remove widget"
                            >
                                <X class="w-4 h-4" />
                            </button>

                            <!-- Drag Handle (edit mode) -->
                            <div
                                v-if="editMode"
                                class="drag-handle absolute -top-3 left-4 w-8 h-8 bg-paper border border-neutral-200 rounded-full shadow-md flex items-center justify-center hover:bg-neutral-50 hover:border-neutral-300 transition-all z-10 cursor-grab active:cursor-grabbing"
                                title="Drag to reorder"
                            >
                                <GripVertical class="w-4 h-4 text-neutral-500" />
                            </div>

                            <!-- ── REVENUE WIDGET ──────────────── -->
                            <div v-if="widgetId === 'revenue'"
                                class="bg-neutral-900 text-white rounded-2xl p-6 sm:p-8 relative overflow-hidden">
                                <div class="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full -mr-32 -mt-32"></div>
                                <div class="absolute bottom-0 left-0 w-40 h-40 bg-amber-500/8 rounded-full -ml-20 -mb-20"></div>
                                <div class="relative z-10">
                                    <div class="flex items-start justify-between mb-6 flex-wrap gap-6">
                                        <div>
                                            <div class="flex items-center gap-3 mb-3">
                                                <div class="w-11 h-11 rounded-xl bg-amber-500/20 inline-flex items-center justify-center">
                                                    <DollarSign class="w-6 h-6 text-amber-400" />
                                                </div>
                                                <div>
                                                    <p class="text-neutral-400 text-xs uppercase tracking-[0.2em] font-bold">Total revenue</p>
                                                    <p class="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold mt-0.5">
                                                        {{ selectedPeriod === 'today' ? 'Today' : selectedPeriod === 'week' ? 'This week' : 'This month' }}
                                                    </p>
                                                </div>
                                            </div>
                                            <div class="flex items-baseline gap-3 flex-wrap">
                                                <h2 class="text-4xl md:text-5xl font-bold tabular-nums">{{ '$' }}{{ formatPrice(totalRevenue) }}</h2>
                                                <span v-if="revenueData.growth !== 0"
                                                    class="inline-flex items-center gap-1 px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm font-bold">
                                                    <TrendingUp class="w-3.5 h-3.5" />
                                                    {{ revenueData.growth > 0 ? '+' : '' }}{{ revenueData.growth }}%
                                                </span>
                                            </div>
                                        </div>
                                        <div class="inline-flex bg-paper/10 rounded-full p-1">
                                            <button v-for="period in ['today', 'week', 'month']" :key="period"
                                                @click="selectedPeriod = period"
                                                :class="[
                                                    'px-4 py-2 rounded-full font-semibold text-sm capitalize transition-all',
                                                    selectedPeriod === period ? 'bg-paper text-neutral-900' : 'text-white hover:bg-paper/10'
                                                ]">
                                                {{ period }}
                                            </button>
                                        </div>
                                    </div>
                                    <div class="grid grid-cols-3 gap-4 pt-6 border-t border-white/10">
                                        <div>
                                            <p class="text-neutral-400 text-xs uppercase tracking-[0.2em] font-bold mb-1">Orders</p>
                                            <p class="text-2xl font-bold tabular-nums">{{ totalOrders }}</p>
                                        </div>
                                        <div>
                                            <p class="text-neutral-400 text-xs uppercase tracking-[0.2em] font-bold mb-1">Pending</p>
                                            <p class="text-2xl font-bold tabular-nums">{{ pendingOrders }}</p>
                                        </div>
                                        <div>
                                            <p class="text-neutral-400 text-xs uppercase tracking-[0.2em] font-bold mb-1">Products</p>
                                            <p class="text-2xl font-bold tabular-nums">{{ totalProducts }}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- ── ACTIONS WIDGET ───────────────── -->
                            <div v-if="widgetId === 'actions'"
                                class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <button @click="navigateTo('/admin/add-product')"
                                    class="card-flat p-5 hover:border-neutral-900 hover:shadow-sm transition-all duration-200 text-left group">
                                    <div class="w-12 h-12 rounded-xl bg-neutral-900 text-white group-hover:bg-amber-600 inline-flex items-center justify-center transition-colors shrink-0 mb-4">
                                        <Plus class="w-6 h-6" />
                                    </div>
                                    <p class="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold">Quick action</p>
                                    <p class="font-bold text-neutral-900">Add product</p>
                                </button>
                                <button @click="navigateTo('/admin/manage-stock')"
                                    class="card-flat p-5 hover:border-neutral-900 hover:shadow-sm transition-all duration-200 text-left group relative">
                                    <div class="w-12 h-12 rounded-xl bg-amber-600 text-white inline-flex items-center justify-center shrink-0 mb-4">
                                        <Boxes class="w-6 h-6" />
                                    </div>
                                    <p class="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold">Inventory</p>
                                    <p class="font-bold text-neutral-900">Manage stock</p>
                                    <span v-if="lowStockCount > 0"
                                        class="absolute top-3 right-3 px-2.5 py-0.5 bg-amber-600 text-white rounded-full text-[10px] font-bold">
                                        {{ lowStockCount }} low
                                    </span>
                                </button>
                                <button @click="navigateTo('/admin/analytics')"
                                    class="card-flat p-5 hover:border-neutral-900 hover:shadow-sm transition-all duration-200 text-left group">
                                    <div class="w-12 h-12 rounded-xl bg-neutral-900 text-white group-hover:bg-amber-600 inline-flex items-center justify-center transition-colors shrink-0 mb-4">
                                        <BarChart3 class="w-6 h-6" />
                                    </div>
                                    <p class="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold">Insights</p>
                                    <p class="font-bold text-neutral-900">Analytics</p>
                                </button>
                                <button @click="navigateTo('/admin/manage-user')"
                                    class="card-flat p-5 hover:border-neutral-900 hover:shadow-sm transition-all duration-200 text-left group">
                                    <div class="w-12 h-12 rounded-xl bg-neutral-900 text-white group-hover:bg-amber-600 inline-flex items-center justify-center transition-colors shrink-0 mb-4">
                                        <Users class="w-6 h-6" />
                                    </div>
                                    <p class="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold">Team</p>
                                    <p class="font-bold text-neutral-900">Manage users</p>
                                </button>
                            </div>

                            <!-- ── ORDERS WIDGET ────────────────── -->
                            <div v-if="widgetId === 'orders'"
                                class="card-flat p-5 sm:p-6">
                                <div class="flex items-center justify-between mb-6">
                                    <div>
                                        <span class="text-[10px] uppercase tracking-[0.2em] text-amber-700 font-bold">Activity</span>
                                        <h2 class="font-bold text-xl text-neutral-900 mt-1">Recent orders</h2>
                                    </div>
                                    <button @click="navigateTo('/admin/orders')"
                                        class="text-sm font-bold text-amber-700 hover:text-amber-800 inline-flex items-center gap-1 transition-colors">
                                        View all
                                        <ArrowRight class="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                <div class="space-y-2">
                                    <div v-if="recentOrders.length === 0" class="text-center py-14">
                                        <div class="w-16 h-16 rounded-full bg-neutral-100 inline-flex items-center justify-center mx-auto mb-4">
                                            <ShoppingBag class="w-8 h-8 text-neutral-400" />
                                        </div>
                                        <p class="text-neutral-500 font-medium">No orders yet</p>
                                        <p class="text-sm text-neutral-400 mt-1">Orders will appear here once customers place them.</p>
                                    </div>

                                    <div v-else v-for="order in recentOrders" :key="order.id"
                                        class="flex items-center justify-between p-4 rounded-xl hover:bg-neutral-50 transition-colors cursor-pointer border border-transparent hover:border-neutral-200">
                                        <div class="flex items-center gap-4 flex-1 min-w-0">
                                            <div class="w-11 h-11 rounded-xl bg-neutral-900 text-white flex items-center justify-center font-bold text-sm shrink-0">
                                                #{{ String(order.id).slice(-4) }}
                                            </div>
                                            <div class="flex-1 min-w-0">
                                                <p class="font-bold text-neutral-900 truncate">{{ order.customer_name }}</p>
                                                <div class="flex items-center gap-3 mt-1 flex-wrap">
                                                    <span :class="['px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full', getStatusBadge(order.status)]">
                                                        {{ order.status }}
                                                    </span>
                                                    <span class="text-xs text-neutral-500">{{ timeAgo(order.created_at) }}</span>
                                                    <span class="text-xs text-neutral-500">{{ order.items_count }} item{{ order.items_count !== 1 ? 's' : '' }}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <p class="text-lg font-bold text-neutral-900 tabular-nums shrink-0">{{ '$' }}{{ formatPrice(order.amount) }}</p>
                                    </div>
                                </div>
                            </div>

                            <!-- ── REVIEWS WIDGET ──────────────── -->
                            <div v-if="widgetId === 'reviews'"
                                class="card-flat p-5 sm:p-6">
                                <div class="flex items-center justify-between mb-5">
                                    <div>
                                        <span class="text-[10px] uppercase tracking-[0.2em] text-amber-700 font-bold">Customer feedback</span>
                                        <h2 class="font-bold text-xl text-neutral-900 mt-1">Reviews &amp; Ratings</h2>
                                    </div>
                                    <button @click="navigateTo('/admin/reviews')"
                                        class="text-sm font-bold text-amber-700 hover:text-amber-800 inline-flex items-center gap-1 transition-colors">
                                        View all
                                        <ArrowRight class="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                <!-- KPI row -->
                                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                                    <div class="bg-neutral-50 rounded-xl p-4">
                                        <p class="text-[10px] uppercase tracking-[0.2em] font-bold text-neutral-500 mb-1">Total reviews</p>
                                        <p class="text-2xl font-bold text-neutral-900">{{ totalReviews }}</p>
                                    </div>
                                    <div class="bg-neutral-50 rounded-xl p-4">
                                        <p class="text-[10px] uppercase tracking-[0.2em] font-bold text-neutral-500 mb-1">Avg rating</p>
                                        <p class="text-2xl font-bold text-neutral-900 flex items-center gap-1.5">
                                            {{ avgRating }}
                                            <Star class="w-5 h-5 text-amber-500 fill-amber-500" />
                                        </p>
                                    </div>
                                    <div class="bg-neutral-50 rounded-xl p-4">
                                        <p class="text-[10px] uppercase tracking-[0.2em] font-bold text-neutral-500 mb-1">Approval rate</p>
                                        <p class="text-2xl font-bold text-neutral-900">{{ approvalRate }}%</p>
                                    </div>
                                    <div class="bg-neutral-50 rounded-xl p-4">
                                        <p class="text-[10px] uppercase tracking-[0.2em] font-bold text-neutral-500 mb-1">Pending</p>
                                        <p class="text-2xl font-bold" :class="pendingReviews > 0 ? 'text-amber-600' : 'text-neutral-900'">
                                            {{ pendingReviews }}
                                            <span v-if="pendingReviews > 0" class="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 ml-1.5 align-middle"></span>
                                        </p>
                                    </div>
                                </div>

                                <!-- Recent reviews -->
                                <div v-if="recentReviews.length === 0" class="text-center py-10">
                                    <div class="w-16 h-16 rounded-full bg-neutral-100 inline-flex items-center justify-center mx-auto mb-4">
                                        <MessageSquare class="w-8 h-8 text-neutral-400" />
                                    </div>
                                    <p class="text-neutral-500 font-medium">No reviews yet</p>
                                    <p class="text-sm text-neutral-400 mt-1">Customer reviews will appear here once submitted.</p>
                                </div>

                                <div v-else class="space-y-2">
                                    <div v-for="review in recentReviews" :key="review.review_id"
                                        class="flex items-start gap-3 p-3.5 rounded-xl hover:bg-neutral-50 transition-colors">
                                        <div
                                            class="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center font-bold text-sm shrink-0">
                                            {{ (review.username || 'A')[0].toUpperCase() }}
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center gap-2 flex-wrap">
                                                <p class="font-bold text-sm text-neutral-900">{{ review.username }}</p>
                                                <span class="inline-flex items-center gap-0.5 text-xs font-bold text-amber-700">
                                                    <Star v-for="i in 5" :key="i"
                                                        :class="['w-3 h-3', i <= review.rating ? 'text-amber-500 fill-amber-500' : 'text-neutral-200 fill-neutral-200']" />
                                                </span>
                                            </div>
                                            <p class="text-sm text-neutral-700 mt-0.5 line-clamp-1">
                                                <span v-if="review.title" class="font-semibold">{{ review.title }}</span>
                                                <span v-if="!review.title && review.product_name" class="text-neutral-500">on {{ review.product_name }}</span>
                                            </p>
                                            <div class="flex items-center gap-2 mt-1">
                                                <span :class="[
                                                    'px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full',
                                                    review.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                                                    review.status === 'rejected' ? 'bg-danger/10 text-danger' :
                                                    'bg-amber-50 text-amber-700'
                                                ]">
                                                    {{ review.status }}
                                                </span>
                                                <span class="text-xs text-neutral-500">{{ timeAgo(review.created_at) }}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- ── ACTIVITY WIDGET ──────────────── -->
                            <div v-if="widgetId === 'activity'"
                                class="card-flat p-5 sm:p-6">
                                <span class="text-[10px] uppercase tracking-[0.2em] text-amber-700 font-bold">Live feed</span>
                                <h2 class="font-bold text-xl text-neutral-900 mt-1 mb-6">Recent activity</h2>

                                <div class="space-y-3">
                                    <div v-if="activitiesLog.length === 0" class="text-center py-14">
                                        <Clock class="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                                        <p class="text-neutral-500 font-medium">No recent activity</p>
                                        <p class="text-xs text-neutral-400 mt-1">Activity will appear as you manage your store.</p>
                                    </div>

                                    <div v-else v-for="(activity, index) in activitiesLog" :key="index"
                                        class="flex items-start gap-3 p-3 rounded-xl hover:bg-neutral-50 transition-colors">
                                        <div class="text-xl leading-none mt-0.5">{{ activity.icon }}</div>
                                        <div class="flex-1 min-w-0">
                                            <p class="text-sm text-neutral-900 leading-relaxed">{{ activity.message }}</p>
                                            <p class="text-xs text-neutral-500 mt-0.5">{{ activity.time }}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- ── PRODUCTS WIDGET ──────────────── -->
                            <div v-if="widgetId === 'products'"
                                class="card-flat p-5 sm:p-6">
                                <div class="flex items-center justify-between mb-6">
                                    <div>
                                        <span class="text-[10px] uppercase tracking-[0.2em] text-amber-700 font-bold">Best sellers</span>
                                        <h2 class="font-bold text-xl text-neutral-900 mt-1">Top products</h2>
                                    </div>
                                    <button @click="navigateTo('/admin/manage-products')"
                                        class="text-sm font-bold text-amber-700 hover:text-amber-800 inline-flex items-center gap-1 transition-colors">
                                        View all
                                        <ArrowRight class="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
                                    <div v-for="(product, index) in topProducts" :key="product.product_id"
                                        class="relative bg-neutral-50 rounded-2xl p-5 hover:border-neutral-200 hover:shadow-sm cursor-pointer group overflow-hidden border border-transparent transition-all duration-200">
                                        <div class="absolute top-4 right-4 w-9 h-9 bg-amber-600 text-white rounded-full inline-flex items-center justify-center font-bold text-sm shadow-sm">
                                            {{ index + 1 }}
                                        </div>
                                        <div class="aspect-square bg-neutral-100 rounded-xl overflow-hidden mb-4">
                                            <LazyImage :src="product.main_image" :alt="product.product_name"
                                                wrapper-class="w-full h-full"
                                                img-class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                        </div>
                                        <p class="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold mb-1">{{ product.category_name }}</p>
                                        <h3 class="font-bold text-neutral-900 mb-2 line-clamp-2">{{ product.product_name }}</h3>
                                        <div class="flex items-baseline justify-between">
                                            <span class="text-xl font-bold text-amber-700 tabular-nums">{{ '$' }}{{ formatPrice(product.base_price) }}</span>
                                            <span class="text-xs text-neutral-500">{{ product.units_sold }} sold</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </template>
                </draggable>
            </div>
        </div>
    </div>
</template>

<style scoped>
.drag-active {
    z-index: 50;
    box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
    transform: scale(1.02) rotate(1deg);
    transition: transform 0.2s ease;
}
</style>
