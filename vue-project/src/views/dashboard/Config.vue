<script setup>
import { ref, computed, onMounted } from 'vue';
import { paymentAPI } from '../../api/paymentApi.js';
import { settingsAPI } from '../../api/settingsApi.js';
import { useToast } from '../../composables/useToast.js';
import HeroSettings from './HeroSettings.vue';
import {
    Settings as SettingsIcon,
    DollarSign,
    CreditCard,
    Save,
    Loader2,
    RefreshCw,
    CheckCircle,
    Info,
    AlertCircle,
    Percent,
    Globe,
    Truck,
    MapPin,
} from 'lucide-vue-next';

const toast = useToast();

// ── State ──────────────────────────────────────────────────────────────────────
const loading = ref(true);
const saving = ref(null); // 'cod' | 'settings' | null
const error = ref(null);   // hard failure: the settings request itself failed
const warning = ref(null); // soft: nothing stored yet, defaults are shown

// COD
const codMethod = ref(null);
const feeInput = ref(0);

// Store settings
const settings = ref({});

const DEFAULT_FORM = {
    taxRate: 8,
    currencySymbol: '$',
    defaultCurrency: 'USD',
    freeShippingThreshold: 50,
    defaultShippingOrigin: '',
};

const form = ref({ ...DEFAULT_FORM });

/**
 * Map a flat settings payload from the API onto form shape.
 * Defaults only apply when the key is missing — an explicit 0
 * (e.g. "disable tax") must survive the round-trip.
 */
const toForm = (data = {}) => ({
    taxRate: data.tax_rate != null ? Number(data.tax_rate) : DEFAULT_FORM.taxRate,
    currencySymbol: data.currency_symbol ?? DEFAULT_FORM.currencySymbol,
    defaultCurrency: data.default_currency ?? DEFAULT_FORM.defaultCurrency,
    freeShippingThreshold: data.free_shipping_threshold != null
        ? Number(data.free_shipping_threshold)
        : DEFAULT_FORM.freeShippingThreshold,
    defaultShippingOrigin: data.default_shipping_origin ?? DEFAULT_FORM.defaultShippingOrigin,
});

// ── Computed ───────────────────────────────────────────────────────────────────
const feeDirty = computed(() => {
    if (!codMethod.value) return false;
    return Number(feeInput.value) !== Number(codMethod.value.fee);
});

const hasStoredSettings = computed(() => Object.keys(settings.value).length > 0);

const settingsDirty = computed(() => {
    // Nothing persisted yet — there is no baseline to compare against, so the
    // form must stay saveable or the settings could never be created.
    if (!hasStoredSettings.value) return true;

    const s = settings.value;
    return (
        Number(form.value.taxRate) !== Number(s.tax_rate ?? DEFAULT_FORM.taxRate) ||
        form.value.currencySymbol !== (s.currency_symbol ?? DEFAULT_FORM.currencySymbol) ||
        form.value.defaultCurrency !== (s.default_currency ?? DEFAULT_FORM.defaultCurrency) ||
        Number(form.value.freeShippingThreshold) !== Number(s.free_shipping_threshold ?? DEFAULT_FORM.freeShippingThreshold) ||
        form.value.defaultShippingOrigin !== (s.default_shipping_origin ?? DEFAULT_FORM.defaultShippingOrigin)
    );
});

const formatCurrency = (val) => (form.value.currencySymbol || '$') + Number(val || 0).toFixed(2);

