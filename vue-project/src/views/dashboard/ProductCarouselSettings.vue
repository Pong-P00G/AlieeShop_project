<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { productCarouselAPI } from '../../api/productCarouselApi.js';
import { productAPI } from '../../api/products/productApi.js';
import { useToast } from '../../composables/useToast.js';
import {
    LayoutGrid,
    ListOrdered,
    Package,
    Search,
    ArrowUp,
    ArrowDown,
    Eye,
    EyeOff,
    Pencil,
    Loader2,
    Save,
    X,
    Link2,
    RefreshCw,
    AlertCircle,
    Info,
    PlayCircle,
    MousePointerClick,
    Type,
} from 'lucide-vue-next';

const toast = useToast();

// ── State ──────────────────────────────────────────────────────────────────────
const loading = ref(true);
const error = ref(null);
const tabs = ref([]);
const maxProductsPerTab = ref(24);
const minProductsPerTab = ref(1);
const maxPickedProducts = ref(24);
const busyTabKey = ref(null);      // tab currently being toggled / reordered
const savingSettings = ref(false);

const DEFAULT_SETTINGS = {
    sectionEnabled: true,
    eyebrow: 'Discover',
    title: 'Curated Collections',
    viewAllLabel: 'View all',
    viewAllLink: '/product',
    autoplayEnabled: true,
    autoplayInterval: 4000,
};

// `saved` is the last known server state (dirty baseline); `form` is the editor.
const saved = ref({ ...DEFAULT_SETTINGS });
const form = reactive({
    sectionEnabled: DEFAULT_SETTINGS.sectionEnabled,
    autoplayEnabled: DEFAULT_SETTINGS.autoplayEnabled,
    intervalSeconds: DEFAULT_SETTINGS.autoplayInterval / 1000,
    eyebrow: DEFAULT_SETTINGS.eyebrow,
    title: DEFAULT_SETTINGS.title,
    viewAllLabel: DEFAULT_SETTINGS.viewAllLabel,
    viewAllLink: DEFAULT_SETTINGS.viewAllLink,
});

// ── Computed ───────────────────────────────────────────────────────────────────
const settingsDirty = computed(() => (
    form.sectionEnabled !== saved.value.sectionEnabled ||
    form.autoplayEnabled !== saved.value.autoplayEnabled ||
    Math.round(Number(form.intervalSeconds) * 1000) !== saved.value.autoplayInterval ||
    String(form.eyebrow ?? '').trim() !== saved.value.eyebrow ||
    String(form.title ?? '').trim() !== saved.value.title ||
    String(form.viewAllLabel ?? '').trim() !== saved.value.viewAllLabel ||
    String(form.viewAllLink ?? '').trim() !== saved.value.viewAllLink
));

const activeCount = computed(() => tabs.value.filter(tab => tab.isActive).length);

const applySettings = (incoming = {}) => {
    const merged = { ...DEFAULT_SETTINGS, ...incoming };
    saved.value = { ...merged };
    form.sectionEnabled = merged.sectionEnabled;
    form.autoplayEnabled = merged.autoplayEnabled;
    form.intervalSeconds = merged.autoplayInterval / 1000;
    form.eyebrow = merged.eyebrow;
    form.title = merged.title;
    form.viewAllLabel = merged.viewAllLabel;
    form.viewAllLink = merged.viewAllLink;
};

const applyTabs = (incoming) => {
    tabs.value = Array.isArray(incoming) ? incoming.map(tab => ({ ...tab })) : [];
};

// ── Load ───────────────────────────────────────────────────────────────────────
const load = async () => {
    try {
        loading.value = true;
        error.value = null;

        const res = await productCarouselAPI.getAdminConfig();
        if (!res?.success) {
            error.value = res?.message || 'Failed to load the product carousel config.';
            return;
        }

        applyTabs(res.data?.tabs);
        maxProductsPerTab.value = res.data?.maxProductsPerTab ?? 24;
        minProductsPerTab.value = res.data?.minProductsPerTab ?? 1;
        maxPickedProducts.value = res.data?.maxPickedProducts ?? 24;
        applySettings(res.data?.settings);
    } catch (err) {
        console.error('Error loading product carousel config:', err);
        error.value = err.response?.data?.message || 'Could not reach the product carousel service.';
    } finally {
        loading.value = false;
    }
};

