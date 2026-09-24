<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useProductStore } from '../../stores/product.js';
import { storeToRefs } from 'pinia';
import { stockAPI } from '../../api/products/stockApi.js';
import { dashboardAPI } from '../../api/dashboardApi.js';
import { useToast } from '../../composables/useToast.js';
import LazyImage from '../../components/LazyImage.vue';
import {
    Package,
    AlertTriangle,
    XCircle,
    Search,
    RefreshCw,
    Bell,
    History,
    CheckSquare,
    Square,
    Clock,
    Users,
} from 'lucide-vue-next';

const toast = useToast();
const productStore = useProductStore();
const { products, loading } = storeToRefs(productStore);

const searchQuery = ref('');
const filterStatus = ref('all');
const showUpdateModal = ref(false);
const selectedProduct = ref(null);
const newStock = ref(0);
const newReorderLevel = ref(5);
const stockReason = ref('');
const updatingStock = ref(false);
const checkingLowStock = ref(false);

const selectedIds = ref(new Set());
const showBulkUpdateModal = ref(false);
const bulkNewStock = ref(0);
const bulkReorderLevel = ref(5);
const bulkReason = ref('');
const bulkUpdating = ref(false);

const showHistoryModal = ref(false);
const historyProduct = ref(null);
const stockHistory = ref([]);
const loadingHistory = ref(false);

// ── Auto-polling ────────────────────────────────────────────────────────────
const lastCheckTime = ref(null);
const autoCheckEnabled = ref(true);
let autoPollInterval = null;
let lowStockAlertInterval = null;

const suggestedRestocks = computed(() =>
  (products.value || []).filter(p => {
    const stock = parseInt(p.total_stock || 0);
    const reorder = parseInt(p.reorder_level || 5);
    return stock <= reorder;
  }).sort((a, b) => {
    // Sort by shortage (most urgent first)
    const aShortage = parseInt(a.reorder_level || 5) - parseInt(a.total_stock || 0);
    const bShortage = parseInt(b.reorder_level || 5) - parseInt(b.total_stock || 0);
    return bShortage - aShortage;
  })
);

const formatLastCheckTime = () => {
  if (!lastCheckTime.value) return 'Never';
  const d = new Date(lastCheckTime.value);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const filteredProducts = computed(() => {
  let result = products.value || [];
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(p =>
      p.product_name?.toLowerCase().includes(q) ||
      p.category_name?.toLowerCase().includes(q)
    );
  }
  if (filterStatus.value === 'low') {
    result = result.filter(p => {
      const s = parseInt(p.total_stock || 0);
      return s > 0 && s < 10;
    });
  } else if (filterStatus.value === 'out') {
    result = result.filter(p => parseInt(p.total_stock || 0) === 0);
  }
  return result;
});

const lowStockCount = computed(() =>
  products.value?.filter(p => {
    const s = parseInt(p.total_stock || 0);
    return s > 0 && s < 10;
  }).length || 0
);

const outOfStockCount = computed(() =>
  products.value?.filter(p => parseInt(p.total_stock || 0) === 0).length || 0
);

const allSelectedOnPage = computed(() => {
  if (filteredProducts.value.length === 0) return false;
  return filteredProducts.value.every(p => selectedIds.value.has(p.product_id));
});

const someSelectedOnPage = computed(() => {
  if (filteredProducts.value.length === 0) return false;
  return filteredProducts.value.some(p => selectedIds.value.has(p.product_id)) && !allSelectedOnPage.value;
});

const hasSelectedItems = computed(() => selectedIds.value.size > 0);

const getStockStatus = (stock) => {
  const n = parseInt(stock || 0);
  if (n === 0) return { text: 'Out of Stock', class: 'bg-red-50 text-red-700', dotClass: 'bg-red-500' };
  if (n < 10) return { text: 'Low Stock', class: 'bg-amber-50 text-amber-700', dotClass: 'bg-amber-500' };
  return { text: 'In Stock', class: 'bg-emerald-50 text-emerald-700', dotClass: 'bg-emerald-500' };
};