// ── Load ───────────────────────────────────────────────────────────────────────
const loadConfig = async () => {
    try {
        loading.value = true;
        error.value = null;
        warning.value = null;

        // Settle independently: a missing COD method is not a reason to fail the
        // whole page, and the store settings are the only fatal dependency.
        const [paySettled, setSettled] = await Promise.allSettled([
            paymentAPI.getAllPaymentMethods(),
            settingsAPI.getSettings(),
        ]);

        // Load COD method (optional — the section is hidden when unavailable)
        const payRes = paySettled.status === 'fulfilled' ? paySettled.value : null;
        codMethod.value = payRes?.success && Array.isArray(payRes.data)
            ? payRes.data.find(m => m.methodName === 'Cash on Delivery') || null
            : null;
        if (codMethod.value) {
            feeInput.value = Number(codMethod.value.fee) || 0;
        }

        const setRes = setSettled.status === 'fulfilled' ? setSettled.value : null;

        // Only a request that actually failed is an error. An empty settings
        // table is a legitimate first-run state, not a failure.
        if (setSettled.status === 'rejected' || !setRes?.success) {
            error.value = setSettled.status === 'rejected'
                ? (setSettled.reason?.response?.data?.message || 'Could not reach the settings service.')
                : (setRes?.message || 'Failed to load configuration data.');
            settings.value = {};
            return;
        }

        const data = setRes.data && typeof setRes.data === 'object' ? setRes.data : {};
        settings.value = data;
        form.value = toForm(data);

        if (Object.keys(data).length === 0) {
            warning.value = 'No settings have been saved yet — the defaults below will be stored when you save.';
        }
    } catch (err) {
        console.error('Error loading config:', err);
        error.value = err.response?.data?.message || 'Failed to load configuration';
    } finally {
        loading.value = false;
    }
};

// ── Save COD Fee ──────────────────────────────────────────────────────────────
const saveFee = async () => {
    if (!codMethod.value) return;
    saving.value = 'cod';
    try {
        const res = await paymentAPI.updatePaymentMethod(codMethod.value.methodId, {
            fee: Number(feeInput.value) || 0,
        });
        if (res.success) {
            codMethod.value.fee = Number(feeInput.value);
            toast.success('COD fee updated to ' + formatCurrency(feeInput.value));
        } else {
            toast.error(res.message || 'Failed to save');
        }
    } catch (err) {
        console.error('Error saving COD fee:', err);
        toast.error(err.response?.data?.message || 'Failed to save COD fee');
    } finally {
        saving.value = null;
    }
};

// ── Save Store Settings ────────────────────────────────────────────────────────
const saveSettings = async () => {
    saving.value = 'settings';
    try {
        const payload = {
            tax_rate: Number(form.value.taxRate),
            currency_symbol: String(form.value.currencySymbol || '').trim() || DEFAULT_FORM.currencySymbol,
            // The input is styled uppercase but that is display-only, so
            // normalise here to keep the stored code matching what is shown.
            default_currency: String(form.value.defaultCurrency || '').trim().toUpperCase() || DEFAULT_FORM.defaultCurrency,
            free_shipping_threshold: Number(form.value.freeShippingThreshold),
            default_shipping_origin: String(form.value.defaultShippingOrigin || '').trim(),
        };

        const res = await settingsAPI.updateSettings(payload);
        if (res.success) {
            const data = res.data && typeof res.data === 'object' ? res.data : payload;
            settings.value = data;
            form.value = toForm(data);
            warning.value = null;
            toast.success('Store settings updated');
        } else {
            toast.error(res.message || 'Failed to update settings');
        }
    } catch (err) {
        console.error('Error saving settings:', err);
        toast.error(err.response?.data?.message || 'Failed to save settings');
    } finally {
        saving.value = null;
    }
};

onMounted(loadConfig);
</script>

