<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { dashboardAPI } from '../../api/dashboardApi.js';
import {
    DollarSign,
    ShoppingBag,
    Users,
    BarChart3,
    TrendingUp,
    TrendingDown,
    AlertCircle,
    RefreshCw,
    Package,
    Clock,
    UserPlus,
    Sparkles,
} from 'lucide-vue-next';
import {
    Line,
    Bar,
    Doughnut,
    Pie,
} from 'vue-chartjs';
import {
    Chart as ChartJS,
    Title,
    Tooltip,
    Legend,
    BarElement,
    ArcElement,
    LineElement,
    PointElement,
    CategoryScale,
    LinearScale,
    RadialLinearScale,
    Filler,
} from 'chart.js';

ChartJS.register(
    Title, Tooltip, Legend,
    BarElement, ArcElement, LineElement, PointElement,
    CategoryScale, LinearScale, RadialLinearScale, Filler
);

// ── State ────────────────────────────────────────────────────────────────────

const timeframe = ref('month');
const loading = ref(false);
const error = ref(null);
const analyticsData = ref(null);
const orderStats = ref(null);

// ── Computed from analytics ──────────────────────────────────────────────────

const salesData = computed(() => analyticsData.value?.sales_trend || []);
const productPerformance = computed(() => analyticsData.value?.product_performance || []);
const categoryData = computed(() => analyticsData.value?.category_data || []);
const summary = computed(() => analyticsData.value?.summary || {});
const totalSales = computed(() => summary.value?.total_revenue || 0);
const totalOrders = computed(() => summary.value?.total_orders || 0);
const totalCustomers = computed(() => summary.value?.total_customers || 0);
const averageOrderValue = computed(() => summary.value?.average_order_value || 0);
const growth = computed(() => summary.value?.growth || {});

const maxProductRevenue = computed(() => {
    if (productPerformance.value.length === 0) return 0;
    return Math.max(...productPerformance.value.map(p => p.sales || p.revenue || 0));
});

// ── Chart Data ───────────────────────────────────────────────────────────────

const tooltipTheme = {
    backgroundColor: '#18181b',
    titleColor: '#fafafa',
    bodyColor: '#a1a1aa',
    padding: 12,
    cornerRadius: 8,
    displayColors: true,
    boxPadding: 4,
    titleFont: { size: 13, weight: '600' },
    bodyFont: { size: 12 },
};

// ── 1. Revenue Trend (Line Chart with gradient fill) ─────────────────────────

const salesChartData = computed(() => ({
    labels: salesData.value.map(d => d.period),
    datasets: [{
        label: 'Revenue',
        data: salesData.value.map(d => d.sales || 0),
        borderColor: '#18181b',
        backgroundColor: (ctx) => {
            if (!ctx.chart.chartArea) return 'rgba(24, 24, 27, 0.1)';
            const { ctx: c, chartArea: { top, bottom } } = ctx.chart;
            const gradient = c.createLinearGradient(0, top, 0, bottom);
            gradient.addColorStop(0, 'rgba(24, 24, 27, 0.25)');
            gradient.addColorStop(0.5, 'rgba(24, 24, 27, 0.08)');
            gradient.addColorStop(1, 'rgba(24, 24, 27, 0.01)');
            return gradient;
        },
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#18181b',
        pointBorderColor: '#fafafa',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 7,
        pointHoverBackgroundColor: '#18181b',
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 3,
        borderWidth: 2.5,
    }]
}));

const salesChartOptions = computed(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    plugins: {
        legend: { display: false },
        tooltip: {
            ...tooltipTheme,
            callbacks: {
                label: (ctx) => {
                    const val = parseFloat(ctx.raw).toFixed(2);
                    const orders = salesData.value[ctx.dataIndex]?.orders_count || 0;
                    return ` $${val}  ·  ${orders} order${orders !== 1 ? 's' : ''}`;
                },
            },
        },
    },
    scales: {
        x: { grid: { display: false }, ticks: { color: '#a1a1aa', font: { size: 11, family: 'system-ui' }, maxTicksLimit: 8 } },
        y: {
            grid: { color: 'rgba(161, 161, 170, 0.15)', drawBorder: false },
            ticks: {
                color: '#a1a1aa',
                font: { size: 11 },
                maxTicksLimit: 6,
                callback: (v) => v >= 1000 ? '$' + (v / 1000).toFixed(1) + 'k' : '$' + v,
            },
        },
    },
}));