const getChangeTypeBadge = (type) => {
  const map = {
    IN: 'bg-emerald-100 text-emerald-700',
    OUT: 'bg-red-100 text-red-700',
    ADJUST: 'bg-amber-100 text-amber-700',
    RETURN: 'bg-blue-100 text-blue-700',
    DAMAGED: 'bg-purple-100 text-purple-700',
  };
  return map[type] || 'bg-neutral-100 text-neutral-700';
};

const formatPrice = (price) => parseFloat(price || 0).toFixed(2);

const filterBtnClass = (v) => ({
  'bg-ink text-white': filterStatus.value === v,
  'bg-neutral-100 text-neutral-700 hover:bg-neutral-200': filterStatus.value !== v,
});

const toggleSelectAll = () => {
  if (allSelectedOnPage.value) {
    filteredProducts.value.forEach(p => selectedIds.value.delete(p.product_id));
  } else {
    filteredProducts.value.forEach(p => selectedIds.value.add(p.product_id));
  }
  selectedIds.value = new Set(selectedIds.value);
};

const toggleSelect = (id) => {
  const s = new Set(selectedIds.value);
  if (s.has(id)) s.delete(id); else s.add(id);
  selectedIds.value = s;
};

const clearSelection = () => { selectedIds.value = new Set(); };

const openUpdateModal = (product) => {
  selectedProduct.value = product;
  newStock.value = parseInt(product.total_stock || 0);
  newReorderLevel.value = parseInt(product.reorder_level || 5);
  stockReason.value = '';
  showUpdateModal.value = true;
};

const closeUpdateModal = () => {
  showUpdateModal.value = false;
  selectedProduct.value = null;
  newStock.value = 0;
  newReorderLevel.value = 5;
  stockReason.value = '';
};

const updateStock = async () => {
  if (!selectedProduct.value) return;
  updatingStock.value = true;
  try {
    const response = await stockAPI.updateProductStock(
      selectedProduct.value.product_id,
      newStock.value,
      newReorderLevel.value,
      stockReason.value || null
    );
    if (response.success) {
      selectedProduct.value.total_stock = newStock.value;
      selectedProduct.value.reorder_level = newReorderLevel.value;
      toast.success('Stock updated');
      closeUpdateModal();
    } else {
      toast.error(response.message || 'Update failed');
    }
  } catch (err) {
    console.error('Stock update error:', err);
    toast.error(err.response?.data?.message || 'Error updating stock');
  } finally {
    updatingStock.value = false;
  }
};

const openBulkUpdateModal = () => {
  bulkNewStock.value = 0;
  bulkReorderLevel.value = 5;
  bulkReason.value = '';
  showBulkUpdateModal.value = true;
};

const closeBulkUpdateModal = () => {
  showBulkUpdateModal.value = false;
  bulkNewStock.value = 0;
  bulkReason.value = '';
};

const executeBulkUpdate = async () => {
  if (selectedIds.value.size === 0) return;
  bulkUpdating.value = true;
  try {
    const ids = Array.from(selectedIds.value);
    const updates = ids.map(id => ({
      product_id: id,
      quantity: bulkNewStock.value,
      reorder_level: bulkReorderLevel.value,
      reason: bulkReason.value || 'Bulk stock update',
    }));
    const response = await stockAPI.bulkUpdateStock(updates);
    if (response.success) {
      const count = response.data?.updated || ids.length;
      toast.success('Updated ' + count + ' product(s)');
      closeBulkUpdateModal();
      selectedIds.value = new Set();
      await productStore.fetchAllProducts();
    } else {
      toast.error(response.message || 'Bulk update failed');
    }
  } catch (err) {
    console.error('Bulk update error:', err);
    toast.error(err.response?.data?.message || 'Error in bulk update');
  } finally {
    bulkUpdating.value = false;
  }
};

const openHistoryModal = async (product) => {
  historyProduct.value = product;
  showHistoryModal.value = true;
  loadingHistory.value = true;
  stockHistory.value = [];
  try {
    const response = await stockAPI.getStockHistory(product.product_id);
    if (response.success) {
      stockHistory.value = response.data || [];
    }
  } catch (err) {
    console.error('Stock history error:', err);
    toast.error('Failed to load stock history');
  } finally {
    loadingHistory.value = false;
  }
};

const closeHistoryModal = () => {
  showHistoryModal.value = false;
  historyProduct.value = null;
  stockHistory.value = [];
};

