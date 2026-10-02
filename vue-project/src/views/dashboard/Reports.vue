<script setup>
import { ref } from 'vue';
import { dashboardAPI } from '../../api/dashboardApi.js';
import { useToast } from '../../composables/useToast.js';
import {
    FileText,
    Package,
    Users,
    DollarSign,
    Download,
    BarChart3,
    Sparkles,
    FileSpreadsheet,
    Tag,
    TrendingDown,
    Clock,
    Percent,
    AlertTriangle,
} from 'lucide-vue-next';

const toast = useToast();

const reportType = ref('sales');
const dateRange = ref('month');
const startDate = ref('');
const endDate = ref('');
const generating = ref(false);
const generatedReport = ref(null);

const reportTypes = [
    { value: 'sales',     label: 'Sales Report',     icon: BarChart3,    desc: 'Revenue, orders, and sales analytics',
      color: 'bg-accent/10 text-accent' },
    { value: 'inventory', label: 'Inventory Report',  icon: Package,     desc: 'Stock levels and product performance',
      color: 'bg-ink/10 text-ink' },
    { value: 'customer',  label: 'Customer Report',   icon: Users,       desc: 'Customer data and behavior',
      color: 'bg-info/10 text-info' },
    { value: 'financial', label: 'Financial Report',  icon: DollarSign,  desc: 'Revenue, orders, and financial metrics',
      color: 'bg-success/10 text-success' },
    { value: 'discount',  label: 'Discount Report',   icon: Tag,         desc: 'Discount usage, redemption rates, revenue impact',
      color: 'bg-purple-500/10 text-purple-600' }
];

const generateReport = async () => {
    try {
        generating.value = true;

        const params = {
            type: reportType.value,
            dateRange: dateRange.value
        };
        if (dateRange.value === 'custom') {
            params.startDate = startDate.value;
            params.endDate = endDate.value;
        }

        const response = await dashboardAPI.generateReport(params);

        if (response.success) {
            generatedReport.value = response.data;
            toast.success('Report generated successfully!');
        } else {
            toast.error(response.message || 'Failed to generate report');
        }
    } catch (err) {
        console.error('Error generating report:', err);
        toast.error(err.response?.data?.message || 'Failed to generate report');
    } finally {
        generating.value = false;
    }
};

