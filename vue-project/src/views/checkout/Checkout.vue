<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useShopStore } from '@/stores/shop';
import { orderAPI } from '@/api/orderApi.js';
import { paymentAPI } from '@/api/paymentApi.js';
import { addressAPI } from '@/api/addressApi.js';
import { settingsAPI } from '@/api/settingsApi.js';
import LazyImage from '../../components/LazyImage.vue';
import { useToast } from '../../composables/useToast.js';
import { shippingAPI } from '@/api/shippingApi.js';
import {
    CreditCard, Lock, CheckCircle, Truck, MapPin,
    Sparkles, ArrowRight, ChevronRight, Loader2,
    Plus, Minus, Trash2, Home, Phone, Mail, User,
    AlertCircle, ShoppingBag, RefreshCw,
    DollarSign, Info
} from 'lucide-vue-next';

const router = useRouter();
const authStore = useAuthStore();
const shop = useShopStore();
const toast = useToast();

// ── Steps ────────────────────────────────────────────────────
const steps = ['Shipping', 'Delivery', 'Payment'];
const currentStep = ref(1);

// ── Auth state ────────────────────────────────────────────────
const isLoggedIn = computed(() => authStore.isAuthenticated);
const currentUser = computed(() => authStore.user);

// ── Addresses ─────────────────────────────────────────────────
const savedAddresses = ref([]);
const showAddressBook = ref(false);
const addressLoading = ref(false);

const shippingInfo = ref({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: ''
});

const saveAddress = ref(false);
const selectedAddressId = ref(null);

// ── Load saved addresses for logged-in users ──────────────────
const loadAddresses = async () => {
    if (!isLoggedIn.value) return;
    addressLoading.value = true;
    try {
        const res = await addressAPI.getAddresses();
        if (res.success && res.data) {
            savedAddresses.value = res.data;
            // Auto-fill default address if exists
            const defaultAddr = res.data.find(a => a.isDefault);
            if (defaultAddr) {
                applyAddress(defaultAddr);
            }
        }
    } catch (err) {
        console.error('Failed to load addresses:', err);
    } finally {
        addressLoading.value = false;
    }
};

const applyAddress = (addr) => {
    shippingInfo.value = {
        firstName: addr.firstName || '',
        lastName: addr.lastName || '',
        email: currentUser.value?.email || shippingInfo.value.email,
        phone: addr.phone || '',
        address: addr.street || '',
        city: addr.city || '',
        state: addr.state || '',
        zipCode: addr.zipCode || '',
        country: addr.country || ''
    };
    selectedAddressId.value = addr.addressId;
    showAddressBook.value = false;
};

const saveAddressToBackend = async () => {
    if (!isLoggedIn.value || !saveAddress.value) return;
    try {
        await addressAPI.createAddress({
            label: `${shippingInfo.value.firstName} ${shippingInfo.value.lastName}`,
            firstName: shippingInfo.value.firstName,
            lastName: shippingInfo.value.lastName,
            phone: shippingInfo.value.phone,
            street: shippingInfo.value.address,
            city: shippingInfo.value.city,
            state: shippingInfo.value.state,
            zipCode: shippingInfo.value.zipCode,
            country: shippingInfo.value.country,
            isDefault: savedAddresses.value.length === 0
        });
    } catch (err) {
        console.error('Failed to save address:', err);
    }
};

const deleteSavedAddress = async (addressId) => {
    try {
        await addressAPI.deleteAddress(addressId);
        savedAddresses.value = savedAddresses.value.filter(a => a.addressId !== addressId);
        if (selectedAddressId.value === addressId) {
            selectedAddressId.value = null;
        }
        toast.success('Address deleted');
    } catch (err) {
        toast.error('Failed to delete address');
    }
};

// ── Shipping Methods (real-time calculator) ───────────────────
const shippingMethods = ref([]);
const selectedShipping = ref(null);
const shippingCalculating = ref(false);
const shippingCalculated = ref(false);

const calculateShippingRates = async () => {
    if (!shippingValid.value) return;
    shippingCalculating.value = true;
    try {
        const res = await shippingAPI.getRates({
            subtotal: subtotal.value,
            itemCount: cartItems.value.length,
            country: shippingInfo.value.country,
            state: shippingInfo.value.state,
            zipCode: shippingInfo.value.zipCode
        });
        if (res.success && res.data) {
            shippingMethods.value = res.data;
            selectedShipping.value = res.data[0]?.id || null;
            shippingCalculated.value = true;
        }
    } catch (err) {
        console.error('Failed to calculate shipping:', err);
        // Fall back to local methods
        shippingMethods.value = [
            { id: 'standard', name: 'Standard Shipping', description: '5-7 business days', price: 0 },
            { id: 'express', name: 'Express Shipping', description: '2-3 business days', price: 15 },
            { id: 'overnight', name: 'Overnight Shipping', description: 'Next business day', price: 30 }
        ];
        selectedShipping.value = 'standard';
        shippingCalculated.value = true;
    } finally {
        shippingCalculating.value = false;
    }
};

