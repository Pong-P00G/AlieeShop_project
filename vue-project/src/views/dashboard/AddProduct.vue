<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useProductStore } from '../../stores/product.js';
import { storeToRefs } from 'pinia';
import { categoryAPI } from '../../api/products/categoryApi.js';

import api from '../../api/api.js';
import {
    ArrowLeft, X, Plus, Image as ImageIcon, Sparkles,
    Upload, Check, CheckCircle2, Trash2, Loader2, Eye, EyeOff,
    Settings2, Link2, Box, Sparkle,
    Layers, Tag, XCircle,
} from 'lucide-vue-next';
import { useToast } from '../../composables/useToast.js';

const toast = useToast();
const router = useRouter();
const route = useRoute();
const productStore = useProductStore();
const { categories } = storeToRefs(productStore);

// ── Edit Mode ────────────────────────────────────────────────────────────────
const editingProductId = ref(null);
const loadingProduct = ref(false);
const isEditing = computed(() => !!editingProductId.value);

// ── Tags ─────────────────────────────────────────────────────────────────────
const COMMON_TAGS = ['coming_soon', 'new_arrival', 'best_seller', 'sale', 'featured', 'eco_friendly', 'limited_edition', 'premium'];
const customTagInput = ref('');

const toggleFormTag = (tag) => {
    const idx = form.value.tags.indexOf(tag);
    if (idx >= 0) {
        form.value.tags.splice(idx, 1);
    } else {
        form.value.tags.push(tag);
    }
};

const addCustomFormTag = () => {
    const tag = customTagInput.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!tag || form.value.tags.includes(tag)) return;
    form.value.tags.push(tag);
    customTagInput.value = '';
};

const removeFormTag = (idx) => {
    form.value.tags.splice(idx, 1);
};

const handleCustomTagKeydown = (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        addCustomFormTag();
    }
};

// ── Form State ───────────────────────────────────────────────────────────────
const form = ref({
    product_name: '',
    product_description: '',
    category_id: null,
    base_price: '',
    product_status: 'active',
    tags: [],
    main_image: '',
    selected_images: [],    // { url, filename } for additional images
    variants: [],
});

const errors = ref({});
const submitting = ref(false);

const validateForm = () => {
    errors.value = {};
    if (!form.value.product_name.trim()) errors.value.product_name = 'Product name is required';
    if (!form.value.category_id) errors.value.category_id = 'Category is required';
    if (!form.value.base_price || parseFloat(form.value.base_price) <= 0) errors.value.base_price = 'Valid price is required';
    return Object.keys(errors.value).length === 0;
};

// ── Image Browser ────────────────────────────────────────────────────────────
const uploadedImages = ref([]);
const loadImages = ref(false);
const showImageBrowser = ref(false);
const selectedMainImage = ref(null);
const selectedExtraImages = ref(new Set());

const fetchUploadedImages = async () => {
    loadImages.value = true;
    try {
        const response = await api.get('/images');
        if (response.data.success) {
            uploadedImages.value = response.data.data || [];
        }
    } catch (err) {
        console.error('Failed to load images:', err);
    } finally {
        loadImages.value = false;
    }
};

const selectMainImage = (image) => {
    selectedMainImage.value = image;
    form.value.main_image = image.url;
};

const toggleExtraImage = (image) => {
    const set = new Set(selectedExtraImages.value);
    if (set.has(image.filename)) {
        set.delete(image.filename);
    } else {
        set.add(image.filename);
    }
    selectedExtraImages.value = set;
    form.value.selected_images = Array.from(set).map(f =>
        uploadedImages.value.find(i => i.filename === f)
    ).filter(Boolean);
};

const removeMainImage = () => {
    selectedMainImage.value = null;
    form.value.main_image = '';
};

// ── Image Upload ─────────────────────────────────────────────────────────────
const fileInput = ref(null);
const isDragOver = ref(false);
const uploading = ref(false);
const uploadPreviewUrls = ref([]);

const triggerFileInput = () => fileInput.value?.click();

const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    processUploadFiles(files);
};

const handleDrop = (event) => {
    isDragOver.value = false;
    const files = Array.from(event.dataTransfer.files);
    processUploadFiles(files);
};

const processUploadFiles = (files) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    imageFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            uploadPreviewUrls.value.push({ url: e.target.result, name: file.name, file });
        };
        reader.readAsDataURL(file);
    });
};

const removeUploadPreview = (index) => {
    uploadPreviewUrls.value.splice(index, 1);
};

const executeUpload = async () => {
    const files = uploadPreviewUrls.value.map(p => p.file);
    if (files.length === 0) return;
    uploading.value = true;
    try {
        const formData = new FormData();
        files.forEach(f => formData.append('images', f));
        const response = await api.post('/images/upload-multiple', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (response.data.success) {
            const newImages = response.data.data;
            uploadedImages.value.push(...newImages);
            // If no main image selected yet, auto-select the first uploaded
            if (!selectedMainImage.value && newImages.length > 0) {
                selectMainImage(newImages[0]);
            }
            uploadPreviewUrls.value = [];
            toast.success(`${newImages.length} image(s) uploaded`);
        }
    } catch (err) {
        console.error('Upload error:', err);
        toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
        uploading.value = false;
    }
};

const deleteImage = async (filename) => {
    try {
        await api.delete(`/images/${filename}`);
        uploadedImages.value = uploadedImages.value.filter(i => i.filename !== filename);
        if (selectedMainImage.value?.filename === filename) removeMainImage();
        const set = new Set(selectedExtraImages.value);
        set.delete(filename);
        selectedExtraImages.value = set;
    } catch (err) {
        toast.error('Failed to delete image');
    }
};

// ── Inline Category Creation ─────────────────────────────────────────────────
const showNewCategory = ref(false);
const newCategoryName = ref('');
const creatingCategory = ref(false);

const toggleNewCategory = () => {
    showNewCategory.value = !showNewCategory.value;
    if (showNewCategory.value) newCategoryName.value = '';
};

const createNewCategory = async () => {
    if (!newCategoryName.value.trim()) {
        toast.warning('Category name is required');
        return;
    }
    creatingCategory.value = true;
    try {
        const response = await categoryAPI.createCategory(newCategoryName.value.trim());
        if (response.success) {
            // Refresh categories from store
            await productStore.fetchCategories();
            // Auto-select the newly created category
            const newCat = categories.value.find(c =>
                c.name?.toLowerCase() === newCategoryName.value.trim().toLowerCase()
            );
            if (newCat) form.value.category_id = newCat.category_id;
            toast.success('Category created');
            showNewCategory.value = false;
            newCategoryName.value = '';
        }
    } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to create category');
    } finally {
        creatingCategory.value = false;
    }
};