// ── Section settings ───────────────────────────────────────────────────────────
const saveSettings = async () => {
    const seconds = Number(form.intervalSeconds);
    if (!Number.isFinite(seconds) || seconds < 2 || seconds > 60) {
        toast.error('Autoplay interval must be between 2 and 60 seconds');
        return;
    }

    const label = String(form.viewAllLabel ?? '').trim();
    const link = String(form.viewAllLink ?? '').trim();
    if ((label && !link) || (link && !label)) {
        toast.error('The View-all button needs both a label and a link');
        return;
    }

    savingSettings.value = true;
    try {
        const res = await productCarouselAPI.updateSettings({
            product_carousel_section_enabled: form.sectionEnabled,
            product_carousel_autoplay_enabled: form.autoplayEnabled,
            product_carousel_autoplay_interval: Math.round(seconds * 1000),
            product_carousel_eyebrow: String(form.eyebrow ?? '').trim(),
            product_carousel_title: String(form.title ?? '').trim(),
            product_carousel_view_all_label: label,
            product_carousel_view_all_link: link,
        });
        if (res?.success) {
            applySettings(res.data?.settings ?? res.data);
            applyTabs(res.data?.tabs ?? tabs.value);
            toast.success('Product carousel settings updated');
        } else {
            toast.error(res?.message || 'Failed to update the product carousel settings');
        }
    } catch (err) {
        console.error('Error saving product carousel settings:', err);
        toast.error(err.response?.data?.message || 'Failed to update the product carousel settings');
    } finally {
        savingSettings.value = false;
    }
};

// ── Tabs ───────────────────────────────────────────────────────────────────────
const tabPayload = (list = tabs.value) => list.map(tab => ({
    key: tab.key,
    label: tab.label,
    title: tab.title,
    productsPerTab: Number(tab.productsPerTab),
    isActive: tab.isActive,
    // Empty means "use this tab's automatic query".
    productIds: Array.isArray(tab.productIds) ? tab.productIds : [],
}));

/**
 * Persist the whole tab list — the endpoint replaces it, so order and
 * visibility always travel together.
 */
const persistTabs = async (ordered, { successMessage, revertTo } = {}) => {
    const previous = tabs.value;
    tabs.value = ordered; // optimistic — feels instant, reverted on failure
    try {
        const res = await productCarouselAPI.updateSettings({ product_carousel_tabs: tabPayload(ordered) });
        if (!res?.success) throw new Error(res?.message || 'Failed to update the tabs');
        applyTabs(res.data?.tabs ?? ordered);
        if (successMessage) toast.success(successMessage);
        return true;
    } catch (err) {
        tabs.value = revertTo ?? previous;
        toast.error(err.response?.data?.message || err.message || 'Failed to update the tabs');
        return false;
    } finally {
        busyTabKey.value = null;
    }
};

const moveTab = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= tabs.value.length) return;
    const ordered = tabs.value.map(tab => ({ ...tab }));
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    busyTabKey.value = ordered[target].key;
    persistTabs(ordered, { successMessage: 'Tab order updated' });
};

const toggleTab = (tab) => {
    busyTabKey.value = tab.key;
    const ordered = tabs.value.map(entry => (
        entry.key === tab.key ? { ...entry, isActive: !entry.isActive } : { ...entry }
    ));
    persistTabs(ordered, {
        successMessage: tab.isActive ? 'Tab hidden' : 'Tab shown on the storefront',
    });
};

// ── Tab editor ─────────────────────────────────────────────────────────────────
const editorOpen = ref(false);
const editingKey = ref(null);
const savingTab = ref(false);
const tabErrors = reactive({});

const emptyTabForm = () => ({ label: '', title: '', productsPerTab: 8, isActive: true });
const tabForm = reactive(emptyTabForm());

// Products hand-picked for the tab being edited. Resolved objects (not just ids)
// so the list can show names without another round trip.
const pickedProducts = ref([]);
const pickerQuery = ref('');
const pickerResults = ref([]);
const pickerLoading = ref(false);
const pickerError = ref(null);
let pickerTimer = null;

const clearTabErrors = () => Object.keys(tabErrors).forEach(key => delete tabErrors[key]);