// ── 2. Category Breakdown (Doughnut) ─────────────────────────────────────────

const DONUT_COLORS = ['#18181b', '#52525b', '#a1a1aa', '#d4d4d8', '#78716c', '#e7e5e4', '#57534e', '#a8a29e'];

const categoryChartData = computed(() => ({
    labels: categoryData.value.map(c => c.name),
    datasets: [{
        data: categoryData.value.map(c => c.sales || 0),
        backgroundColor: DONUT_COLORS.slice(0, categoryData.value.length),
        borderWidth: 2,
        borderColor: '#fafafa',
        hoverOffset: 12,
        spacing: 3,
    }]
}));

const categoryChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
        legend: {
            position: 'bottom',
            labels: {
                color: '#52525b',
                font: { size: 11, family: 'system-ui' },
                padding: 16,
                usePointStyle: true,
                pointStyle: 'circle',
                boxWidth: 8,
            },
        },
        tooltip: {
            ...tooltipTheme,
            callbacks: {
                label: (ctx) => {
                    const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                    const val = parseFloat(ctx.raw).toFixed(2);
                    const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0;
                    return ` $${val}  (${pct}%)`;
                },
            },
        },
    },
};

// ── 3. Product Performance (Horizontal Bar) ──────────────────────────────────

const productBarData = computed(() => ({
    labels: productPerformance.value.map(p => p.name),
    datasets: [{
        label: 'Revenue',
        data: productPerformance.value.map(p => p.revenue || 0),
        backgroundColor: '#18181b',
        borderRadius: 4,
        borderSkipped: false,
        barPercentage: 0.65,
    }]
}));

const productBarOptions = computed(() => ({
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
        legend: { display: false },
        tooltip: {
            ...tooltipTheme,
            callbacks: {
                label: (ctx) => {
                    const revenue = parseFloat(ctx.raw).toFixed(2);
                    const product = productPerformance.value[ctx.dataIndex];
                    return ` $${revenue}  ·  ${product.units} units`;
                },
            },
        },
    },
    scales: {
        x: {
            grid: { color: 'rgba(161, 161, 170, 0.12)' },
            ticks: {
                color: '#a1a1aa',
                font: { size: 10 },
                callback: (v) => v >= 1000 ? '$' + (v / 1000).toFixed(1) + 'k' : '$' + v,
            },
        },
        y: {
            grid: { display: false },
            ticks: { color: '#52525b', font: { size: 11, weight: '600' }, maxTicksLimit: 10 },
        },
    },
}));

// ── 4. Order Status Distribution (Pie) ───────────────────────────────────────

const ORDER_STATUS_COLORS = {
    pending: '#fbbf24',
    confirmed: '#3b82f6',
    processing: '#8b5cf6',
    shipped: '#06b6d4',
    delivered: '#22c55e',
    cancelled: '#ef4444',
};

const orderStatusData = computed(() => {
    const stats = orderStats.value;
    if (!stats) return { labels: [], datasets: [{ data: [], backgroundColor: [], borderWidth: 0 }] };
    const labels = [];
    const data = [];
    const colors = [];
    const statusFields = ['pending', 'processing', 'confirmed', 'shipped', 'completed', 'cancelled'];
    const statusLabels = { pending: 'Pending', processing: 'Processing', confirmed: 'Confirmed', shipped: 'Shipped', completed: 'Delivered', cancelled: 'Cancelled' };

    statusFields.forEach(field => {
        const count = parseInt(stats[field]) || 0;
        if (count > 0) {
            labels.push(statusLabels[field] || field);
            data.push(count);
            colors.push(ORDER_STATUS_COLORS[field] || '#a1a1aa');
        }
    });

    return {
        labels,
        datasets: [{
            data,
            backgroundColor: colors,
            borderWidth: 2,
            borderColor: '#fafafa',
            hoverOffset: 10,
        }]
    };
});

const orderStatusOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: 'bottom',
            labels: {
                color: '#52525b',
                font: { size: 11, family: 'system-ui' },
                padding: 14,
                usePointStyle: true,
                pointStyle: 'circle',
                boxWidth: 8,
            },
        },
        tooltip: {
            ...tooltipTheme,
            callbacks: {
                label: (ctx) => {
                    const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                    const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0;
                    return ` ${ctx.raw} order${ctx.raw !== 1 ? 's' : ''}  (${pct}%)`;
                },
            },
        },
    },
};

// ── 5. Customer Registration Trend ───────────────────────────────────────────

const customerTrendData = computed(() => ({
    labels: salesData.value.map(d => d.period),
    datasets: [{
        label: 'New Customers',
        data: salesData.value.map((_, i) => {
            if (salesData.value.length === 0) return 0;
            const total = salesData.value.reduce((s, d) => s + (d.sales || 0), 0);
            const sales = salesData.value[i]?.sales || 0;
            return total > 0 ? Math.round((sales / total) * (summary.value?.total_customers || 0)) : 0;
        }),
        borderColor: '#52525b',
        backgroundColor: (ctx) => {
            if (!ctx.chart.chartArea) return 'rgba(82, 82, 91, 0.1)';
            const { ctx: c, chartArea: { top, bottom } } = ctx.chart;
            const gradient = c.createLinearGradient(0, top, 0, bottom);
            gradient.addColorStop(0, 'rgba(82, 82, 91, 0.2)');
            gradient.addColorStop(1, 'rgba(82, 82, 91, 0.02)');
            return gradient;
        },
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#52525b',
        pointBorderColor: '#fafafa',
        pointBorderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 6,
        borderWidth: 2,
        borderDash: [5, 3],
    }]
}));

const customerTrendOptions = computed(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    plugins: {
        legend: { display: false },
        tooltip: {
            ...tooltipTheme,
            callbacks: { label: (ctx) => ` ${ctx.raw} customer${ctx.raw !== 1 ? 's' : ''}` },
        },
    },
    scales: {
        x: { grid: { display: false }, ticks: { color: '#a1a1aa', font: { size: 10 }, maxTicksLimit: 6 } },
        y: { grid: { color: 'rgba(161, 161, 170, 0.12)', drawBorder: false }, ticks: { color: '#a1a1aa', font: { size: 10 }, maxTicksLimit: 5 } },
    },
}));

// ── Metric helpers ───────────────────────────────────────────────────────────

const formatPrice = (price) => parseFloat(price || 0).toFixed(2);

const metricValue = (key) => {
    const map = { totalSales, totalOrders, totalCustomers, averageOrderValue };
    const ref = map[key];
    return ref && typeof ref === 'object' ? ref.value ?? 0 : ref ?? 0;
};

const growthInfo = (value) => {
    const num = parseFloat(value) || 0;
    if (num > 0) return { label: `+${num}%`, class: 'text-emerald-700 bg-emerald-50' };
    if (num < 0) return { label: `${num}%`, class: 'text-danger bg-danger/10' };
    return { label: '0%', class: 'text-neutral-400 bg-neutral-100' };
};