// Auto-calculate rates when entering step 2
const goToStepWithShipping = async (step) => {
    if (step === 2 && !shippingCalculated.value) {
        await calculateShippingRates();
    }
    currentStep.value = step;
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ── Payment Methods (from backend) ────────────────────────────
const paymentMethods = ref([]);
const paymentLoading = ref(false);
const selectedPayment = ref(null);

const loadPaymentMethods = async () => {
    paymentLoading.value = true;
    try {
        const res = await paymentAPI.getPaymentMethods();
        if (res.success && res.data && res.data.length > 0) {
            paymentMethods.value = res.data;
            selectedPayment.value = res.data[0].methodId;
        }
    } catch (err) {
        console.error('Failed to load payment methods:', err);
    } finally {
        paymentLoading.value = false;
    }
};

const paymentInfo = ref({
    cardNumber: '',
    expiry: '',
    cvv: '',
    cardName: ''
});

// ── COD Detection ───────────────────────────────────────────────
const isCOD = computed(() => {
    if (!selectedPayment.value || paymentMethods.value.length === 0) return false;
    const method = paymentMethods.value.find(m => m.methodId === selectedPayment.value);
    return method?.methodName === 'Cash on Delivery';
});

const codFee = computed(() => {
    if (!isCOD.value || paymentMethods.value.length === 0) return 0;
    const method = paymentMethods.value.find(m => m.methodId === selectedPayment.value);
    return Number(method?.fee) || 0;
});

const cardBrand = computed(() => {
    const num = paymentInfo.value.cardNumber.replace(/\D/g, '');
    if (num.startsWith('4')) return 'Visa';
    if (num.startsWith('5')) return 'Mastercard';
    if (num.startsWith('3')) return 'Amex';
    if (num.startsWith('6')) return 'Discover';
    return '';
});

const formattedCardNumber = computed(() => {
    const num = paymentInfo.value.cardNumber.replace(/\D/g, '');
    const groups = [];
    for (let i = 0; i < num.length && i < 16; i += 4) {
        groups.push(num.slice(i, i + 4));
    }
    return groups.join(' ');
});

watch(() => paymentInfo.value.cardNumber, (val) => {
    paymentInfo.value.cardNumber = val.replace(/\D/g, '').slice(0, 16);
});

watch(() => paymentInfo.value.expiry, (val) => {
    let cleaned = val.replace(/\D/g, '').slice(0, 4);
    if (cleaned.length > 2) {
        cleaned = cleaned.slice(0, 2) + '/' + cleaned.slice(2);
    }
    paymentInfo.value.expiry = cleaned;
});

watch(() => paymentInfo.value.cvv, (val) => {
    paymentInfo.value.cvv = val.replace(/\D/g, '').slice(0, 4);
});

// ── Cart Items (from shop store) ─────────────────────────────
const cartItems = computed(() => shop.cart);
const hasItems = computed(() => shop.cart.length > 0);

// ── Promo Code ────────────────────────────────────────────────
const promoCode = ref('');
const promoApplied = ref(false);
const discount = ref(0);

// ── Store Settings ────────────────────────────────────────────
const storeSettings = ref({});

const taxRate = computed(() => {
    // Fall back to 8% only when the setting is missing — an explicit 0
    // (tax disabled by the admin) must be respected.
    const raw = storeSettings.value.tax_rate;
    return raw != null && raw !== '' ? Number(raw) : 8;
});

const taxLabel = computed(() => {
    return storeSettings.value.order_tax_label?.replace('{rate}', String(taxRate.value)) || `Tax (${taxRate.value}%)`;
});

const loadStoreSettings = async () => {
    try {
        const res = await settingsAPI.getSettings();
        if (res.success && res.data) {
            storeSettings.value = res.data;
        }
    } catch (err) {
        console.error('Failed to load store settings:', err);
    }
};

// ── Loading state for initial data fetch ──────────────────────
const pageLoading = ref(true);

// ── Auth gate ─────────────────────────────────────────────────
const needsAuth = computed(() => !isLoggedIn.value);

// ── Processing ────────────────────────────────────────────────
const processing = ref(false);
const processingStep = ref('');

// ── Computed ──────────────────────────────────────────────────
const subtotal = computed(() => {
    return cartItems.value.reduce((sum, item) => sum + (item.price * item.qty), 0);
});

const shippingCost = computed(() => {
    const method = shippingMethods.value.find(m => m.id === selectedShipping.value);
    return method ? method.price : 0;
});

const tax = computed(() => {
    const rate = taxRate.value / 100;
    return (subtotal.value + shippingCost.value - discount.value) * rate;
});

const orderTotal = computed(() => {
    const base = subtotal.value + shippingCost.value + tax.value - discount.value;
    return isCOD.value ? base + codFee.value : base;
});

const firstNameValid = computed(() => shippingInfo.value.firstName.length >= 1);
const lastNameValid = computed(() => shippingInfo.value.lastName.length >= 1);
const emailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shippingInfo.value.email));
const addressValid = computed(() => shippingInfo.value.address.length >= 3);
const cityValid = computed(() => shippingInfo.value.city.length >= 1);
const stateValid = computed(() => shippingInfo.value.state.length >= 1);
const zipValid = computed(() => shippingInfo.value.zipCode.length >= 3);
const countryValid = computed(() => shippingInfo.value.country !== '');

const shippingValid = computed(() =>
    firstNameValid.value && lastNameValid.value && emailValid.value &&
    addressValid.value && cityValid.value && stateValid.value &&
    zipValid.value && countryValid.value
);

const paymentFormValid = computed(() => {
    if (selectedPayment.value === null) return false;
    // For COD, no card details needed — just a valid shipping address
    if (isCOD.value) return true;
    // Card-specific validation
    return paymentInfo.value.cardNumber.length >= 13 &&
           paymentInfo.value.expiry.length === 5 &&
           paymentInfo.value.cvv.length >= 3 &&
           paymentInfo.value.cardName.length >= 1;
});

// ── Methods ───────────────────────────────────────────────────
const goToStep = (step) => {
    goToStepWithShipping(step);
};

const applyPromo = () => {
    if (promoCode.value.toUpperCase() === 'SAVE10') {
        discount.value = subtotal.value * 0.1;
        promoApplied.value = true;
        toast.success('Promo code applied! 10% off');
    } else {
        toast.warning('Invalid promo code');
    }
};

const removePromo = () => {
    discount.value = 0;
    promoApplied.value = false;
    promoCode.value = '';
};

/**
 * Main checkout flow:
 * 1. Sync local cart to backend
 * 2. Create order from cart
 * 3. Record payment
 * 4. Clear local cart
 * 5. Navigate to success page
 */