const isPicked = (productId) => pickedProducts.value.some(product => product.product_id === productId);

const addPick = (product) => {
    if (isPicked(product.product_id)) return;
    if (pickedProducts.value.length >= maxPickedProducts.value) {
        toast.error(`A tab can hold at most ${maxPickedProducts.value} picked products`);
        return;
    }
    pickedProducts.value.push({ ...product });
};

const removePick = (productId) => {
    pickedProducts.value = pickedProducts.value.filter(product => product.product_id !== productId);
};

const clearPicks = () => { pickedProducts.value = []; };

/** Search the catalogue the storefront draws from, so only real products are pickable. */
const searchCatalogue = async () => {
    const query = String(pickerQuery.value ?? '').trim();
    if (!query) {
        pickerResults.value = [];
        return;
    }

    pickerLoading.value = true;
    pickerError.value = null;
    try {
        const page = await productAPI.getPaginatedProduct({
            page: 1,
            pageSize: 12,
            search: query,
            status: 'active',
        });
        pickerResults.value = Array.isArray(page?.items) ? page.items : [];
    } catch (err) {
        console.error('Error searching products for the carousel:', err);
        pickerResults.value = [];
        pickerError.value = err.response?.data?.message || 'Could not load products';
    } finally {
        pickerLoading.value = false;
    }
};

// Debounced so typing a product name fires one request, not one per keystroke.
watch(pickerQuery, () => {
    if (pickerTimer) clearTimeout(pickerTimer);
    if (!editorOpen.value) return;
    pickerTimer = setTimeout(searchCatalogue, 300);
});

const openEdit = (tab) => {
    editingKey.value = tab.key;
    Object.assign(tabForm, {
        label: tab.label ?? '',
        title: tab.title ?? '',
        productsPerTab: tab.productsPerTab ?? 8,
        isActive: tab.isActive !== false,
    });
    // `products` comes back resolved from the API; a pick that no longer exists
    // is simply absent here, so saving again drops the dangling id.
    pickedProducts.value = Array.isArray(tab.products) ? tab.products.map(product => ({ ...product })) : [];
    pickerQuery.value = '';
    pickerResults.value = [];
    pickerError.value = null;
    clearTabErrors();
    editorOpen.value = true;
};

const closeEditor = () => {
    if (pickerTimer) clearTimeout(pickerTimer);
    editorOpen.value = false;
    editingKey.value = null;
};

const validateTab = () => {
    clearTabErrors();
    if (!String(tabForm.label ?? '').trim()) tabErrors.label = 'A tab label is required';
    if (!String(tabForm.title ?? '').trim()) tabErrors.title = 'A section heading is required';

    const count = Number(tabForm.productsPerTab);
    if (!Number.isInteger(count) || count < minProductsPerTab.value || count > maxProductsPerTab.value) {
        tabErrors.productsPerTab = `Choose between ${minProductsPerTab.value} and ${maxProductsPerTab.value} products`;
    }

    return Object.keys(tabErrors).length === 0;
};

const saveTab = async () => {
    if (!validateTab()) return;

    const ordered = tabs.value.map(tab => (
        tab.key === editingKey.value
            ? {
                ...tab,
                label: String(tabForm.label).trim(),
                title: String(tabForm.title).trim(),
                productsPerTab: Number(tabForm.productsPerTab),
                isActive: tabForm.isActive,
                productIds: pickedProducts.value.map(product => product.product_id),
            }
            : { ...tab }
    ));

    savingTab.value = true;
    const ok = await persistTabs(ordered, { successMessage: 'Tab updated' });
    savingTab.value = false;
    if (ok) closeEditor();
};

onMounted(load);
</script>