// ── Attribute-Based Variant Builder ──────────────────────────────────────────
const attributeDefinitions = ref([]); // [{ id, name, values: [string] }]
let attrIdCounter = 0;

const addAttribute = () => {
    attrIdCounter++;
    attributeDefinitions.value.push({ id: attrIdCounter, name: '', values: [''] });
};

const removeAttribute = (index) => {
    attributeDefinitions.value.splice(index, 1);
    regenerateVariants();
};

const addAttributeValue = (attrIndex) => {
    attributeDefinitions.value[attrIndex].values.push('');
};

const removeAttributeValue = (attrIndex, valIndex) => {
    attributeDefinitions.value[attrIndex].values.splice(valIndex, 1);
    regenerateVariants();
};

// ── Variant Combination Generator ────────────────────────────────────────────
const generatedVariants = ref([]);

const cartesianProduct = (arrays) => {
    if (arrays.length === 0) return [];
    return arrays.reduce((acc, curr) => {
        const result = [];
        acc.forEach(a => {
            curr.forEach(c => {
                result.push([...a, c]);
            });
        });
        return result;
    }, [[]]);
};

const regenerateVariants = () => {
    // Only generate from attributes that have a name and at least one non-empty value
    const validAttributes = attributeDefinitions.value.filter(
        attr => attr.name.trim() && attr.values.some(v => v.trim() !== '')
    );

    if (validAttributes.length === 0) {
        generatedVariants.value = [];
        return;
    }

    // Get all non-empty values for each attribute
    const valueArrays = validAttributes.map(attr =>
        attr.values.filter(v => v.trim() !== '')
    );

    // Filter out attributes with no values
    const validAttrsWithValues = validAttributes.filter((_, i) => valueArrays[i].length > 0);
    const validValueArrays = valueArrays.filter(arr => arr.length > 0);

    if (validAttrsWithValues.length === 0) {
        generatedVariants.value = [];
        return;
    }

    const combinations = cartesianProduct(validValueArrays);

    // ── Preserve existing variant data via matching ────────────────────────
    // Exact match by full key (e.g. "Color:Orange|Storage:1TB")
    const existingMap = {};
    generatedVariants.value.forEach(gv => {
        const key = gv.options.map(o => `${o.attribute_name}:${o.value}`).sort().join('|');
        existingMap[key] = gv;
    });

    // Subset index: for each individual option key, list all variants that have it
    // Used for partial matching when a new attribute is added mid-editing
    const byOptionKey = {};
    generatedVariants.value.forEach(gv => {
        gv.options.forEach(o => {
            const singleKey = `${o.attribute_name}:${o.value}`;
            if (!byOptionKey[singleKey]) byOptionKey[singleKey] = [];
            byOptionKey[singleKey].push(gv);
        });
    });

    // Find the best-matching existing variant — one whose options are all
    // present in `newOptions`. Prefers the variant with the most matches.
    const findBestMatch = (newOptions) => {
        const newKeySet = new Set(newOptions.map(o => `${o.attribute_name}:${o.value}`));
        const candidates = new Set();
        newOptions.forEach(o => {
            const k = `${o.attribute_name}:${o.value}`;
            (byOptionKey[k] || []).forEach(v => candidates.add(v));
        });
        let best = null;
        let bestScore = 0;
        for (const cand of candidates) {
            const candKeys = cand.options.map(o => `${o.attribute_name}:${o.value}`);
            if (candKeys.every(ck => newKeySet.has(ck)) && candKeys.length > bestScore) {
                best = cand;
                bestScore = candKeys.length;
            }
        }
        return best;
    };

    generatedVariants.value = combinations.map(combo => {
        const options = combo.map((val, i) => ({
            attribute_name: validAttrsWithValues[i].name,
            value: val,
        }));
        const key = options.map(o => `${o.attribute_name}:${o.value}`).sort().join('|');
        // 1. Try exact match (full key)
        let existing = existingMap[key];
        // 2. Fallback: partial subset match (new attribute added)
        if (!existing) existing = findBestMatch(options);
        return {
            options,
            sku: existing?.sku || '',
            variant_price: existing?.variant_price || '',
            stock_quantity: existing?.stock_quantity || 0,
        };
    });
};

// ── Auto-generate SKUs from product name + attribute values ──────────────
const abbreviate = (str) => {
    if (!str) return '';
    // Common abbreviations lookup
    const known = {
        'black': 'BLK', 'white': 'WHT', 'blue': 'BLU', 'red': 'RED',
        'green': 'GRN', 'yellow': 'YLW', 'purple': 'PRP', 'pink': 'PNK',
        'orange': 'ORG', 'gray': 'GRY', 'grey': 'GRY',
        'titanium': 'TI', 'natural titanium': 'NT', 'desert titanium': 'DT',
        'white titanium': 'WT', 'black titanium': 'BT',
        'small': 'S', 'medium': 'M', 'large': 'L',
        'extra large': 'XL', 'x large': 'XL',
    };
    const lower = str.trim().toLowerCase();
    if (known[lower]) return known[lower];
    // For values ending in GB or TB, keep the number
    if (/^(\d+)(gb|tb)$/i.test(lower)) return lower.replace(/\s/g, '').toUpperCase();
    // Fallback: uppercase first letters of each word
    return str.trim()
        .split(/[\s_-]+/)
        .map(w => w.charAt(0).toUpperCase())
        .join('');
};