const handleSubmit = async () => {
    processing.value = true;
    processingStep.value = 'Syncing cart...';

    try {
        // Step 1: Sync local cart to backend
        processingStep.value = 'Syncing your cart...';
        await shop.syncCartToBackend();

        // Step 2: Create the order
        processingStep.value = 'Creating your order...';
        const orderRes = await orderAPI.createOrder();
        if (!orderRes.success) {
            throw new Error(orderRes.message || 'Failed to create order');
        }
        const order = orderRes.data;

        // Step 3: Save address if requested
        if (saveAddress.value) {
            await saveAddressToBackend();
        }

        // Step 4: Record payment (include COD fee in amount)
        processingStep.value = isCOD.value ? 'Placing your order...' : 'Processing payment...';
        // Use the frontend-computed total which includes any COD fee
        // (order.totalAmount from the backend does not include the COD surcharge)
        const paymentAmount = orderTotal.value;
        const paymentRes = await paymentAPI.recordPayment(order.orderId, {
            method_id: selectedPayment.value,
            amount: paymentAmount
        });
        if (!paymentRes.success) {
            throw new Error(paymentRes.message || 'Payment failed');
        }

        // Step 5: Clear local cart
        shop.clearCart();

        // Step 6: Navigate to success page with order data
        processingStep.value = 'Almost there!';
        setTimeout(() => {
            processing.value = false;
            router.push({
                name: 'orderSucces',
                query: {
                    orderId: order.orderId,
                    total: order.totalAmount || orderTotal.value.toFixed(2),
                    email: shippingInfo.value.email
                }
            });
        }, 500);

    } catch (err) {
        console.error('Checkout error:', err);
        // Surface server-provided reasons (validation, 409 stock conflicts,
        // payment failures) instead of axios' generic status-code message.
        const serverMessage = err.response?.data?.message;
        const friendly = err.response?.status === 409
            ? (serverMessage || 'Some items in your cart are no longer available in the requested quantity. Please review your cart.')
            : (serverMessage || err.message || 'Checkout failed. Please try again.');
        toast.error(friendly);
        processing.value = false;
        processingStep.value = '';
    }
};

// ── Reset shipping rates when address changes ───────────────
watch(
    () => [shippingInfo.value.address, shippingInfo.value.city, shippingInfo.value.state, shippingInfo.value.zipCode, shippingInfo.value.country],
    () => {
        if (shippingCalculated.value) {
            shippingCalculated.value = false;
            shippingMethods.value = [];
        }
    }
);

// ── Initialize ────────────────────────────────────────────────
onMounted(async () => {
    await Promise.all([
        loadAddresses(),
        loadPaymentMethods(),
        loadStoreSettings()
    ]);
    // Pre-fill email from user profile
    if (currentUser.value?.email) {
        shippingInfo.value.email = currentUser.value.email;
    }
    pageLoading.value = false;
});
</script>