<template>
    <div class="space-y-6">

        <!-- Loading -->
        <div v-if="loading" class="card-flat p-6 sm:p-8">
            <div class="flex items-start gap-4 sm:gap-6">
                <div class="w-14 h-14 skeleton-shimmer rounded-2xl shrink-0"></div>
                <div class="flex-1 space-y-6">
                    <div>
                        <div class="h-5 w-44 skeleton-shimmer rounded"></div>
                        <div class="h-3 w-60 skeleton-shimmer rounded mt-2"></div>
                    </div>
                    <div v-for="i in 2" :key="'carousel-sk-' + i" class="p-5 bg-neutral-100 rounded-2xl space-y-4">
                        <div class="h-11 skeleton-shimmer rounded-xl max-w-xs"></div>
                        <div class="h-3 w-40 skeleton-shimmer rounded"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Error -->
        <div v-else-if="error" class="card-flat border-l-4 border-danger p-6">
            <div class="flex items-center gap-3">
                <AlertCircle class="w-6 h-6 text-danger shrink-0" />
                <div class="flex-1 min-w-0">
                    <h3 class="font-bold text-ink text-sm">Product carousel unavailable</h3>
                    <p class="text-neutral-600 text-sm mt-0.5">{{ error }}</p>
                </div>
                <button @click="load" class="btn-primary text-sm shrink-0 gap-1.5">
                    <RefreshCw class="w-3.5 h-3.5" /> Retry
                </button>
            </div>
        </div>

        <template v-else>
            <!-- ════════════════════════════════════════════════════════════════
                 SECTION: Section behaviour + heading
                 ════════════════════════════════════════════════════════════════ -->
            <div class="card-flat p-6 sm:p-8">
                <div class="flex items-start gap-4 sm:gap-6 flex-col sm:flex-row">
                    <div class="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center shrink-0">
                        <LayoutGrid class="w-7 h-7 text-sky-600" />
                    </div>

                    <div class="flex-1 min-w-0 w-full">
                        <div class="flex items-center gap-3 flex-wrap">
                            <h2 class="text-xl font-bold text-ink">Product Carousel</h2>
                            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                                :class="form.sectionEnabled
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-neutral-100 text-neutral-500'">
                                {{ form.sectionEnabled ? 'Visible' : 'Hidden' }}
                            </span>
                        </div>
                        <p class="text-sm text-neutral-500 mt-1">
                            Control the "Curated Collections" carousel on the home page — visibility, heading, autoplay and the View-all button
                        </p>

                        <div class="mt-6 space-y-6">
                            <!-- Visibility + autoplay -->
                            <div class="p-5 bg-neutral-50 rounded-2xl border border-neutral-200">
                                <h3 class="text-xs font-bold uppercase tracking-[0.15em] text-neutral-500 mb-4 flex items-center gap-2">
                                    <PlayCircle class="w-3.5 h-3.5" /> Behaviour
                                </h3>

                                <div class="space-y-3">
                                    <label class="flex items-start gap-3 p-4 bg-white rounded-xl border border-neutral-100 cursor-pointer">
                                        <input type="checkbox" v-model="form.sectionEnabled"
                                            class="mt-0.5 w-4 h-4 accent-accent shrink-0" />
                                        <span class="min-w-0">
                                            <span class="block text-sm font-semibold text-ink">Show the carousel on the storefront</span>
                                            <span class="block text-xs text-neutral-500 mt-0.5">
                                                Turn off to hide the whole section from customers.
                                            </span>
                                        </span>
                                    </label>

                                    <label class="flex items-start gap-3 p-4 bg-white rounded-xl border border-neutral-100 cursor-pointer"
                                        :class="!form.sectionEnabled ? 'opacity-50' : ''">
                                        <input type="checkbox" v-model="form.autoplayEnabled" :disabled="!form.sectionEnabled"
                                            class="mt-0.5 w-4 h-4 accent-accent shrink-0" />
                                        <span class="min-w-0">
                                            <span class="block text-sm font-semibold text-ink">Autoplay the carousel</span>
                                            <span class="block text-xs text-neutral-500 mt-0.5">
                                                Slides advance automatically until the customer hovers over the carousel.
                                            </span>
                                        </span>
                                    </label>
                                </div>

                                <div class="mt-4 max-w-xs">
                                    <label class="block text-xs font-semibold text-neutral-600 mb-1.5">Autoplay interval</label>
                                    <div class="relative">
                                        <input v-model.number="form.intervalSeconds" type="number" min="2" max="60" step="0.5"
                                            :disabled="!form.sectionEnabled || !form.autoplayEnabled"
                                            class="input-base pr-14 font-bold tabular-nums disabled:bg-neutral-100 disabled:cursor-not-allowed"
                                            aria-label="Autoplay interval in seconds" />
                                        <span class="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs font-semibold">sec</span>
                                    </div>
                                    <p class="text-xs text-neutral-400 mt-1.5">Between 2 and 60 seconds.</p>
                                </div>
                            </div>

                            <!-- Heading -->
                            <div class="p-5 bg-neutral-50 rounded-2xl border border-neutral-200">
                                <h3 class="text-xs font-bold uppercase tracking-[0.15em] text-neutral-500 mb-4 flex items-center gap-2">
                                    <Type class="w-3.5 h-3.5" /> Heading
                                </h3>
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label class="block text-xs font-semibold text-neutral-600 mb-1.5">Eyebrow</label>
                                        <input v-model="form.eyebrow" type="text" maxlength="40"
                                            class="input-base" placeholder="Discover"
                                            aria-label="Section eyebrow" />
                                    </div>
                                    <div>
                                        <label class="block text-xs font-semibold text-neutral-600 mb-1.5">Title</label>
                                        <input v-model="form.title" type="text" maxlength="80"
                                            class="input-base" placeholder="Curated Collections"
                                            aria-label="Section title" />
                                    </div>
                                </div>
                                <p class="text-xs text-neutral-400 mt-2 flex items-center gap-1">
                                    <Info class="w-3 h-3" />
                                    Clear both fields to hide the heading and leave only the tabs.
                                </p>
                            </div>

                            <!-- View-all button -->
                            <div class="p-5 bg-neutral-50 rounded-2xl border border-neutral-200">
                                <h3 class="text-xs font-bold uppercase tracking-[0.15em] text-neutral-500 mb-4 flex items-center gap-2">
                                    <MousePointerClick class="w-3.5 h-3.5" /> View-all Button
                                </h3>
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label class="block text-xs font-semibold text-neutral-600 mb-1.5">Button label</label>
                                        <input v-model="form.viewAllLabel" type="text" maxlength="40"
                                            class="input-base" placeholder="View all"
                                            aria-label="View-all button label" />
                                    </div>
                                    <div>
                                        <label class="block text-xs font-semibold text-neutral-600 mb-1.5">Link</label>
                                        <div class="relative">
                                            <Link2 class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                                            <input v-model="form.viewAllLink" type="text" maxlength="500"
                                                class="input-base pl-9" placeholder="/product"
                                                aria-label="View-all button link" />
                                        </div>
                                    </div>
                                </div>
                                <p class="text-xs text-neutral-400 mt-2 flex items-center gap-1">
                                    <Info class="w-3 h-3" />
                                    Leave both fields empty to remove the button.
                                </p>
                            </div>
                        </div>

                        <div class="mt-6 flex justify-end">
                            <button @click="saveSettings" :disabled="savingSettings || !settingsDirty"
                                class="px-6 py-3 bg-ink text-white rounded-xl font-bold text-sm
                                       hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed
                                       transition-all flex items-center gap-2 shadow-sm">
                                <Loader2 v-if="savingSettings" class="w-4 h-4 animate-spin" />
                                <Save v-else class="w-4 h-4" />
                                {{ savingSettings ? 'Saving...' : 'Save Carousel Settings' }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ════════════════════════════════════════════════════════════════
                 SECTION: Tabs
                 The tab keys map to product queries the storefront runs, so the
                 list is fixed: rename, reorder, resize and hide — never add.
                 ════════════════════════════════════════════════════════════════ -->
            <div class="card-flat p-6 sm:p-8">
                <div class="flex items-start gap-4 sm:gap-6 flex-col sm:flex-row">
                    <div class="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                        <ListOrdered class="w-7 h-7 text-accent" />
                    </div>

                    <div class="flex-1 min-w-0 w-full">
                        <div>
                            <h2 class="text-xl font-bold text-ink">Carousel Tabs</h2>
                            <p class="text-sm text-neutral-500 mt-1">
                                {{ activeCount }} of {{ tabs.length }} tab{{ tabs.length === 1 ? '' : 's' }} visible
                                · rename, reorder and resize them, or hand-pick the products each one shows
                            </p>
                        </div>

                        <!-- Empty state -->
                        <div v-if="tabs.length === 0" class="mt-6 p-10 bg-neutral-50 rounded-2xl border border-dashed border-neutral-300 text-center">
                            <ListOrdered class="w-10 h-10 text-neutral-300 mx-auto mb-3" />
                            <p class="text-sm font-semibold text-ink">No carousel tabs found</p>
                            <p class="text-xs text-neutral-500 mt-1">
                                Run the <code>add_product_carousel_settings.sql</code> migration to seed the default tabs.
                            </p>
                        </div>

                        <!-- Tab list -->
                        <ul v-else class="mt-6 space-y-3">
                            <li v-for="(tab, index) in tabs" :key="tab.key"
                                class="flex items-center gap-4 p-4 bg-neutral-50 rounded-2xl border border-neutral-200"
                                :class="[!tab.isActive ? 'opacity-60' : '', busyTabKey === tab.key ? 'animate-pulse' : '']">

                                <div class="w-11 h-11 rounded-xl bg-white border border-neutral-200 flex items-center justify-center shrink-0 text-xs font-bold text-neutral-400 tabular-nums">
                                    {{ String(index + 1).padStart(2, '0') }}
                                </div>

                                <!-- Details -->
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <p class="font-bold text-ink text-sm truncate">{{ tab.label }}</p>
                                        <span class="px-2 py-0.5 rounded-full bg-white border border-neutral-200 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                                            {{ tab.key }}
                                        </span>
                                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                                            :class="tab.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-200 text-neutral-600'">
                                            {{ tab.isActive ? 'Visible' : 'Hidden' }}
                                        </span>
                                    </div>
                                    <p class="text-xs text-neutral-500 mt-1 truncate">{{ tab.title }}</p>
                                    <p class="text-xs text-neutral-400 mt-1 flex items-center gap-1 flex-wrap">
                                        <LayoutGrid class="w-3 h-3 shrink-0" />
                                        {{ tab.productsPerTab }} product{{ tab.productsPerTab === 1 ? '' : 's' }} per view
                                        <span v-if="(tab.productIds || []).length" class="text-accent font-bold">
                                            · {{ tab.productIds.length }} picked
                                        </span>
                                        <span v-else>· automatic selection</span>
                                    </p>
                                </div>

                                <!-- Actions -->
                                <div class="flex items-center gap-1 shrink-0">
                                    <button @click="moveTab(index, -1)" :disabled="index === 0"
                                        class="p-2 rounded-lg text-neutral-500 hover:bg-white hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        :aria-label="`Move ${tab.label} earlier`" title="Move earlier">
                                        <ArrowUp class="w-4 h-4" />
                                    </button>
                                    <button @click="moveTab(index, 1)" :disabled="index === tabs.length - 1"
                                        class="p-2 rounded-lg text-neutral-500 hover:bg-white hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        :aria-label="`Move ${tab.label} later`" title="Move later">
                                        <ArrowDown class="w-4 h-4" />
                                    </button>
                                    <button @click="toggleTab(tab)" :disabled="busyTabKey === tab.key"
                                        class="p-2 rounded-lg text-neutral-500 hover:bg-white hover:text-ink disabled:opacity-30 transition-colors"
                                        :aria-label="tab.isActive ? `Hide ${tab.label}` : `Show ${tab.label}`"
                                        :title="tab.isActive ? 'Hide from storefront' : 'Show on storefront'">
                                        <EyeOff v-if="tab.isActive" class="w-4 h-4" />
                                        <Eye v-else class="w-4 h-4" />
                                    </button>
                                    <button @click="openEdit(tab)"
                                        class="p-2 rounded-lg text-neutral-500 hover:bg-white hover:text-ink transition-colors"
                                        :aria-label="`Edit ${tab.label}`" title="Edit tab">
                                        <Pencil class="w-4 h-4" />
                                    </button>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </template>

        <!-- ════════════════════════════════════════════════════════════════════
             Tab editor — teleported to <body> so no ancestor containing block
             (backdrop-filter / transform) can clip the fixed overlay.
             ════════════════════════════════════════════════════════════════════ -->
        <Teleport to="body">
            <div v-if="editorOpen" class="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
                role="dialog" aria-modal="true" aria-labelledby="carousel-tab-editor-title">
                <div class="fixed inset-0 bg-ink/60 backdrop-blur-sm" @click="closeEditor"></div>

                <div class="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl my-auto">
                    <!-- Header -->
                    <div class="flex items-center justify-between gap-4 p-6 border-b border-neutral-100">
                        <div class="min-w-0">
                            <h3 id="carousel-tab-editor-title" class="text-lg font-bold text-ink">Edit carousel tab</h3>
                            <p class="text-xs text-neutral-500 mt-0.5">
                                Rename the tab and its heading, or change how many products it shows.
                            </p>
                        </div>
                        <button @click="closeEditor"
                            class="p-2 rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-ink transition-colors shrink-0"
                            aria-label="Close editor">
                            <X class="w-5 h-5" />
                        </button>
                    </div>

                    <!-- Body -->
                    <div class="p-6 space-y-5">
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-semibold text-neutral-600 mb-1.5">Tab label <span class="text-danger">*</span></label>
                                <input v-model="tabForm.label" type="text" maxlength="40"
                                    class="input-base" :class="tabErrors.label ? 'border-danger' : ''"
                                    placeholder="Hand-picked" aria-label="Tab label" />
                                <p v-if="tabErrors.label" class="text-xs text-danger mt-1">{{ tabErrors.label }}</p>
                                <p v-else class="text-xs text-neutral-400 mt-1">Shown on the tab button.</p>
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-neutral-600 mb-1.5">Section heading <span class="text-danger">*</span></label>
                                <input v-model="tabForm.title" type="text" maxlength="80"
                                    class="input-base" :class="tabErrors.title ? 'border-danger' : ''"
                                    placeholder="Featured this week" aria-label="Tab section heading" />
                                <p v-if="tabErrors.title" class="text-xs text-danger mt-1">{{ tabErrors.title }}</p>
                                <p v-else class="text-xs text-neutral-400 mt-1">Used as the tab's title for screen readers.</p>
                            </div>
                        </div>

                        <div class="p-4 bg-neutral-50 rounded-2xl border border-neutral-200">
                            <label class="block text-xs font-bold uppercase tracking-[0.15em] text-neutral-500 mb-2">
                                Products shown
                            </label>
                            <div class="flex flex-col sm:flex-row sm:items-center gap-3">
                                <input v-model.number="tabForm.productsPerTab" type="number"
                                    :min="minProductsPerTab" :max="maxProductsPerTab" step="1"
                                    class="input-base sm:max-w-32 font-bold tabular-nums"
                                    :class="tabErrors.productsPerTab ? 'border-danger' : ''"
                                    aria-label="Products per tab" />
                                <p class="text-xs text-neutral-500">
                                    Between {{ minProductsPerTab }} and {{ maxProductsPerTab }} products are fetched for this tab.
                                </p>
                            </div>
                            <p v-if="tabErrors.productsPerTab" class="text-xs text-danger mt-1">{{ tabErrors.productsPerTab }}</p>
                        </div>

                        <!-- Hand-picked products: replace the automatic query for this tab -->
                        <div class="p-4 bg-neutral-50 rounded-2xl border border-neutral-200">
                            <div class="flex items-center justify-between gap-3 flex-wrap mb-3">
                                <h4 class="text-xs font-bold uppercase tracking-[0.15em] text-neutral-500 flex items-center gap-2">
                                    <Package class="w-3.5 h-3.5" /> Products in this tab
                                </h4>
                                <span class="text-[11px] font-bold text-neutral-400 tabular-nums">
                                    {{ pickedProducts.length }} / {{ maxPickedProducts }}
                                </span>
                            </div>

                            <!-- Picked, in display order -->
                            <ul v-if="pickedProducts.length" class="space-y-2 mb-3">
                                <li v-for="(product, index) in pickedProducts" :key="product.product_id"
                                    class="flex items-center gap-3 p-2 bg-white rounded-xl border border-neutral-200">
                                    <span class="w-4 text-[11px] font-bold text-neutral-400 tabular-nums shrink-0">{{ index + 1 }}</span>
                                    <div class="w-9 h-9 rounded-lg overflow-hidden bg-neutral-100 shrink-0">
                                        <img v-if="product.thumbnail" :src="product.thumbnail" :alt="product.product_name"
                                            class="w-full h-full object-cover" loading="lazy" />
                                    </div>
                                    <p class="flex-1 min-w-0 text-sm font-semibold text-ink truncate">{{ product.product_name }}</p>
                                    <button @click="removePick(product.product_id)"
                                        class="p-1.5 rounded-lg text-neutral-400 hover:bg-danger/10 hover:text-danger transition-colors"
                                        :aria-label="`Remove ${product.product_name}`" title="Remove from this tab">
                                        <X class="w-3.5 h-3.5" />
                                    </button>
                                </li>
                            </ul>
                            <p v-else class="text-xs text-neutral-500 mb-3">
                                Nothing picked — this tab uses its automatic selection.
                            </p>

                            <!-- Search the catalogue -->
                            <div class="relative">
                                <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                                <input v-model="pickerQuery" type="text" class="input-base pl-9"
                                    placeholder="Search products to add" aria-label="Search products to add" />
                            </div>

                            <div v-if="pickerLoading" class="mt-2 flex items-center gap-2 text-xs text-neutral-400">
                                <Loader2 class="w-3.5 h-3.5 animate-spin" /> Searching…
                            </div>
                            <p v-else-if="pickerError" class="mt-2 text-xs text-danger">{{ pickerError }}</p>

                            <ul v-else-if="pickerResults.length" class="mt-2 max-h-52 overflow-y-auto space-y-1 pr-1">
                                <li v-for="product in pickerResults" :key="product.product_id"
                                    class="flex items-center gap-3 p-2 rounded-xl hover:bg-white transition-colors">
                                    <div class="w-8 h-8 rounded-lg overflow-hidden bg-neutral-100 shrink-0">
                                        <img v-if="product.thumbnail" :src="product.thumbnail" alt=""
                                            class="w-full h-full object-cover" loading="lazy" />
                                    </div>
                                    <p class="flex-1 min-w-0 text-sm text-ink truncate">{{ product.product_name }}</p>
                                    <button v-if="isPicked(product.product_id)" disabled
                                        class="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-neutral-100 text-neutral-400 cursor-not-allowed shrink-0">
                                        Added
                                    </button>
                                    <button v-else @click="addPick(product)"
                                        :disabled="pickedProducts.length >= maxPickedProducts"
                                        class="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-ink text-white hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0">
                                        Add
                                    </button>
                                </li>
                            </ul>

                            <p v-else-if="pickerQuery" class="mt-2 text-xs text-neutral-400">No products match that search.</p>

                            <div class="mt-3 flex items-center justify-between gap-3 flex-wrap">
                                <p class="text-[11px] text-neutral-400 flex items-center gap-1">
                                    <Info class="w-3 h-3 shrink-0" />
                                    Picked products replace this tab's automatic selection.
                                </p>
                                <button v-if="pickedProducts.length" @click="clearPicks"
                                    class="text-[11px] font-bold text-neutral-400 hover:text-accent underline underline-offset-2 transition-colors">
                                    Clear picks
                                </button>
                            </div>
                        </div>

                        <label class="flex items-start gap-3 p-4 bg-white rounded-xl border border-neutral-200 cursor-pointer">
                            <input type="checkbox" v-model="tabForm.isActive" class="mt-0.5 w-4 h-4 accent-accent shrink-0" />
                            <span class="min-w-0">
                                <span class="block text-sm font-semibold text-ink">Show this tab</span>
                                <span class="block text-xs text-neutral-500 mt-0.5">
                                    Hidden tabs keep their settings but never render for customers.
                                </span>
                            </span>
                        </label>
                    </div>

                    <!-- Footer -->
                    <div class="flex items-center justify-end gap-3 p-6 border-t border-neutral-100">
                        <button @click="closeEditor"
                            class="px-5 py-3 rounded-xl font-bold text-sm text-neutral-600 hover:bg-neutral-100 transition-colors">
                            Cancel
                        </button>
                        <button @click="saveTab" :disabled="savingTab"
                            class="px-6 py-3 bg-ink text-white rounded-xl font-bold text-sm
                                   hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed
                                   transition-all flex items-center gap-2 shadow-sm">
                            <Loader2 v-if="savingTab" class="w-4 h-4 animate-spin" />
                            <Save v-else class="w-4 h-4" />
                            {{ savingTab ? 'Saving...' : 'Save Tab' }}
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>