const formatTimestamp = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const handleCheckLowStock = async () => {
  checkingLowStock.value = true;
  try {
    const res = await dashboardAPI.checkLowStock();
    if (res.success) {
      const c = res.data?.notificationsCreated || 0;
      lastCheckTime.value = new Date();
      if (c > 0) toast.success(c + ' low-stock notification(s) created');
      else toast.info('Low-stock check complete - no issues found');
      await productStore.fetchAllProducts();
    } else {
      toast.error(res.message || 'Check failed');
    }
  } catch (err) {
    console.error('Low stock check error:', err);
    toast.error(err.response?.data?.message || 'Error checking low stock');
  } finally {
    checkingLowStock.value = false;
  }
};

const handleImageError = (event) => {
  event.target.src = 'https://via.placeholder.com/80?text=No+Image';
};

const startAutoPolling = () => {
  // Refresh product list every 60 seconds
  autoPollInterval = setInterval(async () => {
    if (!autoCheckEnabled.value) return;
    await productStore.fetchAllProducts();
  }, 60_000);

  // Auto-check low stock every 5 minutes
  lowStockAlertInterval = setInterval(async () => {
    if (!autoCheckEnabled.value) return;
    try {
      const res = await dashboardAPI.checkLowStock();
      if (res.success) {
        const c = res.data?.notificationsCreated || 0;
        lastCheckTime.value = new Date();
        if (c > 0) {
          toast.info(c + ' low-stock alert(s) detected');
          await productStore.fetchAllProducts();
        }
      }
    } catch (err) {
      // Silently fail on auto-poll — don't spam toasts
      console.warn('Auto low-stock check failed:', err.message);
    }
  }, 5 * 60_000);
};

const stopAutoPolling = () => {
  if (autoPollInterval) clearInterval(autoPollInterval);
  if (lowStockAlertInterval) clearInterval(lowStockAlertInterval);
};

onMounted(async () => {
  await productStore.fetchAllProducts();
  startAutoPolling();
});

onUnmounted(() => {
  stopAutoPolling();
});
</script>

