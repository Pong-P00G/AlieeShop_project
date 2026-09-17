<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useShopStore } from '../stores/shop';
import { useRouter } from 'vue-router';
import { orderAPI } from '../api/orderApi.js';
import { useToast } from '../composables/useToast.js';
import {
    User, Mail, Phone, MapPin, Calendar, Camera,
    Edit3, Save, LogOut, Package, Heart, Settings as SettingsIcon,
    ShoppingBag, ShieldCheck, Loader2, X, Eye, RefreshCw,
    AlertCircle, ChevronDown, Search, Download, CreditCard,
    ChevronRight, ArrowRight, Clock, CheckCircle, Truck
} from 'lucide-vue-next';

const authStore = useAuthStore();
const shop = useShopStore();
const router = useRouter();
const toast = useToast();

// Profile state
const activeTab = ref('overview');
const isEditing = ref(false);
const isSaving = ref(false);
const isSaved = ref(false);

const profile = ref({
    name: authStore.user?.username || 'Guest User',
    email: authStore.user?.email || 'user@aleeshop.com',
    phone: '+1 (555) 123-4567',
    location: 'Phnom Penh, Cambodia',
    bio: 'Lover of design, slow fashion, and great coffee.',
    joined: '2024',
});

// Orders state 
const orders = ref([]);
const ordersLoading = ref(false);
const ordersError = ref(null);
const selectedOrder = ref(null);
const orderDetailLoading = ref(false);
const showDetailModal = ref(false);

const totalOrders = computed(() => orders.value.length);
const totalSpent = computed(() =>
    orders.value.reduce((sum, o) => sum + parseFloat(o.totalAmount || 0), 0)
);

const stats = computed(() => [
    { label: 'Orders', value: totalOrders.value, icon: Package },
    { label: 'Wishlist', value: 12, icon: Heart },
    { label: 'Total spent', value: `$${totalSpent.value.toFixed(0)}`, icon: CreditCard },
]);

// Order status display helpers
const statusConfig = {
    pending:    { label: 'Pending',     color: 'bg-warning/10 text-warning border-warning/20', icon: Clock },
    confirmed:  { label: 'Confirmed',   color: 'bg-info/10 text-info border-info/20', icon: CheckCircle },
    shipped:    { label: 'Shipped',     color: 'bg-accent/10 text-accent border-accent/20', icon: Truck },
    delivered:  { label: 'Delivered',   color: 'bg-success/10 text-success border-success/20', icon: CheckCircle },
    cancelled:  { label: 'Cancelled',   color: 'bg-danger/10 text-danger border-danger/20', icon: X },
};

const getStatusConfig = (status) =>
    statusConfig[status] || { label: status, color: 'bg-neutral-100 text-neutral-700', icon: Clock };

// Fetch orders
const fetchOrders = async () => {
    ordersLoading.value = true;
    ordersError.value = null;
    try {
        const res = await orderAPI.getAllOrders();
        if (res.success) {
            orders.value = res.data || [];
        } else {
            ordersError.value = res.message || 'Failed to load orders';
        }
    } catch (err) {
        console.error('Failed to fetch orders:', err);
        ordersError.value = err.response?.data?.message || 'Failed to load orders';
    } finally {
        ordersLoading.value = false;
    }
};

const openOrderDetail = async (order) => {
    showDetailModal.value = true;
    orderDetailLoading.value = true;
    selectedOrder.value = order;
    try {
        const res = await orderAPI.getOrder(order.orderId);
        if (res.success) {
            selectedOrder.value = res.data;
        } else {
            selectedOrder.value = order;
        }
    } catch (err) {
        console.error('Failed to load order detail:', err);
        selectedOrder.value = order;
    } finally {
        orderDetailLoading.value = false;
    }
};

const closeOrderDetail = () => {
    showDetailModal.value = false;
    selectedOrder.value = null;
};

// Reorder
const reorderItem = async (item) => {
    // Look up product detail page
    router.push(`/product/${item.productId}`);
    closeOrderDetail();
};

const reorderAll = async () => {
    if (!selectedOrder.value?.items) return;
    for (const item of selectedOrder.value.items) {
        shop.addToCart({
            id: item.productId,
            title: item.productName || `Product #${item.productId}`,
            price: parseFloat(item.unitPrice || 0),
            qty: item.quantity || 1,
            variant: item.variantId ? { id: item.variantId } : null,
            variantId: item.variantId || null,
            image: item.imageUrl || 'https://via.placeholder.com/80',
        });
    }
    toast.success(`${selectedOrder.value.items.length} item(s) added to cart`);
    closeOrderDetail();
};