const getProductPrefix = () => {
    const name = form.value.product_name.trim();
    if (!name) return 'PROD';
    // Extract meaningful prefix: uppercase first letters of each word, keep digits
    return name
        .split(/[\s_-]+/)
        .map(w => {
            // If word starts with a digit, keep the digit(s) + first letter
            const digitMatch = w.match(/^(\d+)/);
            if (digitMatch) return digitMatch[1] + (w.replace(/^\d+/, '')[0] || '').toUpperCase();
            return w.charAt(0).toUpperCase();
        })
        .join('');
};

const generateSkus = () => {
    const prefix = getProductPrefix();
    if (generatedVariants.value.length === 0) {
        toast.warning('No variants to generate SKUs for');
        return;
    }
    generatedVariants.value = generatedVariants.value.map(v => {
        const suffix = v.options
            .map(o => abbreviate(o.value))
            .filter(Boolean)
            .join('-');
        v.sku = suffix ? `${prefix}-${suffix}` : prefix;
        return v;
    });
    toast.success(`Generated SKUs for ${generatedVariants.value.length} variant(s)`);
};

// ── Manual variant (supports multiple attribute options per variant) ─────
const showManualVariant = ref(false);
const manualVariantOptions = ref([{ name: '', value: '' }]);
const manualVariantPrice = ref('');
const manualVariantStock = ref(0);

const addManualOptionField = () => {
    manualVariantOptions.value.push({ name: '', value: '' });
};

const removeManualOptionField = (idx) => {
    if (manualVariantOptions.value.length > 1) {
        manualVariantOptions.value.splice(idx, 1);
    }
};

const addManualVariant = () => {
    const filledOptions = manualVariantOptions.value.filter(
        o => o.name.trim() && o.value.trim()
    );
    if (filledOptions.length === 0) {
        toast.warning('At least one attribute name and value are required');
        return;
    }
    const newVar = {
        options: filledOptions.map(o => ({
            attribute_name: o.name.trim(),
            value: o.value.trim(),
        })),
        sku: '',
        variant_price: manualVariantPrice.value || '',
        stock_quantity: manualVariantStock.value || 0,
    };
    if (!generatedVariants.value) generatedVariants.value = [];
    generatedVariants.value.push(newVar);
    manualVariantOptions.value = [{ name: '', value: '' }];
    manualVariantPrice.value = '';
    manualVariantStock.value = 0;
};

const removeGeneratedVariant = (index) => {
    generatedVariants.value.splice(index, 1);
};

const variantPreviewLabel = (variant) => {
    return variant.options.map(o => `${o.attribute_name}: ${o.value}`).join(' / ');
};

// ── Load Product for Editing ────────────────────────────────────────────────
const loadProductForEdit = async (productId) => {
    loadingProduct.value = true;
    try {
        const result = await productStore.fetchProductById(productId);
        if (!result.success || !productStore.currentProduct) {
            toast.error('Product not found');
            router.push('/admin/manage-products');
            return;
        }

        const product = productStore.currentProduct;

        form.value.product_name = product.product_name || '';
        form.value.product_description = product.descriptions || product.description || '';
        form.value.base_price = product.base_price ? String(product.base_price) : '';
        form.value.product_status = product.product_status || 'active';
        form.value.tags = product.tags ? [...product.tags] : [];

        // Map category_name from backend to category_id for the select dropdown
        if (product.category_name && categories.value.length > 0) {
            const matched = categories.value.find(
                c => c.name?.toLowerCase() === product.category_name?.toLowerCase()
            );
            if (matched) {
                form.value.category_id = matched.category_id;
            }
        }

        // Images: use thumbnail as main image
        if (product.thumbnail) {
            form.value.main_image = product.thumbnail;
            selectedMainImage.value = { url: product.thumbnail, filename: 'existing' };
        }
        if (product.images && product.images.length > 0) {
            const extras = product.images.filter(img => img.image_url !== product.thumbnail);
            form.value.selected_images = extras.map(img => ({ url: img.image_url, filename: img.image_url.split('/').pop() }));
            selectedExtraImages.value = new Set(extras.map(img => img.image_url));
        }

        // Variants: map backend format to generated variant format
        if (product.variants && product.variants.length > 0) {
            generatedVariants.value = product.variants.map(v => {
                // Prefer the dynamic `options` JSON array (includes ALL attributes)
                let options = [];
                if (Array.isArray(v.options) && v.options.length > 0) {
                    options = v.options.filter(o => o.attribute_name && o.value);
                }
                // Fall back to legacy pivoted columns for backward compat
                if (options.length === 0) {
                    if (v.variant_color)   options.push({ attribute_name: 'Color',   value: v.variant_color });
                    if (v.variant_size)    options.push({ attribute_name: 'Size',    value: v.variant_size });
                    if (v.variant_storage) options.push({ attribute_name: 'Storage', value: v.variant_storage });
                }
                return {
                    options,
                    sku: v.sku || '',
                    variant_price: v.variant_price || '',
                    stock_quantity: v.quantity || 0,
                };
            });

            // Rebuild attribute definitions from loaded variants
            const attrMap = new Map();
            generatedVariants.value.forEach(v => {
                v.options.forEach(o => {
                    if (!attrMap.has(o.attribute_name)) {
                        attrMap.set(o.attribute_name, new Set());
                    }
                    attrMap.get(o.attribute_name).add(o.value);
                });
            });
            if (attrMap.size > 0) {
                attributeDefinitions.value = Array.from(attrMap.entries()).map(([name, values]) => {
                    attrIdCounter++;
                    return {
                        id: attrIdCounter,
                        name,
                        values: Array.from(values),
                    };
                });
                // Re-generate variants so the UI table stays in sync with attribute definitions
                regenerateVariants();
            }
        }
    } catch (err) {
        console.error('Error loading product for edit:', err);
        toast.error(err.response?.data?.message || 'Failed to load product');
        router.push('/admin/manage-products');
    } finally {
        loadingProduct.value = false;
    }
};