const metricCards = [
    { label: 'Total Revenue',       icon: DollarSign,  iconBg: 'bg-amber-50',  iconColor: 'text-amber-700',
      valueKey: 'totalSales',        growthKey: 'revenue', prefix: '$' },
    { label: 'Total Orders',        icon: ShoppingBag, iconBg: 'bg-neutral-50',   iconColor: 'text-neutral-800',
      valueKey: 'totalOrders',       growthKey: 'orders', prefix: '' },
    { label: 'Total Customers',     icon: Users,       iconBg: 'bg-sky-50',    iconColor: 'text-sky-700',
      valueKey: 'totalCustomers',    growthKey: 'customers', prefix: '' },
    { label: 'Avg Order Value',     icon: BarChart3,   iconBg: 'bg-violet-50', iconColor: 'text-violet-700',
      valueKey: 'averageOrderValue', growthKey: null, prefix: '$' },
];

const timeframeLabel = computed(() => {
    const map = { week: 'this week', month: 'this month', year: 'this year' };
    return map[timeframe.value] || timeframe.value;
});

const dataAvailable = computed(() =>
    salesData.value.length > 0 ||
    categoryData.value.length > 0 ||
    productPerformance.value.length > 0
);

// ── Fetch data ───────────────────────────────────────────────────────────────

const fetchData = async () => {
    try {
        loading.value = true;
        error.value = null;

        const [analyticsRes, ordersRes] = await Promise.all([
            dashboardAPI.getAnalytics(timeframe.value),
            dashboardAPI.getOrderStats(),
        ]);

        if (analyticsRes.success) analyticsData.value = analyticsRes.data;
        else error.value = analyticsRes.message || 'Failed to load analytics';

        if (ordersRes.success) orderStats.value = ordersRes.data;
    } catch (err) {
        console.error('Error fetching analytics:', err);
        error.value = err.message || 'Failed to load analytics data';
    } finally {
        loading.value = false;
    }
};

watch(timeframe, () => { fetchData(); });
onMounted(() => { fetchData(); });
</script>