<template>
    <div class="min-h-screen bg-neutral-50 py-6 sm:py-8">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <!-- Header -->
            <div class="mb-6 sm:mb-8 mt-12 sm:mt-16">
                <h1 class="text-2xl sm:text-3xl font-bold text-ink mb-2">Checkout</h1>
                <p class="text-neutral-600 text-sm sm:text-base">Complete your purchase</p>
            </div>

            <!-- Empty Cart State -->
            <div v-if="!pageLoading && !hasItems" class="text-center py-20">
                <div class="w-20 h-20 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-6">
                    <ShoppingBag class="w-10 h-10 text-neutral-400" />
                </div>
                <h2 class="text-xl font-bold text-ink mb-2">Your cart is empty</h2>
                <p class="text-neutral-500 mb-6">Add some items to your cart before checking out.</p>
                <router-link to="/product" class="btn-accent shine-effect inline-flex">
                    Continue Shopping
                    <ArrowRight class="w-4 h-4" />
                </router-link>
            </div>

            <!-- Skeleton Loading State -->
            <div v-if="pageLoading" class="space-y-6 animate-pulse">
                <div class="flex items-center justify-between mb-8">
                    <div v-for="i in 3" :key="'sk-step-' + i" class="flex items-center" :class="{ 'flex-1': i < 3 }">
                        <div class="flex flex-col items-center">
                            <div class="w-10 h-10 bg-neutral-200 rounded-full mb-2"></div>
                            <div class="h-3 bg-neutral-200 rounded w-16"></div>
                        </div>
                        <div v-if="i < 3" class="flex-1 h-1 bg-neutral-200 mx-4"></div>
                    </div>
                </div>
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
                    <div class="lg:col-span-2">
                        <div class="bg-paper rounded-2xl shadow-sm p-4 sm:p-6 space-y-5">
                            <div class="h-6 bg-neutral-200 rounded w-48 mb-2"></div>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div v-for="i in 6" :key="'sk-field-' + i" class="space-y-2">
                                    <div class="h-4 bg-neutral-200 rounded w-24"></div>
                                    <div class="h-11 bg-neutral-200 rounded-lg"></div>
                                </div>
                            </div>
                            <div class="h-11 bg-neutral-200 rounded w-full"></div>
                        </div>
                    </div>
                    <div class="lg:col-span-1">
                        <div class="bg-paper rounded-2xl shadow-sm p-5 sm:p-6 space-y-4">
                            <div class="h-5 bg-neutral-200 rounded w-32"></div>
                            <div v-for="i in 2" :key="'sk-item-' + i" class="flex gap-4">
                                <div class="w-16 h-16 sm:w-20 sm:h-20 bg-neutral-200 rounded-lg shrink-0"></div>
                                <div class="flex-1 space-y-2">
                                    <div class="h-4 bg-neutral-200 rounded w-3/4"></div>
                                    <div class="h-3 bg-neutral-200 rounded w-1/2"></div>
                                    <div class="h-4 bg-neutral-200 rounded w-1/4"></div>
                                </div>
                            </div>
                            <div class="space-y-3 pt-4 border-t border-neutral-200">
                                <div v-for="i in 4" :key="'sk-price-' + i" class="flex justify-between">
                                    <div class="h-4 bg-neutral-200 rounded w-20"></div>
                                    <div class="h-4 bg-neutral-200 rounded w-16"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Auth Gate -->
            <div v-if="!pageLoading && hasItems && needsAuth" class="bg-paper rounded-2xl shadow-sm p-6 sm:p-8 text-center max-w-lg mx-auto">
                <div class="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                    <Lock class="w-7 h-7 text-accent" />
                </div>
                <h2 class="text-xl font-bold text-ink mb-2">Sign in to continue</h2>
                <p class="text-sm text-neutral-500 mb-6 max-w-sm mx-auto">
                    You'll need to be signed in to complete your purchase. Your cart items will be saved.
                </p>
                <div class="flex flex-col sm:flex-row gap-3 justify-center">
                    <router-link
                        :to="{ name: 'login', query: { redirect: $route.fullPath } }"
                        class="btn-accent shine-effect"
                    >
                        Sign in
                        <ArrowRight class="w-4 h-4" />
                    </router-link>
                    <router-link
                        :to="{ name: 'register', query: { redirect: $route.fullPath } }"
                        class="btn-outline"
                    >
                        Create account
                    </router-link>
                </div>
            </div>

            <!-- Main Checkout Content -->
            <div v-if="!pageLoading && hasItems && !needsAuth">
                <!-- Progress Steps -->
                <div class="mb-8">
                    <div class="flex items-center justify-between">
                        <div
                            v-for="(step, index) in steps"
                            :key="index"
                            class="flex items-center"
                            :class="{ 'flex-1': index < steps.length - 1 }"
                        >
                            <div class="flex flex-col items-center">
                                <div
                                    :class="{
                                        'bg-ink text-white scale-100': currentStep >= index + 1,
                                        'bg-paper text-neutral-400 border-2 border-neutral-300 scale-90': currentStep < index + 1
                                    }"
                                    class="w-10 h-10 rounded-full flex items-center justify-center font-semibold mb-2 transition-all duration-500"
                                >
                                    <CheckCircle v-if="currentStep > index + 1" class="w-5 h-5 animate-[scale-in_0.3s_ease-out]" />
                                    <MapPin v-else-if="index === 0" class="w-4 h-4" />
                                    <Truck v-else-if="index === 1" class="w-4 h-4" />
                                    <CreditCard v-else class="w-4 h-4" />
                                </div>
                                <span
                                    :class="{
                                        'text-ink font-semibold': currentStep >= index + 1,
                                        'text-neutral-400': currentStep < index + 1
                                    }"
                                    class="text-[10px] sm:text-sm transition-colors duration-300"
                                >
                                    {{ step }}
                                </span>
                            </div>
                            <div
                                v-if="index < steps.length - 1"
                                :class="{
                                    'bg-ink': currentStep > index + 1,
                                    'bg-neutral-300': currentStep <= index + 1
                                }"
                                class="flex-1 h-1 mx-2 sm:mx-4 transition-all duration-500"
                            ></div>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
                    <!-- Left Column - Forms -->
                    <div class="lg:col-span-2 space-y-6">
                        <transition name="step" mode="out-in">
                            <div :key="'step-' + currentStep">

                                <!-- Step 1: Review Cart + Shipping Information -->
                                <div v-if="currentStep === 1" class="bg-paper rounded-2xl shadow-sm p-4 sm:p-6">
                                    <!-- Cart Review Section -->
                                    <div class="mb-6 border-b border-neutral-200 pb-6">
                                        <div class="flex items-center justify-between mb-4">
                                            <h2 class="text-xl font-semibold text-ink">Review Your Cart</h2>
                                            <span class="text-sm text-neutral-500">{{ cartItems.length }} item{{ cartItems.length !== 1 ? 's' : '' }}</span>
                                        </div>
                                        <div class="space-y-3">
                                            <div
                                                v-for="(item, idx) in cartItems"
                                                :key="'cart-' + idx"
                                                class="flex items-center gap-3 sm:gap-4 p-3 bg-neutral-50 rounded-xl transition-all hover:bg-neutral-100"
                                            >
                                                <!-- Product Image -->
                                                <div class="w-14 h-14 sm:w-16 sm:h-16 bg-neutral-200 rounded-lg overflow-hidden shrink-0">
                                                    <LazyImage :src="item.image" :alt="item.title" wrapper-class="w-full h-full" />
                                                </div>

                                                <!-- Product Info -->
                                                <div class="flex-1 min-w-0">
                                                    <h4 class="text-sm font-medium text-ink truncate">{{ item.title }}</h4>
                                                    <p class="text-sm text-neutral-500 mt-0.5">${{ item.price.toFixed(2) }}</p>
                                                </div>

                                                <!-- Quantity Controls -->
                                                <div class="flex items-center gap-1 sm:gap-2">
                                                    <button
                                                        @click="shop.updateQuantity(idx, item.qty - 1)"
                                                        class="w-8 h-8 flex items-center justify-center rounded-lg border border-neutral-300 text-neutral-600 hover:bg-neutral-200 hover:border-neutral-400 transition-all active:scale-90"
                                                        :disabled="item.qty <= 0"
                                                        aria-label="Decrease quantity"
                                                    >
                                                        <Minus class="w-3.5 h-3.5" />
                                                    </button>
                                                    <span class="w-8 text-center text-sm font-semibold text-ink tabular-nums">{{ item.qty }}</span>
                                                    <button
                                                        @click="shop.updateQuantity(idx, item.qty + 1)"
                                                        class="w-8 h-8 flex items-center justify-center rounded-lg border border-neutral-300 text-neutral-600 hover:bg-neutral-200 hover:border-neutral-400 transition-all active:scale-90"
                                                        aria-label="Increase quantity"
                                                    >
                                                        <Plus class="w-3.5 h-3.5" />
                                                    </button>
                                                </div>

                                                <!-- Item Total & Remove -->
                                                <div class="text-right shrink-0">
                                                    <p class="text-sm font-semibold text-ink">${{ (item.price * item.qty).toFixed(2) }}</p>
                                                    <button
                                                        @click="shop.removeFromCart(idx)"
                                                        class="mt-1 text-xs text-neutral-400 hover:text-red-500 transition-colors flex items-center gap-1 ml-auto active:scale-90"
                                                        aria-label="Remove item"
                                                    >
                                                        <Trash2 class="w-3 h-3" />
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="flex items-center justify-between mb-6">
                                        <h2 class="text-xl font-semibold text-ink">Shipping Information</h2>
                                        <button
                                            v-if="isLoggedIn && savedAddresses.length > 0"
                                            @click="showAddressBook = !showAddressBook"
                                            class="text-sm text-neutral-600 hover:text-ink font-medium flex items-center gap-1"
                                        >
                                            <MapPin class="w-3.5 h-3.5" />
                                            Saved addresses
                                        </button>
                                    </div>

                                    <!-- Address Book Dropdown -->
                                    <div v-if="showAddressBook && savedAddresses.length > 0" class="mb-6 space-y-2 border border-neutral-200 rounded-xl p-4 bg-neutral-50">
                                        <h3 class="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500 mb-3">Your saved addresses</h3>
                                        <div
                                            v-for="addr in savedAddresses"
                                            :key="addr.addressId"
                                            @click="applyAddress(addr)"
                                            class="flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all"
                                            :class="selectedAddressId === addr.addressId ? 'bg-ink text-paper' : 'bg-paper hover:border-ink border border-neutral-200'"
                                        >
                                            <div>
                                                <p class="text-sm font-semibold">{{ addr.firstName }} {{ addr.lastName }}</p>
                                                <p class="text-xs opacity-70">{{ addr.street }}, {{ addr.city }}, {{ addr.state }} {{ addr.zipCode }}</p>
                                            </div>
                                            <button
                                                @click.stop="deleteSavedAddress(addr.addressId)"
                                                class="p-1.5 rounded-full hover:bg-neutral-200 transition-colors"
                                                :class="selectedAddressId === addr.addressId ? 'hover:bg-white/20' : ''"
                                                aria-label="Delete address"
                                            >
                                                <Trash2 class="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    <form @submit.prevent="goToStep(2)" class="space-y-4">
                                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label class="block text-sm font-medium text-neutral-700 mb-2">First Name *</label>
                                                <input
                                                    v-model="shippingInfo.firstName"
                                                    type="text"
                                                    required
                                                    class="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all"
                                                    :class="{ 'border-green-500 ring-1 ring-green-500': firstNameValid && shippingInfo.firstName.length > 0 }"
                                                    placeholder="John"
                                                    aria-label="First name"
                                                />
                                            </div>
                                            <div>
                                                <label class="block text-sm font-medium text-neutral-700 mb-2">Last Name *</label>
                                                <input
                                                    v-model="shippingInfo.lastName"
                                                    type="text"
                                                    required
                                                    class="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all"
                                                    :class="{ 'border-green-500 ring-1 ring-green-500': lastNameValid && shippingInfo.lastName.length > 0 }"
                                                    placeholder="Doe"
                                                    aria-label="Last name"
                                                />
                                            </div>
                                        </div>

                                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label class="block text-sm font-medium text-neutral-700 mb-2">Email *</label>
                                                <input
                                                    v-model="shippingInfo.email"
                                                    type="email"
                                                    required
                                                    class="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all"
                                                    :class="{ 'border-green-500 ring-1 ring-green-500': emailValid }"
                                                    placeholder="john@example.com"
                                                    aria-label="Email address"
                                                />
                                            </div>
                                            <div>
                                                <label class="block text-sm font-medium text-neutral-700 mb-2">Phone *</label>
                                                <input
                                                    v-model="shippingInfo.phone"
                                                    type="tel"
                                                    required
                                                    class="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all"
                                                    placeholder="+1 (555) 000-0000"
                                                    aria-label="Phone number"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label class="block text-sm font-medium text-neutral-700 mb-2">Street Address *</label>
                                            <input
                                                v-model="shippingInfo.address"
                                                type="text"
                                                required
                                                class="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all"
                                                :class="{ 'border-green-500 ring-1 ring-green-500': addressValid }"
                                                placeholder="123 Main Street"
                                                aria-label="Street address"
                                            />
                                        </div>

                                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <div>
                                                <label class="block text-sm font-medium text-neutral-700 mb-2">City *</label>
                                                <input
                                                    v-model="shippingInfo.city"
                                                    type="text"
                                                    required
                                                    class="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all"
                                                    placeholder="New York"
                                                    aria-label="City"
                                                />
                                            </div>
                                            <div>
                                                <label class="block text-sm font-medium text-neutral-700 mb-2">State *</label>
                                                <input
                                                    v-model="shippingInfo.state"
                                                    type="text"
                                                    required
                                                    class="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all"
                                                    placeholder="NY"
                                                    aria-label="State"
                                                />
                                            </div>
                                            <div>
                                                <label class="block text-sm font-medium text-neutral-700 mb-2">ZIP Code *</label>
                                                <input
                                                    v-model="shippingInfo.zipCode"
                                                    type="text"
                                                    required
                                                    class="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all"
                                                    placeholder="10001"
                                                    aria-label="ZIP code"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label class="block text-sm font-medium text-neutral-700 mb-2">Country *</label>
                                            <select
                                                v-model="shippingInfo.country"
                                                required
                                                class="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent bg-paper transition-all"
                                                aria-label="Country"
                                            >
                                                <option value="">Select Country</option>
                                                <option value="CAM">Cambodia</option>
                                                <option value="US">United States</option>
                                                <option value="CA">Canada</option>
                                                <option value="UK">United Kingdom</option>
                                                <option value="AU">Australia</option>
                                                <option value="DE">Germany</option>
                                                <option value="FR">France</option>
                                                <option value="JP">Japan</option>
                                            </select>
                                        </div>

                                        <!-- Save Address -->
                                        <div v-if="isLoggedIn" class="flex items-center">
                                            <input
                                                v-model="saveAddress"
                                                type="checkbox"
                                                id="saveAddress"
                                                class="w-4 h-4 text-ink border-neutral-300 rounded focus:ring-neutral-400"
                                            />
                                            <label for="saveAddress" class="ml-2 text-sm text-neutral-700 cursor-pointer">
                                                Save this address for future orders
                                            </label>
                                        </div>

                                        <button
                                            type="submit"
                                            :disabled="!shippingValid"
                                            class="w-full py-4 bg-ink text-white rounded-lg hover:bg-neutral-800 transition-all font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                                        >
                                            Continue to Shipping Method
                                            <ArrowRight class="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                        </button>
                                    </form>
                                </div>

                                <!-- Step 2: Shipping Method -->
                                <div v-if="currentStep === 2" class="bg-paper rounded-2xl shadow-sm p-4 sm:p-6">
                                    <h2 class="text-lg sm:text-xl font-semibold text-ink mb-2">Shipping Method</h2>
                                    <p class="text-sm text-neutral-500 mb-5">
                                        Rates calculated for <strong>{{ shippingInfo.city }}, {{ shippingInfo.state }} {{ shippingInfo.zipCode }}</strong>
                                        <button @click="calculateShippingRates" class="text-accent hover:underline ml-1 text-xs font-medium inline-flex items-center gap-1" :disabled="shippingCalculating">
                                            <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': shippingCalculating }" />
                                            Recalculate
                                        </button>
                                    </p>

                                    <!-- Calculating -->
                                    <div v-if="shippingCalculating" class="flex items-center gap-3 py-8 justify-center">
                                        <Loader2 class="w-5 h-5 animate-spin text-accent" />
                                        <span class="text-sm text-neutral-500">Calculating shipping rates...</span>
                                    </div>

                                    <!-- Calculated rates -->
                                    <div v-else-if="shippingCalculated && shippingMethods.length > 0" class="space-y-3">
                                        <label
                                            v-for="method in shippingMethods"
                                            :key="method.id"
                                            class="flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-sm"
                                            :class="{
                                                'border-ink bg-neutral-50 shadow-sm': selectedShipping === method.id,
                                                'border-neutral-200 hover:border-neutral-400': selectedShipping !== method.id
                                            }"
                                        >
                                            <div class="flex items-center gap-4">
                                                <input
                                                    v-model="selectedShipping"
                                                    type="radio"
                                                    :value="method.id"
                                                    class="w-4 h-4 text-ink border-neutral-300 focus:ring-neutral-400"
                                                />
                                                <div>
                                                    <div class="font-medium text-ink">{{ method.name }}</div>
                                                    <div class="text-sm text-neutral-500">{{ method.description }} · {{ method.estimatedDays }} days</div>
                                                </div>
                                            </div>
                                            <div class="font-semibold text-ink">
                                                {{ method.price === 0 ? 'Free' : `$${method.price.toFixed(2)}` }}
                                            </div>
                                        </label>
                                    </div>

                                    <!-- Fallback prompt -->
                                    <div v-else class="py-6 text-center">
                                        <Truck class="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                                        <p class="text-sm text-neutral-500">Enter your shipping address to calculate real-time rates.</p>
                                        <button @click="goToStep(1)" class="btn-outline text-sm mt-3">Back to shipping info</button>
                                    </div>

                                    <div class="flex gap-4 mt-6">
                                        <button
                                            @click="goToStep(1)"
                                            class="flex-1 py-3 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors font-medium"
                                        >
                                            Back
                                        </button>
                                        <button
                                            @click="goToStep(3)"
                                            :disabled="!selectedShipping || shippingCalculating"
                                            class="flex-1 py-3 bg-ink text-white rounded-lg hover:bg-neutral-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                                        >
                                            Continue to Payment
                                            <ArrowRight class="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                        </button>
                                    </div>
                                </div>

                                <!-- Step 3: Payment -->
                                <div v-if="currentStep === 3" class="bg-paper rounded-2xl shadow-sm p-4 sm:p-6">
                                    <h2 class="text-lg sm:text-xl font-semibold text-ink mb-5 sm:mb-6">Payment Information</h2>

                                    <!-- Payment Method Selection -->
                                    <div class="space-y-3 mb-6">
                                        <h3 class="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500 mb-3">Select payment method</h3>

                                        <!-- Loading payment methods -->
                                        <div v-if="paymentLoading" class="flex items-center gap-2 text-sm text-neutral-500 py-4">
                                            <Loader2 class="w-4 h-4 animate-spin" />
                                            Loading payment methods...
                                        </div>

                                        <!-- From backend -->
                                        <label
                                            v-for="method in paymentMethods"
                                            :key="method.methodId"
                                            class="flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-sm"
                                            :class="{
                                                'border-ink bg-neutral-50 shadow-sm': selectedPayment === method.methodId,
                                                'border-neutral-200 hover:border-neutral-400': selectedPayment !== method.methodId
                                            }"
                                        >
                                            <input
                                                v-model="selectedPayment"
                                                type="radio"
                                                :value="method.methodId"
                                                class="w-4 h-4 text-ink border-neutral-300 focus:ring-neutral-400"
                                            />
                                            <div class="ml-4 flex-1 flex items-center gap-3">
                                                <component :is="method.methodName === 'Cash on Delivery' ? 'DollarSign' : 'CreditCard'" class="w-5 h-5 text-neutral-600 shrink-0" />
                                                <div class="flex-1 min-w-0">
                                                    <div class="flex items-center gap-2">
                                                        <span class="font-medium text-ink">{{ method.methodName }}</span>
                                                        <span v-if="Number(method.fee) > 0" class="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded shrink-0">
                                                            +${{ Number(method.fee).toFixed(2) }} fee
                                                        </span>
                                                    </div>
                                                    <p v-if="method.description" class="text-xs text-neutral-500 mt-0.5">{{ method.description }}</p>
                                                </div>
                                            </div>
                                        </label>

                                        <!-- Fallback when no backend methods -->
                                    <div v-if="paymentMethods.length === 0 && !paymentLoading" class="py-6 text-center">
                                        <CreditCard class="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                                        <p class="text-sm text-neutral-500">No payment methods available</p>
                                        <p class="text-xs text-neutral-400 mt-1">Please contact support.</p>
                                    </div>
                                    </div>

                                    <!-- Cash on Delivery Info Card -->
                                    <transition name="step" mode="out-in">
                                        <div v-if="isCOD" class="mb-6">
                                            <div class="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6">
                                                <div class="flex items-center gap-3 mb-4">
                                                    <div class="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                                                        <DollarSign class="w-6 h-6 text-emerald-700" />
                                                    </div>
                                                    <div>
                                                        <h3 class="font-bold text-emerald-900 text-lg">Cash on Delivery</h3>
                                                        <p class="text-sm text-emerald-700">Pay when you receive</p>
                                                    </div>
                                                </div>
                                                <ul class="space-y-2">
                                                    <li class="flex items-start gap-2 text-sm text-emerald-800">
                                                        <CheckCircle class="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                                        <span>No online payment required — simply pay with cash when your order arrives at your doorstep.</span>
                                                    </li>
                                                    <li class="flex items-start gap-2 text-sm text-emerald-800">
                                                        <CheckCircle class="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                                        <span>Our delivery personnel will bring a receipt and accept your payment on delivery.</span>
                                                    </li>
                                                    <li class="flex items-start gap-2 text-sm text-emerald-800">
                                                        <CheckCircle class="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                                        <span>Your order will be shipped after confirmation. No upfront payment needed.</span>
                                                    </li>
                                                </ul>
                                                <div v-if="codFee > 0" class="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                                    <p class="text-xs text-amber-800 flex items-center gap-1.5 font-medium">
                                                        <Info class="w-3.5 h-3.5 shrink-0" />
                                                        A service fee of <strong>${{ codFee.toFixed(2) }}</strong> applies for Cash on Delivery.
                                                    </p>
                                                </div>
                                                <div class="mt-3 p-3 bg-white/60 rounded-xl">
                                                    <p class="text-xs text-emerald-700 flex items-center gap-1.5">
                                                        <Info class="w-3.5 h-3.5" />
                                                        Please have the exact amount ready. Delivery personnel may carry limited change.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </transition>

                                    <!-- Card Preview (only for non-COD) -->
                                    <transition name="step" mode="out-in">
                                        <div v-if="!isCOD" class="mb-6">
                                            <div class="card-preview relative bg-linear-to-br from-neutral-800 to-ink rounded-2xl p-5 sm:p-6 text-paper overflow-hidden">
                                                <div class="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/5"></div>
                                                <div class="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-white/5"></div>
                                                <div class="flex items-center justify-between mb-8">
                                                    <div class="flex items-center gap-2">
                                                        <div class="w-10 h-7 rounded-md bg-linear-to-r from-amber-300 to-amber-500 flex items-center justify-center text-[8px] font-bold text-ink">
                                                            <span v-if="cardBrand">{{ cardBrand }}</span>
                                                            <span v-else class="opacity-40">CRD</span>
                                                        </div>
                                                    </div>
                                                    <Lock class="w-4 h-4 text-white/40" />
                                                </div>
                                                <p class="text-lg sm:text-xl tracking-[0.15em] font-mono mb-4">
                                                    {{ formattedCardNumber || '••••  ••••  ••••  ••••' }}
                                                </p>
                                                <div class="flex items-end justify-between">
                                                    <div class="space-y-1">
                                                        <p class="text-[8px] uppercase tracking-[0.2em] text-white/50">Cardholder</p>
                                                        <p class="text-sm font-medium">{{ paymentInfo.cardName || 'Your Name' }}</p>
                                                    </div>
                                                    <div class="text-right space-y-1">
                                                        <p class="text-[8px] uppercase tracking-[0.2em] text-white/50">Expires</p>
                                                        <p class="text-sm font-mono">{{ paymentInfo.expiry || 'MM/YY' }}</p>
                                                    </div>
                                                </div>
                                                <div class="absolute bottom-5 right-5 space-y-1 text-right">
                                                    <p class="text-[8px] uppercase tracking-[0.2em] text-white/50">CVV</p>
                                                    <p class="text-sm font-mono">
                                                        {{ paymentInfo.cvv ? '•'.repeat(paymentInfo.cvv.length) : '•••' }}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </transition>

                                    <!-- Credit Card Form (only for non-COD) -->
                                    <form v-if="!isCOD" @submit.prevent="handleSubmit" class="space-y-4">
                                        <div>
                                            <label class="block text-sm font-medium text-neutral-700 mb-2">Card Number *</label>
                                            <div class="relative">
                                                <CreditCard class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                                                <input
                                                    v-model="paymentInfo.cardNumber"
                                                    type="text"
                                                    required
                                                    placeholder="1234 5678 9012 3456"
                                                    class="w-full pl-10 pr-4 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent font-mono tracking-wider transition-all"
                                                    aria-label="Card number"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label class="block text-sm font-medium text-neutral-700 mb-2">Cardholder Name *</label>
                                            <div class="relative">
                                                <User class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                                                <input
                                                    v-model="paymentInfo.cardName"
                                                    type="text"
                                                    required
                                                    placeholder="John Doe"
                                                    class="w-full pl-10 pr-4 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent transition-all"
                                                    aria-label="Name on card"
                                                />
                                            </div>
                                        </div>

                                        <div class="grid grid-cols-2 gap-4">
                                            <div>
                                                <label class="block text-sm font-medium text-neutral-700 mb-2">Expiry Date *</label>
                                                <input
                                                    v-model="paymentInfo.expiry"
                                                    type="text"
                                                    required
                                                    placeholder="MM/YY"
                                                    maxlength="5"
                                                    class="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent font-mono transition-all"
                                                    aria-label="Expiry date"
                                                />
                                            </div>
                                            <div>
                                                <label class="block text-sm font-medium text-neutral-700 mb-2">CVV *</label>
                                                <input
                                                    v-model="paymentInfo.cvv"
                                                    type="text"
                                                    required
                                                    placeholder="123"
                                                    maxlength="4"
                                                    class="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent font-mono transition-all"
                                                    aria-label="CVC code"
                                                />
                                            </div>
                                        </div>

                                        <div class="flex gap-4 mt-6">
                                            <button
                                                type="button"
                                                @click="goToStep(2)"
                                                class="flex-1 py-3 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors font-medium"
                                                :disabled="processing"
                                            >
                                                Back
                                            </button>
                                            <button
                                                type="submit"
                                                :disabled="processing || !paymentFormValid"
                                                class="flex-1 py-3 bg-ink text-white rounded-lg hover:bg-neutral-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                            >
                                                <Loader2 v-if="processing" class="w-4 h-4 animate-spin" />
                                                <Lock v-else class="w-4 h-4" />
                                                {{ processing ? processingStep : `Pay $${orderTotal.toFixed(2)}` }}
                                            </button>
                                        </div>
                                    </form>

                                    <!-- COD Order Form (no card info needed) -->
                                    <form v-if="isCOD" @submit.prevent="handleSubmit" class="space-y-4">
                                        <div class="p-4 bg-neutral-50 rounded-xl">
                                            <h4 class="text-sm font-semibold text-ink mb-2">Order Summary</h4>
                                            <div class="flex justify-between text-sm">
                                                <span class="text-neutral-600">Items ({{ cartItems.length }})</span>
                                                <span class="font-medium">${{ subtotal.toFixed(2) }}</span>
                                            </div>
                                            <div class="flex justify-between text-sm mt-1">
                                                <span class="text-neutral-600">Shipping</span>
                                                <span class="font-medium">{{ shippingCost === 0 ? 'Free' : `$${shippingCost.toFixed(2)}` }}</span>
                                            </div>
                                            <div class="flex justify-between text-sm mt-1">
                                                <span class="text-neutral-600">Tax</span>
                                                <span class="font-medium">${{ tax.toFixed(2) }}</span>
                                            </div>
                                            <div v-if="codFee > 0" class="flex justify-between text-sm mt-1 text-amber-700">
                                                <span>COD Service Fee</span>
                                                <span class="font-medium">+${{ codFee.toFixed(2) }}</span>
                                            </div>
                                            <div class="flex justify-between font-bold text-ink mt-3 pt-3 border-t border-neutral-200">
                                                <span>Total due on delivery</span>
                                                <span>${{ orderTotal.toFixed(2) }}</span>
                                            </div>
                                        </div>

                                        <div class="flex gap-4 mt-6">
                                            <button
                                                type="button"
                                                @click="goToStep(2)"
                                                class="flex-1 py-3 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors font-medium"
                                                :disabled="processing"
                                            >
                                                Back
                                            </button>
                                            <button
                                                type="submit"
                                                :disabled="processing"
                                                class="flex-1 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                            >
                                                <Loader2 v-if="processing" class="w-4 h-4 animate-spin" />
                                                <DollarSign v-else class="w-4 h-4" />
                                                {{ processing ? processingStep : `Place Order — $${orderTotal.toFixed(2)}` }}
                                            </button>
                                        </div>
                                    </form>
                                </div>

                            </div>
                        </transition>
                    </div>

                    <!-- Right Column - Order Summary -->
                    <div class="lg:col-span-1">
                        <div class="bg-paper rounded-2xl shadow-sm p-5 sm:p-6 lg:sticky lg:top-8">
                            <h2 class="text-base sm:text-lg font-semibold text-ink mb-4">Order Summary</h2>

                            <!-- Cart Items -->
                            <div class="space-y-4 mb-6">
                                <div                                    v-for="(item, idx) in cartItems"
                                    :key="idx"
                                    class="flex gap-4 group/item"
                                >
                                    <div class="w-16 h-16 sm:w-20 sm:h-20 bg-neutral-100 rounded-lg overflow-hidden shrink-0 transition-all duration-200 group-hover/item:shadow-md">
                                        <LazyImage :src="item.image" :alt="item.title" wrapper-class="w-full h-full" />
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <h4 class="text-sm font-medium text-ink truncate group-hover/item:text-accent transition-colors">{{ item.title }}</h4>
                                        <p class="text-sm text-neutral-500">Qty: {{ item.qty }}</p>
                                        <p class="text-sm font-semibold text-ink">${{ (item.price * item.qty).toFixed(2) }}</p>
                                    </div>
                                </div>
                            </div>

                            <!-- Promo Code -->
                            <div class="mb-6">
                                <div class="flex gap-2">
                                    <input
                                        v-model="promoCode"
                                        type="text"
                                        placeholder="Promo code"
                                        class="flex-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-transparent"
                                        :disabled="promoApplied"
                                        aria-label="Promo code"
                                    />                                            <button
                                                v-if="!promoApplied"
                                                @click="applyPromo"
                                                class="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors text-sm font-medium"
                                            >
                                                Apply
                                            </button>
                                            <button
                                                v-else
                                                @click="removePromo"
                                                class="px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium"
                                            >
                                                Remove
                                            </button>
                                </div>
                                <p v-if="promoApplied" class="text-sm text-green-600 mt-2 flex items-center gap-1">
                                    <CheckCircle class="w-3.5 h-3.5" />
                                    Promo code applied! 10% off
                                </p>
                            </div>

                            <!-- Price Breakdown -->
                            <div class="space-y-3 py-4 border-t border-neutral-200">
                                <div class="flex justify-between text-sm">
                                    <span class="text-neutral-600">Subtotal ({{ cartItems.length }} items)</span>
                                    <span class="font-medium text-ink">${{ subtotal.toFixed(2) }}</span>
                                </div>
                                <div class="flex justify-between text-sm">
                                    <span class="text-neutral-600">Shipping</span>
                                    <span class="font-medium text-ink">
                                        {{ shippingCost === 0 ? 'Free' : `$${shippingCost.toFixed(2)}` }}
                                    </span>
                                </div>
                                <div v-if="discount > 0" class="flex justify-between text-sm text-green-600">
                                    <span>Discount (10%)</span>
                                    <span>-${{ discount.toFixed(2) }}</span>
                                </div>
                                <div class="flex justify-between text-sm">
                                    <span class="text-neutral-600">{{ taxLabel }}</span>
                                    <span class="font-medium text-ink">${{ tax.toFixed(2) }}</span>
                                </div>
                                <div v-if="codFee > 0" class="flex justify-between text-sm text-amber-700">
                                    <span>COD Service Fee</span>
                                    <span class="font-medium">+${{ codFee.toFixed(2) }}</span>
                                </div>
                            </div>

                            <!-- Total -->
                            <div class="flex justify-between items-center pt-4 border-t-2 border-ink">
                                <span class="text-lg font-semibold text-ink">Total</span>
                                <span class="text-2xl font-bold text-ink">${{ orderTotal.toFixed(2) }}</span>
                            </div>

                            <!-- Security Badge -->
                            <div class="mt-6 p-3 bg-neutral-50 rounded-lg">
                                <div class="flex items-center gap-2 text-sm text-neutral-600">
                                    <Lock class="w-4 h-4 text-green-600" />
                                    <span>Secure checkout powered by Stripe</span>
                                </div>
                                <div class="flex items-center gap-2 text-xs text-neutral-500 mt-1">
                                    <AlertCircle class="w-3 h-3" />
                                    <span>256-bit SSL encryption</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Step transitions */
.step-enter-active {
    transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.step-leave-active {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.step-enter-from {
    opacity: 0;
    transform: translateX(24px);
}
.step-leave-to {
    opacity: 0;
    transform: translateX(-12px);
}

/* Card preview glow */
@keyframes card-glow {
    0%, 100% { box-shadow: 0 8px 32px -8px rgba(0,0,0,0.12); }
    50% { box-shadow: 0 8px 32px -4px rgba(0,0,0,0.18); }
}
.card-preview {
    animation: card-glow 3s ease-in-out infinite;
}

@keyframes scale-in {
    from { transform: scale(0); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
}
</style>
