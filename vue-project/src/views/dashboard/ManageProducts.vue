<script setup>
import { ref, computed, onMounted, watch, onUnmounted, nextTick } from 'vue';
import { productAPI } from '../../api/products/productApi';
import { categoryAPI } from '../../api/products/categoryApi';
import { variantAPI } from '../../api/products/variantApi';
import { discountAPI } from '../../api/products/discountApi.js';
import { useRouter } from 'vue-router';
import { useToast } from '../../composables/useToast.js';
import { useMediaQuery } from '../../composables/useMediaQuery.js';
import LazyImage from '../../components/LazyImage.vue';
import {
    Plus,
    Search,
    RefreshCw,
    Loader2,
    AlertCircle,
    Package,
    Eye,
    Pencil,
    Trash2,
    Image as ImageIcon,
    Boxes,
    Download,
    Upload,
    CheckSquare,
    Square,
    ChevronUp,
    ChevronDown,
    ChevronsUpDown,
    X,
    AlertTriangle,
    Filter,
    Inbox,
    SlidersHorizontal,
    ChevronLeft,
    ChevronRight,
    Tag,
    Calendar,
} from 'lucide-vue-next';

const toast = useToast();
const router = useRouter();
// Render either the mobile card list or the desktop table — never both, so
// product names aren't duplicated in the DOM. Falls back to the table where
// matchMedia is unavailable (e.g. jsdom in tests).
const isDesktop = useMediaQuery('(min-width: 1024px)', true);

// ── State ────────────────────────────────────────────────────────────────────
const products = ref([]);
const categories = ref([]);
const loading = ref(false);
const deleting = ref(false);
const error = ref(null);
const searchQuery = ref('');
const filterCategory = ref('all');
const filterStatus = ref('all');
const filterStock = ref('all');
const showDeleteModal = ref(false);
const selectedProduct = ref(null);
const forceDelete = ref(false);
const bulkActionLoading = ref(false);
const showBulkStatusModal = ref(false);
const bulkNewStatus = ref('active');
const bulkForceDelete = ref(false);

// Sorting
const sortField = ref('created_at');
const sortDirection = ref('desc');

// Bulk selection
const selectedIds = ref(new Set());
// Per-page
const pageSize = ref(10);
const currentPage = ref(1);
const totalProducts = ref(0);

// Variant expansion
const expandedProducts = ref(new Set());
const productVariants = ref({});
const loadingVariants = ref(new Set());

// Variant inline price editing
const editingVariantPrice = ref(null); // { variantId, productId, value }
const variantPriceInputRef = ref(null);

const startEditingVariantPrice = (variant, productId) => {
    editingVariantPrice.value = { variantId: variant.variant_id, productId, value: variant.variant_price || '' };
    nextTick(() => {
        variantPriceInputRef.value?.focus();
        variantPriceInputRef.value?.select();
    });
};

const cancelEditingVariantPrice = () => {
    editingVariantPrice.value = null;
};

const saveVariantPrice = async () => {
    if (!editingVariantPrice.value) return;
    const { variantId, productId, value } = editingVariantPrice.value;
    const variants = productVariants.value[productId];
    if (!variants) { cancelEditingVariantPrice(); return; }
    const variant = variants.find(v => v.variant_id === variantId);
    if (!variant) { cancelEditingVariantPrice(); return; }

    const num = parseFloat(value);
    if (isNaN(num) || num < 0) {
        toast.warning('Price must be a valid positive number');
        cancelEditingVariantPrice();
        return;
    }
    if (num === parseFloat(variant.variant_price || 0)) {
        cancelEditingVariantPrice();
        return;
    }

    try {
        await variantAPI.upadateVariant(variantId, { variant_price: num });
        variant.variant_price = num;
        editingVariantPrice.value = null;
        toast.success('Variant price updated');
    } catch (err) {
        console.error('Error updating variant price:', err);
        toast.error(err.response?.data?.message || 'Failed to update variant price');
        editingVariantPrice.value = null;
    }
};

const handleVariantPriceKeydown = (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        saveVariantPrice();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEditingVariantPrice();
    }
};

const toggleExpandVariants = async (productId) => {
    if (expandedProducts.value.has(productId)) {
        expandedProducts.value.delete(productId);
        expandedProducts.value = new Set(expandedProducts.value);
        return;
    }
    expandedProducts.value.add(productId);
    expandedProducts.value = new Set(expandedProducts.value);

    if (!productVariants.value[productId]) {
        loadingVariants.value.add(productId);
        loadingVariants.value = new Set(loadingVariants.value);
        try {
            const response = await variantAPI.getProductVariants(productId);
            if (response.success) {
                productVariants.value[productId] = response.data || [];
            } else {
                productVariants.value[productId] = [];
            }
        } catch (err) {
            console.error('Error fetching variants:', err);
            productVariants.value[productId] = [];
        } finally {
            loadingVariants.value.delete(productId);
            loadingVariants.value = new Set(loadingVariants.value);
        }
    }
};

// CSV Import
const fileInput = ref(null);
const showImportModal = ref(false);
const importFile = ref(null);
const importResults = ref(null);
const importing = ref(false);
const importPreview = ref([]);
const importErrors = ref([]);

const openImportModal = () => {
    importFile.value = null;
    importResults.value = null;
    importPreview.value = [];
    importErrors.value = [];
    showImportModal.value = true;
};

const handleImportFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    importFile.value = file;
    importErrors.value = [];

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target.result;
            const lines = text.split('\n').filter(l => l.trim());
            if (lines.length < 2) {
                importErrors.value = ['CSV must have a header row and at least one data row'];
                return;
            }

            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
            const nameIdx = headers.findIndex(h => h === 'name' || h === 'product_name');
            const priceIdx = headers.findIndex(h => h === 'price' || h === 'base_price');
            const categoryIdx = headers.findIndex(h => h === 'category' || h === 'category_name');
            const statusIdx = headers.findIndex(h => h === 'status' || h === 'product_status');

            if (nameIdx === -1 || priceIdx === -1) {
                importErrors.value = ['CSV must contain "name" and "price" columns'];
                return;
            }

            // Build category lookup: name → id
            const categoryMap = {};
            categories.value.forEach(c => { categoryMap[c.name?.toLowerCase()] = c.category_id; });

            const parsed = [];
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                const catName = (categoryIdx >= 0 && cols[categoryIdx]) ? cols[categoryIdx].trim() : null;
                const product = {
                    product_name: cols[nameIdx] || '',
                    base_price: parseFloat(cols[priceIdx]) || 0,
                    product_status: statusIdx >= 0 ? cols[statusIdx] || 'active' : 'active',
                };
                // Resolve category name → id
                if (catName && categoryMap[catName.toLowerCase()]) {
                    product.category_id = categoryMap[catName.toLowerCase()];
                }
                parsed.push(product);
            }

            importPreview.value = parsed;
        } catch (err) {
            console.error('CSV parse error:', err);
            importErrors.value = ['Failed to parse CSV file. Check the format and try again.'];
        }
    };
    reader.readAsText(file);
};

const executeImport = async () => {
    if (importPreview.value.length === 0) return;
    importing.value = true;
    importErrors.value = [];
    try {
        const response = await productAPI.bulkCreateProducts(importPreview.value);
        if (response.success) {
            importResults.value = response.data;
            toast.success(`Imported ${response.data.created || importPreview.value.length} product(s)`);
            await fetchProducts();
        } else {
            importErrors.value = [response.message || 'Import failed'];
        }
    } catch (err) {
        console.error('Import error:', err);
        importErrors.value = [err.response?.data?.message || 'Import failed. Check your CSV format.'];
    } finally {
        importing.value = false;
    }
};

// Image preview
const showImagePreview = ref(false);
const previewImage = ref('');

// ── Computed ─────────────────────────────────────────────────────────────────
const totalPages = computed(() => Math.ceil(totalProducts.value / pageSize.value));

const sortIcon = (field) => {
    if (sortField.value !== field) return ChevronsUpDown;
    return sortDirection.value === 'asc' ? ChevronUp : ChevronDown;
};

const statusStyles = {
    active:   'bg-accent/10 text-accent border-accent/20',
    draft:    'bg-warning/10 text-warning border-warning/20',
    inactive: 'bg-danger/10 text-danger border-danger/20',
    archived: 'bg-neutral-100 text-neutral-500 border-neutral-200',
};

const stockStatus = (stock) => {
    const qty = parseInt(stock || 0);
    if (qty === 0) return { label: 'Out of Stock', class: 'text-danger bg-danger/10 border-danger/20' };
    if (qty < 10) return { label: 'Low Stock', class: 'text-warning bg-warning/10 border-warning/20' };
    return { label: 'In Stock', class: 'text-success bg-success/10 border-success/20' };
};

const allSelectedOnPage = computed(() => {
    if (products.value.length === 0) return false;
    return products.value.every(p => selectedIds.value.has(p.product_id));
});

const someSelectedOnPage = computed(() => {
    if (products.value.length === 0) return false;
    return products.value.some(p => selectedIds.value.has(p.product_id)) && !allSelectedOnPage.value;
});

const hasSelectedItems = computed(() => selectedIds.value.size > 0);

const activeProducts = computed(() => products.value.filter(p => p.product_status === 'active').length);
const draftProducts = computed(() => products.value.filter(p => p.product_status === 'draft').length);
const inactiveProducts = computed(() => products.value.filter(p => p.product_status === 'inactive').length);

const paginationStart = computed(() => ((currentPage.value - 1) * pageSize.value) + 1);
const paginationEnd = computed(() => Math.min(currentPage.value * pageSize.value, totalProducts.value));

// ── Search Debounce ──────────────────────────────────────────────────────────
let searchDebounce = null;

watch(searchQuery, () => {
    if (searchDebounce) clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
        currentPage.value = 1;
        fetchProducts();
    }, 300);
});

onUnmounted(() => {
    if (searchDebounce) clearTimeout(searchDebounce);
});

// ── Data Fetching ────────────────────────────────────────────────────────────
const fetchProducts = async () => {
    try {
        loading.value = true;
        error.value = null;

        const params = {
            page: currentPage.value,
            pageSize: pageSize.value,
            search: searchQuery.value || null,
            category: filterCategory.value !== 'all' ? filterCategory.value : null,
            status: filterStatus.value !== 'all' ? filterStatus.value : null,
            stockStatus: filterStock.value !== 'all' ? filterStock.value : null,
            sortField: sortField.value,
            sortDirection: sortDirection.value,
        };

        const response = await productAPI.getPaginatedProduct(params);

        products.value = response.items || [];
        totalProducts.value = response.totalItems || 0;
    } catch (err) {
        console.error('Error fetching products:', err);
        error.value = err.response?.data?.message || 'Failed to load products';
    } finally {
        loading.value = false;
    }
};