// ── Submit ───────────────────────────────────────────────────────────────────
const handleSubmit = async () => {
    if (!validateForm()) return;
    submitting.value = true;
    try {
        // Build images array: main image first, then selected extras
        const images = [];
        if (form.value.main_image) {
            images.push({ image_url: form.value.main_image, is_main: true, sort_order: 0 });
        }
        form.value.selected_images.forEach((img, i) => {
            if (img.url !== form.value.main_image) {
                images.push({ image_url: img.url, is_main: false, sort_order: i + 1 });
            }
        });

        // Build variants from generated variants + any attribute definitions as options
        const variants = generatedVariants.value.map(v => ({
            sku: v.sku || null,
            options: v.options || [],
            variant_price: v.variant_price || null,
            stock_quantity: v.stock_quantity != null ? v.stock_quantity : 0,
            reorder_level: 5,
        }));

        const productData = {
            product_name: form.value.product_name.trim(),
            descriptions: form.value.product_description.trim(),
            category_id: form.value.category_id,
            base_price: parseFloat(form.value.base_price),
            product_status: form.value.product_status,
            tags: form.value.tags,
            images,
            variants,
        };

        let result;
        if (isEditing.value) {
            result = await productStore.updateProduct(editingProductId.value, productData);
            if (result.success) {
                toast.success('Product updated successfully!');
                router.push('/admin/manage-products');
            } else {
                handleServerErrors(result);
            }
        } else {
            result = await productStore.createCompleteProduct(productData);
            if (result.success) {
                toast.success('Product created successfully!');
                router.push('/admin/dashboard');
            } else {
                handleServerErrors(result);
            }
        }
    } catch (error) {
        console.error('Error saving product:', error);
        toast.error(error.response?.data?.message || 'Unexpected error saving product. Please try again.');
    } finally {
        submitting.value = false;
    }
};

// ── Handle Server Errors (field-level + toast) ─────────────────────────
const handleServerErrors = (result) => {
    // Show toast with readable message
    toast.error(result.error || 'Failed to save product');

    // Map backend validation errors to form fields
    if (result.fieldErrors && Array.isArray(result.fieldErrors)) {
        for (const fe of result.fieldErrors) {
            const fieldName = fe.field || '';
            const message = fe.message || '';

            // Map backend field paths to form field names
            if (fieldName.startsWith('product_name')) {
                errors.value.product_name = message;
            } else if (fieldName.startsWith('base_price')) {
                errors.value.base_price = message;
            } else if (fieldName.startsWith('category_id')) {
                errors.value.category_id = message;
            } else if (fieldName.startsWith('variants')) {
                // Show a general variants error — specific variant index errors
                // are hard to pinpoint in the generated table, so summarise
                if (!errors.value.variants) {
                    errors.value.variants = 'Check variant details above';
                }
            } else if (fieldName.startsWith('images')) {
                if (!errors.value.images) {
                    errors.value.images = 'Check image details';
                }
            }
        }
    }
};

const cancel = () => {
    if (isEditing.value) {
        router.push('/admin/manage-products');
    } else {
        router.push('/admin/dashboard');
    }
};

onMounted(async () => {
    await productStore.fetchCategories();
    fetchUploadedImages();

    const editId = route.query.edit;
    if (editId) {
        editingProductId.value = parseInt(editId);
        await loadProductForEdit(editId);
    }
});
</script>