<template>
  <div class="min-h-screen bg-neutral-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

      <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <span class="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-700 mb-2">
            <Package class="w-3.5 h-3.5" />
            Inventory
          </span>
          <h1 class="text-2xl sm:text-3xl font-bold text-ink">Stock Management</h1>
          <p class="text-neutral-500 mt-1 text-sm">Monitor inventory, update stock, and configure alerts</p>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
        <div class="bg-white rounded-2xl p-5 sm:p-6 border border-neutral-100 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <div class="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center mb-4 transition-transform hover:scale-110">
            <Package class="w-6 h-6 text-amber-700" />
          </div>
          <p class="text-neutral-500 text-xs uppercase tracking-[0.15em] font-bold mb-1">Total Products</p>
          <p class="text-3xl font-bold text-ink">{{ products?.length || 0 }}</p>
        </div>
        <div class="bg-white rounded-2xl p-5 sm:p-6 border border-amber-100 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <div class="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center mb-4 transition-transform hover:scale-110">
            <AlertTriangle class="w-6 h-6 text-amber-600" />
          </div>
          <p class="text-neutral-500 text-xs uppercase tracking-[0.15em] font-bold mb-1">Low Stock</p>
          <p class="text-3xl font-bold text-amber-600">{{ lowStockCount }}</p>
        </div>
        <div class="bg-white rounded-2xl p-5 sm:p-6 border border-red-100 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <div class="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mb-4 transition-transform hover:scale-110">
            <XCircle class="w-6 h-6 text-red-600" />
          </div>
          <p class="text-neutral-500 text-xs uppercase tracking-[0.15em] font-bold mb-1">Out of Stock</p>
          <p class="text-3xl font-bold text-red-600">{{ outOfStockCount }}</p>
        </div>
      </div>

      <div class="bg-white rounded-2xl p-4 sm:p-5 border border-neutral-100 mb-6">
        <div class="flex flex-col sm:flex-row gap-4">
          <div class="flex-1 relative">
            <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
            <input v-model="searchQuery" type="text" placeholder="Search products..." aria-label="Search products"
              class="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-ink placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition-all" />
          </div>
          <div class="flex flex-wrap gap-2">
            <button @click="filterStatus = 'all'" :class="filterBtnClass('all')"
              class="px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">All</button>
            <button @click="filterStatus = 'low'" :class="filterBtnClass('low')"
              class="px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">Low Stock</button>
            <button @click="filterStatus = 'out'" :class="filterBtnClass('out')"
              class="px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">Out of Stock</button>
            <div class="w-px h-8 bg-neutral-200 self-center mx-1 hidden sm:block"></div>
            <button @click="handleCheckLowStock" :disabled="checkingLowStock"
              class="px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50">
              <Bell v-if="!checkingLowStock" class="w-4 h-4" />                          <RefreshCw v-else class="w-4 h-4 animate-spin" />
              {{ checkingLowStock ? 'Checking...' : 'Check Alerts' }}
            </button>
          </div>
        </div>
      </div>

      <!-- ── Auto-Restock Suggestions ──────────────────────────── -->
      <div v-if="suggestedRestocks.length > 0"
        class="bg-white rounded-2xl p-4 sm:p-6 border border-amber-100 mb-6">
        <div class="flex items-start justify-between gap-4 mb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
              <Bell class="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 class="font-bold text-ink text-sm">Restock Suggestions</h3>
              <p class="text-xs text-neutral-500">{{ suggestedRestocks.length }} product(s) below reorder threshold</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-1.5 text-[10px] text-neutral-400">
              <div class="w-2 h-2 rounded-full" :class="autoCheckEnabled ? 'bg-emerald-500' : 'bg-neutral-300'"></div>
              <span>Auto-check {{ autoCheckEnabled ? 'ON' : 'OFF' }}</span>
            </div>
            <button @click="autoCheckEnabled = !autoCheckEnabled"
              class="text-[10px] font-bold uppercase tracking-wider text-amber-700 hover:text-amber-800 transition-colors">
              {{ autoCheckEnabled ? 'Pause' : 'Resume' }}
            </button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-150">
            <thead class="bg-neutral-50/60 border-b border-neutral-200">
              <tr>
                <th class="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Product</th>
                <th class="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Stock</th>
                <th class="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Reorder at</th>
                <th class="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Shortage</th>
                <th class="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-100">
              <tr v-for="product in suggestedRestocks.slice(0, 10)" :key="product.product_id"
                class="hover:bg-neutral-50/70 transition-colors"
                :class="{ 'bg-red-50/30': parseInt(product.total_stock || 0) === 0 }">
                <td class="px-3 py-2.5">
                  <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 bg-neutral-100 rounded-lg overflow-hidden shrink-0">
                      <LazyImage :src="product.main_image || 'https://via.placeholder.com/40'" :alt="product.product_name"
                        wrapper-class="w-full h-full" img-class="w-full h-full object-cover" />
                    </div>
                    <span class="text-sm font-semibold text-ink truncate max-w-45">{{ product.product_name }}</span>
                  </div>
                </td>
                <td class="px-3 py-2.5">
                  <span class="text-lg font-bold tabular-nums"
                    :class="parseInt(product.total_stock || 0) === 0 ? 'text-red-600' : 'text-amber-600'">
                    {{ product.total_stock || 0 }}
                  </span>
                </td>
                <td class="px-3 py-2.5">
                  <span class="text-sm font-semibold text-neutral-500">{{ product.reorder_level || 5 }}</span>
                </td>
                <td class="px-3 py-2.5">
                  <span class="text-sm font-bold"
                    :class="parseInt(product.total_stock || 0) === 0 ? 'text-red-600' : 'text-amber-600'">
                    {{ Math.max(0, parseInt(product.reorder_level || 5) - parseInt(product.total_stock || 0)) }}
                  </span>
                </td>
                <td class="px-3 py-2.5 text-right">
                  <button @click="openUpdateModal(product)"
                    class="px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-all text-xs font-semibold">
                    Restock
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="mt-3 flex items-center justify-between">
          <p class="text-[10px] text-neutral-400">
            Last auto-check: <span class="font-semibold text-neutral-500">{{ formatLastCheckTime() }}</span>
          </p>
          <p v-if="suggestedRestocks.length > 10" class="text-[10px] text-neutral-400">
            +{{ suggestedRestocks.length - 10 }} more products below threshold
          </p>
        </div>
      </div>

      <div v-if="hasSelectedItems"
        class="bg-ink text-white rounded-2xl px-5 py-3 mb-4 flex items-center justify-between gap-4 flex-wrap">
        <div class="flex items-center gap-3">
          <CheckSquare class="w-5 h-5 text-amber-400" />
          <span class="text-sm font-semibold tabular-nums">{{ selectedIds.size }}</span>
          <span class="text-sm text-neutral-400">selected</span>
          <button @click="clearSelection" class="text-xs text-neutral-400 hover:text-white underline underline-offset-2 transition-colors">Clear</button>
        </div>
        <button @click="openBulkUpdateModal"
          class="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all">
          Update Stock
        </button>
      </div>

      <div v-if="loading" class="flex items-center justify-center py-20">
        <RefreshCw class="w-10 h-10 text-neutral-300 animate-spin" />
      </div>

      <div v-else class="bg-white rounded-2xl border border-neutral-100 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full min-w-225">
            <thead class="bg-neutral-50/60 border-b border-neutral-200">
              <tr>
                <th class="px-4 sm:px-5 py-3 w-12">
                  <button @click="toggleSelectAll" class="p-0.5">
                    <CheckSquare v-if="allSelectedOnPage" class="w-4 h-4 text-amber-600" />
                    <Square v-else-if="someSelectedOnPage" class="w-4 h-4 text-amber-600 opacity-60" />
                    <Square v-else class="w-4 h-4 text-neutral-300 hover:text-neutral-400 transition-colors" />
                  </button>
                </th>
                <th class="px-4 sm:px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Product</th>
                <th class="px-4 sm:px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Category</th>
                <th class="px-4 sm:px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Price</th>
                <th class="px-4 sm:px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Stock</th>
                <th class="px-4 sm:px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Reorder at</th>
                <th class="px-4 sm:px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Status</th>
                <th class="px-4 sm:px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-100">
              <tr v-for="product in filteredProducts" :key="product.product_id"
                class="hover:bg-neutral-50/70 transition-colors"
                :class="{ 'bg-amber-50/30': selectedIds.has(product.product_id) }">
                <td class="px-4 sm:px-5 py-2.5">
                  <button @click="toggleSelect(product.product_id)" class="p-0.5">
                    <CheckSquare v-if="selectedIds.has(product.product_id)" class="w-4 h-4 text-amber-600" />
                    <Square v-else class="w-4 h-4 text-neutral-300 hover:text-neutral-400 transition-colors" />
                  </button>
                </td>
                <td class="px-4 sm:px-5 py-2.5">
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 sm:w-10 sm:h-10 bg-neutral-100 rounded-lg overflow-hidden shrink-0">
                      <LazyImage :src="product.main_image || 'https://via.placeholder.com/80'" :alt="product.product_name"
                        wrapper-class="w-full h-full" img-class="w-full h-full object-cover" />
                    </div>
                    <div class="min-w-0">
                      <p class="font-semibold text-ink text-sm truncate">{{ product.product_name }}</p>
                      <p class="text-[11px] text-neutral-400">ID: {{ product.product_id }}</p>
                    </div>
                  </div>
                </td>
                <td class="px-4 sm:px-5 py-2.5">
                  <span class="text-sm text-neutral-500">{{ product.category_name || 'N/A' }}</span>
                </td>
                <td class="px-4 sm:px-5 py-2.5">
                  <span class="text-sm font-semibold text-ink tabular-nums">{{ '$' }}{{ formatPrice(product.final_price || product.base_price) }}</span>
                </td>
                <td class="px-4 sm:px-5 py-2.5">
                  <span class="text-2xl font-bold text-ink tabular-nums">{{ product.total_stock || 0 }}</span>
                </td>
                <td class="px-4 sm:px-5 py-2.5">
                  <span class="text-sm tabular-nums font-semibold"
                    :class="parseInt(product.total_stock || 0) <= parseInt(product.reorder_level || 5) ? 'text-amber-600' : 'text-neutral-500'">
                    {{ product.reorder_level || 5 }}
                  </span>
                </td>
                <td class="px-4 sm:px-5 py-2.5">
                  <span :class="getStockStatus(product.total_stock).class"
                    class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide">
                    <div :class="getStockStatus(product.total_stock).dotClass" class="w-2 h-2 rounded-full"></div>
                    {{ getStockStatus(product.total_stock).text }}
                  </span>
                </td>
                <td class="px-4 sm:px-6 py-3 text-right">
                  <div class="flex items-center justify-end gap-1">
                    <button @click="openHistoryModal(product)"
                      class="p-1.5 rounded-lg text-neutral-400 hover:text-ink hover:bg-neutral-100 transition-colors"
                      title="View stock history">
                      <History class="w-4 h-4" />
                    </button>
                    <button @click="openUpdateModal(product)"
                      class="px-3 py-1.5 bg-ink text-white rounded-lg hover:bg-ink/90 transition-colors text-xs font-semibold">
                      Update
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="filteredProducts.length === 0" class="text-center py-16">
          <Package class="mx-auto w-12 h-12 text-neutral-300 mb-4" />
          <p class="text-neutral-500 text-sm font-semibold">No products found</p>
          <p class="text-xs text-neutral-400 mt-1">Try adjusting your search or filter.</p>
        </div>
      </div>
    </div>

    <!-- Single Stock Update Modal -->
    <div v-if="showUpdateModal" @click="closeUpdateModal"
      class="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div @click.stop class="bg-white rounded-2xl p-5 sm:p-8 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto animate-[scale-in_0.25s_ease-out]">
        <h3 class="text-xl font-bold text-ink mb-6">Update Stock</h3>

        <div class="flex items-center gap-4 mb-6 p-4 bg-neutral-50 rounded-xl">
          <div class="w-16 h-16 bg-neutral-200 rounded-xl overflow-hidden shrink-0">
            <LazyImage :src="selectedProduct?.main_image || 'https://via.placeholder.com/80'"
              :alt="selectedProduct?.product_name" wrapper-class="w-full h-full" img-class="w-full h-full object-cover" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-ink truncate">{{ selectedProduct?.product_name }}</p>
            <p class="text-sm text-neutral-500">Current: <span class="font-semibold text-ink">{{ selectedProduct?.total_stock || 0 }}</span> units</p>
          </div>
        </div>

        <div class="mb-4">
          <label class="block text-xs font-bold uppercase tracking-[0.15em] text-ink mb-2">New Stock Quantity</label>
          <input v-model.number="newStock" type="number" min="0" aria-label="New stock quantity"
            class="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-lg font-bold tabular-nums text-ink focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition-all" />
        </div>

        <div class="mb-4">
          <label class="block text-xs font-bold uppercase tracking-[0.15em] text-ink mb-2">
            Alert Threshold
            <span class="text-neutral-400 font-normal normal-case ml-1">(reorder when stock falls below)</span>
          </label>
          <input v-model.number="newReorderLevel" type="number" min="0" aria-label="Alert threshold"
            class="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-base font-semibold tabular-nums text-ink focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition-all" />
        </div>

        <div class="mb-6">
          <label class="block text-xs font-bold uppercase tracking-[0.15em] text-ink mb-2">Reason (optional)</label>
          <input v-model="stockReason" type="text" placeholder="e.g. Restock from supplier" aria-label="Stock update reason"
            class="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-ink placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition-all" />
        </div>

        <div class="flex gap-3">
          <button @click="closeUpdateModal" class="flex-1 px-4 py-3 border border-neutral-200 rounded-xl text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors" :disabled="updatingStock">Cancel</button>
          <button @click="updateStock" :disabled="updatingStock"
            class="flex-1 px-4 py-3 bg-ink text-white rounded-xl text-sm font-semibold hover:bg-ink/90 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2">
            <RefreshCw v-if="updatingStock" class="w-4 h-4 animate-spin" />
            {{ updatingStock ? 'Updating...' : 'Update Stock' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Bulk Stock Update Modal -->
    <div v-if="showBulkUpdateModal" @click="closeBulkUpdateModal"
      class="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div @click.stop class="bg-white rounded-2xl p-5 sm:p-8 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto animate-[scale-in_0.25s_ease-out]">
        <h3 class="text-xl font-bold text-ink mb-2">Bulk Stock Update</h3>
        <p class="text-sm text-neutral-500 mb-6">Update stock for <strong class="text-ink">{{ selectedIds.size }}</strong> selected product(s)</p>

        <div class="mb-4">
          <label class="block text-xs font-bold uppercase tracking-[0.15em] text-ink mb-2">New Stock Quantity</label>
          <input v-model.number="bulkNewStock" type="number" min="0" aria-label="Bulk stock quantity"
            class="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-lg font-bold tabular-nums text-ink focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition-all" />
        </div>

        <div class="mb-4">
          <label class="block text-xs font-bold uppercase tracking-[0.15em] text-ink mb-2">Alert Threshold</label>
          <input v-model.number="bulkReorderLevel" type="number" min="0" aria-label="Bulk alert threshold"
            class="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-base font-semibold tabular-nums text-ink focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition-all" />
        </div>

        <div class="mb-6">
          <label class="block text-xs font-bold uppercase tracking-[0.15em] text-ink mb-2">Reason (optional)</label>
          <input v-model="bulkReason" type="text" placeholder="e.g. End-of-month restock" aria-label="Bulk update reason"
            class="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-ink placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition-all" />
        </div>

        <div class="flex gap-3">
          <button @click="closeBulkUpdateModal" class="flex-1 px-4 py-3 border border-neutral-200 rounded-xl text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors" :disabled="bulkUpdating">Cancel</button>
          <button @click="executeBulkUpdate" :disabled="bulkUpdating"
            class="flex-1 px-4 py-3 bg-ink text-white rounded-xl text-sm font-semibold hover:bg-ink/90 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2">
            <RefreshCw v-if="bulkUpdating" class="w-4 h-4 animate-spin" />
            {{ bulkUpdating ? 'Updating...' : 'Update All' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Stock History Modal -->
    <div v-if="showHistoryModal" @click="closeHistoryModal"
      class="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div @click.stop class="bg-white rounded-2xl p-5 sm:p-8 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto animate-[scale-in_0.25s_ease-out]">
        <div class="flex items-center justify-between mb-6">
          <div>
            <span class="text-[10px] uppercase tracking-[0.2em] text-amber-700 font-bold">Stock History</span>
            <h3 class="text-lg font-bold text-ink mt-1">{{ historyProduct?.product_name }}</h3>
          </div>
          <button @click="closeHistoryModal" class="p-2 rounded-lg hover:bg-neutral-100 transition-colors">
            <svg class="w-5 h-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div v-if="loadingHistory" class="flex items-center justify-center py-12">
          <RefreshCw class="w-8 h-8 text-neutral-300 animate-spin" />
        </div>

        <div v-else-if="stockHistory.length === 0" class="text-center py-12">
          <Clock class="w-12 h-12 text-neutral-200 mx-auto mb-3" />
          <p class="text-neutral-500 font-medium">No stock history yet</p>
          <p class="text-xs text-neutral-400 mt-1">Stock changes will appear here once you update inventory.</p>
        </div>

        <div v-else class="space-y-3 max-h-96 overflow-y-auto">
          <div v-for="log in stockHistory" :key="log.log_id"
            class="flex items-start gap-4 p-4 bg-neutral-50 rounded-xl">
            <div :class="['px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide shrink-0', getChangeTypeBadge(log.change_type)]">
              {{ log.change_type }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-baseline gap-2">
                <span v-if="log.change_type === 'IN'" class="text-emerald-600 font-bold text-lg">+{{ log.quantity }}</span>
                <span v-else-if="log.change_type === 'OUT'" class="text-red-600 font-bold text-lg">-{{ log.quantity }}</span>
                <span v-else class="text-amber-600 font-bold text-lg">{{ log.quantity }}</span>
              </div>
              <p v-if="log.reason" class="text-xs text-neutral-500 mt-0.5">{{ log.reason }}</p>
              <div class="flex items-center gap-3 mt-1 text-[10px] text-neutral-400">
                <span class="inline-flex items-center gap-1">
                  <Clock class="w-3 h-3" />
                  {{ formatTimestamp(log.created_at) }}
                </span>
                <span v-if="log.user_name" class="inline-flex items-center gap-1">
                  <Users class="w-3 h-3" />
                  {{ log.user_name }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