const fetchCategories = async () => {
    try {
        const response = await categoryAPI.getAllCategories();
        categories.value = response.data || response || [];
    } catch (err) {
        console.error('Error fetching categories:', err);
    }
};

// ── Filtering ────────────────────────────────────────────────────────────────
const handleFilter = () => {
    currentPage.value = 1;
    selectedIds.value = new Set();
    fetchProducts();
};

const clearFilters = () => {
    searchQuery.value = '';
    filterCategory.value = 'all';
    filterStatus.value = 'all';
    filterStock.value = 'all';
    currentPage.value = 1;
    fetchProducts();
};

const hasActiveFilters = computed(() =>
    searchQuery.value || filterCategory.value !== 'all' || filterStatus.value !== 'all' || filterStock.value !== 'all'
);

// ── Sorting ──────────────────────────────────────────────────────────────────
const toggleSort = (field) => {
    if (sortField.value === field) {
        sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
    } else {
        sortField.value = field;
        sortDirection.value = 'desc';
    }
    currentPage.value = 1;
    fetchProducts();
};

// ── Pagination ───────────────────────────────────────────────────────────────
const goToPage = (page) => {
    currentPage.value = page;
    selectedIds.value = new Set();
    fetchProducts();
};

const nextPage = () => {
    if (currentPage.value < totalPages.value) {
        currentPage.value++;
        selectedIds.value = new Set();
        fetchProducts();
    }
};

const prevPage = () => {
    if (currentPage.value > 1) {
        currentPage.value--;
        selectedIds.value = new Set();
        fetchProducts();
    }
};

const changePageSize = () => {
    currentPage.value = 1;
    selectedIds.value = new Set();
    fetchProducts();
};

const getPageNumbers = () => {
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
};

// ── Bulk Selection ───────────────────────────────────────────────────────────
const toggleSelectAll = () => {
    if (allSelectedOnPage.value) {
        products.value.forEach(p => selectedIds.value.delete(p.product_id));
        selectedIds.value = new Set(selectedIds.value);
    } else {
        products.value.forEach(p => selectedIds.value.add(p.product_id));
        selectedIds.value = new Set(selectedIds.value);
    }
};

const toggleSelect = (id) => {
    const newSet = new Set(selectedIds.value);
    if (newSet.has(id)) {
        newSet.delete(id);
    } else {
        newSet.add(id);
    }
    selectedIds.value = newSet;
};

const clearSelection = () => {
    selectedIds.value = new Set();
};

// ── Bulk Actions ─────────────────────────────────────────────────────────────
const executeBulkStatusChange = async () => {
    if (selectedIds.value.size === 0) return;
    bulkActionLoading.value = true;
    try {
        const ids = Array.from(selectedIds.value);
        await Promise.all(
            ids.map(id => productAPI.updateProduct(id, { product_status: bulkNewStatus.value }))
        );
        toast.success(`${ids.length} product(s) updated to "${bulkNewStatus.value}"`);
        showBulkStatusModal.value = false;
        selectedIds.value = new Set();
        await fetchProducts();
    } catch (err) {
        console.error('Bulk status change error:', err);
        toast.error(err.response?.data?.message || 'Failed to update products');
    } finally {
        bulkActionLoading.value = false;
    }
};

const showBulkDeleteModal = ref(false);

const executeBulkDelete = async () => {
    if (selectedIds.value.size === 0) return;
    bulkForceDelete.value = false;
    showBulkDeleteModal.value = true;
};

const confirmBulkDelete = async () => {
    bulkActionLoading.value = true;
    try {
        const ids = Array.from(selectedIds.value);
        const force = bulkForceDelete.value;
        const results = await Promise.allSettled(
            ids.map(id => productAPI.deleteProduct(id, force))
        );
        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failedReasons = results
            .filter(r => r.status === 'rejected')
            .map(r => r.reason?.response?.data?.message || r.reason?.message);
        const failed = failedReasons.length;
        if (failed > 0) {
            const hasFkSuggestion = results.some(
                r => r.status === 'rejected' && r.reason?.response?.data?.suggestForceDelete
            );
            const hint = hasFkSuggestion && !force
                ? ' — enable "Force delete" to remove order-linked products'
                : '';
            toast.warning(`${succeeded} deleted, ${failed} failed${hint}`);
        } else {
            toast.success(`${ids.length} product(s) deleted`);
        }
        showBulkDeleteModal.value = false;
        selectedIds.value = new Set();
        bulkForceDelete.value = false;
        await fetchProducts();
    } catch (err) {
        console.error('Bulk delete error:', err);
        toast.error(err.response?.data?.message || 'Failed to delete products');
    } finally {
        bulkActionLoading.value = false;
    }
};