const downloadReport = () => {
    if (!generatedReport.value) return;

    const dataStr = JSON.stringify(generatedReport.value, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${generatedReport.value.label?.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(`Downloaded ${generatedReport.value.label}`);
};

const downloadAsCSV = () => {
    if (!generatedReport.value) return;

    let csv = '';
    const data = generatedReport.value;

    if (data.summary) {
        csv += 'Metric,Value\n';
        Object.entries(data.summary).forEach(([key, val]) => {
            if (typeof val !== 'object') {
                csv += `${key},${val}\n`;
            }
        });
    } else if (data.low_stock_items?.length > 0) {
        csv += 'Product,SKU,Quantity,Reorder Level,Shortage\n';
        data.low_stock_items.forEach(item => {
            csv += `${item.productname},${item.sku || ''},${item.quantity},${item.reorder_level},${item.shortage}\n`;
        });
    } else if (data.recent_users?.length > 0) {
        csv += 'Username,Email,Joined\n';
        data.recent_users.forEach(u => {
            csv += `${u.username},${u.email},${u.joined_at || ''}\n`;
        });
    } else {
        csv += `Report,${data.label},Generated,${data.generated_at}\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.label?.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('CSV downloaded');
};

const newReport = () => {
    generatedReport.value = null;
};

const formatPrice = (price) => parseFloat(price || 0).toFixed(2);

const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const truncate = (text, len = 60) => {
    if (!text || text.length <= len) return text || '';
    return text.substring(0, len) + '...';
};
</script>

<template>
    <div class="min-h-screen bg-neutral-100">
        <div class="section py-6 sm:py-8">
            <!-- Header -->
            <div class="mb-8">
                <span class="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-accent mb-2">
                    <FileText class="w-3.5 h-3.5" />
                    Reports
                </span>
                <h1 class="text-2xl sm:text-3xl font-bold text-ink">Generate &amp; download reports</h1>
                <p class="text-neutral-500 mt-1 text-sm">Create business reports with live data from your store</p>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Report Generator -->
                <div class="lg:col-span-2 space-y-6">
                    <div class="card-flat p-5 sm:p-6">
                        <div class="flex items-center justify-between mb-6">
                            <div>
                                <span class="text-[10px] uppercase tracking-[0.2em] text-accent font-bold">Generator</span>
                                <h2 class="font-elegant font-bold text-xl text-ink mt-1">Create new report</h2>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <label v-for="type in reportTypes" :key="type.value"
                                :class="[
                                    'flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer hover:bg-neutral-50 transition-all',
                                    reportType === type.value
                                        ? 'border-ink bg-neutral-50'
                                        : 'border-neutral-200'
                                ]"
                            >
                                <input v-model="reportType" type="radio" :value="type.value" class="mt-1.5 shrink-0" />
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2 mb-1">
                                        <component :is="type.icon" class="w-4 h-4 shrink-0" :class="type.color.split(' ')[1]" />
                                        <p class="font-semibold text-sm text-ink">{{ type.label }}</p>
                                    </div>
                                    <p class="text-xs text-neutral-500">{{ type.desc }}</p>
                                </div>
                            </label>
                        </div>

                        <div class="space-y-4">
                            <div>
                                <label class="block text-xs font-bold uppercase tracking-[0.2em] text-ink mb-2">Date range</label>
                                <select v-model="dateRange" class="input-base">
                                    <option value="week">Last 7 Days</option>
                                    <option value="month">Last 30 Days</option>
                                    <option value="quarter">Last 3 Months</option>
                                    <option value="year">Last Year</option>
                                    <option value="custom">Custom Range</option>
                                </select>
                            </div>
                            <div v-if="dateRange === 'custom'" class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-xs font-bold uppercase tracking-[0.15em] text-ink mb-2">Start date</label>
                                    <input v-model="startDate" type="date" class="input-base" />
                                </div>
                                <div>
                                    <label class="block text-xs font-bold uppercase tracking-[0.15em] text-ink mb-2">End date</label>
                                    <input v-model="endDate" type="date" class="input-base" />
                                </div>
                            </div>
                        </div>

                        <button @click="generateReport" :disabled="generating"
                            class="btn-accent w-full mt-6 py-3.5 disabled:opacity-50">
                            <div v-if="generating" class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <FileText v-else class="w-4 h-4" />
                            {{ generating ? 'Generating report...' : 'Generate Report' }}
                        </button>
                    </div>

                    <!-- Report Preview -->
                    <div v-if="generatedReport" class="card-flat p-5 sm:p-6">
                        <div class="flex items-center justify-between mb-6">
                            <div>
                                <span class="text-[10px] uppercase tracking-[0.2em] text-accent font-bold">Preview</span>
                                <h2 class="font-elegant font-bold text-xl text-ink mt-1">{{ generatedReport.label }}</h2>
                                <p class="text-xs text-neutral-500 mt-1">Generated {{ formatDate(generatedReport.generated_at) }}</p>
                            </div>
                            <div class="flex items-center gap-2">
                                <button @click="downloadAsCSV" class="btn-ghost text-xs gap-1.5">
                                    <FileSpreadsheet class="w-3.5 h-3.5" />
                                    CSV
                                </button>
                                <button @click="downloadReport" class="btn-primary text-xs gap-1.5">
                                    <Download class="w-3.5 h-3.5" />
                                    JSON
                                </button>
                            </div>
                        </div>

                        <!-- Sales Report -->
                        <div v-if="generatedReport.type === 'sales' && generatedReport.summary" class="space-y-4">
                            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div class="bg-neutral-50 rounded-xl p-4">
                                    <p class="text-[10px] uppercase tracking-[0.15em] text-neutral-500 font-bold mb-1">Revenue</p>
                                    <p class="text-xl font-bold text-ink tabular-nums">{{ '$' }}{{ formatPrice(generatedReport.summary.total_revenue) }}</p>
                                </div>
                                <div class="bg-neutral-50 rounded-xl p-4">
                                    <p class="text-[10px] uppercase tracking-[0.15em] text-neutral-500 font-bold mb-1">Orders</p>
                                    <p class="text-xl font-bold text-ink tabular-nums">{{ generatedReport.summary.total_orders }}</p>
                                </div>
                                <div class="bg-neutral-50 rounded-xl p-4">
                                    <p class="text-[10px] uppercase tracking-[0.15em] text-neutral-500 font-bold mb-1">Customers</p>
                                    <p class="text-xl font-bold text-ink tabular-nums">{{ generatedReport.summary.total_customers }}</p>
                                </div>
                                <div class="bg-neutral-50 rounded-xl p-4">
                                    <p class="text-[10px] uppercase tracking-[0.15em] text-neutral-500 font-bold mb-1">Avg Order</p>
                                    <p class="text-xl font-bold text-ink tabular-nums">{{ '$' }}{{ formatPrice(generatedReport.summary.average_order_value) }}</p>
                                </div>
                            </div>
                            <div v-if="generatedReport.product_performance?.length" class="overflow-x-auto">
                                <p class="text-xs font-bold uppercase tracking-[0.15em] text-neutral-500 mb-3">Top products</p>
                                <table class="w-full min-w-[400px]">
                                    <thead class="bg-neutral-50 border-b border-neutral-200">
                                        <tr>
                                            <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-500">Product</th>
                                            <th class="px-4 py-2.5 text-right text-[10px] font-bold uppercase text-neutral-500">Units</th>
                                            <th class="px-4 py-2.5 text-right text-[10px] font-bold uppercase text-neutral-500">Revenue</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-neutral-200">
                                        <tr v-for="p in generatedReport.product_performance" :key="p.name" class="hover:bg-neutral-50">
                                            <td class="px-4 py-3 text-sm font-semibold text-ink">{{ truncate(p.name, 40) }}</td>
                                            <td class="px-4 py-3 text-sm text-right text-ink tabular-nums">{{ p.units }}</td>
                                            <td class="px-4 py-3 text-sm text-right text-ink tabular-nums font-bold">{{ '$' }}{{ formatPrice(p.revenue) }}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- Inventory Report -->
                        <div v-else-if="generatedReport.type === 'inventory'" class="space-y-4">
                            <div class="grid grid-cols-3 gap-3">
                                <div class="bg-neutral-50 rounded-xl p-4">
                                    <p class="text-[10px] uppercase tracking-[0.15em] text-neutral-500 font-bold mb-1">Total Products</p>
                                    <p class="text-xl font-bold text-ink tabular-nums">{{ generatedReport.total_products }}</p>
                                </div>
                                <div class="bg-neutral-50 rounded-xl p-4">
                                    <p class="text-[10px] uppercase tracking-[0.15em] text-neutral-500 font-bold mb-1">Low Stock</p>
                                    <p class="text-xl font-bold text-warning tabular-nums">{{ generatedReport.low_stock_count }}</p>
                                </div>
                                <div class="bg-neutral-50 rounded-xl p-4">
                                    <p class="text-[10px] uppercase tracking-[0.15em] text-neutral-500 font-bold mb-1">Out of Stock</p>
                                    <p class="text-xl font-bold text-danger tabular-nums">{{ generatedReport.out_of_stock_count }}</p>
                                </div>
                            </div>
                            <div v-if="generatedReport.low_stock_items?.length" class="overflow-x-auto">
                                <p class="text-xs font-bold uppercase tracking-[0.15em] text-neutral-500 mb-3">Low stock items</p>
                                <table class="w-full min-w-[400px]">
                                    <thead class="bg-neutral-50 border-b border-neutral-200">
                                        <tr>
                                            <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-500">Product</th>
                                            <th class="px-4 py-2.5 text-right text-[10px] font-bold uppercase text-neutral-500">Stock</th>
                                            <th class="px-4 py-2.5 text-right text-[10px] font-bold uppercase text-neutral-500">Min</th>
                                            <th class="px-4 py-2.5 text-right text-[10px] font-bold uppercase text-neutral-500">Shortage</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-neutral-200">
                                        <tr v-for="item in generatedReport.low_stock_items" :key="item.productname" class="hover:bg-neutral-50">
                                            <td class="px-4 py-3 text-sm font-semibold text-ink">{{ truncate(item.productname, 40) }}</td>
                                            <td class="px-4 py-3 text-sm text-right text-ink tabular-nums">{{ item.quantity }}</td>
                                            <td class="px-4 py-3 text-sm text-right text-neutral-600 tabular-nums">{{ item.reorder_level }}</td>
                                            <td class="px-4 py-3 text-sm text-right text-danger tabular-nums font-bold">{{ item.shortage }}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- Customer Report -->
                        <div v-else-if="generatedReport.type === 'customer'" class="space-y-4">
                            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div class="bg-neutral-50 rounded-xl p-4">
                                    <p class="text-[10px] uppercase tracking-[0.15em] text-neutral-500 font-bold mb-1">Total</p>
                                    <p class="text-xl font-bold text-ink tabular-nums">{{ generatedReport.total_users }}</p>
                                </div>
                                <div class="bg-neutral-50 rounded-xl p-4">
                                    <p class="text-[10px] uppercase tracking-[0.15em] text-neutral-500 font-bold mb-1">New Today</p>
                                    <p class="text-xl font-bold text-accent tabular-nums">{{ generatedReport.new_today }}</p>
                                </div>
                                <div class="bg-neutral-50 rounded-xl p-4">
                                    <p class="text-[10px] uppercase tracking-[0.15em] text-neutral-500 font-bold mb-1">This Week</p>
                                    <p class="text-xl font-bold text-ink tabular-nums">{{ generatedReport.new_this_week }}</p>
                                </div>
                                <div class="bg-neutral-50 rounded-xl p-4">
                                    <p class="text-[10px] uppercase tracking-[0.15em] text-neutral-500 font-bold mb-1">This Month</p>
                                    <p class="text-xl font-bold text-ink tabular-nums">{{ generatedReport.new_this_month }}</p>
                                </div>
                            </div>
                            <div v-if="generatedReport.recent_users?.length" class="overflow-x-auto">
                                <p class="text-xs font-bold uppercase tracking-[0.15em] text-neutral-500 mb-3">Recent users</p>
                                <table class="w-full min-w-[400px]">
                                    <thead class="bg-neutral-50 border-b border-neutral-200">
                                        <tr>
                                            <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-500">Username</th>
                                            <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-500">Email</th>
                                            <th class="px-4 py-2.5 text-right text-[10px] font-bold uppercase text-neutral-500">Joined</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-neutral-200">
                                        <tr v-for="u in generatedReport.recent_users" :key="u.id" class="hover:bg-neutral-50">
                                            <td class="px-4 py-3 text-sm font-semibold text-ink">{{ u.username }}</td>
                                            <td class="px-4 py-3 text-sm text-neutral-600">{{ u.email }}</td>
                                            <td class="px-4 py-3 text-sm text-right text-neutral-600 tabular-nums">{{ formatDate(u.joined_at) }}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- Financial Report -->
                        <div v-else-if="generatedReport.type === 'financial'" class="space-y-4">
                            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div class="bg-neutral-50 rounded-xl p-4">
                                    <p class="text-[10px] uppercase tracking-[0.15em] text-neutral-500 font-bold mb-1">Revenue</p>
                                    <p class="text-xl font-bold text-ink tabular-nums">{{ '$' }}{{ formatPrice(generatedReport.revenue?.month) }}</p>
                                </div>
                                <div class="bg-neutral-50 rounded-xl p-4">
                                    <p class="text-[10px] uppercase tracking-[0.15em] text-neutral-500 font-bold mb-1">Total Orders</p>
                                    <p class="text-xl font-bold text-ink tabular-nums">{{ generatedReport.orders?.total }}</p>
                                </div>
                                <div class="bg-neutral-50 rounded-xl p-4">
                                    <p class="text-[10px] uppercase tracking-[0.15em] text-neutral-500 font-bold mb-1">Avg Order</p>
                                    <p class="text-xl font-bold text-ink tabular-nums">{{ '$' }}{{ formatPrice(generatedReport.average_order_value) }}</p>
                                </div>
                                <div class="bg-neutral-50 rounded-xl p-4">
                                    <p class="text-[10px] uppercase tracking-[0.15em] text-neutral-500 font-bold mb-1">Growth</p>
                                    <p class="text-xl font-bold tabular-nums" :class="(generatedReport.growth?.revenue || 0) > 0 ? 'text-success' : 'text-danger'">
                                        {{ generatedReport.growth?.revenue > 0 ? '+' : '' }}{{ generatedReport.growth?.revenue || 0 }}%
                                    </p>
                                </div>
                            </div>
                        </div>

                        <!-- Discount Report -->
                        <div v-else-if="generatedReport.type === 'discount'" class="space-y-6">
                            <!-- Summary KPI Cards -->
                            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div class="bg-neutral-50 rounded-xl p-4">
                                    <div class="flex items-center gap-2 mb-1">
                                        <Tag class="w-3.5 h-3.5 text-purple-500" />
                                        <p class="text-[10px] uppercase tracking-[0.15em] text-neutral-500 font-bold">Total Discounts</p>
                                    </div>
                                    <p class="text-xl font-bold text-ink tabular-nums">{{ generatedReport.summary.total_discounts }}</p>
                                </div>
                                <div class="bg-neutral-50 rounded-xl p-4">
                                    <div class="flex items-center gap-2 mb-1">
                                        <Percent class="w-3.5 h-3.5 text-accent" />
                                        <p class="text-[10px] uppercase tracking-[0.15em] text-neutral-500 font-bold">Redemption Rate</p>
                                    </div>
                                    <p class="text-xl font-bold text-ink tabular-nums">{{ generatedReport.summary.redemption_rate }}%</p>
                                </div>
                                <div class="bg-neutral-50 rounded-xl p-4">
                                    <div class="flex items-center gap-2 mb-1">
                                        <TrendingDown class="w-3.5 h-3.5 text-danger" />
                                        <p class="text-[10px] uppercase tracking-[0.15em] text-neutral-500 font-bold">Revenue Impact</p>
                                    </div>
                                    <p class="text-xl font-bold text-ink tabular-nums">{{ '$' }}{{ formatPrice(generatedReport.summary.total_discount_amount) }}</p>
                                </div>
                                <div class="bg-neutral-50 rounded-xl p-4">
                                    <div class="flex items-center gap-2 mb-1">
                                        <Clock class="w-3.5 h-3.5 text-amber-500" />
                                        <p class="text-[10px] uppercase tracking-[0.15em] text-neutral-500 font-bold">Avg Amount</p>
                                    </div>
                                    <p class="text-xl font-bold text-ink tabular-nums">{{ '$' }}{{ formatPrice(generatedReport.summary.avg_discount_amount) }}</p>
                                </div>
                            </div>

                            <!-- Status Breakdown -->
                            <div class="grid grid-cols-3 gap-3">
                                <div class="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                                    <p class="text-[10px] uppercase tracking-[0.15em] text-emerald-600 font-bold mb-1">Active</p>
                                    <p class="text-lg font-bold text-emerald-700 tabular-nums">{{ generatedReport.summary.active_count }}</p>
                                </div>
                                <div class="bg-amber-50 rounded-xl p-4 border border-amber-100">
                                    <p class="text-[10px] uppercase tracking-[0.15em] text-amber-600 font-bold mb-1">Scheduled</p>
                                    <p class="text-lg font-bold text-amber-700 tabular-nums">{{ generatedReport.summary.scheduled_count }}</p>
                                </div>
                                <div class="bg-neutral-100 rounded-xl p-4 border border-neutral-200">
                                    <p class="text-[10px] uppercase tracking-[0.15em] text-neutral-500 font-bold mb-1">Expired</p>
                                    <p class="text-lg font-bold text-neutral-600 tabular-nums">{{ generatedReport.summary.expired_count }}</p>
                                </div>
                            </div>

                            <!-- Revenue Impact Comparison -->
                            <div class="bg-neutral-50 rounded-xl p-4">
                                <p class="text-xs font-bold uppercase tracking-[0.15em] text-neutral-500 mb-3">Revenue: Discounted vs Non-Discounted</p>
                                <div class="space-y-3">
                                    <div>
                                        <div class="flex justify-between text-sm mb-1">
                                            <span class="font-semibold text-ink">Non-Discounted Revenue</span>
                                            <span class="font-bold text-ink tabular-nums">{{ '$' }}{{ formatPrice(generatedReport.summary.non_discounted_revenue) }}</span>
                                        </div>
                                        <div class="w-full bg-neutral-200 rounded-full h-2.5 overflow-hidden">
                                            <div class="bg-accent h-2.5 rounded-full transition-all" :style="{ width: (100 - generatedReport.summary.discount_revenue_share) + '%' }"></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div class="flex justify-between text-sm mb-1">
                                            <span class="font-semibold text-ink">Discounted Revenue</span>
                                            <span class="font-bold text-ink tabular-nums">{{ '$' }}{{ formatPrice(generatedReport.summary.discounted_revenue) }}</span>
                                        </div>
                                        <div class="w-full bg-neutral-200 rounded-full h-2.5 overflow-hidden">
                                            <div class="bg-purple-500 h-2.5 rounded-full transition-all" :style="{ width: generatedReport.summary.discount_revenue_share + '%' }"></div>
                                        </div>
                                    </div>
                                    <p class="text-xs text-neutral-500">{{ generatedReport.summary.discount_revenue_share }}% of total revenue comes from discounted orders</p>
                                </div>
                            </div>

                            <!-- Discount Usage Table -->
                            <div v-if="generatedReport.discount_usage?.length">
                                <p class="text-xs font-bold uppercase tracking-[0.15em] text-neutral-500 mb-3">Discount usage breakdown</p>
                                <div class="overflow-x-auto">
                                    <table class="w-full min-w-[500px]">
                                        <thead class="bg-neutral-50 border-b border-neutral-200">
                                            <tr>
                                                <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase text-neutral-500">Product</th>
                                                <th class="px-4 py-2.5 text-right text-[10px] font-bold uppercase text-neutral-500">Amount</th>
                                                <th class="px-4 py-2.5 text-right text-[10px] font-bold uppercase text-neutral-500">Times Used</th>
                                                <th class="px-4 py-2.5 text-right text-[10px] font-bold uppercase text-neutral-500">Revenue</th>
                                                <th class="px-4 py-2.5 text-center text-[10px] font-bold uppercase text-neutral-500">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-neutral-200">
                                            <tr v-for="d in generatedReport.discount_usage" :key="d.discount_id" class="hover:bg-neutral-50">
                                                <td class="px-4 py-3 text-sm font-semibold text-ink">{{ truncate(d.product_name, 35) }}</td>
                                                <td class="px-4 py-3 text-sm text-right text-ink tabular-nums font-bold">{{ '$' }}{{ formatPrice(d.discount_amount) }}</td>
                                                <td class="px-4 py-3 text-sm text-right tabular-nums"
                                                    :class="d.times_used > 0 ? 'text-ink font-semibold' : 'text-neutral-400'">
                                                    {{ d.times_used }}
                                                </td>
                                                <td class="px-4 py-3 text-sm text-right text-ink tabular-nums">{{ '$' }}{{ formatPrice(d.revenue_from_used) }}</td>
                                                <td class="px-4 py-3 text-center">
                                                    <span v-if="d.times_used > 0"
                                                        class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-600">
                                                        Redeemed
                                                    </span>
                                                    <span v-else
                                                        class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-neutral-100 text-neutral-500">
                                                        Unused
                                                    </span>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div v-else class="p-6 text-center text-neutral-400 text-sm bg-neutral-50 rounded-xl">
                                No discounts found in the system
                            </div>

                            <!-- Usage Trend -->
                            <div v-if="generatedReport.usage_trend?.length" class="bg-neutral-50 rounded-xl p-4">
                                <p class="text-xs font-bold uppercase tracking-[0.15em] text-neutral-500 mb-3">Discount usage trend</p>
                                <div class="overflow-x-auto">
                                    <table class="w-full min-w-[300px]">
                                        <thead class="border-b border-neutral-200">
                                            <tr>
                                                <th class="px-4 py-2 text-left text-[10px] font-bold uppercase text-neutral-500">Period</th>
                                                <th class="px-4 py-2 text-right text-[10px] font-bold uppercase text-neutral-500">Discounts Used</th>
                                                <th class="px-4 py-2 text-right text-[10px] font-bold uppercase text-neutral-500">Revenue</th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-neutral-200">
                                            <tr v-for="t in generatedReport.usage_trend" :key="t.period" class="hover:bg-paper">
                                                <td class="px-4 py-2.5 text-sm text-ink">{{ t.period }}</td>
                                                <td class="px-4 py-2.5 text-sm text-right text-ink tabular-nums">{{ t.times_used }}</td>
                                                <td class="px-4 py-2.5 text-sm text-right text-ink tabular-nums font-bold">{{ '$' }}{{ formatPrice(t.revenue) }}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <!-- Expiring Soon -->
                            <div v-if="generatedReport.expiring_soon?.length" class="bg-amber-50 rounded-xl p-4 border border-amber-100">
                                <div class="flex items-center gap-2 mb-3">
                                    <AlertTriangle class="w-4 h-4 text-amber-500" />
                                    <p class="text-sm font-bold text-amber-700">Expiring within 7 days</p>
                                </div>
                                <div class="space-y-2">
                                    <div v-for="e in generatedReport.expiring_soon" :key="e.discount_id"
                                        class="flex items-center justify-between text-sm bg-paper/60 rounded-lg px-3 py-2">
                                        <span class="font-semibold text-amber-800">{{ e.product_name }}</span>
                                        <div class="flex items-center gap-3">
                                            <span class="text-amber-600 tabular-nums">{{ '$' }}{{ formatPrice(e.discount_amount) }}</span>
                                            <span class="text-xs text-amber-500 tabular-nums">ends {{ formatDate(e.end_date) }}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="mt-6 pt-4 border-t border-neutral-200">
                            <button @click="newReport" class="btn-outline text-sm">Generate another report</button>
                        </div>
                    </div>
                </div>

                <!-- Sidebar -->
                <div class="space-y-6">
                    <div class="card-flat p-5 sm:p-6">
                        <h3 class="text-sm font-bold text-ink mb-4">Export formats</h3>
                        <div class="space-y-3">
                            <div class="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl">
                                <div class="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                                    <FileText class="w-5 h-5 text-accent" />
                                </div>
                                <div>
                                    <p class="text-sm font-semibold text-ink">JSON</p>
                                    <p class="text-xs text-neutral-500">Full data export</p>
                                </div>
                            </div>
                            <div class="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl">
                                <div class="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                                    <FileSpreadsheet class="w-5 h-5 text-success" />
                                </div>
                                <div>
                                    <p class="text-sm font-semibold text-ink">CSV</p>
                                    <p class="text-xs text-neutral-500">Spreadsheet format</p>
                                </div>
                            </div>
                        </div>
                        <p class="text-xs text-neutral-400 mt-4 leading-relaxed">
                            Reports are generated in real-time using your current store data and can be downloaded immediately.
                        </p>
                    </div>

                    <div class="card-flat p-5 sm:p-6 bg-accent/5 border-accent/20">
                        <div class="flex gap-3">
                            <Sparkles class="w-5 h-5 text-accent shrink-0 mt-0.5" />
                            <div>
                                <p class="text-sm font-bold text-ink mb-1">Real-time data</p>
                                <p class="text-xs text-neutral-600 leading-relaxed">
                                    All reports pull live data from your store. Generated reports can be downloaded as JSON or CSV for external analysis.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>