<template>
    <div class="min-h-screen bg-neutral-50">
        <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div class="mb-8">
                <span class="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-accent mb-2">
                    <SettingsIcon class="w-3.5 h-3.5" />
                    Configuration
                </span>
                <h1 class="text-2xl sm:text-3xl font-bold text-ink">Store Settings</h1>
                <p class="text-neutral-500 mt-1 text-sm">Manage your store configuration, tax, shipping, and payment options</p>
            </div>

            <!-- Loading -->
            <div v-if="loading" class="space-y-6">
                <!-- Skeleton Header -->
                <div class="flex items-center justify-between">
                    <div class="space-y-3">
                        <div class="h-3 w-24 skeleton-shimmer rounded"></div>
                        <div class="h-7 w-48 skeleton-shimmer rounded-lg"></div>
                        <div class="h-4 w-36 skeleton-shimmer rounded"></div>
                    </div>
                </div>

                <!-- Skeleton General Settings Card -->
                <div class="card-flat p-6 sm:p-8">
                    <div class="flex items-start gap-4 sm:gap-6">
                        <div class="w-14 h-14 skeleton-shimmer rounded-2xl shrink-0"></div>
                        <div class="flex-1 space-y-6">
                            <div>
                                <div class="h-5 w-36 skeleton-shimmer rounded"></div>
                                <div class="h-3 w-48 skeleton-shimmer rounded mt-2"></div>
                            </div>
                            <div v-for="i in 4" :key="'sk-set-' + i" class="p-5 bg-neutral-100 rounded-2xl space-y-4">
                                <div class="flex items-center gap-2">
                                    <div class="w-5 h-5 skeleton-shimmer rounded"></div>
                                    <div class="h-3 w-24 skeleton-shimmer rounded"></div>
                                </div>
                                <div class="h-11 skeleton-shimmer rounded-xl max-w-xs"></div>
                                <div class="h-3 w-40 skeleton-shimmer rounded"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Skeleton COD Card -->
                <div class="card-flat p-6 sm:p-8">
                    <div class="flex items-start gap-4 sm:gap-6">
                        <div class="w-14 h-14 skeleton-shimmer rounded-2xl shrink-0"></div>
                        <div class="flex-1 space-y-4">
                            <div>
                                <div class="h-5 w-40 skeleton-shimmer rounded"></div>
                                <div class="h-3 w-52 skeleton-shimmer rounded mt-2"></div>
                            </div>
                            <div class="p-5 bg-neutral-100 rounded-2xl space-y-3">
                                <div class="h-3 w-20 skeleton-shimmer rounded"></div>
                                <div class="h-12 skeleton-shimmer rounded-xl max-w-xs"></div>
                                <div class="h-3 w-44 skeleton-shimmer rounded"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Error -->
            <div v-else-if="error" class="card-flat border-l-4 border-danger p-6 mb-6">
                <div class="flex items-center gap-3">
                    <AlertCircle class="w-6 h-6 text-danger shrink-0" />
                    <div class="flex-1 min-w-0">
                        <h3 class="font-bold text-ink text-sm">Configuration Error</h3>
                        <p class="text-neutral-600 text-sm mt-0.5">{{ error }}</p>
                    </div>
                    <button @click="loadConfig" class="btn-primary text-sm shrink-0 gap-1.5">
                        <RefreshCw class="w-3.5 h-3.5" /> Retry
                    </button>
                </div>
            </div>

            <!-- Content -->
            <div v-else class="space-y-6">

                <!-- First run: nothing stored yet, defaults are editable -->
                <div v-if="warning" class="card-flat p-5 bg-amber-50 border-amber-200">
                    <div class="flex items-start gap-3">
                        <Info class="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <p class="text-sm font-semibold text-amber-800">Using default settings</p>
                            <p class="text-xs text-amber-700 mt-1 leading-relaxed">{{ warning }}</p>
                        </div>
                    </div>
                </div>

                <!-- ════════════════════════════════════════════════════════════════
                     SECTION: General Store Settings
                     ════════════════════════════════════════════════════════════════ -->
                <div class="card-flat p-6 sm:p-8">
                    <div class="flex items-start gap-4 sm:gap-6 flex-col sm:flex-row">
                        <div class="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center shrink-0">
                            <SettingsIcon class="w-7 h-7 text-sky-600" />
                        </div>
                        <div class="flex-1 min-w-0 w-full">
                            <h2 class="text-xl font-bold text-ink">General Settings</h2>
                            <p class="text-sm text-neutral-500 mt-1">Currency, tax rate, and shipping defaults</p>

                            <div class="mt-6 space-y-6">
                                <!-- Currency -->
                                <div class="p-5 bg-neutral-50 rounded-2xl border border-neutral-200">
                                    <h3 class="text-xs font-bold uppercase tracking-[0.15em] text-neutral-500 mb-4 flex items-center gap-2">
                                        <Globe class="w-3.5 h-3.5" /> Currency
                                    </h3>
                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label class="block text-xs font-semibold text-neutral-600 mb-1.5">Symbol</label>
                                            <input v-model="form.currencySymbol" type="text" maxlength="5"
                                                class="input-base" placeholder="$" aria-label="Currency symbol" />
                                        </div>
                                        <div>
                                            <label class="block text-xs font-semibold text-neutral-600 mb-1.5">Code</label>
                                            <input v-model="form.defaultCurrency" type="text" maxlength="3"
                                                class="input-base uppercase" placeholder="USD" aria-label="Currency code" />
                                        </div>
                                    </div>
                                    <p class="text-xs text-neutral-400 mt-2">Used for display throughout the store.</p>
                                </div>

                                <!-- Tax Rate -->
                                <div class="p-5 bg-neutral-50 rounded-2xl border border-neutral-200">
                                    <h3 class="text-xs font-bold uppercase tracking-[0.15em] text-neutral-500 mb-4 flex items-center gap-2">
                                        <Percent class="w-3.5 h-3.5" /> Tax Rate
                                    </h3>
                                    <div class="flex items-end gap-4">
                                        <div class="flex-1 max-w-xs">
                                            <label class="block text-xs font-semibold text-neutral-600 mb-1.5">Tax percentage</label>
                                            <div class="relative">
                                                <input v-model.number="form.taxRate" type="number" step="0.1" min="0" max="100"
                                                    class="input-base pr-8 font-bold tabular-nums"
                                                    aria-label="Tax rate percentage" />
                                                <span class="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 font-semibold">%</span>
                                            </div>
                                        </div>
                                        <div class="text-sm text-neutral-500 pb-2">
                                            Applied as <strong class="text-ink">{{ Number(form.taxRate).toFixed(1) }}%</strong> on subtotal + shipping
                                        </div>
                                    </div>
                                    <p class="text-xs text-neutral-400 mt-2">Set to 0 to disable tax calculation.</p>
                                </div>

                                <!-- Free Shipping Threshold -->
                                <div class="p-5 bg-neutral-50 rounded-2xl border border-neutral-200">
                                    <h3 class="text-xs font-bold uppercase tracking-[0.15em] text-neutral-500 mb-4 flex items-center gap-2">
                                        <Truck class="w-3.5 h-3.5" /> Free Shipping
                                    </h3>
                                    <div class="flex items-end gap-4">
                                        <div class="flex-1 max-w-xs">
                                            <label class="block text-xs font-semibold text-neutral-600 mb-1.5">Free shipping threshold</label>
                                            <div class="relative">
                                                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 font-semibold">{{ form.currencySymbol }}</span>
                                                <input v-model.number="form.freeShippingThreshold" type="number" step="0.01" min="0"
                                                    class="input-base pl-7 font-bold tabular-nums"
                                                    aria-label="Free shipping threshold" />
                                            </div>
                                        </div>
                                        <div class="text-sm text-neutral-500 pb-2">
                                            Orders over <strong class="text-ink">{{ form.currencySymbol }}{{ Number(form.freeShippingThreshold).toFixed(2) }}</strong> ship free
                                        </div>
                                    </div>
                                    <p class="text-xs text-neutral-400 mt-2">Set to 0 to disable free shipping.</p>
                                </div>

                                <!-- Default Shipping Origin -->
                                <div class="p-5 bg-neutral-50 rounded-2xl border border-neutral-200">
                                    <h3 class="text-xs font-bold uppercase tracking-[0.15em] text-neutral-500 mb-4 flex items-center gap-2">
                                        <MapPin class="w-3.5 h-3.5" /> Shipping Origin
                                    </h3>
                                    <div>
                                        <label class="block text-xs font-semibold text-neutral-600 mb-1.5">Default origin location</label>
                                        <input v-model="form.defaultShippingOrigin" type="text"
                                            class="input-base" placeholder="e.g. Phnom Penh, Cambodia"
                                            aria-label="Default shipping origin" />
                                    </div>
                                    <p class="text-xs text-neutral-400 mt-2">Shown to customers as the dispatch location.</p>
                                </div>
                            </div>

                            <!-- Save Button -->
                            <div class="mt-6 flex justify-end">
                                <button @click="saveSettings" :disabled="saving === 'settings' || !settingsDirty"
                                    class="px-6 py-3 bg-ink text-white rounded-xl font-bold text-sm
                                           hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed
                                           transition-all flex items-center gap-2 shadow-sm">
                                    <Loader2 v-if="saving === 'settings'" class="w-4 h-4 animate-spin" />
                                    <Save v-else class="w-4 h-4" />
                                    {{ saving === 'settings' ? 'Saving...' : 'Save Settings' }}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ════════════════════════════════════════════════════════════════
                     SECTION: Storefront Hero
                     Manages the hero carousel slides + section behaviour.
                     Self-contained: loads and saves through /api/hero.
                     ════════════════════════════════════════════════════════════════ -->
                <HeroSettings />

                <!-- ════════════════════════════════════════════════════════════════
                     SECTION: COD Fee (existing)
                     ════════════════════════════════════════════════════════════════ -->
                <div v-if="codMethod" class="card-flat p-6 sm:p-8">
                    <div class="flex items-start gap-4 sm:gap-6 flex-col sm:flex-row">
                        <div class="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                            <DollarSign class="w-7 h-7 text-emerald-600" />
                        </div>

                        <div class="flex-1 min-w-0 w-full">
                            <div class="flex items-center gap-3 flex-wrap">
                                <h2 class="text-xl font-bold text-ink">Cash on Delivery Fee</h2>
                                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                                    :class="codMethod.isActive
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-neutral-100 text-neutral-500'">
                                    {{ codMethod.isActive ? 'Active' : 'Inactive' }}
                                </span>
                            </div>
                            <p class="text-sm text-neutral-500 mt-1.5">
                                {{ codMethod.description || 'Pay with cash when your order arrives.' }}
                            </p>

                            <div class="mt-6 p-5 bg-neutral-50 rounded-2xl border border-neutral-200">
                                <div class="flex flex-col sm:flex-row sm:items-end gap-4">
                                    <div class="flex-1 max-w-xs">
                                        <label class="block text-xs font-bold uppercase tracking-[0.15em] text-neutral-500 mb-2">
                                            Service Fee
                                        </label>
                                        <div class="relative">
                                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-lg">{{ form.currencySymbol }}</span>
                                            <input v-model.number="feeInput" type="number" step="0.01" min="0"
                                                class="input-base pl-8 pr-4 py-3 text-lg font-bold tabular-nums"
                                                :class="feeDirty ? 'border-accent ring-1 ring-accent/30' : ''"
                                                aria-label="COD service fee" />
                                        </div>
                                        <p class="text-xs text-neutral-400 mt-1.5 flex items-center gap-1">
                                            <Info class="w-3 h-3" />
                                            Added to the order total when COD is selected.
                                            Current: <strong class="text-ink">{{ formatCurrency(codMethod.fee) }}</strong>
                                        </p>
                                    </div>
                                    <button @click="saveFee" :disabled="saving === 'cod' || !feeDirty"
                                        class="shrink-0 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm
                                               hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed
                                               transition-all flex items-center gap-2 shadow-sm">
                                        <Loader2 v-if="saving === 'cod'" class="w-4 h-4 animate-spin" />
                                        <Save v-else class="w-4 h-4" />
                                        {{ saving === 'cod' ? 'Saving...' : 'Save' }}
                                    </button>
                                </div>
                            </div>

                            <div class="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div class="flex items-center gap-3 p-3 bg-white rounded-xl border border-neutral-100">
                                    <div class="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                                        <CheckCircle class="w-4 h-4 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p class="text-xs text-neutral-500">Charged per order</p>
                                        <p class="text-sm font-bold text-ink">{{ formatCurrency(codMethod.fee) }}</p>
                                    </div>
                                </div>
                                <div class="flex items-center gap-3 p-3 bg-white rounded-xl border border-neutral-100">
                                    <div class="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                                        <CreditCard class="w-4 h-4 text-amber-600" />
                                    </div>
                                    <div>
                                        <p class="text-xs text-neutral-500">Payment method</p>
                                        <p class="text-sm font-bold text-ink">{{ codMethod.methodName }}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Info Banner -->
                <div class="card-flat p-5 bg-amber-50 border-amber-200">
                    <div class="flex items-start gap-3">
                        <Info class="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <p class="text-sm font-semibold text-amber-800">How these settings work</p>
                            <p class="text-xs text-amber-700 mt-1 leading-relaxed">
                                Changes take effect immediately for all new orders. The tax rate is applied to the
                                subtotal plus shipping cost during checkout. The free shipping threshold determines
                                when customers qualify for free delivery. The COD fee is added on top of the order
                                total when customers select Cash on Delivery.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