<template>
    <div class="bg-neutral-100 min-h-screen pb-16">
        <div class="section py-6 sm:py-8 max-w-5xl">
            <!-- Header -->
            <div class="mb-8">
                <button @click="cancel"
                    class="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-ink mb-4 transition-colors">
                    <ArrowLeft class="h-4 w-4" />
                    Back to dashboard
                </button>
                <span class="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-accent mb-2">
                    <Sparkles class="w-3.5 h-3.5" />
                    {{ isEditing ? 'Edit product' : 'New inventory' }}
                </span>
                <h1 class="heading-hero text-4xl text-ink">{{ isEditing ? 'Edit product' : 'Add new product' }}</h1>
                <p class="text-neutral-500 mt-2">{{ isEditing ? 'Update product details, images, attributes, and variants.' : 'Create a new product with images, attributes, and variants.' }}</p>
            </div>

            <!-- Loading State -->
            <div v-if="loadingProduct" class="space-y-6">
                <!-- Skeleton Header -->
                <div class="flex items-center gap-4 mb-8">
                    <div class="h-4 w-24 skeleton-shimmer rounded"></div>
                </div>
                <div class="space-y-2 mb-8">
                    <div class="h-3 w-32 skeleton-shimmer rounded"></div>
                    <div class="h-8 w-56 skeleton-shimmer rounded-lg"></div>
                    <div class="h-4 w-48 skeleton-shimmer rounded"></div>
                </div>

                <!-- Skeleton Form Sections -->
                <div v-for="i in 3" :key="'sk-form-' + i" class="card-flat p-6 md:p-8">
                    <div class="h-5 w-40 skeleton-shimmer rounded mb-6"></div>
                    <div class="space-y-5">
                        <div v-for="j in 3" :key="'sk-field-' + i + '-' + j" class="space-y-2">
                            <div class="h-3 w-28 skeleton-shimmer rounded"></div>
                            <div class="h-11 skeleton-shimmer rounded-xl"></div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div class="space-y-2">
                                <div class="h-3 w-24 skeleton-shimmer rounded"></div>
                                <div class="h-11 skeleton-shimmer rounded-xl"></div>
                            </div>
                            <div class="space-y-2">
                                <div class="h-3 w-20 skeleton-shimmer rounded"></div>
                                <div class="h-11 skeleton-shimmer rounded-xl"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <form v-else @submit.prevent="handleSubmit" class="space-y-5">

                <!-- ── Basic Information ────────────────────────────────────── -->
                <div class="card-flat p-6 md:p-8">
                    <h2 class="text-base font-bold text-ink mb-6">Basic information</h2>
                    <div class="space-y-6">
                        <div>
                            <label class="block text-xs font-bold uppercase tracking-[0.2em] text-ink mb-2">
                                Product name <span class="text-accent">*</span>
                            </label>
                            <input v-model="form.product_name" type="text" class="input-base"
                                placeholder="Enter product name" aria-label="Product name" />
                            <p v-if="errors.product_name" class="mt-1.5 text-xs text-danger font-semibold">
                                {{ errors.product_name }}
                            </p>
                        </div>

                        <div>
                            <label class="block text-xs font-bold uppercase tracking-[0.2em] text-ink mb-2">
                                Description
                            </label>
                            <textarea v-model="form.product_description" rows="4"
                                class="input-base resize-none" placeholder="Describe your product..."
                                aria-label="Product description"></textarea>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <!-- Category -->
                            <div>
                                <label class="block text-xs font-bold uppercase tracking-[0.2em] text-ink mb-2">
                                    Category <span class="text-accent">*</span>
                                </label>
                                <div class="flex gap-2">
                                    <div class="flex-1 relative">
                                        <select v-model="form.category_id" class="input-base w-full"
                                            aria-label="Product category">
                                            <option :value="null">Select category</option>
                                            <option v-for="category in categories" :key="category.category_id"
                                                :value="category.category_id">
                                                {{ category.name }}
                                            </option>
                                        </select>
                                    </div>
                                    <button type="button" @click="toggleNewCategory"
                                        class="btn-outline text-sm gap-1.5 px-3 shrink-0"
                                        :title="showNewCategory ? 'Cancel' : 'Add new category'">
                                        <Plus class="w-4 h-4" />
                                    </button>
                                </div>
                                <!-- Inline New Category -->
                                <div v-if="showNewCategory"
                                    class="mt-2.5 p-2.5 bg-neutral-50 rounded-md border border-neutral-200 animate-fade-in">
                                    <div class="flex gap-2">
                                        <input v-model="newCategoryName" type="text"
                                            class="input-base text-sm flex-1" placeholder="Category name"
                                            @keyup.enter="createNewCategory" aria-label="New category name" />
                                        <button type="button" @click="createNewCategory" :disabled="creatingCategory"
                                            class="btn-accent text-sm gap-1.5 px-3">
                                            <Loader2 v-if="creatingCategory" class="w-3.5 h-3.5 animate-spin" />
                                            <Plus v-else class="w-3.5 h-3.5" />
                                            Add
                                        </button>
                                    </div>
                                </div>
                                <p v-if="errors.category_id" class="mt-1.5 text-xs text-danger font-semibold">
                                    {{ errors.category_id }}
                                </p>
                            </div>

                            <!-- Base Price -->
                            <div>
                                <label class="block text-xs font-bold uppercase tracking-[0.2em] text-ink mb-2">
                                    Base price <span class="text-accent">*</span>
                                </label>
                                <div class="relative">
                                    <span class="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 font-semibold">
                                        {{ '$' }}
                                    </span>
                                    <input v-model="form.base_price" type="number" step="0.01"
                                        class="input-base pl-9" placeholder="0.00" aria-label="Base price" />
                                </div>
                                <p v-if="errors.base_price" class="mt-1.5 text-xs text-danger font-semibold">
                                    {{ errors.base_price }}
                                </p>
                            </div>
                        </div>

                        <!-- Status -->
                        <div>
                            <label class="block text-xs font-bold uppercase tracking-[0.2em] text-ink mb-3">Status</label>
                            <div class="flex gap-3">
                                <label class="flex items-center gap-2.5 cursor-pointer px-4 py-2.5 rounded-xl border border-neutral-200 hover:border-ink transition-colors"
                                    :class="{ 'border-ink bg-ink text-paper': form.product_status === 'active' }">
                                    <input v-model="form.product_status" type="radio" value="active" class="hidden" />
                                    <span class="text-sm font-semibold">Active</span>
                                </label>
                                <label class="flex items-center gap-2.5 cursor-pointer px-4 py-2.5 rounded-xl border border-neutral-200 hover:border-ink transition-colors"
                                    :class="{ 'border-ink bg-ink text-paper': form.product_status === 'inactive' }">
                                    <input v-model="form.product_status" type="radio" value="inactive" class="hidden" />
                                    <span class="text-sm font-semibold">Inactive</span>
                                </label>
                            </div>
                        </div>

                        <!-- Tags -->
                        <div>
                            <label class="block text-xs font-bold uppercase tracking-[0.2em] text-ink mb-3 flex items-center gap-2">
                                <Tag class="w-3.5 h-3.5 text-accent" />
                                Product tags
                                <span class="text-xs font-normal text-neutral-400">(optional)</span>
                            </label>
                            <div class="flex flex-wrap gap-1.5 mb-3">
                                <button
                                    v-for="tag in COMMON_TAGS"
                                    :key="tag"
                                    type="button"
                                    @click="toggleFormTag(tag)"
                                    class="px-3 py-1.5 rounded-full text-xs font-bold border transition-all duration-150"
                                    :class="form.tags.includes(tag)
                                        ? 'bg-accent text-white border-accent shadow-sm'
                                        : 'bg-paper text-neutral-500 border-neutral-200 hover:border-accent hover:text-accent'"
                                >
                                    {{ tag }}
                                </button>
                            </div>
                            <div class="flex items-center gap-2">
                                <input
                                    v-model="customTagInput"
                                    type="text"
                                    placeholder="Custom tag..."
                                    class="input-base text-sm flex-1"
                                    @keydown="handleCustomTagKeydown"
                                    aria-label="Custom tag"
                                />
                                <button
                                    type="button"
                                    @click="addCustomFormTag"
                                    class="btn-outline text-sm px-3 gap-1"
                                    :disabled="!customTagInput.trim()"
                                >
                                    <Plus class="w-3.5 h-3.5" />
                                    Add
                                </button>
                            </div>
                            <!-- Selected tags preview -->
                            <div v-if="form.tags.length > 0" class="flex flex-wrap gap-1.5 mt-3">
                                <span
                                    v-for="(tag, idx) in form.tags"
                                    :key="idx"
                                    class="inline-flex items-center gap-1 px-2.5 py-1 bg-ink text-paper rounded-full text-[10px] font-bold"
                                >
                                    {{ tag }}
                                    <button type="button" @click="removeFormTag(idx)" class="hover:text-danger transition-colors p-0.5">
                                        <X class="w-3 h-3" />
                                    </button>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ── Product Images ────────────────────────────────────────── -->
                <div class="card-flat p-6 md:p-8">
                    <div class="flex items-center justify-between mb-6">
                        <h2 class="text-base font-bold text-ink flex items-center gap-2">
                            <ImageIcon class="w-4 h-4 text-accent" />
                            Product images
                        </h2>
                        <button type="button" @click="showImageBrowser = !showImageBrowser"
                            class="btn-ghost text-xs gap-1.5">
                            <Eye v-if="!showImageBrowser" class="w-3.5 h-3.5" />
                            <EyeOff v-else class="w-3.5 h-3.5" />
                            {{ showImageBrowser ? 'Hide browser' : 'Browse images' }}
                        </button>
                    </div>

                    <!-- Selected Main Image Preview -->
                    <div v-if="selectedMainImage" class="mb-4">
                        <label class="block text-xs font-bold uppercase tracking-[0.2em] text-accent mb-2 flex items-center gap-1.5">
                            <CheckCircle2 class="w-3.5 h-3.5" />
                            Main image
                        </label>
                        <div class="relative group w-48 h-48 rounded-xl overflow-hidden border-2 border-accent bg-neutral-100">
                            <img :src="selectedMainImage.url" alt="Main product image"
                                class="w-full h-full object-cover" />
                            <button type="button" @click="removeMainImage"
                                class="absolute top-2 right-2 w-7 h-7 bg-ink/60 hover:bg-danger text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                <X class="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    <!-- Selected Extra Images -->
                    <div v-if="selectedExtraImages.size > 0" class="mb-4">
                        <label class="block text-xs font-bold uppercase tracking-[0.2em] text-neutral-500 mb-2">
                            Additional images ({{ selectedExtraImages.size }})
                        </label>
                        <div class="flex gap-2 flex-wrap">
                            <div v-for="img in form.selected_images" :key="img.filename"
                                class="w-16 h-16 rounded-lg overflow-hidden border border-neutral-200 bg-neutral-100">
                                <img :src="img.url" :alt="img.filename"
                                    class="w-full h-full object-cover" />
                            </div>
                        </div>
                    </div>

                    <!-- Image Browser Grid -->
                    <div v-if="showImageBrowser">
                        <!-- Upload Area -->
                        <div class="mb-4">
                            <div @drop.prevent="handleDrop" @dragover.prevent="isDragOver = true"
                                @dragleave.prevent="isDragOver = false" @click="triggerFileInput"
                                class="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all"
                                :class="isDragOver ? 'border-accent bg-accent/5' : 'border-neutral-300 hover:border-neutral-400 bg-neutral-50'">
                                <input ref="fileInput" type="file" accept="image/*" multiple
                                    class="hidden" @change="handleFileSelect" />
                                <Upload class="w-6 h-6 text-neutral-400 mx-auto mb-2" />
                                <p class="text-xs text-neutral-500 font-medium">Click or drag to upload new images</p>
                            </div>
                            <!-- Upload Preview -->
                            <div v-if="uploadPreviewUrls.length > 0" class="mt-3 space-y-3">
                                <div class="flex gap-2 flex-wrap">
                                    <div v-for="(preview, i) in uploadPreviewUrls" :key="i"
                                        class="relative w-16 h-16 rounded-lg overflow-hidden border border-neutral-200">
                                        <img :src="preview.url" :alt="preview.name" class="w-full h-full object-cover" />
                                        <button type="button" @click="removeUploadPreview(i)"
                                            class="absolute top-0.5 right-0.5 w-4 h-4 bg-ink/60 text-white rounded-full flex items-center justify-center">
                                            <X class="w-2.5 h-2.5" />
                                        </button>
                                    </div>
                                </div>
                                <button type="button" @click="executeUpload" :disabled="uploading"
                                    class="btn-accent text-xs gap-1.5">
                                    <Loader2 v-if="uploading" class="w-3.5 h-3.5 animate-spin" />
                                    <Upload v-else class="w-3.5 h-3.5" />
                                    {{ uploading ? 'Uploading...' : `Upload ${uploadPreviewUrls.length} image(s)` }}
                                </button>
                            </div>
                        </div>

                        <!-- Existing Images Grid -->
                        <div v-if="loadImages" class="flex justify-center py-8">
                            <Loader2 class="w-6 h-6 text-accent animate-spin" />
                        </div>
                        <div v-else-if="uploadedImages.length === 0"
                            class="text-center py-8 text-neutral-400 text-sm">
                            <ImageIcon class="w-8 h-8 mx-auto mb-2 opacity-50" />
                            No images uploaded yet. Upload images above.
                        </div>
                        <div v-else>
                            <label class="block text-xs font-bold uppercase tracking-[0.2em] text-neutral-500 mb-2">
                                Existing images
                            </label>
                            <div class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                                <div v-for="image in uploadedImages" :key="image.filename"
                                    class="relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all"
                                    :class="{
                                        'border-accent ring-2 ring-accent/30': selectedMainImage?.filename === image.filename,
                                        'border-neutral-200 hover:border-neutral-400': selectedMainImage?.filename !== image.filename
                                    }"
                                    @click="selectMainImage(image)">
                                    <div class="aspect-square bg-neutral-100">
                                        <img :src="image.url" :alt="image.filename"
                                            class="w-full h-full object-cover" />
                                    </div>
                                    <!-- Main badge -->
                                    <div v-if="selectedMainImage?.filename === image.filename"
                                        class="absolute top-1 left-1 w-4 h-4 bg-accent rounded-full flex items-center justify-center">
                                        <Check class="w-3 h-3 text-white" />
                                    </div>
                                    <!-- Extra image toggle -->
                                    <button type="button" @click.stop="toggleExtraImage(image)"
                                        class="absolute top-1 right-1 w-4 h-4 rounded-full border border-white flex items-center justify-center text-[8px] font-bold transition-all"
                                        :class="selectedExtraImages.has(image.filename) ? 'bg-accent text-white' : 'bg-ink/50 text-white hover:bg-ink/70'">
                                        <template v-if="selectedExtraImages.has(image.filename)">✓</template>
                                        <template v-else>+</template>
                                    </button>
                                    <!-- Delete -->
                                    <button type="button" @click.stop="deleteImage(image.filename)"
                                        class="absolute bottom-1 right-1 w-5 h-5 bg-danger/80 text-white rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-[10px]"
                                        title="Delete image">
                                        <Trash2 class="w-3 h-3" />
                                    </button>
                                    <!-- Extra images count badge -->
                                    <div v-if="selectedExtraImages.has(image.filename) && selectedMainImage?.filename !== image.filename"
                                        class="absolute inset-0 bg-accent/10 border-2 border-accent rounded-lg pointer-events-none">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- URL fallback (always visible) -->
                    <div class="mt-4 pt-4 border-t border-neutral-200">
                        <label class="block text-xs font-bold uppercase tracking-[0.2em] text-neutral-500 mb-2 flex items-center gap-1.5">
                            <Link2 class="w-3 h-3" />
                            Or paste image URL
                        </label>
                        <input v-model="form.main_image" type="url" class="input-base"
                            placeholder="https://example.com/image.jpg" aria-label="Main image URL" />
                    </div>
                </div>

                <!-- ── Variant Attributes Builder ────────────────────────────── -->
                <div class="card-flat p-6 md:p-8">
                    <h2 class="text-base font-bold text-ink mb-6 flex items-center gap-2">
                        <Settings2 class="w-4 h-4 text-accent" />
                        Variant attributes
                        <span class="text-xs font-normal text-neutral-500">(optional)</span>
                    </h2>

                    <!-- Attribute Definitions -->
                    <div class="space-y-4">
                        <div v-for="(attr, aIdx) in attributeDefinitions" :key="attr.id"
                            class="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                            <div class="flex items-center gap-3 mb-3">
                                <div class="flex-1">
                                    <input v-model="attr.name" type="text" @input="regenerateVariants()"
                                        class="input-base text-sm font-semibold"
                                        :placeholder="'e.g. Color, Size, Material'"
                                        aria-label="Attribute name" />
                                </div>
                                <button type="button" @click="removeAttribute(aIdx)"
                                    class="text-neutral-400 hover:text-danger transition-colors p-1">
                                    <X class="w-4 h-4" />
                                </button>
                            </div>

                            <!-- Values for this attribute -->
                            <div class="flex gap-2 flex-wrap">
                                <div v-for="(val, vIdx) in attr.values" :key="vIdx"
                                    class="flex items-center gap-1">
                                    <input v-model="attr.values[vIdx]" type="text"
                                        @input="regenerateVariants()"
                                        class="w-24 sm:w-28 px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs text-center focus:border-accent focus:ring-1 focus:ring-accent/20 outline-none transition-all"
                                        :placeholder="'Value ' + (vIdx + 1)"
                                        aria-label="Attribute value" />
                                    <button v-if="attr.values.length > 1" type="button"
                                        @click="removeAttributeValue(aIdx, vIdx)"
                                        class="text-neutral-300 hover:text-danger transition-colors p-0.5">
                                        <X class="w-3 h-3" />
                                    </button>
                                </div>
                                <button type="button" @click="addAttributeValue(aIdx)"
                                    class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed border-neutral-300 text-xs text-neutral-500 hover:border-accent hover:text-accent transition-all">
                                    <Plus class="w-3 h-3" />
                                    Add value
                                </button>
                            </div>
                        </div>

                        <!-- Add Attribute Button -->
                        <button type="button" @click="addAttribute"
                            class="btn-outline text-sm gap-1.5 w-full py-2.5">
                            <Plus class="w-4 h-4" />
                            Add attribute
                        </button>

                        <!-- Server-side variant errors -->
                        <p v-if="errors.variants"
                            class="mt-2 text-xs text-danger font-semibold flex items-center gap-1.5">
                            <XCircle class="w-3.5 h-3.5" />
                            {{ errors.variants }}
                        </p>

                        <!-- No attributes state -->
                        <div v-if="attributeDefinitions.length === 0"
                            class="text-center py-6 text-neutral-400 text-sm">
                            <Layers class="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>Add attributes like <strong>Color</strong>, <strong>Size</strong>, or <strong>Material</strong>
                                to generate variant combinations automatically.</p>
                        </div>
                    </div>

                    <!-- ── Generated Variants ────────────────────────────────── -->
                    <div v-if="generatedVariants.length > 0" class="mt-6 pt-6 border-t border-neutral-200">
                        <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
                            <h3 class="text-sm font-bold text-ink flex items-center gap-2">
                                <Box class="w-4 h-4 text-accent" />
                                Generated variants
                                <span class="text-xs font-normal text-neutral-500">({{ generatedVariants.length }})</span>
                            </h3>
                            <button type="button" @click="generateSkus"
                                class="btn-accent text-xs gap-1.5 px-3 py-1.5"
                                :disabled="!form.product_name.trim() || generatedVariants.length === 0">
                                <Sparkle class="w-3.5 h-3.5" />
                                Generate SKUs
                            </button>
                        </div>

                        <div class="overflow-x-auto">
                            <table class="w-full min-w-150">
                                <thead>
                                    <tr class="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500 border-b border-neutral-200">
                                        <th class="px-3 py-2 text-left">Variant</th>
                                        <th class="px-3 py-2 text-left">SKU</th>
                                        <th class="px-3 py-2 text-right">Price</th>
                                        <th class="px-3 py-2 text-right">Stock</th>
                                        <th class="px-3 py-2 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-neutral-100">
                                    <tr v-for="(variant, vIdx) in generatedVariants" :key="vIdx"
                                        class="hover:bg-neutral-50/50 transition-colors">
                                        <td class="px-3 py-2.5">
                                            <span class="text-sm font-semibold text-ink">
                                                {{ variantPreviewLabel(variant) }}
                                            </span>
                                        </td>
                                        <td class="px-3 py-2.5">
                                            <input v-model="variant.sku" type="text"
                                                class="w-full px-2 py-1 bg-white border border-neutral-200 rounded-lg text-xs font-mono focus:border-accent focus:ring-1 focus:ring-accent/20 outline-none transition-all"
                                                placeholder="Optional" aria-label="SKU" />
                                        </td>
                                        <td class="px-3 py-2.5">
                                            <div class="relative">
                                                <span class="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">$</span>
                                                <input v-model="variant.variant_price" type="number" step="0.01"
                                                    class="w-full pl-5 pr-2 py-1 bg-white border border-neutral-200 rounded-lg text-xs text-right font-semibold tabular-nums focus:border-accent focus:ring-1 focus:ring-accent/20 outline-none transition-all"
                                                    placeholder="0.00" aria-label="Variant price" />
                                            </div>
                                        </td>
                                        <td class="px-3 py-2.5">
                                            <input v-model.number="variant.stock_quantity" type="number" min="0"
                                                class="w-20 px-2 py-1 bg-white border border-neutral-200 rounded-lg text-xs text-right font-semibold tabular-nums focus:border-accent focus:ring-1 focus:ring-accent/20 outline-none transition-all"
                                                placeholder="0" aria-label="Stock quantity" />
                                        </td>
                                        <td class="px-3 py-2.5 text-center">
                                            <button type="button" @click="removeGeneratedVariant(vIdx)"
                                                class="text-neutral-300 hover:text-danger transition-colors p-0.5">
                                                <X class="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- ── Manual Variant (Single) ──────────────────────────── -->
                    <div class="mt-4 pt-4 border-t border-neutral-200">
                        <button type="button" @click="showManualVariant = !showManualVariant"
                            class="btn-ghost text-xs gap-1.5">
                            <Plus class="w-3.5 h-3.5" />
                            {{ showManualVariant ? 'Cancel' : 'Add single variant manually' }}
                        </button>

                        <div v-if="showManualVariant" class="mt-3 animate-fade-in space-y-4">
                            <!-- Option rows: name + value pairs -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <span class="text-xs font-bold uppercase tracking-[0.15em] text-ink">Options</span>
                                    <button type="button" @click="addManualOptionField"
                                        class="text-[10px] text-accent font-bold hover:underline flex items-center gap-1">
                                        <Plus class="w-3 h-3" /> Add option
                                    </button>
                                </div>

                                <div v-for="(opt, oIdx) in manualVariantOptions" :key="oIdx"
                                    class="flex items-center gap-2 mb-2">
                                    <input v-model="opt.name" type="text"
                                        placeholder="e.g. Color, Size, Storage"
                                        class="input-base text-sm flex-1" aria-label="Attribute name" />
                                    <input v-model="opt.value" type="text"
                                        placeholder="e.g. Natural Titanium, 256GB"
                                        class="input-base text-sm flex-[2]" aria-label="Attribute value" />
                                    <button v-if="manualVariantOptions.length > 1" type="button"
                                        @click="removeManualOptionField(oIdx)"
                                        class="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-neutral-200 text-neutral-400 hover:text-danger hover:border-danger transition-colors"
                                        title="Remove option">
                                        <X class="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <!-- Price & Stock fields -->
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-xs font-semibold text-ink mb-1">
                                        Price <span class="text-neutral-400 font-normal">(optional)</span>
                                    </label>
                                    <div class="relative">
                                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm font-medium">$</span>
                                        <input v-model="manualVariantPrice" type="number" step="0.01"
                                            class="input-base pl-7 text-sm" placeholder="0.00" aria-label="Variant price" />
                                    </div>
                                </div>
                                <div>
                                    <label class="block text-xs font-semibold text-ink mb-1">Stock quantity</label>
                                    <input v-model.number="manualVariantStock" type="number" min="0"
                                        class="input-base text-sm" placeholder="0" aria-label="Variant stock" />
                                </div>
                            </div>

                            <!-- Add button -->
                            <button type="button" @click="addManualVariant"
                                class="btn-accent text-sm w-full py-2.5 flex items-center justify-center gap-1.5">
                                <Plus class="w-4 h-4" />
                                Add variant to list
                            </button>
                        </div>
                    </div>
                </div>

                <!-- ── Action Buttons ────────────────────────────────────────── -->
                <div class="flex flex-col sm:flex-row gap-3 pt-2">
                    <button type="button" @click="cancel" class="btn-outline flex-1 py-3.5">
                        Cancel
                    </button>
                    <button type="submit" :disabled="submitting"
                        class="btn-accent shine-effect flex-1 py-3.5 disabled:opacity-50">
                        <Loader2 v-if="submitting" class="w-4 h-4 animate-spin inline mr-2" />
                        {{ submitting
                            ? (isEditing ? 'Saving changes...' : 'Creating product...')
                            : (isEditing ? 'Save changes' : 'Create product')
                        }}
                    </button>
                </div>
            </form>
        </div>
    </div>
</template>

<style scoped>
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
    animation: fadeIn 0.25s ease-out;
}
</style>