// Profile helpers
const save = async () => {
    isSaving.value = true;
    await new Promise((r) => setTimeout(r, 700));
    isSaving.value = false;
    isSaved.value = true;
    isEditing.value = false;
    setTimeout(() => (isSaved.value = false), 2500);
};

const logout = () => {
    authStore.logout();
    router.push('/login');
};

// Revokes every session for this user, on every device
const logoutEverywhere = async () => {
    await authStore.logoutAll();
    router.push('/login');
};

const initials = computed(() =>
    profile.value.name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
);

// Date formatting
const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - d) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatPrice = (p) => parseFloat(p || 0).toFixed(2);

const formatDateFull = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

onMounted(() => {
    fetchOrders();
});
</script>

<template>
    <div class="bg-neutral-50 min-h-screen">
        <!-- Cover + avatar -->
        <section class="bg-ink text-paper">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24">
                <div class="flex flex-col md:flex-row items-start md:items-end gap-6">
                    <div class="relative">
                        <div class="w-28 h-28 rounded-3xl bg-accent flex items-center justify-center text-3xl font-elegant font-bold text-white border-4 border-paper">
                            {{ initials }}
                        </div>
                        <button class="absolute bottom-1 right-1 w-9 h-9 rounded-full bg-paper text-ink flex items-center justify-center shadow-lg hover:bg-accent hover:text-white transition-colors" aria-label="Change photo">
                            <Camera class="w-4 h-4" />
                        </button>
                    </div>
                    <div class="flex-1">
                        <p class="text-xs font-bold uppercase tracking-[0.2em] text-accent mb-1">Member since {{ profile.joined }}</p>
                        <h1 class="text-3xl md:text-4xl font-elegant font-bold">{{ profile.name }}</h1>
                        <p class="text-neutral-400 mt-1 flex items-center gap-2">
                            <Mail class="w-4 h-4" />
                            {{ profile.email }}
                        </p>
                    </div>
                    <div class="flex items-center gap-2">
                        <button
                            @click="isEditing = !isEditing"
                            class="inline-flex items-center gap-2 px-5 py-2.5 bg-paper text-ink font-bold text-sm rounded-full hover:bg-accent hover:text-white transition-all"
                        >
                            <Edit3 class="w-4 h-4" />
                            {{ isEditing ? 'Cancel' : 'Edit profile' }}
                        </button>
                        <button
                            @click="logout"
                            class="inline-flex items-center gap-2 px-5 py-2.5 bg-transparent border border-neutral-700 text-paper font-bold text-sm rounded-full hover:bg-paper hover:text-ink transition-all"
                        >
                            <LogOut class="w-4 h-4" />
                            Sign out
                        </button>
                        <button
                            @click="logoutEverywhere"
                            title="Signs you out on every device and invalidates all active sessions"
                            class="inline-flex items-center gap-2 px-5 py-2.5 bg-transparent border border-neutral-700 text-paper font-bold text-sm rounded-full hover:bg-paper hover:text-ink transition-all"
                        >
                            <ShieldCheck class="w-4 h-4" />
                            Sign out everywhere
                        </button>
                    </div>
                </div>
            </div>
        </section>

        <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 pb-16 relative z-10">
            <!-- Stats -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div v-for="s in stats" :key="s.label" class="bg-paper border border-neutral-200 rounded-2xl p-4 sm:p-5 flex items-center gap-3 sm:gap-4 transition-all duration-200 hover:border-ink hover:shadow-md hover:-translate-y-0.5 group/stats">
                    <div class="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0 group-hover/stats:bg-accent group-hover/stats:text-white transition-colors duration-200">
                        <component :is="s.icon" class="w-5 h-5 text-ink group-hover/stats:text-white transition-colors duration-200" />
                    </div>
                    <div class="min-w-0">
                        <p class="text-xl sm:text-2xl font-elegant font-bold text-ink tabular-nums">{{ s.value }}</p>
                        <p class="text-xs font-bold uppercase tracking-wider text-neutral-500 truncate">{{ s.label }}</p>
                    </div>
                </div>
            </div>

            <!-- Tabs -->
            <div class="flex items-center gap-1 sm:gap-2 mb-6 border-b border-neutral-200 overflow-x-auto">
                <button
                    v-for="tab in [
                        { id: 'overview', label: 'Overview', icon: User },
                        { id: 'orders', label: 'Orders', icon: ShoppingBag },
                        { id: 'security', label: 'Security', icon: ShieldCheck },
                    ]"
                    :key="tab.id"
                    @click="activeTab = tab.id"
                    :class="[
                        'inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap shrink-0',
                        activeTab === tab.id
                            ? 'border-ink text-ink'
                            : 'border-transparent text-neutral-500 hover:text-ink'
                    ]"
                >
                    <component :is="tab.icon" class="w-4 h-4" />
                    {{ tab.label }}
                </button>
            </div>

            <!-- Overview -->
            <div v-if="activeTab === 'overview'" class="grid lg:grid-cols-3 gap-6">
                <div class="lg:col-span-2 bg-paper border border-neutral-200 rounded-2xl p-6 lg:p-8 space-y-6">
                    <div class="flex items-center justify-between">
                        <h2 class="text-xl font-bold text-ink">Personal info</h2>
                        <transition name="slide-fade">
                            <span v-if="isSaved" class="text-xs font-bold text-accent flex items-center gap-1">
                                <Save class="w-3 h-3" />
                                Saved
                            </span>
                        </transition>
                    </div>

                    <div class="grid sm:grid-cols-2 gap-4">
                        <div>
                            <label class="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1.5 block">Full name</label>
                            <input v-model="profile.name" :disabled="!isEditing" class="input-base disabled:bg-neutral-50 disabled:text-neutral-500 transition-all duration-200 focus:ring-2 focus:ring-neutral-400" />
                        </div>
                        <div>
                            <label class="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1.5 block">Email</label>
                            <input v-model="profile.email" :disabled="!isEditing" type="email" class="input-base disabled:bg-neutral-50 disabled:text-neutral-500" />
                        </div>
                        <div>
                            <label class="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1.5 block">Phone</label>
                            <input v-model="profile.phone" :disabled="!isEditing" class="input-base disabled:bg-neutral-50 disabled:text-neutral-500" />
                        </div>
                        <div>
                            <label class="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1.5 block">Location</label>
                            <input v-model="profile.location" :disabled="!isEditing" class="input-base disabled:bg-neutral-50 disabled:text-neutral-500" />
                        </div>
                    </div>
                    <div>
                        <label class="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1.5 block">Bio</label>
                        <textarea v-model="profile.bio" :disabled="!isEditing" rows="3" class="input-base disabled:bg-neutral-50 disabled:text-neutral-500 resize-none"></textarea>
                    </div>
                    <div v-if="isEditing" class="flex gap-2 pt-2">
                        <button @click="save" :disabled="isSaving" class="btn-accent active:scale-[0.97] transition-all duration-200">
                            <Loader2 v-if="isSaving" class="w-4 h-4 animate-spin" />
                            <Save v-else class="w-4 h-4" />
                            {{ isSaving ? 'Saving...' : 'Save changes' }}
                        </button>
                        <button @click="isEditing = false" class="btn-outline active:scale-[0.97] transition-all duration-200">Cancel</button>
                    </div>
                </div>

                <div class="space-y-6">
                    <div class="bg-paper border border-neutral-200 rounded-2xl p-6">
                        <h3 class="text-sm font-bold uppercase tracking-[0.2em] text-ink mb-4">Account</h3>
                        <div class="space-y-3 text-sm">
                            <div class="flex items-center justify-between">
                                <span class="text-neutral-500">Plan</span>
                                <span class="font-bold text-ink">Premium</span>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-neutral-500">Member since</span>
                                <span class="font-bold text-ink">{{ profile.joined }}</span>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-neutral-500">Status</span>
                                <span class="inline-flex items-center gap-1 text-xs font-bold text-accent">
                                    <span class="w-1.5 h-1.5 rounded-full bg-accent pulse-dot"></span>
                                    Active
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Quick link to orders -->
                    <div class="bg-paper border border-neutral-200 rounded-2xl p-6">
                        <h3 class="text-sm font-bold uppercase tracking-[0.2em] text-ink mb-4">Quick links</h3>
                        <div class="space-y-2">
                            <button @click="activeTab = 'orders'" class="w-full flex items-center justify-between p-3 rounded-xl hover:bg-neutral-50 transition-colors text-left">
                                <span class="flex items-center gap-3">
                                    <ShoppingBag class="w-4 h-4 text-neutral-500" />
                                    <span class="text-sm font-medium text-ink">My orders</span>
                                </span>
                                <ChevronRight class="w-4 h-4 text-neutral-400" />
                            </button>
                            <router-link to="/track-order" class="w-full flex items-center justify-between p-3 rounded-xl hover:bg-neutral-50 transition-colors text-left">
                                <span class="flex items-center gap-3">
                                    <Truck class="w-4 h-4 text-neutral-500" />
                                    <span class="text-sm font-medium text-ink">Track order</span>
                                </span>
                                <ChevronRight class="w-4 h-4 text-neutral-400" />
                            </router-link>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Orders Tab -->
            <div v-else-if="activeTab === 'orders'" class="space-y-6">
                <div class="flex items-center justify-between">
                    <div>
                        <h2 class="text-xl font-bold text-ink">Order history</h2>
                        <p v-if="!ordersLoading" class="text-sm text-neutral-500 mt-1">
                            {{ totalOrders }} {{ totalOrders === 1 ? 'order' : 'total orders' }}
                        </p>
                    </div>
                    <button @click="fetchOrders" :disabled="ordersLoading" class="btn-ghost text-sm gap-1.5">
                        <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': ordersLoading }" />
                        Refresh
                    </button>
                </div>

                <!-- Error state -->
                <div v-if="ordersError && orders.length === 0" class="card-flat border-l-4 border-danger p-6">
                    <div class="flex items-center gap-3">
                        <AlertCircle class="w-6 h-6 text-danger shrink-0" />
                        <div>
                            <h3 class="font-bold text-ink text-sm">Failed to load orders</h3>
                            <p class="text-neutral-600 text-sm mt-0.5">{{ ordersError }}</p>
                        </div>
                        <button @click="fetchOrders" class="btn-primary text-sm gap-1.5 shrink-0 ml-auto">
                            <RefreshCw class="w-3.5 h-3.5" />
                            Retry
                        </button>
                    </div>
                </div>

                <!-- Loading skeleton -->
                <div v-if="ordersLoading && orders.length === 0" class="space-y-3 animate-pulse">
                    <div v-for="i in 4" :key="'sk-order-' + i" class="card-flat p-5">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 bg-neutral-200 rounded-xl"></div>
                            <div class="flex-1 space-y-2">
                                <div class="h-4 bg-neutral-200 rounded w-32"></div>
                                <div class="h-3 bg-neutral-200 rounded w-48"></div>
                            </div>
                            <div class="text-right space-y-2">
                                <div class="h-4 bg-neutral-200 rounded w-20"></div>
                                <div class="h-6 bg-neutral-200 rounded-full w-24"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Empty state -->
                <div v-else-if="!ordersLoading && orders.length === 0 && !ordersError" class="card-flat text-center py-16">
                    <div class="w-20 h-20 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-5">
                        <ShoppingBag class="w-10 h-10 text-neutral-400" />
                    </div>
                    <h3 class="text-lg font-bold text-ink mb-2">No orders yet</h3>
                    <p class="text-neutral-500 mb-6 max-w-sm mx-auto">You haven't placed any orders yet. Start shopping to see your order history here.</p>
                    <router-link to="/product" class="btn-accent shine-effect inline-flex">
                        Start shopping
                        <ArrowRight class="w-4 h-4" />
                    </router-link>
                </div>

                <!-- Order cards -->
                <div v-else class="space-y-3">
                    <div
                        v-for="order in orders"
                        :key="order.orderId"
                        class="card-flat p-4 sm:p-5 hover:shadow-md transition-all cursor-pointer group"
                        @click="openOrderDetail(order)"
                    >
                        <div class="flex items-start sm:items-center gap-4">
                            <!-- Status icon -->
                            <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0 group-hover:bg-neutral-200 transition-colors">
                                <component :is="getStatusConfig(order.status).icon" class="w-5 h-5 text-ink" />
                            </div>

                            <!-- Order info -->
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <span class="font-bold text-ink tabular-nums group-hover:text-accent transition-colors">#{{ order.orderId }}</span>
                                    <span :class="['px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border', getStatusConfig(order.status).color]">
                                        {{ getStatusConfig(order.status).label }}
                                    </span>
                                </div>
                                <div class="flex items-center gap-2 mt-1 text-xs text-neutral-500">
                                    <Calendar class="w-3 h-3" />
                                    <span>{{ formatDate(order.createdAt) }}</span>
                                    <span class="text-neutral-300">&middot;</span>
                                    <Package class="w-3 h-3" />
                                    <span>{{ order.itemCount || 0 }} {{ (order.itemCount || 0) === 1 ? 'item' : 'items' }}</span>
                                </div>
                            </div>

                            <!-- Total & Arrow -->
                            <div class="text-right shrink-0">
                                <p class="text-base sm:text-lg font-bold text-ink tabular-nums group-hover:text-accent transition-colors">${{ formatPrice(order.totalAmount) }}</p>
                                <div class="flex items-center justify-end gap-1 mt-1 text-xs text-neutral-400 group-hover:text-ink transition-colors">
                                    <span>Details</span>
                                    <ChevronRight class="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Security -->
            <div v-else-if="activeTab === 'security'" class="grid lg:grid-cols-2 gap-6">
                <div class="bg-paper border border-neutral-200 rounded-2xl p-6 space-y-4">
                    <h3 class="text-lg font-bold text-ink">Password</h3>
                    <p class="text-sm text-neutral-500">Update your password to keep your account secure.</p>
                    <input type="password" placeholder="Current password" class="input-base" />
                    <input type="password" placeholder="New password" class="input-base" />
                    <input type="password" placeholder="Confirm new password" class="input-base" />
                    <button class="btn-primary">Update password</button>
                </div>
                <div class="bg-paper border border-neutral-200 rounded-2xl p-6 space-y-4">
                    <h3 class="text-lg font-bold text-ink">Two-factor authentication</h3>
                    <p class="text-sm text-neutral-500">Add an extra layer of security to your account.</p>
                    <div class="flex items-center justify-between p-4 bg-neutral-50 rounded-xl">
                        <div>
                            <p class="text-sm font-bold text-ink">Authenticator app</p>
                            <p class="text-xs text-neutral-500">Use an app like Authy or Google Authenticator.</p>
                        </div>
                        <button class="btn-outline">Enable</button>
                    </div>
                </div>
            </div>
        </section>

        <!-- Order Detail Modal -->
        <Teleport to="body">
            <div
                v-if="showDetailModal"
                @click="closeOrderDetail"
                class="fixed inset-0 z-70 flex items-center justify-center p-4"
            >
                <div class="absolute inset-0 bg-ink/50 backdrop-blur-sm"></div>

                <div
                    @click.stop
                    class="relative bg-paper rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto animate-fade-up"
                >
                    <!-- Modal Header -->
                    <div class="flex items-center justify-between px-6 py-5 border-b border-neutral-200 sticky top-0 bg-paper z-10">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center">
                                <component :is="getStatusConfig(selectedOrder?.status).icon" class="w-5 h-5 text-ink" />
                            </div>
                            <div>
                                <h3 class="font-bold text-ink">Order #{{ selectedOrder?.orderId }}</h3>
                                <p class="text-xs text-neutral-500">{{ formatDateFull(selectedOrder?.createdAt) }}</p>
                            </div>
                        </div>
                        <button
                            @click="closeOrderDetail"
                            class="w-9 h-9 rounded-full hover:bg-neutral-100 flex items-center justify-center transition-colors"
                            aria-label="Close"
                        >
                            <X class="w-5 h-5" />
                        </button>
                    </div>

                    <!-- Loading -->
                    <div v-if="orderDetailLoading" class="p-10 text-center">
                        <Loader2 class="w-8 h-8 animate-spin text-accent mx-auto" />
                    </div>

                    <!-- Modal Body -->
                    <div v-else-if="selectedOrder" class="p-6 space-y-6">
                        <!-- Status Badge -->
                        <div class="flex items-center justify-between flex-wrap gap-3">
                            <span :class="['px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border', getStatusConfig(selectedOrder.status).color]">
                                {{ getStatusConfig(selectedOrder.status).label }}
                            </span>
                            <span class="text-2xl font-bold text-ink tabular-nums">${{ formatPrice(selectedOrder.totalAmount) }}</span>
                        </div>

                        <!-- Items list -->
                        <div>
                            <h4 class="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500 mb-3">
                                Items ({{ selectedOrder.items?.length || 0 }})
                            </h4>
                            <div class="space-y-2">
                                <div
                                    v-for="item in selectedOrder.items"
                                    :key="item.orderItemId"
                                    class="flex items-center justify-between p-3 bg-neutral-50 rounded-xl"
                                >
                                    <div class="flex items-center gap-3 min-w-0">
                                        <div class="w-9 h-9 rounded-lg bg-paper border border-neutral-200 flex items-center justify-center text-xs font-bold text-neutral-600 shrink-0">
                                            {{ item.quantity }}
                                        </div>
                                        <div class="min-w-0">
                                            <p class="text-sm font-semibold text-ink truncate">{{ item.productName || `Product #${item.productId}` }}</p>
                                            <p v-if="item.sku" class="text-[10px] text-neutral-500 font-mono">SKU: {{ item.sku }}</p>
                                        </div>
                                    </div>
                                    <span class="text-sm font-bold text-ink tabular-nums shrink-0 ml-2">
                                        ${{ formatPrice(item.unitPrice) }}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- Order Timeline -->
                        <div>
                            <h4 class="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500 mb-3">Order timeline</h4>
                            <div class="space-y-3">
                                <div class="flex items-start gap-3">
                                    <div class="w-6 h-6 rounded-full bg-success flex items-center justify-center shrink-0 mt-0.5">
                                        <CheckCircle class="w-3 h-3 text-white" />
                                    </div>
                                    <div>
                                        <p class="text-sm font-semibold text-ink">Order placed</p>
                                        <p class="text-xs text-neutral-500">{{ formatDateFull(selectedOrder.createdAt) }}</p>
                                    </div>
                                </div>
                                <div
                                    class="flex items-start gap-3"
                                    :class="{ 'opacity-50': selectedOrder.status === 'pending' }"
                                >
                                    <div
                                        class="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                                        :class="['pending', 'confirmed', 'shipped', 'delivered'].includes(selectedOrder.status) ? 'bg-success' : 'bg-neutral-200'"
                                    >
                                        <component :is="['pending', 'confirmed', 'shipped', 'delivered'].includes(selectedOrder.status) ? CheckCircle : Clock" class="w-3 h-3 text-white" />
                                    </div>
                                    <div>
                                        <p class="text-sm font-semibold text-ink">Payment confirmed</p>
                                        <p class="text-xs text-neutral-500">{{ ['pending', 'confirmed', 'shipped', 'delivered'].includes(selectedOrder.status) ? formatDateFull(selectedOrder.updatedAt) : 'Awaiting confirmation' }}</p>
                                    </div>
                                </div>
                                <div
                                    class="flex items-start gap-3"
                                    :class="{ 'opacity-50': !['shipped', 'delivered'].includes(selectedOrder.status) }"
                                >
                                    <div
                                        class="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                                        :class="['shipped', 'delivered'].includes(selectedOrder.status) ? 'bg-accent' : 'bg-neutral-200'"
                                    >
                                        <Truck class="w-3 h-3 text-white" />
                                    </div>
                                    <div>
                                        <p class="text-sm font-semibold text-ink">Shipped</p>
                                        <p class="text-xs text-neutral-500">{{ ['shipped', 'delivered'].includes(selectedOrder.status) ? 'On its way' : 'Not yet shipped' }}</p>
                                    </div>
                                </div>
                                <div
                                    class="flex items-start gap-3"
                                    :class="{ 'opacity-50': selectedOrder.status !== 'delivered' }"
                                >
                                    <div
                                        class="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                                        :class="selectedOrder.status === 'delivered' ? 'bg-success' : 'bg-neutral-200'"
                                    >
                                        <MapPin class="w-3 h-3 text-white" />
                                    </div>
                                    <div>
                                        <p class="text-sm font-semibold text-ink">Delivered</p>
                                        <p class="text-xs text-neutral-500">{{ selectedOrder.status === 'delivered' ? formatDateFull(selectedOrder.updatedAt) : 'Awaiting delivery' }}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Modal Footer -->
                    <div class="px-6 py-4 border-t border-neutral-200 bg-neutral-50 sticky bottom-0 flex gap-3">
                        <button
                            @click="closeOrderDetail"
                            class="btn-outline flex-1 text-sm"
                        >
                            Close
                        </button>
                        <button
                            @click="reorderAll"
                            class="btn-accent flex-1 text-sm gap-1.5"
                        >
                            <RefreshCw class="w-3.5 h-3.5" />
                            Reorder all
                        </button>
                        <router-link
                            :to="`/track-order?orderId=${selectedOrder?.orderId}`"
                            @click="closeOrderDetail"
                            class="btn-primary flex-1 text-sm gap-1.5 inline-flex items-center justify-center"
                        >
                            <Truck class="w-3.5 h-3.5" />
                            Track
                        </router-link>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>

<style scoped>
.slide-fade-enter-active {
    transition: all 0.3s ease;
}
.slide-fade-leave-active {
    transition: all 0.2s ease;
}
.slide-fade-enter-from,
.slide-fade-leave-to {
    opacity: 0;
    transform: translateY(-4px);
}
</style>
