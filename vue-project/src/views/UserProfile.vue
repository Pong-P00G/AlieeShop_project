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

        <!-- ── Hero Header ─────────────────────────────────────── -->
        <section class="relative bg-ink text-paper overflow-hidden">
            <!-- subtle grid texture -->
            <div class="absolute inset-0 opacity-[0.04]"
                 style="background-image: linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px); background-size: 40px 40px;"></div>
            <!-- orange glow bottom-right -->
            <div class="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-accent/20 blur-3xl pointer-events-none"></div>

            <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-28">
                <div class="flex flex-col md:flex-row items-start md:items-end gap-6">

                    <!-- Avatar -->
                    <div class="relative shrink-0">
                        <div class="w-24 h-24 md:w-28 md:h-28 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-700 flex items-center justify-center text-3xl font-elegant font-bold text-white shadow-2xl ring-4 ring-white/10">
                            {{ initials }}
                        </div>
                        <button
                            class="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-paper text-ink flex items-center justify-center shadow-lg hover:bg-accent hover:text-white transition-all duration-200"
                            aria-label="Change photo"
                        >
                            <Camera class="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <!-- Name / meta -->
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/15 border border-accent/25 text-[10px] font-bold uppercase tracking-[0.15em] text-accent">
                                <span class="w-1.5 h-1.5 rounded-full bg-accent pulse-dot"></span>
                                Member since {{ profile.joined }}
                            </span>
                        </div>
                        <h1 class="text-3xl md:text-4xl font-elegant font-bold leading-tight truncate">{{ profile.name }}</h1>
                        <div class="flex flex-wrap items-center gap-4 mt-2 text-sm text-neutral-400">
                            <span class="flex items-center gap-1.5">
                                <Mail class="w-3.5 h-3.5" />
                                {{ profile.email }}
                            </span>
                            <span class="flex items-center gap-1.5">
                                <MapPin class="w-3.5 h-3.5" />
                                {{ profile.location }}
                            </span>
                        </div>
                    </div>

                    <!-- Actions -->
                    <div class="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                            @click="isEditing = !isEditing"
                            class="inline-flex items-center gap-2 px-4 py-2 bg-white text-ink font-semibold text-sm rounded-xl hover:bg-accent hover:text-white transition-all duration-200 shadow-sm"
                        >
                            <Edit3 class="w-4 h-4" />
                            {{ isEditing ? 'Cancel' : 'Edit profile' }}
                        </button>
                        <button
                            @click="logout"
                            class="inline-flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 text-paper font-semibold text-sm rounded-xl hover:bg-white hover:text-ink transition-all duration-200"
                        >
                            <LogOut class="w-4 h-4" />
                            Sign out
                        </button>
                        <button
                            @click="logoutEverywhere"
                            title="Signs you out on every device and invalidates all active sessions"
                            class="inline-flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 text-paper font-semibold text-sm rounded-xl hover:bg-white hover:text-ink transition-all duration-200"
                        >
                            <ShieldCheck class="w-4 h-4" />
                            <span class="hidden sm:inline">Sign out everywhere</span>
                            <span class="sm:hidden">All devices</span>
                        </button>
                    </div>
                </div>
            </div>
        </section>

        <!-- ── Body ───────────────────────────────────────────── -->
        <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-14 pb-20 relative z-10">

            <!-- Stats row -->
            <div class="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
                <div
                    v-for="s in stats" :key="s.label"
                    class="bg-paper border border-neutral-200 rounded-2xl p-4 sm:p-5 flex items-center gap-3 sm:gap-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group/stat"
                >
                    <div class="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0 group-hover/stat:bg-ink group-hover/stat:text-paper transition-all duration-200">
                        <component :is="s.icon" class="w-5 h-5 text-ink group-hover/stat:text-paper transition-colors duration-200" />
                    </div>
                    <div class="min-w-0">
                        <p class="text-xl sm:text-2xl font-elegant font-bold text-ink tabular-nums leading-none">{{ s.value }}</p>
                        <p class="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-neutral-400 mt-1 truncate">{{ s.label }}</p>
                    </div>
                </div>
            </div>

            <!-- Tab bar -->
            <div class="flex items-center gap-1 mb-6 bg-paper border border-neutral-200 rounded-2xl p-1 w-fit shadow-sm overflow-x-auto">
                <button
                    v-for="tab in [
                        { id: 'overview', label: 'Overview', icon: User },
                        { id: 'orders',   label: 'Orders',   icon: ShoppingBag },
                        { id: 'security', label: 'Security', icon: ShieldCheck },
                    ]"
                    :key="tab.id"
                    @click="activeTab = tab.id"
                    :class="[
                        'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 whitespace-nowrap shrink-0',
                        activeTab === tab.id
                            ? 'bg-ink text-paper shadow-sm'
                            : 'text-neutral-500 hover:text-ink hover:bg-neutral-50'
                    ]"
                >
                    <component :is="tab.icon" class="w-4 h-4" />
                    {{ tab.label }}
                </button>
            </div>

            <!-- ── Overview Tab ──────────────────────────────── -->
            <div v-if="activeTab === 'overview'" class="grid lg:grid-cols-3 gap-6">

                <!-- Personal info form -->
                <div class="lg:col-span-2 bg-paper border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
                    <div class="px-6 py-5 border-b border-neutral-100 flex items-center justify-between">
                        <h2 class="text-base font-bold text-ink">Personal info</h2>
                        <transition name="slide-fade">
                            <span v-if="isSaved" class="inline-flex items-center gap-1 text-xs font-bold text-accent">
                                <CheckCircle class="w-3.5 h-3.5" />
                                Saved
                            </span>
                        </transition>
                    </div>

                    <div class="p-6 space-y-5">
                        <div class="grid sm:grid-cols-2 gap-4">
                            <div class="space-y-1.5">
                                <label class="text-[10px] font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-1.5">
                                    <User class="w-3 h-3" /> Full name
                                </label>
                                <input v-model="profile.name" :disabled="!isEditing"
                                    class="input-base disabled:bg-neutral-50 disabled:text-neutral-500 disabled:cursor-default" />
                            </div>
                            <div class="space-y-1.5">
                                <label class="text-[10px] font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-1.5">
                                    <Mail class="w-3 h-3" /> Email
                                </label>
                                <input v-model="profile.email" :disabled="!isEditing" type="email"
                                    class="input-base disabled:bg-neutral-50 disabled:text-neutral-500 disabled:cursor-default" />
                            </div>
                            <div class="space-y-1.5">
                                <label class="text-[10px] font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-1.5">
                                    <Phone class="w-3 h-3" /> Phone
                                </label>
                                <input v-model="profile.phone" :disabled="!isEditing"
                                    class="input-base disabled:bg-neutral-50 disabled:text-neutral-500 disabled:cursor-default" />
                            </div>
                            <div class="space-y-1.5">
                                <label class="text-[10px] font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-1.5">
                                    <MapPin class="w-3 h-3" /> Location
                                </label>
                                <input v-model="profile.location" :disabled="!isEditing"
                                    class="input-base disabled:bg-neutral-50 disabled:text-neutral-500 disabled:cursor-default" />
                            </div>
                        </div>
                        <div class="space-y-1.5">
                            <label class="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Bio</label>
                            <textarea v-model="profile.bio" :disabled="!isEditing" rows="3"
                                class="input-base disabled:bg-neutral-50 disabled:text-neutral-500 disabled:cursor-default resize-none"></textarea>
                        </div>

                        <div v-if="isEditing" class="flex gap-2 pt-1">
                            <button @click="save" :disabled="isSaving" class="btn-accent gap-2">
                                <Loader2 v-if="isSaving" class="w-4 h-4 animate-spin" />
                                <Save v-else class="w-4 h-4" />
                                {{ isSaving ? 'Saving…' : 'Save changes' }}
                            </button>
                            <button @click="isEditing = false" class="btn-outline">Cancel</button>
                        </div>
                    </div>
                </div>

                <!-- Right column -->
                <div class="space-y-4">
                    <!-- Account summary -->
                    <div class="bg-paper border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
                        <div class="px-5 py-4 border-b border-neutral-100">
                            <h3 class="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Account</h3>
                        </div>
                        <div class="p-5 space-y-3">
                            <div class="flex items-center justify-between text-sm">
                                <span class="text-neutral-500">Plan</span>
                                <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-bold">Premium</span>
                            </div>
                            <div class="flex items-center justify-between text-sm">
                                <span class="text-neutral-500">Member since</span>
                                <span class="font-semibold text-ink">{{ profile.joined }}</span>
                            </div>
                            <div class="flex items-center justify-between text-sm">
                                <span class="text-neutral-500">Status</span>
                                <span class="inline-flex items-center gap-1.5 text-xs font-bold text-success">
                                    <span class="w-1.5 h-1.5 rounded-full bg-success pulse-dot"></span>
                                    Active
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Quick links -->
                    <div class="bg-paper border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
                        <div class="px-5 py-4 border-b border-neutral-100">
                            <h3 class="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Quick links</h3>
                        </div>
                        <div class="p-2">
                            <button
                                @click="activeTab = 'orders'"
                                class="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-neutral-50 transition-colors text-left group/ql"
                            >
                                <div class="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0 group-hover/ql:bg-ink group-hover/ql:text-paper transition-colors">
                                    <ShoppingBag class="w-4 h-4 text-neutral-500 group-hover/ql:text-paper" />
                                </div>
                                <span class="flex-1 text-sm font-medium text-ink">My orders</span>
                                <ChevronRight class="w-4 h-4 text-neutral-300 group-hover/ql:text-ink group-hover/ql:translate-x-0.5 transition-all" />
                            </button>
                            <router-link
                                to="/track-order"
                                class="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-neutral-50 transition-colors group/ql"
                            >
                                <div class="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0 group-hover/ql:bg-ink group-hover/ql:text-paper transition-colors">
                                    <Truck class="w-4 h-4 text-neutral-500 group-hover/ql:text-paper" />
                                </div>
                                <span class="flex-1 text-sm font-medium text-ink">Track order</span>
                                <ChevronRight class="w-4 h-4 text-neutral-300 group-hover/ql:text-ink group-hover/ql:translate-x-0.5 transition-all" />
                            </router-link>
                            <router-link
                                to="/wishlist"
                                class="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-neutral-50 transition-colors group/ql"
                            >
                                <div class="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0 group-hover/ql:bg-ink group-hover/ql:text-paper transition-colors">
                                    <Heart class="w-4 h-4 text-neutral-500 group-hover/ql:text-paper" />
                                </div>
                                <span class="flex-1 text-sm font-medium text-ink">Wishlist</span>
                                <ChevronRight class="w-4 h-4 text-neutral-300 group-hover/ql:text-ink group-hover/ql:translate-x-0.5 transition-all" />
                            </router-link>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ── Orders Tab ─────────────────────────────────── -->
            <div v-else-if="activeTab === 'orders'" class="space-y-5">
                <div class="flex items-center justify-between">
                    <div>
                        <h2 class="text-xl font-bold text-ink">Order history</h2>
                        <p v-if="!ordersLoading" class="text-sm text-neutral-500 mt-0.5">
                            {{ totalOrders }} {{ totalOrders === 1 ? 'order' : 'orders' }}
                        </p>
                    </div>
                    <button @click="fetchOrders" :disabled="ordersLoading"
                        class="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-ink bg-paper border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors disabled:opacity-50 shadow-sm">
                        <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': ordersLoading }" />
                        Refresh
                    </button>
                </div>

                <!-- Error -->
                <div v-if="ordersError && orders.length === 0"
                    class="flex items-start gap-4 p-5 bg-danger/5 border border-danger/20 rounded-2xl">
                    <div class="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center shrink-0">
                        <AlertCircle class="w-5 h-5 text-danger" />
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="font-semibold text-ink text-sm">Failed to load orders</p>
                        <p class="text-neutral-500 text-sm mt-0.5">{{ ordersError }}</p>
                    </div>
                    <button @click="fetchOrders" class="btn-primary text-xs shrink-0 py-2 px-3">
                        <RefreshCw class="w-3.5 h-3.5" /> Retry
                    </button>
                </div>

                <!-- Skeleton -->
                <div v-if="ordersLoading && orders.length === 0" class="space-y-3">
                    <div v-for="i in 4" :key="'sk-' + i"
                        class="bg-paper border border-neutral-200 rounded-2xl p-5 animate-pulse flex items-center gap-4">
                        <div class="w-12 h-12 bg-neutral-100 rounded-xl shrink-0"></div>
                        <div class="flex-1 space-y-2">
                            <div class="h-4 bg-neutral-100 rounded-lg w-28"></div>
                            <div class="h-3 bg-neutral-100 rounded-lg w-44"></div>
                        </div>
                        <div class="space-y-2 text-right">
                            <div class="h-4 bg-neutral-100 rounded-lg w-16"></div>
                            <div class="h-5 bg-neutral-100 rounded-full w-20"></div>
                        </div>
                    </div>
                </div>

                <!-- Empty -->
                <div v-else-if="!ordersLoading && orders.length === 0 && !ordersError"
                    class="bg-paper border border-neutral-200 rounded-2xl shadow-sm text-center py-20">
                    <div class="w-20 h-20 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-5">
                        <ShoppingBag class="w-9 h-9 text-neutral-300" />
                    </div>
                    <h3 class="text-lg font-bold text-ink mb-2">No orders yet</h3>
                    <p class="text-neutral-500 mb-7 max-w-xs mx-auto text-sm">Start shopping to see your order history here.</p>
                    <router-link to="/product" class="btn-accent shine-effect inline-flex">
                        Start shopping <ArrowRight class="w-4 h-4" />
                    </router-link>
                </div>

                <!-- Order list -->
                <div v-else class="space-y-3">
                    <div
                        v-for="order in orders" :key="order.orderId"
                        @click="openOrderDetail(order)"
                        class="bg-paper border border-neutral-200 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-neutral-300 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group"
                    >
                        <div class="flex items-center gap-4">
                            <!-- Icon -->
                            <div class="w-11 h-11 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-center shrink-0 group-hover:bg-ink group-hover:border-ink transition-all duration-200">
                                <component :is="getStatusConfig(order.status).icon" class="w-5 h-5 text-neutral-500 group-hover:text-white transition-colors duration-200" />
                            </div>

                            <!-- Info -->
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <span class="font-bold text-ink tabular-nums text-sm group-hover:text-accent transition-colors">#{{ order.orderId }}</span>
                                    <span :class="['px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border', getStatusConfig(order.status).color]">
                                        {{ getStatusConfig(order.status).label }}
                                    </span>
                                </div>
                                <div class="flex items-center gap-2 mt-1 text-xs text-neutral-400">
                                    <Calendar class="w-3 h-3" />
                                    {{ formatDate(order.createdAt) }}
                                    <span class="text-neutral-200">&bull;</span>
                                    <Package class="w-3 h-3" />
                                    {{ order.itemCount || 0 }} {{ (order.itemCount || 0) === 1 ? 'item' : 'items' }}
                                </div>
                            </div>

                            <!-- Price + cta -->
                            <div class="text-right shrink-0">
                                <p class="text-base font-bold text-ink tabular-nums group-hover:text-accent transition-colors">${{ formatPrice(order.totalAmount) }}</p>
                                <div class="flex items-center justify-end gap-0.5 mt-1 text-[11px] text-neutral-400 group-hover:text-accent transition-colors">
                                    Details
                                    <ChevronRight class="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ── Security Tab ───────────────────────────────── -->
            <div v-else-if="activeTab === 'security'" class="grid lg:grid-cols-2 gap-6">
                <!-- Password -->
                <div class="bg-paper border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
                    <div class="px-6 py-5 border-b border-neutral-100 flex items-center gap-3">
                        <div class="w-9 h-9 rounded-xl bg-neutral-100 flex items-center justify-center">
                            <ShieldCheck class="w-4.5 h-4.5 text-ink" />
                        </div>
                        <div>
                            <h3 class="text-base font-bold text-ink">Password</h3>
                            <p class="text-xs text-neutral-400">Keep your account secure</p>
                        </div>
                    </div>
                    <div class="p-6 space-y-4">
                        <div class="space-y-1.5">
                            <label class="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Current password</label>
                            <input type="password" placeholder="••••••••" class="input-base" />
                        </div>
                        <div class="space-y-1.5">
                            <label class="text-[10px] font-bold uppercase tracking-widest text-neutral-400">New password</label>
                            <input type="password" placeholder="••••••••" class="input-base" />
                        </div>
                        <div class="space-y-1.5">
                            <label class="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Confirm new password</label>
                            <input type="password" placeholder="••••••••" class="input-base" />
                        </div>
                        <button class="btn-primary w-full">Update password</button>
                    </div>
                </div>

                <!-- 2FA -->
                <div class="bg-paper border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
                    <div class="px-6 py-5 border-b border-neutral-100 flex items-center gap-3">
                        <div class="w-9 h-9 rounded-xl bg-neutral-100 flex items-center justify-center">
                            <SettingsIcon class="w-4.5 h-4.5 text-ink" />
                        </div>
                        <div>
                            <h3 class="text-base font-bold text-ink">Two-factor authentication</h3>
                            <p class="text-xs text-neutral-400">Extra layer of security</p>
                        </div>
                    </div>
                    <div class="p-6 space-y-3">
                        <div class="flex items-center justify-between p-4 bg-neutral-50 border border-neutral-200 rounded-xl hover:border-neutral-300 transition-colors">
                            <div>
                                <p class="text-sm font-semibold text-ink">Authenticator app</p>
                                <p class="text-xs text-neutral-500 mt-0.5">Authy, Google Authenticator</p>
                            </div>
                            <button class="btn-outline text-xs py-1.5 px-3">Enable</button>
                        </div>
                        <div class="flex items-center justify-between p-4 bg-neutral-50 border border-neutral-200 rounded-xl hover:border-neutral-300 transition-colors">
                            <div>
                                <p class="text-sm font-semibold text-ink">SMS verification</p>
                                <p class="text-xs text-neutral-500 mt-0.5">Receive codes by text message</p>
                            </div>
                            <button class="btn-outline text-xs py-1.5 px-3">Enable</button>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- ── Order Detail Modal ─────────────────────────────── -->
        <Teleport to="body">
            <div
                v-if="showDetailModal"
                @click="closeOrderDetail"
                class="fixed inset-0 z-70 flex items-end sm:items-center justify-center p-0 sm:p-4"
            >
                <div class="absolute inset-0 bg-ink/60 backdrop-blur-sm"></div>

                <div
                    @click.stop
                    class="relative bg-paper rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[85vh] overflow-y-auto animate-fade-up"
                >
                    <!-- Handle (mobile) -->
                    <div class="sm:hidden flex justify-center pt-3 pb-1">
                        <div class="w-10 h-1 rounded-full bg-neutral-200"></div>
                    </div>

                    <!-- Header -->
                    <div class="flex items-center justify-between px-6 py-4 border-b border-neutral-100 sticky top-0 bg-paper/95 backdrop-blur-sm z-10">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-center">
                                <component :is="getStatusConfig(selectedOrder?.status).icon" class="w-5 h-5 text-ink" />
                            </div>
                            <div>
                                <h3 class="font-bold text-ink">Order #{{ selectedOrder?.orderId }}</h3>
                                <p class="text-xs text-neutral-400">{{ formatDateFull(selectedOrder?.createdAt) }}</p>
                            </div>
                        </div>
                        <button
                            @click="closeOrderDetail"
                            class="w-9 h-9 rounded-xl hover:bg-neutral-100 flex items-center justify-center transition-colors"
                            aria-label="Close"
                        >
                            <X class="w-4.5 h-4.5 text-ink" />
                        </button>
                    </div>

                    <!-- Loading -->
                    <div v-if="orderDetailLoading" class="p-12 text-center">
                        <Loader2 class="w-8 h-8 animate-spin text-accent mx-auto" />
                    </div>

                    <!-- Body -->
                    <div v-else-if="selectedOrder" class="p-6 space-y-6">
                        <!-- Summary row -->
                        <div class="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                            <span :class="['px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border', getStatusConfig(selectedOrder.status).color]">
                                {{ getStatusConfig(selectedOrder.status).label }}
                            </span>
                            <span class="text-2xl font-elegant font-bold text-ink tabular-nums">${{ formatPrice(selectedOrder.totalAmount) }}</span>
                        </div>

                        <!-- Items -->
                        <div>
                            <h4 class="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-3">
                                Items · {{ selectedOrder.items?.length || 0 }}
                            </h4>
                            <div class="space-y-2">
                                <div
                                    v-for="item in selectedOrder.items" :key="item.orderItemId"
                                    class="flex items-center justify-between p-3.5 bg-neutral-50 rounded-xl border border-neutral-100"
                                >
                                    <div class="flex items-center gap-3 min-w-0">
                                        <div class="w-9 h-9 rounded-lg bg-paper border border-neutral-200 flex items-center justify-center text-xs font-bold text-ink shrink-0">
                                            {{ item.quantity }}
                                        </div>
                                        <div class="min-w-0">
                                            <p class="text-sm font-semibold text-ink truncate">{{ item.productName || `Product #${item.productId}` }}</p>
                                            <p v-if="item.sku" class="text-[10px] text-neutral-400 font-mono">{{ item.sku }}</p>
                                        </div>
                                    </div>
                                    <span class="text-sm font-bold text-ink tabular-nums shrink-0 ml-3">${{ formatPrice(item.unitPrice) }}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Timeline -->
                        <div>
                            <h4 class="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-4">Order timeline</h4>
                            <div class="relative pl-4">
                                <!-- vertical line -->
                                <div class="absolute left-[11px] top-3 bottom-3 w-px bg-neutral-200"></div>

                                <div class="space-y-5">
                                    <div class="flex items-start gap-4 relative">
                                        <div class="w-6 h-6 rounded-full bg-success flex items-center justify-center shrink-0 z-10 -ml-1">
                                            <CheckCircle class="w-3 h-3 text-white" />
                                        </div>
                                        <div class="-mt-0.5">
                                            <p class="text-sm font-semibold text-ink">Order placed</p>
                                            <p class="text-xs text-neutral-400 mt-0.5">{{ formatDateFull(selectedOrder.createdAt) }}</p>
                                        </div>
                                    </div>

                                    <div class="flex items-start gap-4 relative" :class="{ 'opacity-40': selectedOrder.status === 'pending' }">
                                        <div class="w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 -ml-1"
                                            :class="['confirmed','shipped','delivered'].includes(selectedOrder.status) ? 'bg-success' : 'bg-neutral-200'">
                                            <component :is="['confirmed','shipped','delivered'].includes(selectedOrder.status) ? CheckCircle : Clock" class="w-3 h-3 text-white" />
                                        </div>
                                        <div class="-mt-0.5">
                                            <p class="text-sm font-semibold text-ink">Payment confirmed</p>
                                            <p class="text-xs text-neutral-400 mt-0.5">{{ ['confirmed','shipped','delivered'].includes(selectedOrder.status) ? formatDateFull(selectedOrder.updatedAt) : 'Awaiting confirmation' }}</p>
                                        </div>
                                    </div>

                                    <div class="flex items-start gap-4 relative" :class="{ 'opacity-40': !['shipped','delivered'].includes(selectedOrder.status) }">
                                        <div class="w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 -ml-1"
                                            :class="['shipped','delivered'].includes(selectedOrder.status) ? 'bg-accent' : 'bg-neutral-200'">
                                            <Truck class="w-3 h-3 text-white" />
                                        </div>
                                        <div class="-mt-0.5">
                                            <p class="text-sm font-semibold text-ink">Shipped</p>
                                            <p class="text-xs text-neutral-400 mt-0.5">{{ ['shipped','delivered'].includes(selectedOrder.status) ? 'On its way' : 'Not yet shipped' }}</p>
                                        </div>
                                    </div>

                                    <div class="flex items-start gap-4 relative" :class="{ 'opacity-40': selectedOrder.status !== 'delivered' }">
                                        <div class="w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 -ml-1"
                                            :class="selectedOrder.status === 'delivered' ? 'bg-success' : 'bg-neutral-200'">
                                            <MapPin class="w-3 h-3 text-white" />
                                        </div>
                                        <div class="-mt-0.5">
                                            <p class="text-sm font-semibold text-ink">Delivered</p>
                                            <p class="text-xs text-neutral-400 mt-0.5">{{ selectedOrder.status === 'delivered' ? formatDateFull(selectedOrder.updatedAt) : 'Awaiting delivery' }}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="px-6 py-4 border-t border-neutral-100 bg-neutral-50 sticky bottom-0 flex gap-2">
                        <button @click="closeOrderDetail" class="btn-outline flex-1 text-sm py-2.5">Close</button>
                        <button @click="reorderAll" class="btn-accent flex-1 text-sm py-2.5 gap-1.5">
                            <RefreshCw class="w-3.5 h-3.5" /> Reorder all
                        </button>
                        <router-link
                            :to="`/track-order?orderId=${selectedOrder?.orderId}`"
                            @click="closeOrderDetail"
                            class="btn-primary flex-1 text-sm py-2.5 gap-1.5 inline-flex items-center justify-center"
                        >
                            <Truck class="w-3.5 h-3.5" /> Track
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

/* Order timeline styles */
.order-timeline {
    position: relative;
}
.order-timeline::before {
    content: '';
    position: absolute;
    left: 14px;
    top: 24px;
    bottom: 0;
    width: 2px;
    background: #e4e4e7;
}
</style>