// ── CSV Export ───────────────────────────────────────────────────────────────
const exportCSV = () => {
    const data = products.value;
    if (data.length === 0) {
        toast.warning('No products to export');
        return;
    }

    const headers = ['ID', 'Name', 'Category', 'Price', 'Status', 'Stock', 'Created'];
    const rows = data.map(p => [
        p.product_id,
        `"${(p.product_name || '').replace(/"/g, '""')}"`,
        `"${(p.category_name || '').replace(/"/g, '""')}"`,
        p.base_price || 0,
        p.product_status || '',
        p.total_stock || 0,
        p.created_at || '',
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${data.length} product(s) as CSV`);
};

// ── Quick Status Toggle ──────────────────────────────────────────────────────
const quickStatusChange = async (product, newStatus) => {
    try {
        await productAPI.updateProduct(product.product_id, { product_status: newStatus });
        product.product_status = newStatus;
        toast.success(`"${product.product_name}" → ${newStatus}`);
    } catch (err) {
        console.error('Status update error:', err);
        toast.error(err.response?.data?.message || 'Failed to update status');
    }
};

// ── CRUD Navigation ──────────────────────────────────────────────────────────
const openAddProduct = () => {
    router.push({ name: 'addproduct' });
};

const openEditProduct = (product) => {
    router.push({ name: 'addproduct', query: { edit: product.product_id } });
};

const viewProduct = (product) => {
    router.push({ name: 'ProductDetail', params: { id: product.product_id } });
};

// ── Delete Modal ─────────────────────────────────────────────────────────────
const openDeleteModal = (product) => {
    selectedProduct.value = product;
    forceDelete.value = false;
    showDeleteModal.value = true;
};

const closeDeleteModal = () => {
    showDeleteModal.value = false;
    selectedProduct.value = null;
    forceDelete.value = false;
};

const confirmDelete = async () => {
    try {
        deleting.value = true;
        await productAPI.deleteProduct(selectedProduct.value.product_id, forceDelete.value);
        toast.success(`"${selectedProduct.value.product_name}" deleted`);
        closeDeleteModal();
        selectedIds.value.delete(selectedProduct.value.product_id);
        forceDelete.value = false;
        await fetchProducts();
    } catch (err) {
        console.error('Error deleting product:', err);
        const msg = err.response?.data?.message || 'Failed to delete product';
        if (err.response?.data?.suggestForceDelete) {
            toast.warning(`${msg} — enable "Force delete" to remove it.`);
        } else {
            toast.error(msg);
        }
    } finally {
        deleting.value = false;
    }
};

// ── Image Preview ────────────────────────────────────────────────────────────
const openImagePreview = (url) => {
    if (!url) return;
    previewImage.value = url;
    showImagePreview.value = true;
};

const closeImagePreview = () => {
    showImagePreview.value = false;
    previewImage.value = '';
};

const handleImageError = (event) => {
    event.target.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22 viewBox=%220 0 24 24%22%3E%3Crect width=%2224%22 height=%2224%22 fill=%22%23f4f4f5%22/%3E%3C/svg%3E';
};

// ── Utilities ────────────────────────────────────────────────────────────────
const formatPrice = (price) => parseFloat(price || 0).toFixed(2);

const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 86400) {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    if (diff < 604800) {
        const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        return days[date.getDay()];
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const truncateText = (text, length = 40) => {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + '...' : text;
};

// ── Tags Management ──────────────────────────────────────────────────────────
const COMMON_TAGS = ['coming_soon', 'new_arrival', 'best_seller', 'sale', 'featured', 'eco_friendly', 'limited_edition', 'premium'];

const editingTags = ref(null); // product_id being edited
const editingTagsInput = ref('');
const tagEditorRef = ref(null);
const savingTags = ref(false);

const getTags = (product) => product.tags || [];

const toggleTag = (product, tag) => {
    const currentTags = [...getTags(product)];
    const idx = currentTags.indexOf(tag);
    if (idx >= 0) {
        currentTags.splice(idx, 1);
    } else {
        currentTags.push(tag);
    }
    product.tags = currentTags;
};

const addCustomTag = (product) => {
    const tag = editingTagsInput.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!tag) return;
    const currentTags = [...getTags(product)];
    if (!currentTags.includes(tag)) {
        currentTags.push(tag);
        product.tags = currentTags;
    }
    editingTagsInput.value = '';
};

const openTagEditor = (product) => {
    editingTags.value = product.product_id;
    editingTagsInput.value = '';
    // Ensure tags is an array
    if (!Array.isArray(product.tags)) {
        product.tags = [];
    }
    nextTick(() => {
        tagEditorRef.value?.focus();
    });
};

const closeTagEditor = () => {
    editingTags.value = null;
    editingTagsInput.value = '';
};

const saveTags = async (product) => {
    const tags = getTags(product);
    savingTags.value = true;
    try {
        await productAPI.updateProduct(product.product_id, { tags });
        toast.success(`Tags updated for "${product.product_name}"`);
        closeTagEditor();
    } catch (err) {
        console.error('Error saving tags:', err);
        toast.error(err.response?.data?.message || 'Failed to save tags');
    } finally {
        savingTags.value = false;
    }
};

const handleTagKeydown = (e, product) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        addCustomTag(product);
    } else if (e.key === 'Escape') {
        e.preventDefault();
        closeTagEditor();
    }
};

// ── Inline Editing ───────────────────────────────────────────────────────────
const editingCell = ref(null); // { productId, field, value }
const editInputRef = ref(null);

const startEditing = (product, field) => {
    const currentValue = field === 'product_name' ? product.product_name : product.base_price;
    editingCell.value = { productId: product.product_id, field, value: currentValue };
    // Focus input on next tick after Vue renders the input
    nextTick(() => {
        editInputRef.value?.focus();
        editInputRef.value?.select();
    });
};

const cancelEditing = () => {
    editingCell.value = null;
};

const saveEditing = async () => {
    if (!editingCell.value) return;
    const { productId, field, value } = editingCell.value;
    const product = products.value.find(p => p.product_id === productId);
    if (!product) { cancelEditing(); return; }

    // Validate
    if (field === 'product_name') {
        if (!value || String(value).trim().length === 0) {
            toast.warning('Product name cannot be empty');
            cancelEditing();
            return;
        }
        if (String(value).trim() === product.product_name) {
            cancelEditing();
            return;
        }
    }
    if (field === 'base_price') {
        const num = parseFloat(value);
        if (isNaN(num) || num <= 0) {
            toast.warning('Price must be greater than 0');
            cancelEditing();
            return;
        }
        if (num === product.base_price) {
            cancelEditing();
            return;
        }
    }

    try {
        const updateData = field === 'product_name'
            ? { product_name: String(value).trim() }
            : { base_price: parseFloat(value) };

        await productAPI.updateProduct(productId, updateData);

        // Update local state immediately
        product[field] = field === 'base_price' ? parseFloat(value) : String(value).trim();
        editingCell.value = null;
        toast.success(`Product ${field === 'product_name' ? 'name' : 'price'} updated`);
    } catch (err) {
        console.error('Inline edit error:', err);
        toast.error(err.response?.data?.message || 'Failed to save changes');
        editingCell.value = null;
    }
};

const handleEditKeydown = (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        saveEditing();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEditing();
    }
};

// ── Discount Management ─────────────────────────────────────────────────────
const showDiscountModal = ref(false);
const showDiscountForm = ref(false);
const discounts = ref([]);
const discountForm = ref({ product_id: null, discount_amount: '', start_date: '', end_date: '' });
const editingDiscount = ref(null);
const savingDiscount = ref(false);
const loadingDiscounts = ref(false);
const showDeleteDiscountConfirm = ref(false);
const deletingDiscount = ref(null);
const deletingDiscountLoading = ref(false);

const discountStatusStyle = (discount) => {
    const now = new Date();
    const start = new Date(discount.start_date);
    const end = new Date(discount.end_date);
    if (now < start) return { label: 'Scheduled', cls: 'bg-blue-50 text-blue-700 border-blue-200' };
    if (now > end) return { label: 'Expired', cls: 'bg-zinc-100 text-zinc-500 border-zinc-200' };
    return { label: 'Active', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
};

const openDiscountModal = async () => {
    showDiscountModal.value = true;
    loadingDiscounts.value = true;
    try {
        await refreshDiscounts();
    } finally {
        loadingDiscounts.value = false;
    }
};

const closeDiscountModal = () => {
    showDiscountModal.value = false;
    showDiscountForm.value = false;
    discountForm.value = { product_id: null, discount_amount: '', start_date: '', end_date: '' };
    editingDiscount.value = null;
};

const closeDiscountForm = () => {
    showDiscountForm.value = false;
    editingDiscount.value = null;
    discountForm.value = { product_id: null, discount_amount: '', start_date: '', end_date: '' };
};

const openDiscountForm = (discount) => {
    showDiscountForm.value = true;
    if (discount) {
        editingDiscount.value = discount;
        discountForm.value = {
            product_id: discount.product_id,
            discount_amount: discount.discount_amount,
            start_date: discount.start_date ? discount.start_date.split('T')[0] : '',
            end_date: discount.end_date ? discount.end_date.split('T')[0] : '',
        };
    } else {
        editingDiscount.value = null;
        discountForm.value = { product_id: null, discount_amount: '', start_date: '', end_date: '' };
    }
};

const refreshDiscounts = async () => {
    try {
        const res = await discountAPI.getAllDiscounts();
        if (res.success) discounts.value = res.data;
    } catch (err) {
        console.error('Failed to refresh discounts:', err);
    }
};

const saveDiscount = async () => {
    if (!discountForm.value.product_id || !discountForm.value.discount_amount ||
        !discountForm.value.start_date || !discountForm.value.end_date) {
        toast.warning('All fields are required');
        return;
    }
    savingDiscount.value = true;
    try {
        if (editingDiscount.value) {
            const res = await discountAPI.updateDiscount(editingDiscount.value.discount_id, {
                discount_amount: parseFloat(discountForm.value.discount_amount),
                start_date: discountForm.value.start_date,
                end_date: discountForm.value.end_date,
            });
            if (!res.success) { toast.error(res.message || 'Update failed'); return; }
            toast.success('Discount updated');
        } else {
            const res = await discountAPI.applyDiscount(discountForm.value.product_id, {
                discount_amount: parseFloat(discountForm.value.discount_amount),
                start_date: discountForm.value.start_date,
                end_date: discountForm.value.end_date,
            });
            if (!res.success) { toast.error(res.message || 'Create failed'); return; }
            toast.success('Discount created');
        }
        closeDiscountForm();
        await refreshDiscounts();
    } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to save discount');
    } finally {
        savingDiscount.value = false;
    }
};

const confirmDeleteDiscount = (discount) => {
    deletingDiscount.value = discount;
    showDeleteDiscountConfirm.value = true;
};

const executeDeleteDiscount = async () => {
    if (!deletingDiscount.value) return;
    deletingDiscountLoading.value = true;
    try {
        const res = await discountAPI.deleteDiscount(deletingDiscount.value.discount_id);
        if (res.success) {
            toast.success('Discount deleted');
            showDeleteDiscountConfirm.value = false;
            deletingDiscount.value = null;
            await openDiscountModal();
        } else {
            toast.error(res.message || 'Delete failed');
        }
    } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to delete discount');
    } finally {
        deletingDiscountLoading.value = false;
    }
};

const cancelDeleteDiscount = () => {
    showDeleteDiscountConfirm.value = false;
    deletingDiscount.value = null;
};

const formatDiscountDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

const pageSizeOptions = [10, 25, 50, 100];

// ── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(() => {
    fetchProducts();
    fetchCategories();
});
</script>

<template>
    <div class="min-h-screen bg-neutral-50">
        <div class="max-w-350 mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <!-- Header -->
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                    <span class="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-accent mb-2">
                        <Package class="w-3.5 h-3.5" />
                        Products
                    </span>
                    <h1 class="text-2xl sm:text-3xl font-bold text-ink">Product Management</h1>
                    <p class="text-neutral-500 mt-1 text-sm">Manage your product catalog</p>
                </div>
                <div class="flex items-center gap-3 w-full sm:w-auto">
                    <button @click="openDiscountModal" class="btn-outline text-sm gap-2 flex-1 sm:flex-none justify-center">
                        <Tag class="w-4 h-4" />
                        Discounts
                    </button>
                    <button @click="openAddProduct" class="btn-accent text-sm gap-2 shadow-sm flex-1 sm:flex-none justify-center">
                        <Plus class="w-4 h-4" />
                        Add Product
                    </button>
                </div>
            </div>

            <!-- Stats -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-5 mb-6">
                <div class="card-flat p-4 sm:p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-10 h-10 rounded-xl bg-info/10 inline-flex items-center justify-center transition-transform hover:scale-110">
                            <Boxes class="w-5 h-5 text-info" />
                        </div>
                    </div>
                    <p class="text-neutral-500 text-[10px] uppercase tracking-[0.15em] font-bold mb-0.5">Total</p>
                    <p class="text-2xl sm:text-3xl font-bold text-ink tabular-nums">{{ totalProducts }}</p>
                </div>
                <div class="card-flat p-4 sm:p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-10 h-10 rounded-xl bg-accent/10 inline-flex items-center justify-center">
                            <Package class="w-5 h-5 text-accent" />
                        </div>
                    </div>
                    <p class="text-neutral-500 text-[10px] uppercase tracking-[0.15em] font-bold mb-0.5">Active</p>
                    <p class="text-2xl sm:text-3xl font-bold text-accent tabular-nums">{{ activeProducts }}</p>
                </div>
                <div class="card-flat p-4 sm:p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-10 h-10 rounded-xl bg-warning/10 inline-flex items-center justify-center">
                            <Eye class="w-5 h-5 text-warning" />
                        </div>
                    </div>
                    <p class="text-neutral-500 text-[10px] uppercase tracking-[0.15em] font-bold mb-0.5">Draft</p>
                    <p class="text-2xl sm:text-3xl font-bold text-warning tabular-nums">{{ draftProducts }}</p>
                </div>
                <div class="card-flat p-4 sm:p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-10 h-10 rounded-xl bg-danger/10 inline-flex items-center justify-center">
                            <AlertCircle class="w-5 h-5 text-danger" />
                        </div>
                    </div>
                    <p class="text-neutral-500 text-[10px] uppercase tracking-[0.15em] font-bold mb-0.5">Inactive</p>
                    <p class="text-2xl sm:text-3xl font-bold text-danger tabular-nums">{{ inactiveProducts }}</p>
                </div>
            </div>

            <!-- Filters Bar -->
            <div class="card-flat p-4 sm:p-5 mb-6">
                <div class="flex flex-col lg:flex-row gap-4">
                    <!-- Search -->
                    <div class="flex-1 relative">
                        <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                        <input
                            v-model="searchQuery"
                            type="text"
                            placeholder="Search products..."
                            class="input-base pl-10 py-2.5 text-sm"
                            aria-label="Search products"
                        />
                        <button
                            v-if="searchQuery"
                            @click="clearFilters"
                            class="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-ink transition-colors"
                        >
                            <X class="w-4 h-4" />
                        </button>
                    </div>

                    <!-- Category Filter -->
                    <div class="relative">
                        <Filter class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                        <select
                            v-model="filterCategory"
                            @change="handleFilter"
                            class="input-base pl-10 py-2.5 text-sm min-w-40 appearance-none"
                            aria-label="Filter by category"
                        >
                            <option value="all">All Categories</option>
                            <option v-for="category in categories" :key="category.category_id" :value="category.name">
                                {{ category.name }}
                            </option>
                        </select>
                    </div>

                    <!-- Status Filter -->
                    <div class="relative">
                        <SlidersHorizontal class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                        <select
                            v-model="filterStatus"
                            @change="handleFilter"
                            class="input-base pl-10 py-2.5 text-sm min-w-35 appearance-none"
                            aria-label="Filter by status"
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="draft">Draft</option>
                            <option value="inactive">Inactive</option>
                            <option value="archived">Archived</option>
                        </select>
                    </div>

                    <!-- Stock Filter -->
                    <div class="relative">
                        <Boxes class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                        <select
                            v-model="filterStock"
                            @change="handleFilter"
                            class="input-base pl-10 py-2.5 text-sm min-w-35 appearance-none"
                            aria-label="Filter by stock status"
                        >
                            <option value="all">All Stock</option>
                            <option value="in_stock">In Stock</option>
                            <option value="low_stock">Low Stock</option>
                            <option value="out_of_stock">Out of Stock</option>
                        </select>
                    </div>

                    <!-- Active filters indicator + clear -->
                    <button
                        v-if="hasActiveFilters"
                        @click="clearFilters"
                        class="btn-ghost text-xs gap-1.5 shrink-0 px-3"
                    >
                        <X class="w-3.5 h-3.5" />
                        Clear filters
                    </button>
                </div>
            </div>

            <!-- Error State -->
            <div v-if="error && products.length === 0" class="card-flat border-l-4 border-l-danger p-5 sm:p-6 mb-6">
                <div class="flex items-center gap-4">
                    <AlertCircle class="w-10 h-10 text-danger shrink-0" />
                    <div class="flex-1 min-w-0">
                        <h3 class="font-bold text-ink text-sm">Error Loading Products</h3>
                        <p class="text-neutral-500 text-sm mt-0.5">{{ error }}</p>
                    </div>
                    <button @click="fetchProducts" class="btn-primary text-sm gap-1.5 shrink-0">
                        <RefreshCw class="w-3.5 h-3.5" />
                        Retry
                    </button>
                </div>
            </div>

            <!-- Loading State (initial) -->
            <div v-if="loading && products.length === 0" class="card-flat overflow-hidden">
                <div class="p-6 sm:p-8">
                    <!-- Skeleton Header -->
                    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                        <div class="space-y-3">
                            <div class="h-3 w-24 skeleton-shimmer rounded"></div>
                            <div class="h-7 w-48 skeleton-shimmer rounded-lg"></div>
                            <div class="h-4 w-36 skeleton-shimmer rounded"></div>
                        </div>
                        <div class="flex gap-3">
                            <div class="h-10 w-28 skeleton-shimmer rounded-full"></div>
                            <div class="h-10 w-32 skeleton-shimmer rounded-full"></div>
                        </div>
                    </div>

                    <!-- Skeleton Stats -->
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-5 mb-8">
                        <div v-for="i in 4" :key="'sk-stat-' + i" class="rounded-2xl border border-neutral-200 p-4 sm:p-5 space-y-3">
                            <div class="w-10 h-10 skeleton-shimmer rounded-xl"></div>
                            <div class="h-3 w-16 skeleton-shimmer rounded"></div>
                            <div class="h-7 w-20 skeleton-shimmer rounded"></div>
                        </div>
                    </div>

                    <!-- Skeleton Filters -->
                    <div class="rounded-2xl border border-neutral-200 p-4 sm:p-5 mb-8">
                        <div class="flex flex-col lg:flex-row gap-4">
                            <div class="flex-1 h-10 skeleton-shimmer rounded-xl"></div>
                            <div class="w-full lg:w-44 h-10 skeleton-shimmer rounded-xl"></div>
                            <div class="w-full lg:w-36 h-10 skeleton-shimmer rounded-xl"></div>
                            <div class="w-full lg:w-36 h-10 skeleton-shimmer rounded-xl"></div>
                        </div>
                    </div>

                    <!-- Skeleton Table -->
                    <div class="rounded-2xl border border-neutral-200 overflow-hidden">
                        <!-- Toolbar -->
                        <div class="px-4 sm:px-6 py-3 bg-neutral-50 border-b border-neutral-200">
                            <div class="flex items-center justify-between">
                                <div class="h-5 w-40 skeleton-shimmer rounded"></div>
                                <div class="flex gap-2">
                                    <div class="h-8 w-20 skeleton-shimmer rounded-lg"></div>
                                    <div class="h-8 w-20 skeleton-shimmer rounded-lg"></div>
                                </div>
                            </div>
                        </div>
                        <!-- Table Header -->
                        <div class="px-4 sm:px-6 py-3.5 bg-neutral-50 border-b border-neutral-200">
                            <div class="flex gap-6">
                                <div v-for="i in 7" :key="'sk-th-' + i" class="h-3 w-16 skeleton-shimmer rounded" :class="{ 'w-24': i === 1 }"></div>
                            </div>
                        </div>
                        <!-- Skeleton Rows -->
                        <div v-for="i in 4" :key="'sk-row-' + i" class="border-b border-neutral-200 last:border-b-0">
                            <div class="px-4 sm:px-6 py-4 flex items-center gap-4">
                                <div class="w-5 h-5 skeleton-shimmer rounded"></div>
                                <div class="w-12 h-12 skeleton-shimmer rounded-xl shrink-0"></div>
                                <div class="flex-1 space-y-2">
                                    <div class="h-4 w-48 skeleton-shimmer rounded"></div>
                                    <div class="h-3 w-32 skeleton-shimmer rounded"></div>
                                </div>
                                <div class="h-5 w-20 skeleton-shimmer rounded-full"></div>
                                <div class="h-5 w-16 skeleton-shimmer rounded"></div>
                                <div class="h-5 w-16 skeleton-shimmer rounded"></div>
                                <div class="h-5 w-20 skeleton-shimmer rounded-full"></div>
                                <div class="h-5 w-16 skeleton-shimmer rounded"></div>
                                <div class="flex gap-2">
                                    <div v-for="j in 3" :key="'sk-act-' + i + '-' + j" class="w-8 h-8 skeleton-shimmer rounded-full"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Filtered Empty State -->
            <div v-if="!loading && products.length === 0 && !error && totalProducts > 0" class="card-flat p-12 sm:p-16 text-center">
                <div class="w-20 h-20 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-5">
                    <Inbox class="w-9 h-9 text-warning" />
                </div>
                <h3 class="text-lg font-bold text-ink mb-2">No matching products</h3>
                <p class="text-sm text-neutral-500 mb-2 max-w-sm mx-auto">
                    No products match your current filters. Try adjusting your search or filter criteria.
                </p>
                <button @click="clearFilters" class="btn-outline text-sm gap-1.5 mt-3">
                    <X class="w-3.5 h-3.5" />
                    Clear filters
                </button>
            </div>

            <!-- Empty State -->
            <div v-else-if="!loading && products.length === 0 && !error && totalProducts === 0" class="card-flat p-12 sm:p-16 text-center">
                <div class="w-24 h-24 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-6">
                    <Package class="w-11 h-11 text-neutral-300" />
                </div>
                <h3 class="text-xl font-bold text-ink mb-2">No products yet</h3>
                <p class="text-sm text-neutral-500 mb-6 max-w-sm mx-auto">
                    Get started by adding your first product to the catalog. You can add images, variants, and more.
                </p>
                <button @click="openAddProduct" class="btn-accent text-sm gap-2 shine-effect">
                    <Plus class="w-4 h-4" />
                    Add your first product
                </button>
            </div>

            <!-- Products Table -->
            <div v-else class="card-flat overflow-hidden">
                <!-- Bulk Actions Toolbar -->
                <div
                    v-if="hasSelectedItems"
                    class="bg-ink text-paper px-4 sm:px-6 py-3 flex items-center justify-between gap-4 flex-wrap"
                >
                    <div class="flex items-center gap-3">
                        <CheckSquare class="w-5 h-5 text-accent" />
                        <span class="text-sm font-semibold tabular-nums">{{ selectedIds.size }}</span>
                        <span class="text-sm text-neutral-400">selected</span>
                        <button @click="clearSelection" class="text-xs text-neutral-400 hover:text-paper underline underline-offset-2 transition-colors">
                            Clear
                        </button>
                    </div>
                    <div class="flex items-center gap-2">
                        <select
                            v-model="bulkNewStatus"
                            class="bg-paper/10 text-paper border border-paper/20 rounded-lg px-3 py-1.5 text-xs font-semibold"
                            aria-label="Bulk status change"
                        >
                            <option value="active">Active</option>
                            <option value="draft">Draft</option>
                            <option value="inactive">Inactive</option>
                            <option value="archived">Archived</option>
                        </select>
                        <button
                            @click="showBulkStatusModal = true"
                            class="px-3 py-1.5 bg-paper/10 hover:bg-paper/20 rounded-lg text-xs font-bold transition-colors"
                        >
                            Change Status
                        </button>
                        <button
                            @click="executeBulkDelete"
                            class="px-3 py-1.5 bg-danger/20 hover:bg-danger/30 text-danger rounded-lg text-xs font-bold transition-colors"
                        >
                            <Trash2 class="w-3.5 h-3.5 inline mr-1" />
                            Delete
                        </button>
                    </div>
                </div>

                <!-- Table Controls (per-page, export, import) -->
                <div class="px-4 sm:px-6 py-3 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between gap-4 flex-wrap">
                    <div class="flex items-center gap-4 text-sm">
                        <div class="flex items-center gap-2">
                            <span class="text-neutral-500 text-xs">Show</span>
                            <select
                                v-model="pageSize"
                                @change="changePageSize"
                                class="bg-paper border border-neutral-200 rounded-lg px-2 py-1.5 text-xs font-semibold text-ink"
                                aria-label="Products per page"
                            >
                                <option v-for="opt in pageSizeOptions" :key="opt" :value="opt">{{ opt }}</option>
                            </select>
                            <span class="text-neutral-500 text-xs">per page</span>
                        </div>
                        <span class="text-neutral-400 hidden sm:inline">·</span>
                        <span class="text-neutral-500 text-xs hidden sm:inline">
                            {{ totalProducts }} total product{{ totalProducts !== 1 ? 's' : '' }}
                        </span>
                    </div>
                    <div class="flex items-center gap-2">
                        <button
                            @click="exportCSV"
                            class="btn-ghost text-xs gap-1.5"
                            :disabled="products.length === 0"
                        >
                            <Download class="w-3.5 h-3.5" />
                            Export CSV
                        </button>
                        <button
                            @click="openImportModal"
                            class="btn-ghost text-xs gap-1.5"
                        >
                            <Upload class="w-3.5 h-3.5" />
                            Import CSV
                        </button>
                        <button
                            @click="fetchProducts"
                            class="btn-ghost text-xs gap-1.5"
                            :disabled="loading"
                        >
                            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loading }" />
                        </button>
                    </div>
                </div>

                <!-- Mobile Card List (below lg) -->
                <div v-if="!isDesktop" class="divide-y divide-neutral-100">
                    <!-- eslint-disable-next-line vue/no-v-for-template-key -->
                    <template v-for="product in products" :key="'m-' + product.product_id">
                        <div
                            class="px-4 py-3.5 transition-colors"
                            :class="{ 'bg-accent/5': selectedIds.has(product.product_id) }"
                        >
                            <!-- Thumb + name + expand -->
                            <div class="flex items-start gap-3">
                                <button
                                    @click="toggleSelect(product.product_id)"
                                    class="p-1 mt-0.5 shrink-0"
                                    :aria-label="'Select ' + product.product_name"
                                >
                                    <CheckSquare v-if="selectedIds.has(product.product_id)" class="w-4 h-4 text-accent" />
                                    <Square v-else class="w-4 h-4 text-neutral-300 hover:text-neutral-500 transition-colors" />
                                </button>

                                <button
                                    @click="openImagePreview(product.thumbnail)"
                                    class="w-11 h-11 bg-neutral-100 rounded-lg overflow-hidden shrink-0 border border-neutral-200/80 hover:border-accent transition-colors"
                                >
                                    <LazyImage
                                        v-if="product.thumbnail"
                                        :src="product.thumbnail"
                                        :alt="product.product_name"
                                        wrapper-class="w-full h-full"
                                        img-class="w-full h-full object-cover"
                                    />
                                    <div v-else class="w-full h-full flex items-center justify-center">
                                        <ImageIcon class="w-5 h-5 text-neutral-300" />
                                    </div>
                                </button>

                                <div class="min-w-0 flex-1">
                                    <p class="font-semibold text-ink text-sm leading-tight truncate">{{ product.product_name }}</p>
                                    <p class="text-[11px] text-neutral-400 mt-0.5 truncate">{{ truncateText(product.description, 48) }}</p>
                                    <span class="inline-block mt-1 px-2 py-0.5 bg-neutral-100 text-neutral-500 rounded-md text-[10px] font-semibold uppercase tracking-wide">
                                        {{ product.category_name || 'N/A' }}
                                    </span>
                                </div>

                                <button
                                    @click="toggleExpandVariants(product.product_id)"
                                    class="p-1.5 shrink-0 text-neutral-400 hover:text-ink transition-colors"
                                    :aria-label="'Toggle variants for ' + product.product_name"
                                >
                                    <ChevronRight
                                        class="w-4 h-4 transition-transform duration-200"
                                        :class="{ 'rotate-90': expandedProducts.has(product.product_id) }"
                                    />
                                </button>
                            </div>

                            <!-- Price / Stock -->
                            <div class="mt-3 flex items-center gap-5">
                                <div class="flex items-baseline gap-1.5">
                                    <span class="text-[10px] uppercase tracking-wide font-semibold text-neutral-400">Price</span>
                                    <span class="text-sm font-bold text-ink tabular-nums">${{ formatPrice(product.base_price) }}</span>
                                </div>
                                <div class="flex items-center gap-1.5">
                                    <span class="text-[10px] uppercase tracking-wide font-semibold text-neutral-400">Stock</span>
                                    <span class="text-sm font-bold text-ink tabular-nums">{{ product.total_stock || 0 }}</span>
                                    <span :class="['px-1.5 py-0.5 rounded-md text-[9px] font-semibold border', stockStatus(product.total_stock).class]">
                                        {{ stockStatus(product.total_stock).label }}
                                    </span>
                                </div>
                            </div>

                            <!-- Tags -->
                            <div v-if="(getTags(product) || []).length > 0" class="mt-3 flex flex-wrap items-center gap-1.5">
                                <span
                                    v-for="tag in (getTags(product) || [])"
                                    :key="tag"
                                    class="px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded-md text-[10px] font-semibold whitespace-nowrap"
                                >
                                    {{ tag }}
                                </span>
                            </div>

                            <!-- Status + actions -->
                            <div class="mt-3 flex items-center justify-between gap-3">
                                <select
                                    :value="product.product_status"
                                    @change="quickStatusChange(product, $event.target.value)"
                                    :class="['px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide border appearance-none cursor-pointer pr-5', statusStyles[product.product_status] || 'bg-neutral-100 text-neutral-600']"
                                    aria-label="Change product status"
                                >
                                    <option value="active">Active</option>
                                    <option value="draft">Draft</option>
                                    <option value="inactive">Inactive</option>
                                    <option value="archived">Archived</option>
                                </select>
                                <div class="flex items-center gap-1">
                                    <button @click="viewProduct(product)" class="btn-ghost p-1.5 rounded-lg text-neutral-400 hover:text-info transition-colors" title="View product">
                                        <Eye class="w-4 h-4" />
                                    </button>
                                    <button @click="openEditProduct(product)" class="btn-ghost p-1.5 rounded-lg text-neutral-400 hover:text-ink transition-colors" title="Edit product">
                                        <Pencil class="w-4 h-4" />
                                    </button>
                                    <button @click="openDeleteModal(product)" class="btn-ghost p-1.5 rounded-lg text-neutral-400 hover:text-danger transition-colors" title="Delete product">
                                        <Trash2 class="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <!-- Expanded variants -->
                            <div v-if="expandedProducts.has(product.product_id)" class="mt-3 bg-neutral-50 rounded-lg p-3">
                                <div v-if="loadingVariants.has(product.product_id)" class="flex items-center gap-2 text-xs text-neutral-500 py-2">
                                    <Loader2 class="w-4 h-4 animate-spin text-accent" />
                                    Loading variants...
                                </div>
                                <p v-else-if="!productVariants[product.product_id] || productVariants[product.product_id].length === 0" class="text-xs text-neutral-400 py-2">
                                    No variants defined for this product.
                                </p>
                                <div v-else class="space-y-2">
                                    <div
                                        v-for="variant in productVariants[product.product_id]"
                                        :key="variant.variant_id"
                                        class="bg-paper rounded-lg border border-neutral-200 p-2.5"
                                    >
                                        <div class="flex items-center justify-between gap-2">
                                            <span class="text-xs font-mono text-ink truncate">{{ variant.sku || '—' }}</span>
                                            <span class="text-xs font-bold text-ink tabular-nums whitespace-nowrap">
                                                {{ variant.variant_price != null && variant.variant_price !== '' ? '$' + formatPrice(variant.variant_price) : '—' }}
                                            </span>
                                        </div>
                                        <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
                                            <span v-if="variant.variant_color" class="px-1.5 py-0.5 bg-neutral-100 rounded text-[10px] font-semibold text-neutral-700">{{ variant.variant_color }}</span>
                                            <span v-if="variant.variant_size" class="px-1.5 py-0.5 bg-neutral-100 rounded text-[10px] font-semibold text-neutral-700">{{ variant.variant_size }}</span>
                                            <span v-if="variant.variant_storage" class="px-1.5 py-0.5 bg-neutral-100 rounded text-[10px] font-semibold text-neutral-700">{{ variant.variant_storage }}</span>
                                            <span class="ml-auto text-[10px] text-neutral-500">Stock: <strong class="text-ink tabular-nums">{{ variant.quantity || 0 }}</strong></span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </template>
                </div>

                <div v-else class="overflow-x-auto">
                    <table class="w-full min-w-225">
                        <thead class="bg-neutral-50/60 border-b border-neutral-200">
                            <tr>
                                <!-- Checkbox -->
                                <!-- Expand -->
                                <th class="px-2 sm:px-3 py-3 w-10"></th>
                                <!-- Checkbox -->
                                <th class="px-2 sm:px-3 py-3 w-12">
                                    <button @click="toggleSelectAll" class="p-0.5">
                                        <CheckSquare v-if="allSelectedOnPage" class="w-4 h-4 text-accent" />
                                        <Square v-else-if="someSelectedOnPage" class="w-4 h-4 text-accent opacity-60" />
                                        <Square v-else class="w-4 h-4 text-neutral-300 hover:text-neutral-500 transition-colors" />
                                    </button>
                                </th>
                                <!-- Product -->
                                <th class="px-4 sm:px-5 py-3 text-left">
                                    <button @click="toggleSort('product_name')" class="inline-flex items-center gap-1.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-[0.12em] hover:text-ink transition-colors">
                                        Product
                                        <component :is="sortIcon('product_name')" class="w-3 h-3" />
                                    </button>
                                </th>
                                <!-- Category -->
                                <th class="px-4 sm:px-5 py-3 text-left text-[10px] font-semibold text-neutral-400 uppercase tracking-[0.12em]">
                                    Category
                                </th>
                                <!-- Price -->
                                <th class="px-4 sm:px-5 py-3 text-left">
                                    <button @click="toggleSort('base_price')" class="inline-flex items-center gap-1.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-[0.12em] hover:text-ink transition-colors">
                                        Price
                                        <component :is="sortIcon('base_price')" class="w-3 h-3" />
                                    </button>
                                </th>
                                <!-- Stock -->
                                <th class="px-4 sm:px-5 py-3 text-left text-[10px] font-semibold text-neutral-400 uppercase tracking-[0.12em]">
                                    Stock
                                </th>
                                <!-- Tags -->
                                <th class="px-4 sm:px-5 py-3 text-left text-[10px] font-semibold text-neutral-400 uppercase tracking-[0.12em]">
                                    Tags
                                </th>
                                <!-- Status -->
                                <th class="px-4 sm:px-5 py-3 text-left">
                                    <button @click="toggleSort('product_status')" class="inline-flex items-center gap-1.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-[0.12em] hover:text-ink transition-colors">
                                        Status
                                        <component :is="sortIcon('product_status')" class="w-3 h-3" />
                                    </button>
                                </th>
                                <!-- Created -->
                                <th class="px-4 sm:px-5 py-3 text-left">
                                    <button @click="toggleSort('created_at')" class="inline-flex items-center gap-1.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-[0.12em] hover:text-ink transition-colors">
                                        Created
                                        <component :is="sortIcon('created_at')" class="w-3 h-3" />
                                    </button>
                                </th>
                                <!-- Actions -->
                                <th class="px-4 sm:px-5 py-3 text-right text-[10px] font-semibold text-neutral-400 uppercase tracking-[0.12em]">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-neutral-100">
                            <!-- eslint-disable-next-line vue/no-v-for-template-key -->
                            <template v-for="product in products" :key="product.product_id">
                            <!-- Product Row -->
                            <tr
                                class="hover:bg-neutral-50/70 transition-colors group cursor-pointer"
                                :class="{
                                    'bg-accent/5': selectedIds.has(product.product_id),
                                    'border-b-0': expandedProducts.has(product.product_id)
                                }"
                                @click="toggleExpandVariants(product.product_id)"
                            >
                                <!-- Expand Toggle -->
                                <td class="px-2 sm:px-3 py-2.5 w-10">
                                    <ChevronRight
                                        class="w-4 h-4 text-neutral-400 transition-transform duration-200"
                                        :class="{ 'rotate-90': expandedProducts.has(product.product_id) }"
                                    />
                                </td>

                                <!-- Checkbox -->
                                <td class="px-2 sm:px-3 py-2.5" @click.stop>
                                    <button @click="toggleSelect(product.product_id)" class="p-0.5">
                                        <CheckSquare v-if="selectedIds.has(product.product_id)" class="w-4 h-4 text-accent" />
                                        <Square v-else class="w-4 h-4 text-neutral-300 group-hover:text-neutral-400 transition-colors" />
                                    </button>
                                </td>

                                <!-- Product -->
                                <td class="px-4 sm:px-5 py-2.5">
                                    <div class="flex items-center gap-3">
                                        <button
                                            @click="openImagePreview(product.thumbnail)"
                                            class="group w-9 h-9 sm:w-10 sm:h-10 bg-neutral-100 rounded-lg overflow-hidden shrink-0 border border-neutral-200/80 hover:border-accent transition-colors relative"
                                        >
                                            <LazyImage
                                                v-if="product.thumbnail"
                                                :src="product.thumbnail"
                                                :alt="product.product_name"
                                                wrapper-class="w-full h-full"
                                                img-class="w-full h-full object-cover"
                                            />
                                            <div
                                                v-else
                                                class="w-full h-full flex items-center justify-center"
                                            >
                                                <ImageIcon class="w-5 h-5 text-neutral-300" />
                                            </div>
                                            <div class="hidden group-hover:flex absolute inset-0 bg-ink/40 items-center justify-center rounded-lg transition-all">
                                                <Eye class="w-4 h-4 text-paper" />
                                            </div>
                                        </button>
                                        <div class="min-w-0 flex-1">
                                            <!-- Inline Edit: Name -->
                                            <div v-if="editingCell?.productId === product.product_id && editingCell?.field === 'product_name'"
                                                 class="flex items-center" @click.stop>
                                                <input
                                                    ref="editInputRef"
                                                    v-model="editingCell.value"
                                                    type="text"
                                                    class="w-full px-2 py-1 text-sm font-semibold text-ink bg-paper border-2 border-accent rounded-lg outline-none"
                                                    @keydown="handleEditKeydown"
                                                    @blur="saveEditing"
                                                    @click.stop
                                                />
                                            </div>
                                            <!-- Display: Name -->
                                            <div v-else
                                                 class="group/name flex items-center gap-1.5 cursor-pointer"
                                                 @click.stop="startEditing(product, 'product_name')"
                                                 title="Click to edit name">
                                                <p class="font-semibold text-ink text-sm leading-tight truncate max-w-25 sm:max-w-62">
                                                    {{ product.product_name }}
                                                </p>
                                                <Pencil class="w-3 h-3 text-neutral-300 opacity-0 group-hover/name:opacity-100 transition-opacity shrink-0" />
                                            </div>
                                            <p class="text-[11px] text-neutral-400 mt-0.5 truncate max-w-25 sm:max-w-62">
                                                {{ truncateText(product.description, 40) }}
                                            </p>
                                        </div>
                                    </div>
                                </td>

                                <!-- Category -->
                                <td class="px-4 sm:px-5 py-2.5">
                                    <span class="px-2 py-0.5 bg-neutral-100 text-neutral-500 rounded-md text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap">
                                        {{ product.category_name || 'N/A' }}
                                    </span>
                                </td>

                                <!-- Price -->
                                <td class="px-4 sm:px-5 py-2.5">
                                    <!-- Inline Edit: Price -->
                                    <div v-if="editingCell?.productId === product.product_id && editingCell?.field === 'base_price'"
                                         class="flex items-center" @click.stop>
                                        <span class="text-sm font-bold text-ink mr-1">$</span>
                                        <input
                                            ref="editInputRef"
                                            v-model="editingCell.value"
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            class="w-24 px-2 py-1 text-sm font-bold text-ink bg-paper border-2 border-accent rounded-lg outline-none tabular-nums"
                                            @keydown="handleEditKeydown"
                                            @blur="saveEditing"
                                            @click.stop
                                        />
                                    </div>
                                    <!-- Display: Price -->
                                    <div v-else
                                         class="group/price inline-flex items-center gap-1.5 cursor-pointer"
                                         @click.stop="startEditing(product, 'base_price')"
                                         title="Click to edit price">
                                        <span class="font-bold text-ink tabular-nums">${{ formatPrice(product.base_price) }}</span>
                                        <Pencil class="w-3 h-3 text-neutral-300 opacity-0 group-hover/price:opacity-100 transition-opacity shrink-0" />
                                    </div>
                                </td>

                                <!-- Stock -->
                                <td class="px-4 sm:px-5 py-2.5">
                                    <div class="flex items-center gap-2">
                                        <span class="font-bold text-ink tabular-nums text-sm">{{ product.total_stock || 0 }}</span>
                                        <span
                                            :class="['px-2 py-0.5 rounded-md text-[10px] font-semibold border', stockStatus(product.total_stock).class]"
                                            class="hidden sm:inline"
                                        >
                                            {{ stockStatus(product.total_stock).label }}
                                        </span>
                                    </div>
                                </td>

                                <!-- Tags -->
                                <td class="px-4 sm:px-6 py-3 max-w-40" @click.stop>
                                    <!-- Inline Tag Editor -->
                                    <div v-if="editingTags === product.product_id" class="space-y-2 min-w-52">
                                        <!-- Common tag toggles -->
                                        <div class="flex flex-wrap gap-1">
                                            <button
                                                v-for="tag in COMMON_TAGS"
                                                :key="tag"
                                                @click="toggleTag(product, tag)"
                                                class="px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all duration-150"
                                                :class="(getTags(product) || []).includes(tag)
                                                    ? 'bg-accent text-white border-accent'
                                                    : 'bg-paper text-neutral-500 border-neutral-200 hover:border-accent hover:text-accent'"
                                            >
                                                {{ tag }}
                                            </button>
                                        </div>
                                        <!-- Custom tag input -->
                                        <div class="flex items-center gap-1.5">
                                            <input
                                                ref="tagEditorRef"
                                                v-model="editingTagsInput"
                                                type="text"
                                                placeholder="Add custom tag..."
                                                class="flex-1 px-2 py-1 text-xs bg-paper border border-neutral-200 rounded-lg focus:border-accent focus:ring-1 focus:ring-accent/20 outline-none transition-all"
                                                @keydown="handleTagKeydown($event, product)"
                                            />
                                            <button
                                                @click="addCustomTag(product)"
                                                class="px-2 py-1 bg-neutral-100 hover:bg-accent hover:text-white rounded-lg text-xs font-bold transition-all"
                                                :disabled="!editingTagsInput.trim()"
                                            >
                                                Add
                                            </button>
                                        </div>
                                        <!-- Current tags preview -->
                                        <div v-if="(getTags(product) || []).length > 0" class="flex flex-wrap gap-1 pt-1">
                                            <span
                                                v-for="tag in (getTags(product) || [])"
                                                :key="tag"
                                                class="inline-flex items-center gap-1 px-2 py-0.5 bg-ink text-paper rounded-full text-[10px] font-bold"
                                            >
                                                {{ tag }}
                                                <button @click="toggleTag(product, tag)" class="hover:text-danger transition-colors">
                                                    <X class="w-2.5 h-2.5" />
                                                </button>
                                            </span>
                                        </div>
                                        <!-- Actions -->
                                        <div class="flex gap-1.5 pt-1">
                                            <button
                                                @click="saveTags(product)"
                                                :disabled="savingTags"
                                                class="px-3 py-1 bg-accent text-white rounded-lg text-[10px] font-bold hover:bg-accent-600 transition-all disabled:opacity-50"
                                            >
                                                {{ savingTags ? 'Saving...' : 'Save' }}
                                            </button>
                                            <button
                                                @click="closeTagEditor"
                                                class="px-3 py-1 bg-neutral-100 text-neutral-600 rounded-lg text-[10px] font-bold hover:bg-neutral-200 transition-all"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                    <!-- Display tags as chips -->
                                    <div v-else class="flex items-center gap-1.5 flex-wrap">
                                        <template v-if="(getTags(product) || []).length > 0">
                                            <span
                                                v-for="tag in (getTags(product) || []).slice(0, 3)"
                                                :key="tag"
                                                class="px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded-md text-[10px] font-semibold whitespace-nowrap"
                                            >
                                                {{ tag }}
                                            </span>
                                            <span
                                                v-if="(getTags(product) || []).length > 3"
                                                class="text-[10px] text-neutral-400 font-bold"
                                            >
                                                +{{ (getTags(product) || []).length - 3 }}
                                            </span>
                                        </template>
                                        <span v-else class="text-xs text-neutral-300 italic">—</span>
                                        <button
                                            @click="openTagEditor(product)"
                                            class="ml-0.5 p-0.5 rounded text-neutral-300 hover:text-accent hover:bg-accent/10 transition-all opacity-0 group-hover:opacity-100"
                                            title="Edit tags"
                                        >
                                            <Pencil class="w-3 h-3" />
                                        </button>
                                    </div>
                                </td>

                                <!-- Status (with quick toggle) -->
                                <td class="px-4 sm:px-5 py-2.5">
                                    <select
                                        :value="product.product_status"
                                        @change="quickStatusChange(product, $event.target.value)"
                                        :class="['px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide border appearance-none cursor-pointer pr-5 min-w-20', statusStyles[product.product_status] || 'bg-neutral-100 text-neutral-600']"
                                    >
                                        <option value="active">Active</option>
                                        <option value="draft">Draft</option>
                                        <option value="inactive">Inactive</option>
                                        <option value="archived">Archived</option>
                                    </select>
                                </td>

                                <!-- Created -->
                                <td class="px-4 sm:px-5 py-2.5">
                                    <span class="text-[11px] text-neutral-400 whitespace-nowrap">{{ formatDate(product.created_at) }}</span>
                                </td>

                                <!-- Actions -->
                                <td class="px-4 sm:px-6 py-3 text-right">
                                    <div class="flex items-center justify-end gap-1">
                                        <button
                                            @click="viewProduct(product)"
                                            class="btn-ghost p-1.5 rounded-lg text-neutral-400 hover:text-info transition-colors"
                                            title="View product"
                                        >
                                            <Eye class="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            @click="openEditProduct(product)"
                                            class="btn-ghost p-1.5 rounded-lg text-neutral-400 hover:text-ink transition-colors"
                                            title="Edit product"
                                        >
                                            <Pencil class="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            @click="openDeleteModal(product)"
                                            class="btn-ghost p-1.5 rounded-lg text-neutral-400 hover:text-danger transition-colors"
                                            title="Delete product"
                                        >
                                            <Trash2 class="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            <!-- Variant Rows (expandable) -->
                            <tr v-if="expandedProducts.has(product.product_id)" class="border-b border-neutral-100">
                                <td colspan="10" class="px-4 sm:px-5 py-0 bg-neutral-50/40">
                                    <div class="py-4 pl-12 sm:pl-14">
                                        <!-- Loading variants -->
                                        <div v-if="loadingVariants.has(product.product_id)" class="flex items-center gap-3 text-sm text-neutral-500 py-3">
                                            <Loader2 class="w-4 h-4 animate-spin text-accent" />
                                            Loading variants...
                                        </div>
                                        <!-- No variants -->
                                        <div v-else-if="!productVariants[product.product_id] || productVariants[product.product_id].length === 0" class="text-sm text-neutral-400 py-3">
                                            No variants defined for this product.
                                        </div>
                                        <!-- Variants table -->
                                        <div v-else class="overflow-x-auto">
                                            <table class="w-full min-w-125">
                                                <thead>
                                                    <tr class="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                                                        <th class="px-3 py-2 text-left">SKU</th>
                                                        <th class="px-3 py-2 text-left">Options</th>
                                                        <th class="px-3 py-2 text-right">Price</th>
                                                        <th class="px-3 py-2 text-right">Stock</th>
                                                        <th class="px-3 py-2 text-right">Reorder Level</th>
                                                    </tr>
                                                </thead>
                                                <tbody class="divide-y divide-neutral-100">
                                                    <tr v-for="variant in productVariants[product.product_id]" :key="variant.variant_id" class="hover:bg-neutral-50 transition-colors">
                                                        <td class="px-3 py-2.5">
                                                            <span class="text-sm font-mono text-ink">{{ variant.sku || '—' }}</span>
                                                        </td>
                                                        <td class="px-3 py-2.5">
                                                            <div class="flex items-center gap-2">
                                                                <span v-if="variant.variant_color" class="px-2 py-0.5 bg-neutral-100 rounded text-[10px] font-semibold text-neutral-700">
                                                                    {{ variant.variant_color }}
                                                                </span>
                                                                <span v-if="variant.variant_size" class="px-2 py-0.5 bg-neutral-100 rounded text-[10px] font-semibold text-neutral-700">
                                                                    {{ variant.variant_size }}
                                                                </span>
                                                                <span v-if="variant.variant_storage" class="px-2 py-0.5 bg-neutral-100 rounded text-[10px] font-semibold text-neutral-700">
                                                                    {{ variant.variant_storage }}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <!-- Variant Price (Inline Edit) -->
                                                        <td class="px-3 py-2.5 text-right">
                                                            <div v-if="editingVariantPrice?.variantId === variant.variant_id" class="inline-flex items-center" @click.stop>
                                                                <span class="text-sm font-bold text-ink mr-1">$</span>
                                                                <input
                                                                    ref="variantPriceInputRef"
                                                                    v-model="editingVariantPrice.value"
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    class="w-22 px-2 py-1 text-sm font-bold text-ink bg-paper border-2 border-accent rounded-lg outline-none tabular-nums"
                                                                    @keydown="handleVariantPriceKeydown"
                                                                    @blur="saveVariantPrice"
                                                                    @click.stop
                                                                />
                                                            </div>
                                                            <div v-else
                                                                 class="group/price inline-flex items-center gap-1.5 cursor-pointer justify-end"
                                                                 @click.stop="startEditingVariantPrice(variant, product.product_id)"
                                                                 title="Click to edit variant price">
                                                                <span class="text-sm font-bold text-ink tabular-nums">
                                                                    {{ variant.variant_price != null && variant.variant_price !== '' ? '$' + formatPrice(variant.variant_price) : '—' }}
                                                                </span>
                                                                <Pencil class="w-3 h-3 text-neutral-300 opacity-0 group-hover/price:opacity-100 transition-opacity shrink-0" />
                                                            </div>
                                                        </td>
                                                        <td class="px-3 py-2.5 text-right">
                                                            <span class="font-bold text-ink tabular-nums text-sm">{{ variant.quantity || 0 }}</span>
                                                        </td>
                                                        <td class="px-3 py-2.5 text-right">
                                                            <span class="text-sm text-neutral-600 tabular-nums">{{ variant.reorder_level || 5 }}</span>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                            </template>
                        </tbody>
                    </table>
                </div>

                <!-- Empty State (kept as fallback) -->

                <!-- Pagination -->
                <div v-if="totalPages > 1" class="border-t border-neutral-200 px-4 sm:px-6 py-4">
                    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div class="text-xs text-neutral-500 text-center sm:text-left">
                            Showing <span class="font-semibold text-ink">{{ paginationStart }}</span>
                            – <span class="font-semibold text-ink">{{ paginationEnd }}</span>
                            of <span class="font-semibold text-ink">{{ totalProducts }}</span> products
                        </div>
                        <div class="flex items-center justify-center gap-1">
                            <button
                                @click="prevPage"
                                :disabled="currentPage === 1"
                                class="w-9 h-9 rounded-lg flex items-center justify-center text-neutral-500 hover:bg-neutral-100 hover:text-ink transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
                                aria-label="Previous page"
                            >
                                <ChevronLeft class="w-4 h-4" />
                            </button>
                                <button
                                    v-for="page in getPageNumbers()"
                                    :key="page"
                                    @click="goToPage(page)"
                                    class="min-w-9 h-9 rounded-lg text-sm font-bold transition-all duration-150 active:scale-90"
                                    :class="page === currentPage
                                        ? 'bg-ink text-paper shadow-sm scale-105'
                                        : 'text-neutral-500 hover:bg-neutral-100 hover:text-ink'"
                                >
                                    {{ page }}
                                </button>
                            <button
                                @click="nextPage"
                                :disabled="currentPage === totalPages"
                                class="w-9 h-9 rounded-lg flex items-center justify-center text-neutral-500 hover:bg-neutral-100 hover:text-ink transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
                                aria-label="Next page"
                            >
                                <ChevronRight class="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Image Preview Modal -->
        <transition name="modal">
            <div
                v-if="showImagePreview"
                @click="closeImagePreview"
                class="fixed inset-0 bg-ink/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
            >
                <div @click.stop class="relative max-w-3xl max-h-[90vh] w-full animate-[scale-in_0.25s_ease-out]">
                    <button
                        @click="closeImagePreview"
                        class="absolute -top-3 -right-3 w-10 h-10 bg-paper rounded-full shadow-lg flex items-center justify-center hover:bg-neutral-100 transition-colors z-10"
                    >
                        <X class="w-5 h-5" />
                    </button>
                    <img
                        :src="previewImage"
                        alt="Product image preview"
                        class="w-full h-auto max-h-[85vh] object-contain rounded-2xl shadow-2xl"
                    />
                </div>
            </div>
        </transition>

        <!-- CSV Import Modal -->
        <div
            v-if="showImportModal"
            @click="showImportModal = false"
            class="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
            <div @click.stop class="card-flat p-5 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-[scale-in_0.25s_ease-out]">
                <div class="flex items-center justify-between mb-6">
                    <div>
                        <span class="text-[10px] uppercase tracking-[0.2em] text-accent font-bold">Import</span>
                        <h2 class="text-xl font-bold text-ink mt-1">Import Products from CSV</h2>
                    </div>
                    <button @click="showImportModal = false" class="btn-ghost p-1.5 -mr-1.5">
                        <X class="w-5 h-5" />
                    </button>
                </div>

                <!-- Results after import -->
                <div v-if="importResults" class="mb-6">
                    <div class="bg-success/10 border border-success/20 rounded-xl p-4 mb-4">
                        <p class="text-sm font-bold text-success">Import Complete</p>
                        <p class="text-sm text-neutral-600 mt-1">
                            {{ importResults.created || 0 }} product(s) created,
                            {{ importResults.failed || 0 }} failed
                        </p>
                    </div>
                    <button @click="showImportModal = false" class="btn-accent text-sm">Done</button>
                </div>

                <!-- Import form -->
                <div v-else class="space-y-5">
                    <div class="bg-neutral-50 rounded-xl p-4">
                        <p class="text-xs font-bold text-ink mb-2">CSV Format</p>
                        <p class="text-xs text-neutral-500 leading-relaxed">
                            Your CSV should include headers: <code class="bg-neutral-200 px-1 rounded text-[10px]">name</code>,
                            <code class="bg-neutral-200 px-1 rounded text-[10px]">price</code>,
                            <code class="bg-neutral-200 px-1 rounded text-[10px]">category</code> (optional),
                            <code class="bg-neutral-200 px-1 rounded text-[10px]">status</code> (optional).
                        </p>
                    </div>

                    <!-- File Upload -->
                    <div>
                        <label class="block text-xs font-bold uppercase tracking-[0.15em] text-ink mb-2">Select CSV File</label>
                        <div class="border-2 border-dashed border-neutral-300 rounded-xl p-8 text-center hover:border-accent transition-colors cursor-pointer"
                             @click="fileInput?.click()">
                            <Upload class="w-8 h-8 text-neutral-400 mx-auto mb-3" />
                            <p class="text-sm text-neutral-600 font-medium">
                                {{ importFile ? importFile.name : 'Click to upload CSV' }}
                            </p>
                            <p class="text-xs text-neutral-400 mt-1">.csv files only</p>
                            <input ref="fileInput" type="file" accept=".csv" @change="handleImportFile" class="hidden" @click.stop />
                        </div>
                    </div>

                    <!-- Errors -->
                    <div v-if="importErrors.length > 0" class="bg-danger/10 border border-danger/20 rounded-xl p-4">
                        <p class="text-xs font-bold text-danger mb-2">Errors</p>
                        <ul class="space-y-1">
                            <li v-for="(err, i) in importErrors" :key="i" class="text-xs text-danger">{{ err }}</li>
                        </ul>
                    </div>

                    <!-- Preview -->
                    <div v-if="importPreview.length > 0">
                        <div class="flex items-center justify-between mb-3">
                            <p class="text-xs font-bold uppercase tracking-[0.15em] text-ink">
                                Preview: {{ importPreview.length }} product(s)
                            </p>
                        </div>
                        <div class="overflow-x-auto max-h-48 overflow-y-auto border border-neutral-200 rounded-xl">
                            <table class="w-full min-w-100">
                                <thead class="bg-neutral-50 sticky top-0">
                                    <tr class="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                                        <th class="px-3 py-2 text-left">Name</th>
                                        <th class="px-3 py-2 text-right">Price</th>
                                        <th class="px-3 py-2 text-left">Category</th>
                                        <th class="px-3 py-2 text-left">Status</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-neutral-100">
                                    <tr v-for="(p, i) in importPreview" :key="i" class="hover:bg-neutral-50">
                                        <td class="px-3 py-2 text-sm text-ink font-semibold">{{ p.product_name }}</td>
                                        <td class="px-3 py-2 text-sm text-right text-ink tabular-nums">${{ p.base_price }}</td>
                                        <td class="px-3 py-2 text-sm text-neutral-600">{{ p.category_name || '—' }}</td>
                                        <td class="px-3 py-2">
                                            <span :class="['px-2 py-0.5 rounded text-[10px] font-bold uppercase', statusStyles[p.product_status] || 'bg-neutral-100 text-neutral-500']">
                                                {{ p.product_status }}
                                            </span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Actions -->
                    <div class="flex gap-3 pt-2">
                        <button @click="showImportModal = false" class="btn-outline flex-1" :disabled="importing">
                            Cancel
                        </button>
                        <button
                            @click="executeImport"
                            :disabled="importing || importPreview.length === 0"
                            class="btn-accent flex-1 gap-2"
                        >
                            <Loader2 v-if="importing" class="w-4 h-4 animate-spin" />
                            <Upload v-else class="w-4 h-4" />
                            {{ importing ? 'Importing...' : `Import ${importPreview.length} product(s)` }}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Delete Confirmation Modal -->
        <div
            v-if="showDeleteModal"
            @click="closeDeleteModal"
            class="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
            <div @click.stop class="card-flat p-6 sm:p-8 max-w-md w-full text-center animate-[scale-in_0.25s_ease-out]">
                <div class="w-14 h-14 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle class="w-7 h-7 text-danger" />
                </div>
                <h3 class="text-lg font-bold text-ink mb-2">Delete Product</h3>
                <p class="text-sm text-neutral-600 mb-2">
                    Are you sure you want to delete
                    <strong class="text-ink">{{ selectedProduct?.product_name }}</strong>?
                    This action cannot be undone.
                </p>
                <!-- Force Delete Checkbox -->
                <label class="inline-flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors hover:bg-warning/5 mb-4"
                       :class="{ 'bg-warning/10 border border-warning/30': forceDelete }">
                    <input
                        v-model="forceDelete"
                        type="checkbox"
                        class="w-4 h-4 rounded border-neutral-300 text-warning focus:ring-warning/30"
                    />
                    <span class="text-xs font-semibold text-neutral-600">
                        Force delete
                        <span class="text-warning font-bold">(removes from orders &amp; wishlists)</span>
                    </span>
                </label>
                <div class="flex gap-3">
                    <button @click="closeDeleteModal" class="btn-outline flex-1" :disabled="deleting">
                        Cancel
                    </button>
                    <button @click="confirmDelete" :disabled="deleting" class="btn-danger flex-1 gap-2">
                        <Loader2 v-if="deleting" class="w-4 h-4 animate-spin" />
                        {{ deleting ? 'Deleting...' : (forceDelete ? 'Force Delete' : 'Delete') }}
                    </button>
                </div>
            </div>
        </div>

        <!-- Bulk Delete Confirmation Modal -->
        <div
            v-if="showBulkDeleteModal"
            @click="showBulkDeleteModal = false"
            class="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
            <div @click.stop class="card-flat p-6 sm:p-8 max-w-sm w-full text-center animate-[scale-in_0.25s_ease-out]">
                <div class="w-14 h-14 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle class="w-7 h-7 text-danger" />
                </div>
                <h3 class="text-lg font-bold text-ink mb-2">Delete Products</h3>
                <p class="text-sm text-neutral-600 mb-2">
                    Are you sure you want to delete <strong class="text-ink">{{ selectedIds.size }}</strong> product(s)?
                    This action cannot be undone.
                </p>
                <!-- Force Delete Checkbox -->
                <label class="inline-flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors hover:bg-warning/5"
                       :class="{ 'bg-warning/10 border border-warning/30': bulkForceDelete }">
                    <input
                        v-model="bulkForceDelete"
                        type="checkbox"
                        class="w-4 h-4 rounded border-neutral-300 text-warning focus:ring-warning/30"
                    />
                    <span class="text-xs font-semibold text-neutral-600">
                        Force delete
                        <span class="text-warning font-bold">(removes from orders &amp; wishlists)</span>
                    </span>
                </label>
                <div class="flex gap-3 mt-4">
                    <button
                        @click="showBulkDeleteModal = false"
                        class="btn-outline flex-1"
                        :disabled="bulkActionLoading"
                    >
                        Cancel
                    </button>
                    <button
                        @click="confirmBulkDelete"
                        :disabled="bulkActionLoading"
                        class="btn-danger flex-1 gap-2"
                    >
                        <Loader2 v-if="bulkActionLoading" class="w-4 h-4 animate-spin" />
                        {{ bulkActionLoading ? 'Deleting...' : (bulkForceDelete ? 'Force Delete' : 'Delete') }}
                    </button>
                </div>
            </div>
        </div>

        <!-- Discount Management Modal -->
        <div
            v-if="showDiscountModal"
            @click="closeDiscountModal"
            class="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
            <div @click.stop class="card-flat p-5 sm:p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-[scale-in_0.25s_ease-out]">
                <div class="flex items-center justify-between mb-6">
                    <div>
                        <span class="text-[10px] uppercase tracking-[0.2em] text-amber-700 font-bold">
                            <Tag class="w-3.5 h-3.5 inline mr-1" />
                            Discounts
                        </span>
                        <h2 class="text-xl font-bold text-ink mt-1">Product Discounts</h2>
                    </div>
                    <button @click="closeDiscountModal" class="btn-ghost p-1.5 -mr-1.5">
                        <X class="w-5 h-5" />
                    </button>
                </div>

                <!-- Header with create form toggle -->
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                    <p v-if="!showDiscountForm" class="text-sm text-neutral-500">
                        {{ discounts.length }} discount{{ discounts.length !== 1 ? 's' : '' }} across all products
                    </p>
                    <button
                        v-if="!showDiscountForm"
                        @click="openDiscountForm(null)"
                        class="btn-accent text-xs gap-1.5 self-start"
                    >
                        <Plus class="w-3.5 h-3.5" />
                        Add Discount
                    </button>
                </div>

                <!-- Create/Edit Form -->
                <div v-if="showDiscountForm" class="bg-zinc-50 rounded-2xl p-5 mb-5 border border-zinc-200">
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div>
                            <label class="block text-xs font-bold uppercase tracking-[0.15em] text-ink mb-2">Product</label>
                            <select v-model="discountForm.product_id" class="input-base text-sm" :disabled="!!editingDiscount" aria-label="Select product for discount">
                                <option :value="null">Select product...</option>
                                <option v-for="p in products" :key="p.product_id" :value="p.product_id">
                                    {{ p.product_name }}
                                </option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold uppercase tracking-[0.15em] text-ink mb-2">Amount ($)</label>
                            <input v-model="discountForm.discount_amount" type="number" step="0.01" min="0.01" class="input-base text-sm" placeholder="9.99" aria-label="Discount amount" />
                        </div>
                        <div>
                            <label class="block text-xs font-bold uppercase tracking-[0.15em] text-ink mb-2">Start Date</label>
                            <input v-model="discountForm.start_date" type="date" class="input-base text-sm" aria-label="Discount start date" />
                        </div>
                        <div>
                            <label class="block text-xs font-bold uppercase tracking-[0.15em] text-ink mb-2">End Date</label>
                            <input v-model="discountForm.end_date" type="date" class="input-base text-sm" aria-label="Discount end date" />
                        </div>
                    </div>
                    <div class="flex gap-3 justify-end">
                        <button @click="closeDiscountForm" class="btn-outline text-sm" :disabled="savingDiscount">Cancel</button>
                        <button @click="saveDiscount" :disabled="savingDiscount" class="btn-accent text-sm gap-2">
                            <Loader2 v-if="savingDiscount" class="w-4 h-4 animate-spin" />
                            {{ savingDiscount ? 'Saving...' : (editingDiscount ? 'Update' : 'Create') }}
                        </button>
                    </div>
                </div>

                <!-- Loading -->
                <div v-if="loadingDiscounts" class="py-12 text-center">
                    <Loader2 class="w-8 h-8 text-amber-600 animate-spin mx-auto mb-3" />
                    <p class="text-sm text-zinc-500">Loading discounts...</p>
                </div>

                <!-- Discount List -->
                <div v-else-if="discounts.length === 0" class="py-12 text-center">
                    <Tag class="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                    <p class="text-zinc-500 text-sm font-medium">No discounts configured</p>
                    <p class="text-xs text-zinc-400 mt-1">Create a discount to start offering promotions.</p>
                </div>

                <div v-else class="space-y-2">
                    <div v-for="d in discounts" :key="d.discount_id"
                        class="flex items-start gap-4 p-4 bg-zinc-50 rounded-xl hover:bg-zinc-100/50 transition-colors">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-1.5">
                                <span class="font-semibold text-sm text-zinc-900">{{ d.product_name }}</span>
                                <span :class="['px-2 py-0.5 rounded-full text-[10px] font-bold border', discountStatusStyle(d).cls]">
                                    {{ discountStatusStyle(d).label }}
                                </span>
                            </div>
                            <div class="flex items-center gap-4 text-xs text-zinc-500">
                                <span class="font-bold text-amber-600 text-sm">${{ formatPrice(d.discount_amount) }}</span>
                                <span class="flex items-center gap-1">
                                    <Calendar class="w-3 h-3" />
                                    {{ formatDiscountDate(d.start_date) }} – {{ formatDiscountDate(d.end_date) }}
                                </span>
                            </div>
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                            <button @click="openDiscountForm(d)" class="p-2 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 transition-all" title="Edit">
                                <Pencil class="w-4 h-4" />
                            </button>
                            <button @click="confirmDeleteDiscount(d)" class="p-2 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-all" title="Delete">
                                <Trash2 class="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Delete Discount Confirmation -->
        <div
            v-if="showDeleteDiscountConfirm"
            @click="cancelDeleteDiscount"
            class="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
            <div @click.stop class="card-flat p-6 max-w-sm w-full text-center animate-[scale-in_0.25s_ease-out]">
                <div class="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle class="w-7 h-7 text-red-500" />
                </div>
                <h3 class="text-lg font-bold text-zinc-900 mb-2">Delete Discount</h3>
                <p class="text-sm text-zinc-600 mb-6">
                    Delete discount for <strong class="text-zinc-900">{{ deletingDiscount?.product_name }}</strong>?
                </p>
                <div class="flex gap-3">
                    <button @click="cancelDeleteDiscount" class="btn-outline flex-1" :disabled="deletingDiscountLoading">Cancel</button>
                    <button @click="executeDeleteDiscount" :disabled="deletingDiscountLoading" class="px-4 py-3 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 flex-1 inline-flex items-center justify-center gap-2">
                        <Loader2 v-if="deletingDiscountLoading" class="w-4 h-4 animate-spin" />
                        {{ deletingDiscountLoading ? 'Deleting...' : 'Delete' }}
                    </button>
                </div>
            </div>
        </div>

        <!-- Bulk Status Change Confirmation Modal -->
        <div
            v-if="showBulkStatusModal"
            @click="showBulkStatusModal = false"
            class="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div @click.stop class="card-flat p-6 sm:p-8 max-w-sm w-full text-center animate-[scale-in_0.25s_ease-out]">
                <div class="w-14 h-14 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckSquare class="w-7 h-7 text-accent" />
                </div>
                <h3 class="text-lg font-bold text-ink mb-2">Update Status</h3>
                <p class="text-sm text-neutral-600 mb-2">
                    Change status of <strong class="text-ink">{{ selectedIds.size }}</strong> product(s)
                    to <strong class="text-accent">{{ bulkNewStatus }}</strong>?
                </p>
                <div class="flex gap-3 mt-6">
                    <button
                        @click="showBulkStatusModal = false"
                        class="btn-outline flex-1"
                        :disabled="bulkActionLoading"
                    >
                        Cancel
                    </button>
                        <button
                        @click="executeBulkStatusChange"
                        :disabled="bulkActionLoading"
                        class="btn-accent flex-1 gap-2"
                    >
                        <Loader2 v-if="bulkActionLoading" class="w-4 h-4 animate-spin" />
                        {{ bulkActionLoading ? 'Updating...' : 'Update' }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Modal transitions */
.modal-enter-active {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.modal-leave-active {
    transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.modal-enter-from {
    opacity: 0;
}
.modal-leave-to {
    opacity: 0;
}

/* Scale-in animation for modal content */
@keyframes scale-in {
    from {
        opacity: 0;
        transform: scale(0.92);
    }
    to {
        opacity: 1;
        transform: scale(1);
    }
}
</style>