<template>
    <div class="min-h-screen bg-neutral-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">

            <!-- ── Header ──────────────────────────────────────── -->
            <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
                <div>
                    <span class="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-700 mb-2">
                        <BarChart3 class="w-3.5 h-3.5" />
                        Analytics
                    </span>
                    <h1 class="text-2xl sm:text-3xl font-bold text-neutral-900">Performance overview</h1>
                    <p class="text-neutral-500 mt-1 text-sm">Track your store performance <span class="font-semibold text-neutral-700">{{ timeframeLabel }}</span></p>
                </div>

                <div class="flex items-center gap-3">
                    <button @click="fetchData" :disabled="loading"
                        class="w-9 h-9 flex items-center justify-center rounded-xl border border-neutral-200 bg-paper hover:bg-neutral-50 hover:border-neutral-300 transition-all disabled:opacity-50"
                        title="Refresh data">
                        <RefreshCw class="w-4 h-4 text-neutral-600" :class="{ 'animate-spin': loading }" />
                    </button>
                    <select v-model="timeframe" :disabled="loading"
                        class="appearance-none bg-paper border border-neutral-200 rounded-xl px-4 py-2.5 pr-10 text-sm font-medium text-neutral-700
                               focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:border-neutral-900
                               disabled:opacity-50 transition-all cursor-pointer
                               bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2371717a%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')]
                               bg-no-repeat bg-[right_0.75rem_center] bg-[length:1.25rem]">
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                        <option value="year">This Year</option>
                    </select>
                </div>
            </div>

            <!-- ── Loading Skeleton ──────────────────────────────────────── -->
            <div v-if="loading && !analyticsData" class="space-y-6">
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                    <div v-for="i in 4" :key="i" class="card-flat p-5 sm:p-6">
                        <div class="flex items-center justify-between mb-4">
                            <div class="w-11 h-11 skeleton-shimmer rounded-xl"></div>
                            <div class="w-16 h-6 skeleton-shimmer rounded-full"></div>
                        </div>
                        <div class="h-3 w-24 skeleton-shimmer rounded mb-2"></div>
                        <div class="h-8 w-28 skeleton-shimmer rounded"></div>
                    </div>
                </div>
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div class="lg:col-span-2 card-flat p-6 h-80">
                        <div class="h-4 w-20 skeleton-shimmer rounded mb-2"></div>
                        <div class="h-5 w-32 skeleton-shimmer rounded mb-6"></div>
                        <div class="h-52 skeleton-shimmer rounded-lg"></div>
                    </div>
                    <div class="card-flat p-6 h-80">
                        <div class="h-4 w-20 skeleton-shimmer rounded mb-2"></div>
                        <div class="h-5 w-36 skeleton-shimmer rounded mb-6"></div>
                        <div class="h-44 w-44 skeleton-shimmer rounded-full mx-auto"></div>
                    </div>
                </div>
            </div>

            <!-- ── Error State ──────────────────────────────────────────── -->
            <div v-else-if="error && !analyticsData"
                class="bg-paper rounded-2xl p-6 sm:p-8 border border-danger/20 shadow-sm">
                <div class="flex items-start gap-4">
                    <div class="w-12 h-12 rounded-2xl bg-danger/10 flex items-center justify-center shrink-0">
                        <AlertCircle class="h-6 w-6 text-danger" />
                    </div>
                    <div class="flex-1 min-w-0">
                        <h3 class="text-lg font-bold text-neutral-900">Failed to load analytics</h3>
                        <p class="text-neutral-500 text-sm mt-1">{{ error }}</p>
                    </div>
                    <button @click="fetchData"
                        class="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-xl hover:bg-neutral-800 transition-colors">
                        <RefreshCw class="w-4 h-4" />
                        Retry
                    </button>
                </div>
            </div>

            <!-- ── Analytics Content ────────────────────────────────────── -->
            <div v-else class="space-y-6">

                <!-- ── Key Metrics ────────────────────────────────── -->
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                    <div v-for="metric in metricCards" :key="metric.label"
                        class="card-base p-5 sm:p-6">
                        <div class="flex items-center justify-between mb-4">
                            <div :class="['w-11 h-11 rounded-xl flex items-center justify-center transition-transform hover:scale-110', metric.iconBg]">
                                <component :is="metric.icon" :class="['w-5 h-5', metric.iconColor]" />
                            </div>
                            <span v-if="metric.growthKey && growth[metric.growthKey] !== undefined"
                                :class="['inline-flex items-center gap-0.5 px-2.5 py-1 rounded-full text-xs font-bold', growthInfo(growth[metric.growthKey]).class]">
                                <TrendingUp v-if="parseFloat(growth[metric.growthKey]) > 0" class="w-3 h-3" />
                                <TrendingDown v-else-if="parseFloat(growth[metric.growthKey]) < 0" class="w-3 h-3" />
                                {{ growthInfo(growth[metric.growthKey]).label }}
                            </span>
                        </div>
                        <p class="text-neutral-500 text-xs uppercase tracking-[0.15em] font-bold mb-1">{{ metric.label }}</p>
                        <p class="text-2xl sm:text-3xl font-bold text-neutral-900 tabular-nums tracking-tight">
                            <template v-if="metric.prefix">{{ metric.prefix }}</template>
                            <template v-if="metric.valueKey === 'totalSales' || metric.valueKey === 'averageOrderValue'">
                                {{ metricValue(metric.valueKey) >= 1000
                                    ? (metricValue(metric.valueKey) / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'k'
                                    : formatPrice(metricValue(metric.valueKey))
                                }}
                            </template>
                            <template v-else>
                                {{ metricValue(metric.valueKey).toLocaleString() }}
                            </template>
                        </p>
                    </div>
                </div>

                <!-- ── Charts Row 1: Sales Trend + Category ────────── -->
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- Revenue Trend (Line Chart) -->
                    <div class="lg:col-span-2 card-base p-5 sm:p-6">
                        <div class="flex items-center justify-between mb-6">
                            <div>
                                <span class="text-[10px] uppercase tracking-[0.2em] text-amber-700 font-bold">Revenue trend</span>
                                <h2 class="font-bold text-xl text-neutral-900 mt-1">Sales over time</h2>
                            </div>
                            <div class="flex items-center gap-2 text-xs text-neutral-400">
                                <span class="inline-block w-3 h-0.5 bg-neutral-900 rounded"></span>
                                <span>Revenue</span>
                            </div>
                        </div>

                        <div v-if="salesData.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
                            <BarChart3 class="w-14 h-14 text-neutral-200 mb-4" />
                            <p class="text-neutral-500 font-semibold">No sales data {{ timeframeLabel }}</p>
                            <p class="text-xs text-neutral-400 mt-1">Orders will appear here once customers start purchasing.</p>
                        </div>

                        <div v-else class="h-64 sm:h-72">
                            <Line :data="salesChartData" :options="salesChartOptions" />
                        </div>
                    </div>

                    <!-- Sales by Category (Doughnut) -->
                    <div class="card-base p-5 sm:p-6">
                        <div class="mb-6">
                            <span class="text-[10px] uppercase tracking-[0.2em] text-amber-700 font-bold">Breakdown</span>
                            <h2 class="font-bold text-xl text-neutral-900 mt-1">Sales by category</h2>
                        </div>

                        <div v-if="categoryData.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
                            <Package class="w-14 h-14 text-neutral-200 mb-4" />
                            <p class="text-neutral-500 font-semibold">No category data yet</p>
                            <p class="text-xs text-neutral-400 mt-1">Categories will populate as products are ordered.</p>
                        </div>

                        <div v-else class="h-64 flex items-center justify-center">
                            <Doughnut :data="categoryChartData" :options="categoryChartOptions" />
                        </div>
                    </div>
                </div>

                <!-- ── Charts Row 2: Products + Orders ───────────── │ -->
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- Top Products (Horizontal Bar) -->
                    <div class="lg:col-span-2 card-base p-5 sm:p-6">
                        <div class="flex items-center justify-between mb-6">
                            <div>
                                <span class="text-[10px] uppercase tracking-[0.2em] text-amber-700 font-bold">Best sellers</span>
                                <h2 class="font-bold text-xl text-neutral-900 mt-1">Top performing products</h2>
                            </div>
                        </div>

                        <div v-if="productPerformance.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
                            <ShoppingBag class="w-14 h-14 text-neutral-200 mb-4" />
                            <p class="text-neutral-500 font-semibold">No product sales {{ timeframeLabel }}</p>
                            <p class="text-xs text-neutral-400 mt-1">Products will appear once they are added to orders.</p>
                        </div>

                        <div v-else class="h-72">
                            <Bar :data="productBarData" :options="productBarOptions" />
                        </div>
                    </div>

                    <!-- Order Status (Pie) + Customer Trend -->
                    <div class="space-y-6">
                        <!-- Order Status -->
                        <div class="card-base p-5 sm:p-6">
                            <div class="mb-4">
                                <span class="text-[10px] uppercase tracking-[0.2em] text-amber-700 font-bold">Orders</span>
                                <h2 class="font-bold text-lg text-neutral-900 mt-1">Order status</h2>
                            </div>

                            <div v-if="!orderStats" class="flex flex-col items-center justify-center py-10 text-center">
                                <Clock class="w-10 h-10 text-neutral-200 mb-3" />
                                <p class="text-neutral-500 text-sm font-medium">No order data</p>
                            </div>

                            <div v-else class="h-52 flex items-center justify-center">
                                <Pie :data="orderStatusData" :options="orderStatusOptions" />
                            </div>
                        </div>

                        <!-- Customer Trend -->
                        <div class="card-base p-5 sm:p-6">
                            <div class="mb-4">
                                <span class="text-[10px] uppercase tracking-[0.2em] text-amber-700 font-bold">Customers</span>
                                <h2 class="font-bold text-lg text-neutral-900 mt-1">Customer acquisition</h2>
                            </div>

                            <div v-if="salesData.length === 0" class="flex flex-col items-center justify-center py-10 text-center">
                                <UserPlus class="w-10 h-10 text-neutral-200 mb-3" />
                                <p class="text-neutral-500 text-sm font-medium">No customer data yet</p>
                            </div>

                            <div v-else class="h-36">
                                <Line :data="customerTrendData" :options="customerTrendOptions" />
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ── Detailed Product Performance Table ─────────── -->
                <div class="card-base p-5 sm:p-6">
                    <div class="mb-6">
                        <span class="text-[10px] uppercase tracking-[0.2em] text-amber-700 font-bold">Details</span>
                        <h2 class="font-bold text-xl text-neutral-900 mt-1">Product performance details</h2>
                    </div>

                    <div v-if="productPerformance.length === 0" class="text-center py-12">
                        <ShoppingBag class="w-12 h-12 text-neutral-200 mx-auto mb-3" />
                        <p class="text-neutral-500 font-medium">No data to display</p>
                    </div>

                    <div v-else class="overflow-x-auto">
                        <table class="w-full min-w-[600px]">
                            <thead>
                                <tr class="border-b border-neutral-100">
                                    <th class="px-4 sm:px-6 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">Product</th>
                                    <th class="px-4 sm:px-6 py-3.5 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">Units sold</th>
                                    <th class="px-4 sm:px-6 py-3.5 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">Revenue</th>
                                    <th class="px-4 sm:px-6 py-3.5 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">Performance</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-neutral-50">
                                <tr v-for="(product, idx) in productPerformance" :key="product.name"
                                    class="hover:bg-neutral-50/80 transition-colors">
                                    <td class="px-4 sm:px-6 py-4">
                                        <div class="flex items-center gap-3">
                                            <span class="w-6 h-6 rounded-lg bg-neutral-100 flex items-center justify-center text-xs font-bold text-neutral-500 shrink-0">
                                                {{ idx + 1 }}
                                            </span>
                                            <p class="font-semibold text-neutral-900 truncate">{{ product.name }}</p>
                                        </div>
                                    </td>
                                    <td class="px-4 sm:px-6 py-4 text-right">
                                        <span class="text-sm font-bold text-neutral-900 tabular-nums">{{ product.units }}</span>
                                    </td>
                                    <td class="px-4 sm:px-6 py-4 text-right">
                                        <span class="text-sm font-bold text-neutral-900 tabular-nums">{{ '$' }}{{ formatPrice(product.revenue) }}</span>
                                    </td>
                                    <td class="px-4 sm:px-6 py-4 text-right">
                                        <div class="flex items-center justify-end gap-2">
                                            <div class="w-24 bg-neutral-100 rounded-full h-2 overflow-hidden">
                                                <div :style="{
                                                    width: maxProductRevenue > 0
                                                        ? `${(product.sales / maxProductRevenue) * 100}%`
                                                        : '0%'
                                                }" class="bg-neutral-900 h-full rounded-full transition-all duration-700 ease-out">
                                                </div>
                                            </div>
                                            <span class="text-xs font-semibold text-neutral-500 tabular-nums w-10 text-right">
                                                {{ maxProductRevenue > 0 ? Math.round((product.sales / maxProductRevenue) * 100) : 0 }}%
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- ── Empty state (no data at all) ───────────────── -->
                <div v-if="!dataAvailable && !loading && analyticsData" class="card-flat p-10 sm:p-16 text-center">
                    <Sparkles class="w-16 h-16 text-neutral-200 mx-auto mb-4" />
                    <div class="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart3 class="w-8 h-8 text-neutral-400" />
            </div>
            <h3 class="text-xl font-bold text-ink mb-2">No data available yet</h3>
                    <p class="text-neutral-500 max-w-md mx-auto">
                        Analytics data will appear as customers interact with your store.
                        Try switching the timeframe or add some products to get started.
                    </p>
                    <button @click="fetchData"
                        class="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-xl hover:bg-neutral-800 transition-colors">
                        <RefreshCw class="w-4 h-4" />
                        Refresh
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
