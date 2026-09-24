<script setup>
import { ref, computed, onMounted } from 'vue';
import { orderAPI } from '../../api/orderApi.js';
import { paymentAPI } from '../../api/paymentApi.js';
import { useToast } from '../../composables/useToast.js';
import {
    ShoppingBag,
    Search,
    RefreshCw,
    Eye,
    X,
    ChevronDown,
    AlertCircle,
    User as UserIcon,
    Mail,
    Calendar,
    DollarSign,
    CheckCircle,
} from 'lucide-vue-next';

const toast = useToast();

const orders = ref([]);
const loading = ref(false);
const error = ref(null);
const searchQuery = ref('');
const statusFilter = ref("all");
const showDetailModal = ref(false);
const selectedOrder = ref(null);
const updatingId = ref(null);
const markingPaidId = ref(null);

const statuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

const statusStyles = {
    pending:    'bg-warning/10 text-warning border-warning/20',
    confirmed:  'bg-info/10 text-info border-info/20',
    shipped:    'bg-accent/10 text-accent border-accent/20',
    delivered:  'bg-success/10 text-success border-success/20',
    cancelled:  'bg-danger/10 text-danger border-danger/20',
};

const filteredOrders = computed(() => {
    let result = orders.value;
    if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase();
        result = result.filter(o =>
            o.username?.toLowerCase().includes(q) ||
            o.email?.toLowerCase().includes(q) ||
            String(o.orderId).includes(q)
        );
    }
    if (statusFilter.value !== 'all') {
        result = result.filter(o => o.status === statusFilter.value);
    }
    return result;
});

const statusCounts = computed(() => {
    const counts = { all: orders.value.length };
    statuses.forEach(s => { counts[s] = orders.value.filter(o => o.status === s).length; });
    return counts;
});

const totalRevenue = computed(() =>
    filteredOrders.value.reduce((sum, o) => sum + parseFloat(o.totalAmount || 0), 0)
);

const fetchOrders = async () => {
    try {
        loading.value = true;
        error.value = null;
        const response = await orderAPI.getAllOrders();
        if (response.success) {
            orders.value = response.data;
        } else {
            error.value = response.message || 'Failed to load orders';
        }
    } catch (err) {
        console.error('Error fetching orders:', err);
        error.value = err.response?.data?.message || 'Failed to load orders';
    } finally {
        loading.value = false;
    }
};

const openDetail = async (order) => {
    try {
        const response = await orderAPI.getOrder(order.orderId);
        if (response.success) {
            selectedOrder.value = response.data;
            showDetailModal.value = true;
        } else {
            toast.error(response.message || 'Failed to load order details');
        }
    } catch (err) {
        console.error('Error loading order detail:', err);
        toast.error(err.response?.data?.message || 'Failed to load order details');
    }
};

const closeDetail = () => {
    showDetailModal.value = false;
    selectedOrder.value = null;
};

const updateStatus = async (orderId, newStatus) => {
    updatingId.value = orderId;
    try {
        const response = await orderAPI.updateOrderStatus(orderId, newStatus);
        if (response.success) {
            toast.success('Order #' + orderId + ' status changed to ' + newStatus);
            const idx = orders.value.findIndex(o => o.orderId === orderId);
            if (idx !== -1) orders.value[idx].status = newStatus;
            if (selectedOrder.value?.orderId === orderId) {
                selectedOrder.value.status = newStatus;
            }
        } else {
            toast.error(response.message || 'Failed to update status');
        }
    } catch (err) {
        console.error('Error updating status:', err);
        toast.error(err.response?.data?.message || 'Failed to update status');
    } finally {
        updatingId.value = null;
    }
};

const isCODPending = (order) =>
    order.paymentMethod === 'Cash on Delivery' && order.paymentStatus === 'pending';

const markAsPaid = async (order) => {
    markingPaidId.value = order.orderId;
    try {
        const response = await paymentAPI.markPaymentAsPaid(order.orderId);
        if (response.success) {
            toast.success('Order #' + order.orderId + ' marked as paid');
            // Update local state
            const idx = orders.value.findIndex(o => o.orderId === order.orderId);
            if (idx !== -1) {
                orders.value[idx].paymentStatus = 'paid';
                orders.value[idx].status = 'confirmed';
            }
            if (selectedOrder.value?.orderId === order.orderId) {
                selectedOrder.value.paymentStatus = 'paid';
                selectedOrder.value.status = 'confirmed';
            }
        } else {
            toast.error(response.message || 'Failed to mark payment as paid');
        }
    } catch (err) {
        console.error('Error marking payment as paid:', err);
        toast.error(err.response?.data?.message || 'Failed to mark payment as paid');
    } finally {
        markingPaidId.value = null;
    }
};

const formatPrice = (price) => parseFloat(price || 0).toFixed(2);

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
};

const filterBtnClass = (value) => ({
    'bg-ink text-white': statusFilter.value === value,
    'bg-neutral-100 text-neutral-700 hover:bg-neutral-200': statusFilter.value !== value
});

onMounted(fetchOrders);
</script>
<template>
    <div class="min-h-screen bg-neutral-100">
        <div class="section py-6 sm:py-8">
            <div class="mb-8">
                <span class="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-accent mb-2">
                    <ShoppingBag class="w-3.5 h-3.5" />
                    Orders
                </span>
                <h1 class="text-2xl sm:text-3xl font-bold text-ink">Order management</h1>
                <p class="text-neutral-500 mt-1 text-sm">View, manage, and update customer orders</p>
            </div>

            <div class="flex flex-wrap gap-2 mb-6">                    <button v-for="status in ['all', ...statuses]" :key="status" @click="statusFilter = status" :class="filterBtnClass(status)" class="px-4 py-2.5 rounded-lg font-semibold text-sm capitalize transition-all active:scale-95">
                        {{ status }}
                        <span class="ml-1.5 text-xs opacity-70">({{ statusCounts[status] || 0 }})</span>
                    </button>
            </div>

            <div class="card-flat p-4 sm:p-6 mb-6">
                <div class="flex flex-col sm:flex-row gap-4">
                    <div class="flex-1 relative">
                        <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                        <input v-model="searchQuery" type="text" placeholder="Search by customer, email, or order ID..." class="input-base pl-11" aria-label="Search orders" />
                    </div>
                    <div class="flex items-center gap-3 shrink-0">
                        <span class="text-sm text-neutral-500 font-medium">{{ filteredOrders.length }} of {{ orders.length }} orders</span>
                        <span class="text-sm font-bold text-ink tabular-nums">${{ formatPrice(totalRevenue) }}</span>
                    </div>
                </div>
            </div>

            <div v-if="error && orders.length === 0" class="card-flat border-l-4 border-danger p-6 mb-6">
                <div class="flex items-center gap-3">
                    <AlertCircle class="w-6 h-6 text-danger shrink-0" />
                    <div class="flex-1 min-w-0">
                        <h3 class="font-bold text-ink text-sm">Error Loading Orders</h3>
                        <p class="text-neutral-600 text-sm mt-0.5">{{ error }}</p>
                    </div>
                    <button @click="fetchOrders" class="btn-primary text-sm gap-1.5 shrink-0">
                        <RefreshCw class="w-3.5 h-3.5" />
                        Retry
                    </button>
                </div>
            </div>

            <div v-if="loading && orders.length === 0" class="card-flat overflow-hidden animate-pulse">
                <div class="flex flex-wrap gap-2 px-6 pt-6 pb-2">
                    <div v-for="i in 6" :key="i" class="h-9 w-24 bg-neutral-200 rounded-lg"></div>
                </div>
                <div class="px-6 pt-6 pb-4">
                    <div class="h-12 bg-neutral-200 rounded-xl"></div>
                </div>
                <div class="divide-y divide-neutral-100">
                    <div class="px-6 py-3.5">
                        <div class="grid grid-cols-7 gap-4">
                            <div v-for="i in 7" :key="i" class="h-3 bg-neutral-200 rounded w-3/4"></div>
                        </div>
                    </div>
                    <div v-for="row in 5" :key="row" class="px-6 py-5">
                        <div class="grid grid-cols-7 gap-4 items-center">
                            <div><div class="h-4 bg-neutral-200 rounded w-16"></div></div>
                            <div class="space-y-2">
                                <div class="h-3.5 bg-neutral-200 rounded w-28"></div>
                                <div class="h-3 bg-neutral-200 rounded w-36"></div>
                            </div>
                            <div><div class="h-4 bg-neutral-200 rounded w-14"></div></div>
                            <div><div class="h-4 bg-neutral-200 rounded w-10"></div></div>
                            <div><div class="h-6 bg-neutral-200 rounded-full w-24"></div></div>
                            <div><div class="h-3.5 bg-neutral-200 rounded w-20"></div></div>
                            <div class="flex justify-end"><div class="h-8 bg-neutral-200 rounded-lg w-16"></div></div>
                        </div>
                    </div>
                </div>
            </div>

            <div v-else class="card-flat overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full min-w-[800px]">
                        <thead class="bg-neutral-50/60 border-b border-neutral-200">
                            <tr>
                                <th class="px-6 py-3 text-left text-[10px] font-semibold text-neutral-400 uppercase tracking-[0.12em]">Order</th>
                                <th class="px-6 py-3 text-left text-[10px] font-semibold text-neutral-400 uppercase tracking-[0.12em]">Customer</th>
                                <th class="px-6 py-3 text-left text-[10px] font-semibold text-neutral-400 uppercase tracking-[0.12em]">Amount</th>
                                <th class="px-6 py-3 text-left text-[10px] font-semibold text-neutral-400 uppercase tracking-[0.12em]">Items</th>
                                <th class="px-6 py-3 text-left text-[10px] font-semibold text-neutral-400 uppercase tracking-[0.12em]">Status</th>
                                <th class="px-6 py-3 text-left text-[10px] font-semibold text-neutral-400 uppercase tracking-[0.12em]">Date</th>
                                <th class="px-6 py-3 text-right text-[10px] font-semibold text-neutral-400 uppercase tracking-[0.12em]">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-neutral-100">
                            <tr v-for="order in filteredOrders" :key="order.orderId" class="hover:bg-neutral-50/70 transition-colors">
                                <td class="px-6 py-2.5"><span class="font-bold text-ink tabular-nums">#{{ order.orderId }}</span></td>
                                <td class="px-6 py-2.5">
                                    <p class="font-semibold text-ink text-sm">{{ order.username }}</p>
                                    <p class="text-[11px] text-neutral-400">{{ order.email }}</p>
                                </td>
                                <td class="px-6 py-2.5"><span class="font-bold text-ink tabular-nums">${{ formatPrice(order.totalAmount) }}</span></td>
                                <td class="px-6 py-2.5"><span class="text-sm text-neutral-600 tabular-nums">{{ order.itemCount }}</span></td>
                                <td class="px-6 py-2.5">
                                    <div class="relative inline-block">
                                        <select :value="order.status" @change="updateStatus(order.orderId, $event.target.value)" :disabled="updatingId === order.orderId" :aria-label="'Order status for #' + order.orderId" :class="['px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide border appearance-none cursor-pointer pr-6 disabled:opacity-50', statusStyles[order.status] || 'bg-neutral-100 text-neutral-700']">
                                            <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
                                        </select>
                                        <ChevronDown class="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none opacity-60" />
                                    </div>
                                </td>
                                <td class="px-6 py-2.5"><span class="text-[11px] text-neutral-400">{{ formatDate(order.createdAt) }}</span></td>
                                <td class="px-6 py-2.5 text-right">
                                    <div class="flex items-center justify-end gap-2">
                                        <button v-if="isCODPending(order)"
                                            @click="markAsPaid(order)"
                                            :disabled="markingPaidId === order.orderId"
                                            class="btn-ghost text-xs gap-1.5 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 disabled:opacity-50">
                                            <CheckCircle v-if="markingPaidId !== order.orderId" class="w-3.5 h-3.5" />
                                            <svg v-else class="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            Mark Paid
                                        </button>
                                        <button @click="openDetail(order)" class="btn-ghost text-xs gap-1.5">
                                            <Eye class="w-3.5 h-3.5" />
                                            View
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div v-if="filteredOrders.length === 0" class="text-center py-16">
                    <ShoppingBag class="mx-auto w-12 h-12 text-neutral-300 mb-4" />
                    <p class="text-neutral-500 text-sm font-medium">No orders found</p>
                    <p v-if="searchQuery || statusFilter !== 'all'" class="text-xs text-neutral-400 mt-1">Try adjusting your search or filter criteria</p>
                </div>
            </div>
        </div>

        <!-- Order Detail Modal -->
        <div v-if="showDetailModal && selectedOrder" @click="closeDetail" class="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div @click.stop class="card-flat p-5 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-[scale-in_0.25s_ease-out]">
                <div class="flex items-center justify-between mb-6">
                    <div>
                        <span class="text-[10px] uppercase tracking-[0.2em] text-accent font-bold">Order Details</span>
                        <h2 class="text-xl font-bold text-ink mt-1">Order #{{ selectedOrder.orderId }}</h2>
                    </div>
                    <button @click="closeDetail" class="btn-ghost p-1.5 -mr-1.5">
                        <X class="w-5 h-5" />
                    </button>
                </div>

                <div class="bg-neutral-50 rounded-xl p-5 mb-6">
                    <h3 class="text-xs font-bold uppercase tracking-[0.15em] text-neutral-500 mb-3">Customer Information</h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div class="flex items-center gap-3">
                            <UserIcon class="w-4 h-4 text-neutral-400 shrink-0" />
                            <span class="text-sm text-ink font-semibold">{{ selectedOrder.username }}</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <Mail class="w-4 h-4 text-neutral-400 shrink-0" />
                            <span class="text-sm text-neutral-600">{{ selectedOrder.email }}</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <Calendar class="w-4 h-4 text-neutral-400 shrink-0" />
                            <span class="text-sm text-neutral-600">{{ formatDate(selectedOrder.createdAt) }}</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-xs font-bold uppercase tracking-[0.15em] text-neutral-500 shrink-0">Status</span>
                            <span :class="['px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide', statusStyles[selectedOrder.status] || 'bg-neutral-100 text-neutral-700']">{{ selectedOrder.status }}</span>
                        </div>
                    </div>
                </div>

                <div class="mb-6">
                    <h3 class="text-xs font-bold uppercase tracking-[0.15em] text-neutral-500 mb-3">Order Items</h3>
                    <div class="space-y-3">
                        <div v-for="item in selectedOrder.items" :key="item.orderItemId" class="flex items-center justify-between p-4 bg-neutral-50 rounded-xl">
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-semibold text-ink">{{ item.productName }}</p>
                                <p class="text-xs text-neutral-500 mt-0.5">SKU: {{ item.sku || 'N/A' }} &middot; Qty: {{ item.quantity }}</p>
                            </div>
                            <div class="text-right shrink-0 ml-4">
                                <p class="text-sm font-bold text-ink tabular-nums">${{ formatPrice(item.unitPrice) }}</p>
                                <p class="text-xs text-neutral-500 tabular-nums">${{ formatPrice(item.subtotal) }} total</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="border-t border-neutral-200 pt-4">
                    <div class="flex items-center justify-between">
                        <span class="text-sm font-bold text-ink">Total</span>
                        <span class="text-xl font-bold text-accent tabular-nums">${{ formatPrice(selectedOrder.totalAmount) }}</span>
                    </div>
                </div>

                <div class="mt-6 pt-4 border-t border-neutral-200">
                    <h3 class="text-xs font-bold uppercase tracking-[0.15em] text-neutral-500 mb-3">Update Status</h3>
                    <div class="flex flex-wrap gap-2">
                        <button v-for="s in statuses" :key="s" @click="updateStatus(selectedOrder.orderId, s)" :disabled="updatingId === selectedOrder.orderId || selectedOrder.status === s" :class="['px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all', selectedOrder.status === s ? (statusStyles[s] || 'bg-neutral-100 text-neutral-700') + ' ring-2 ring-offset-1' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-ink']">
                            {{ s }}
                        </button>
                    </div>

                    <!-- COD: Mark as Paid -->
                    <div v-if="isCODPending(selectedOrder)" class="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <div class="flex items-center gap-3">
                            <DollarSign class="w-5 h-5 text-emerald-600 shrink-0" />
                            <div class="flex-1 min-w-0">
                                <p class="font-bold text-sm text-emerald-800">Cash on Delivery</p>
                                <p class="text-xs text-emerald-600 mt-0.5">This order is awaiting cash payment. Mark as paid once the customer pays on delivery.</p>
                            </div>
                            <button @click="markAsPaid(selectedOrder)"
                                :disabled="markingPaidId === selectedOrder.orderId"
                                class="shrink-0 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                                <span v-if="markingPaidId !== selectedOrder.orderId" class="flex items-center gap-1.5">
                                    <CheckCircle class="w-3.5 h-3.5" />
                                    Mark as Paid
                                </span>
                                <span v-else class="flex items-center gap-1.5">
                                    <svg class="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Processing...
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
