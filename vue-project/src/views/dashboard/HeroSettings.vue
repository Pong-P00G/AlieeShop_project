<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { heroAPI } from '../../api/heroApi.js';
import { useToast } from '../../composables/useToast.js';
import {
    LayoutTemplate,
    Image as ImageIcon,
    Plus,
    Pencil,
    Trash2,
    ArrowUp,
    ArrowDown,
    Eye,
    EyeOff,
    Loader2,
    Save,
    X,
    Upload,
    Link2,
    RefreshCw,
    AlertCircle,
    Info,
    PlayCircle,
    MousePointerClick,
} from 'lucide-vue-next';

const toast = useToast();

// ── State ──────────────────────────────────────────────────────────────────────
const loading = ref(true);
const error = ref(null);
const slides = ref([]);
const maxSlides = ref(12);
const busySlideId = ref(null);   // slide currently being toggled / reordered
const savingSettings = ref(false);

const DEFAULT_SETTINGS = {
    sectionEnabled: true,
    autoplayEnabled: true,
    autoplayInterval: 5000,
    secondaryLabel: 'Our Story',
    secondaryLink: '/about',
};

// `saved` is the last known server state (dirty baseline); `form` is the editor.
const saved = ref({ ...DEFAULT_SETTINGS });
const form = reactive({
    sectionEnabled: DEFAULT_SETTINGS.sectionEnabled,
    autoplayEnabled: DEFAULT_SETTINGS.autoplayEnabled,
    intervalSeconds: DEFAULT_SETTINGS.autoplayInterval / 1000,
    secondaryLabel: DEFAULT_SETTINGS.secondaryLabel,
    secondaryLink: DEFAULT_SETTINGS.secondaryLink,
});

// ── Computed ───────────────────────────────────────────────────────────────────
const settingsDirty = computed(() => (
    form.sectionEnabled !== saved.value.sectionEnabled ||
    form.autoplayEnabled !== saved.value.autoplayEnabled ||
    Math.round(Number(form.intervalSeconds) * 1000) !== saved.value.autoplayInterval ||
    String(form.secondaryLabel ?? '').trim() !== saved.value.secondaryLabel ||
    String(form.secondaryLink ?? '').trim() !== saved.value.secondaryLink
));

const activeCount = computed(() => slides.value.filter(s => s.isActive).length);
const atSlideCap = computed(() => slides.value.length >= maxSlides.value);

const applySettings = (incoming = {}) => {
    const merged = { ...DEFAULT_SETTINGS, ...incoming };
    saved.value = { ...merged };
    form.sectionEnabled = merged.sectionEnabled;
    form.autoplayEnabled = merged.autoplayEnabled;
    form.intervalSeconds = merged.autoplayInterval / 1000;
    form.secondaryLabel = merged.secondaryLabel;
    form.secondaryLink = merged.secondaryLink;
};

// ── Load ───────────────────────────────────────────────────────────────────────
const load = async () => {
    try {
        loading.value = true;
        error.value = null;

        const res = await heroAPI.getAdminHero();
        if (!res?.success) {
            error.value = res?.message || 'Failed to load hero content.';
            return;
        }

        slides.value = Array.isArray(res.data?.slides) ? res.data.slides : [];
        maxSlides.value = res.data?.maxSlides ?? 12;
        applySettings(res.data?.settings);
    } catch (err) {
        console.error('Error loading hero content:', err);
        error.value = err.response?.data?.message || 'Could not reach the hero service.';
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
    const label = String(form.secondaryLabel ?? '').trim();
    const link = String(form.secondaryLink ?? '').trim();
    if (label && !link) {
        toast.error('The secondary button needs a link');
        return;
    }
    if (link && !label) {
        toast.error('The secondary link needs a button label');
        return;
    }

    savingSettings.value = true;
    try {
        const res = await heroAPI.updateSectionSettings({
            hero_section_enabled: form.sectionEnabled,
            hero_autoplay_enabled: form.autoplayEnabled,
            hero_autoplay_interval: Math.round(seconds * 1000),
            hero_secondary_label: label,
            hero_secondary_link: link,
        });
        if (res?.success) {
            applySettings(res.data);
            toast.success('Hero settings updated');
        } else {
            toast.error(res?.message || 'Failed to update hero settings');
        }
    } catch (err) {
        console.error('Error saving hero settings:', err);
        toast.error(err.response?.data?.message || 'Failed to update hero settings');
    } finally {
        savingSettings.value = false;
    }
};

// ── Slide editor ───────────────────────────────────────────────────────────────
const editorOpen = ref(false);
const editingId = ref(null);
const savingSlide = ref(false);
const uploading = ref(false);
const slideErrors = reactive({});
const fileInput = ref(null);

const emptySlide = () => ({
    title: '',
    titleAccent: '',
    eyebrow: '',
    description: '',
    badge: '',
    image: '',
    cta: '',
    ctaLink: '',
    isActive: true,
});

const slideForm = reactive(emptySlide());

const clearErrors = () => Object.keys(slideErrors).forEach(key => delete slideErrors[key]);

const openCreate = () => {
    editingId.value = null;
    Object.assign(slideForm, emptySlide());
    clearErrors();
    editorOpen.value = true;
};

const openEdit = (slide) => {
    editingId.value = slide.id;
    Object.assign(slideForm, {
        title: slide.title ?? '',
        titleAccent: slide.titleAccent ?? '',
        eyebrow: slide.eyebrow ?? '',
        description: slide.description ?? '',
        badge: slide.badge ?? '',
        image: slide.image ?? '',
        cta: slide.cta ?? '',
        ctaLink: slide.ctaLink ?? '',
        isActive: slide.isActive !== false,
    });
    clearErrors();
    editorOpen.value = true;
};

const closeEditor = () => {
    editorOpen.value = false;
    editingId.value = null;
};

const validateSlide = () => {
    clearErrors();
    const title = String(slideForm.title ?? '').trim();
    const image = String(slideForm.image ?? '').trim();
    const cta = String(slideForm.cta ?? '').trim();
    const ctaLink = String(slideForm.ctaLink ?? '').trim();

    if (!title) slideErrors.title = 'A title is required';
    if (!image) slideErrors.image = 'An image is required';
    if (ctaLink && !/^(\/[^/]|https?:\/\/)/.test(ctaLink)) {
        slideErrors.ctaLink = 'Use an in-app path like /product or a full https:// URL';
    }
    if (ctaLink && !cta) slideErrors.cta = 'Add a button label for this link';
    if (cta && !ctaLink) slideErrors.ctaLink = 'Add a link for this button';

    return Object.keys(slideErrors).length === 0;
};

const saveSlide = async () => {
    if (!validateSlide()) return;

    const payload = {
        title: String(slideForm.title).trim(),
        titleAccent: String(slideForm.titleAccent ?? '').trim(),
        eyebrow: String(slideForm.eyebrow ?? '').trim(),
        description: String(slideForm.description ?? '').trim(),
        badge: String(slideForm.badge ?? '').trim(),
        image: String(slideForm.image).trim(),
        cta: String(slideForm.cta ?? '').trim(),
        ctaLink: String(slideForm.ctaLink ?? '').trim(),
        isActive: slideForm.isActive,
    };

    savingSlide.value = true;
    try {
        const res = editingId.value
            ? await heroAPI.updateSlide(editingId.value, payload)
            : await heroAPI.createSlide(payload);

        if (res?.success) {
            toast.success(editingId.value ? 'Slide updated' : 'Slide added');
            closeEditor();
            await load();
        } else {
            toast.error(res?.message || 'Failed to save slide');
        }
    } catch (err) {
        console.error('Error saving slide:', err);
        const firstFieldError = err.response?.data?.errors?.[0]?.message;
        toast.error(firstFieldError || err.response?.data?.message || 'Failed to save slide');
    } finally {
        savingSlide.value = false;
    }
};

// ── Image upload ───────────────────────────────────────────────────────────────
const triggerFilePick = () => fileInput.value?.click();

const onFileSelected = async (event) => {
    const file = event.target.files?.[0];
    // Reset immediately so re-picking the same file still fires `change`.
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        toast.error('Please choose an image file');
        return;
    }

    uploading.value = true;
    try {
        const res = await heroAPI.uploadImage(file);
        const uploaded = res?.data?.[0];
        if (res?.success && uploaded?.url) {
            slideForm.image = uploaded.url;
            delete slideErrors.image;
            toast.success('Image uploaded');
        } else {
            toast.error(res?.message || 'Upload failed');
        }
    } catch (err) {
        console.error('Error uploading hero image:', err);
        toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
        uploading.value = false;
    }
};

// ── Visibility / order / delete ────────────────────────────────────────────────
const toggleActive = async (slide) => {
    busySlideId.value = slide.id;
    try {
        const res = await heroAPI.setSlideActive(slide.id, !slide.isActive);
        if (res?.success) {
            slide.isActive = res.data.isActive;
            toast.success(res.data.isActive ? 'Slide shown on the storefront' : 'Slide hidden');
        } else {
            toast.error(res?.message || 'Failed to update slide');
        }
    } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to update slide');
    } finally {
        busySlideId.value = null;
    }
};

const persistOrder = async (ordered) => {
    const previous = slides.value;
    slides.value = ordered; // optimistic — feels instant, reverted on failure
    try {
        const res = await heroAPI.reorderSlides(ordered.map(s => s.id));
        if (!res?.success) throw new Error(res?.message || 'Reorder failed');
        toast.success('Slide order updated');
    } catch (err) {
        slides.value = previous;
        toast.error(err.response?.data?.message || err.message || 'Failed to reorder slides');
    } finally {
        busySlideId.value = null;
    }
};

const moveSlide = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= slides.value.length) return;
    const ordered = [...slides.value];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    busySlideId.value = ordered[target].id;
    persistOrder(ordered);
};

const slideToDelete = ref(null);
const deleting = ref(false);

const askDelete = (slide) => { slideToDelete.value = slide; };
const cancelDelete = () => { if (!deleting.value) slideToDelete.value = null; };

const confirmDelete = async () => {
    if (!slideToDelete.value) return;
    deleting.value = true;
    try {
        const res = await heroAPI.deleteSlide(slideToDelete.value.id);
        if (res?.success) {
            toast.success('Slide deleted');
            slideToDelete.value = null;
            await load();
        } else {
            toast.error(res?.message || 'Failed to delete slide');
        }
    } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to delete slide');
    } finally {
        deleting.value = false;
    }
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
                        <div class="h-5 w-40 skeleton-shimmer rounded"></div>
                        <div class="h-3 w-56 skeleton-shimmer rounded mt-2"></div>
                    </div>
                    <div v-for="i in 2" :key="'hero-sk-' + i" class="p-5 bg-neutral-100 rounded-2xl space-y-4">
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
                    <h3 class="font-bold text-ink text-sm">Hero content unavailable</h3>
                    <p class="text-neutral-600 text-sm mt-0.5">{{ error }}</p>
                </div>
                <button @click="load" class="btn-primary text-sm shrink-0 gap-1.5">
                    <RefreshCw class="w-3.5 h-3.5" /> Retry
                </button>
            </div>
        </div>

        <template v-else>
            <!-- ════════════════════════════════════════════════════════════════
                 SECTION: Hero behaviour
                 ════════════════════════════════════════════════════════════════ -->
            <div class="card-flat p-6 sm:p-8">
                <div class="flex items-start gap-4 sm:gap-6 flex-col sm:flex-row">
                    <div class="w-14 h-14 rounded-2xl bg-violet-50 border border-violet-200 flex items-center justify-center shrink-0">
                        <LayoutTemplate class="w-7 h-7 text-violet-600" />
                    </div>

                    <div class="flex-1 min-w-0 w-full">
                        <div class="flex items-center gap-3 flex-wrap">
                            <h2 class="text-xl font-bold text-ink">Hero Section</h2>
                            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                                :class="form.sectionEnabled
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-neutral-100 text-neutral-500'">
                                {{ form.sectionEnabled ? 'Visible' : 'Hidden' }}
                            </span>
                        </div>
                        <p class="text-sm text-neutral-500 mt-1">
                            Control the storefront hero carousel — visibility, autoplay and the secondary button
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
                                            <span class="block text-sm font-semibold text-ink">Show the hero on the storefront</span>
                                            <span class="block text-xs text-neutral-500 mt-0.5">
                                                Turn off to hide the entire hero carousel from customers.
                                            </span>
                                        </span>
                                    </label>

                                    <label class="flex items-start gap-3 p-4 bg-white rounded-xl border border-neutral-100 cursor-pointer"
                                        :class="!form.sectionEnabled ? 'opacity-50' : ''">
                                        <input type="checkbox" v-model="form.autoplayEnabled" :disabled="!form.sectionEnabled"
                                            class="mt-0.5 w-4 h-4 accent-accent shrink-0" />
                                        <span class="min-w-0">
                                            <span class="block text-sm font-semibold text-ink">Autoplay slides</span>
                                            <span class="block text-xs text-neutral-500 mt-0.5">
                                                Slides advance automatically until the customer hovers over the hero.
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

                            <!-- Secondary button -->
                            <div class="p-5 bg-neutral-50 rounded-2xl border border-neutral-200">
                                <h3 class="text-xs font-bold uppercase tracking-[0.15em] text-neutral-500 mb-4 flex items-center gap-2">
                                    <MousePointerClick class="w-3.5 h-3.5" /> Secondary Button
                                </h3>
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label class="block text-xs font-semibold text-neutral-600 mb-1.5">Button label</label>
                                        <input v-model="form.secondaryLabel" type="text" maxlength="80"
                                            class="input-base" placeholder="Our Story"
                                            aria-label="Secondary button label" />
                                    </div>
                                    <div>
                                        <label class="block text-xs font-semibold text-neutral-600 mb-1.5">Link</label>
                                        <div class="relative">
                                            <Link2 class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                                            <input v-model="form.secondaryLink" type="text" maxlength="500"
                                                class="input-base pl-9" placeholder="/about"
                                                aria-label="Secondary button link" />
                                        </div>
                                    </div>
                                </div>
                                <p class="text-xs text-neutral-400 mt-2 flex items-center gap-1">
                                    <Info class="w-3 h-3" />
                                    Shown next to each slide's main button. Leave both fields empty to remove it.
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
                                {{ savingSettings ? 'Saving...' : 'Save Hero Settings' }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ════════════════════════════════════════════════════════════════
                 SECTION: Slides
                 ════════════════════════════════════════════════════════════════ -->
            <div class="card-flat p-6 sm:p-8">
                <div class="flex items-start gap-4 sm:gap-6 flex-col sm:flex-row">
                    <div class="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                        <ImageIcon class="w-7 h-7 text-accent" />
                    </div>

                    <div class="flex-1 min-w-0 w-full">
                        <div class="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
                            <div>
                                <h2 class="text-xl font-bold text-ink">Hero Slides</h2>
                                <p class="text-sm text-neutral-500 mt-1">
                                    {{ activeCount }} of {{ slides.length }} slide{{ slides.length === 1 ? '' : 's' }} visible
                                    · limit {{ maxSlides }}
                                </p>
                            </div>
                            <button @click="openCreate" :disabled="atSlideCap"
                                class="shrink-0 px-4 py-2.5 bg-accent text-white rounded-xl font-bold text-sm
                                       hover:bg-accent-600 disabled:opacity-40 disabled:cursor-not-allowed
                                       transition-all flex items-center gap-2 shadow-sm"
                                :title="atSlideCap ? `Limit of ${maxSlides} slides reached` : 'Add a slide'">
                                <Plus class="w-4 h-4" /> Add Slide
                            </button>
                        </div>

                        <!-- Empty state -->
                        <div v-if="slides.length === 0" class="mt-6 p-10 bg-neutral-50 rounded-2xl border border-dashed border-neutral-300 text-center">
                            <ImageIcon class="w-10 h-10 text-neutral-300 mx-auto mb-3" />
                            <p class="text-sm font-semibold text-ink">No hero slides yet</p>
                            <p class="text-xs text-neutral-500 mt-1">
                                Add a slide to start building the storefront hero carousel.
                            </p>
                        </div>

                        <!-- Slide list -->
                        <ul v-else class="mt-6 space-y-3">
                            <li v-for="(slide, index) in slides" :key="slide.id"
                                class="flex items-center gap-4 p-4 bg-neutral-50 rounded-2xl border border-neutral-200"
                                :class="[!slide.isActive ? 'opacity-60' : '', busySlideId === slide.id ? 'animate-pulse' : '']">

                                <!-- Preview -->
                                <div class="w-24 h-16 sm:w-32 sm:h-20 rounded-xl overflow-hidden bg-ink shrink-0 relative">
                                    <img v-if="slide.image" :src="slide.image" :alt="slide.title"
                                        class="w-full h-full object-cover" loading="lazy" />
                                    <div v-else class="w-full h-full flex items-center justify-center">
                                        <ImageIcon class="w-5 h-5 text-paper/40" />
                                    </div>
                                    <span v-if="index === 0"
                                        class="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full bg-accent text-white text-[9px] font-bold uppercase tracking-wider">
                                        First
                                    </span>
                                </div>

                                <!-- Details -->
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <p class="font-bold text-ink text-sm truncate">
                                            {{ slide.title }}<span v-if="slide.titleAccent" class="text-neutral-500"> {{ slide.titleAccent }}</span>
                                        </p>
                                        <span v-if="slide.badge"
                                            class="px-2 py-0.5 rounded-full bg-white border border-neutral-200 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                                            {{ slide.badge }}
                                        </span>
                                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                                            :class="slide.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-200 text-neutral-600'">
                                            {{ slide.isActive ? 'Visible' : 'Hidden' }}
                                        </span>
                                    </div>
                                    <p v-if="slide.eyebrow" class="text-xs text-neutral-500 mt-1 truncate">{{ slide.eyebrow }}</p>
                                    <p v-if="slide.cta || slide.ctaLink" class="text-xs text-neutral-400 mt-1 flex items-center gap-1 truncate">
                                        <Link2 class="w-3 h-3 shrink-0" />
                                        {{ slide.cta || 'Button' }} → {{ slide.ctaLink || '—' }}
                                    </p>
                                </div>

                                <!-- Actions -->
                                <div class="flex items-center gap-1 shrink-0">
                                    <button @click="moveSlide(index, -1)" :disabled="index === 0"
                                        class="p-2 rounded-lg text-neutral-500 hover:bg-white hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        :aria-label="`Move ${slide.title} up`" title="Move up">
                                        <ArrowUp class="w-4 h-4" />
                                    </button>
                                    <button @click="moveSlide(index, 1)" :disabled="index === slides.length - 1"
                                        class="p-2 rounded-lg text-neutral-500 hover:bg-white hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        :aria-label="`Move ${slide.title} down`" title="Move down">
                                        <ArrowDown class="w-4 h-4" />
                                    </button>
                                    <button @click="toggleActive(slide)" :disabled="busySlideId === slide.id"
                                        class="p-2 rounded-lg text-neutral-500 hover:bg-white hover:text-ink disabled:opacity-30 transition-colors"
                                        :aria-label="slide.isActive ? `Hide ${slide.title}` : `Show ${slide.title}`"
                                        :title="slide.isActive ? 'Hide from storefront' : 'Show on storefront'">
                                        <EyeOff v-if="slide.isActive" class="w-4 h-4" />
                                        <Eye v-else class="w-4 h-4" />
                                    </button>
                                    <button @click="openEdit(slide)"
                                        class="p-2 rounded-lg text-neutral-500 hover:bg-white hover:text-ink transition-colors"
                                        :aria-label="`Edit ${slide.title}`" title="Edit slide">
                                        <Pencil class="w-4 h-4" />
                                    </button>
                                    <button @click="askDelete(slide)"
                                        class="p-2 rounded-lg text-danger hover:bg-danger/10 transition-colors"
                                        :aria-label="`Delete ${slide.title}`" title="Delete slide">
                                        <Trash2 class="w-4 h-4" />
                                    </button>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </template>

        <!-- ════════════════════════════════════════════════════════════════════
             Slide editor — teleported to <body> so no ancestor containing
             block (backdrop-filter / transform) can clip the fixed overlay.
             ════════════════════════════════════════════════════════════════ -->
        <Teleport to="body">
            <div v-if="editorOpen" class="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
                role="dialog" aria-modal="true" aria-labelledby="hero-editor-title">
                <div class="fixed inset-0 bg-ink/60 backdrop-blur-sm" @click="closeEditor"></div>

                <div class="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl my-auto">
                    <!-- Header -->
                    <div class="flex items-center justify-between gap-4 p-6 border-b border-neutral-100">
                        <div class="min-w-0">
                            <h3 id="hero-editor-title" class="text-lg font-bold text-ink">
                                {{ editingId ? 'Edit hero slide' : 'Add hero slide' }}
                            </h3>
                            <p class="text-xs text-neutral-500 mt-0.5">
                                Everything here appears on the storefront hero carousel.
                            </p>
                        </div>
                        <button @click="closeEditor"
                            class="p-2 rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-ink transition-colors shrink-0"
                            aria-label="Close editor">
                            <X class="w-5 h-5" />
                        </button>
                    </div>

                    <!-- Body -->
                    <div class="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
                        <!-- Image -->
                        <div>
                            <label class="block text-xs font-semibold text-neutral-600 mb-1.5">Image <span class="text-danger">*</span></label>
                            <div class="flex items-start gap-4">
                                <div class="w-28 h-20 rounded-xl overflow-hidden bg-ink shrink-0 flex items-center justify-center">
                                    <img v-if="slideForm.image" :src="slideForm.image" alt="Slide preview" class="w-full h-full object-cover" />
                                    <ImageIcon v-else class="w-6 h-6 text-paper/40" />
                                </div>
                                <div class="flex-1 min-w-0 space-y-2">
                                    <input v-model="slideForm.image" type="text"
                                        class="input-base" :class="slideErrors.image ? 'border-danger' : ''"
                                        placeholder="https://... or upload an image"
                                        aria-label="Slide image URL" />
                                    <div class="flex items-center gap-2">
                                        <button @click="triggerFilePick" :disabled="uploading"
                                            class="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-lg text-xs font-bold text-ink
                                                   transition-colors flex items-center gap-1.5 disabled:opacity-50">
                                            <Loader2 v-if="uploading" class="w-3.5 h-3.5 animate-spin" />
                                            <Upload v-else class="w-3.5 h-3.5" />
                                            {{ uploading ? 'Uploading...' : 'Upload image' }}
                                        </button>
                                        <span class="text-[11px] text-neutral-400">Stored on R2, max 5MB</span>
                                    </div>
                                    <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFileSelected" />
                                    <p v-if="slideErrors.image" class="text-xs text-danger">{{ slideErrors.image }}</p>
                                </div>
                            </div>
                        </div>

                        <!-- Title -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-semibold text-neutral-600 mb-1.5">Title <span class="text-danger">*</span></label>
                                <input v-model="slideForm.title" type="text" maxlength="150"
                                    class="input-base" :class="slideErrors.title ? 'border-danger' : ''"
                                    placeholder="Threads of" aria-label="Slide title" />
                                <p v-if="slideErrors.title" class="text-xs text-danger mt-1">{{ slideErrors.title }}</p>
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-neutral-600 mb-1.5">Accent word</label>
                                <input v-model="slideForm.titleAccent" type="text" maxlength="150"
                                    class="input-base italic" placeholder="Modernity" aria-label="Slide accent word" />
                                <p class="text-xs text-neutral-400 mt-1">Shown bold + italic on the line below the title.</p>
                            </div>
                        </div>

                        <!-- Eyebrow + badge -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-semibold text-neutral-600 mb-1.5">Eyebrow</label>
                                <input v-model="slideForm.eyebrow" type="text" maxlength="120"
                                    class="input-base" placeholder="Summer Collection 2024" aria-label="Slide eyebrow" />
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-neutral-600 mb-1.5">Badge</label>
                                <input v-model="slideForm.badge" type="text" maxlength="60"
                                    class="input-base" placeholder="New Season" aria-label="Slide badge" />
                            </div>
                        </div>

                        <!-- Description -->
                        <div>
                            <label class="block text-xs font-semibold text-neutral-600 mb-1.5">Description</label>
                            <textarea v-model="slideForm.description" rows="3" maxlength="500"
                                class="input-base resize-none"
                                placeholder="Curated apparel and essentials designed for the contemporary wardrobe."
                                aria-label="Slide description"></textarea>
                        </div>

                        <!-- CTA -->
                        <div class="p-4 bg-neutral-50 rounded-2xl border border-neutral-200">
                            <h4 class="text-xs font-bold uppercase tracking-[0.15em] text-neutral-500 mb-3">Main Button</h4>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-xs font-semibold text-neutral-600 mb-1.5">Button label</label>
                                    <input v-model="slideForm.cta" type="text" maxlength="80"
                                        class="input-base" :class="slideErrors.cta ? 'border-danger' : ''"
                                        placeholder="Shop Collection" aria-label="Button label" />
                                    <p v-if="slideErrors.cta" class="text-xs text-danger mt-1">{{ slideErrors.cta }}</p>
                                </div>
                                <div>
                                    <label class="block text-xs font-semibold text-neutral-600 mb-1.5">Link</label>
                                    <input v-model="slideForm.ctaLink" type="text" maxlength="500"
                                        class="input-base" :class="slideErrors.ctaLink ? 'border-danger' : ''"
                                        placeholder="/product?category=tech" aria-label="Button link" />
                                    <p v-if="slideErrors.ctaLink" class="text-xs text-danger mt-1">{{ slideErrors.ctaLink }}</p>
                                </div>
                            </div>
                        </div>

                        <!-- Visibility -->
                        <label class="flex items-start gap-3 p-4 bg-white rounded-xl border border-neutral-200 cursor-pointer">
                            <input type="checkbox" v-model="slideForm.isActive" class="mt-0.5 w-4 h-4 accent-accent shrink-0" />
                            <span class="min-w-0">
                                <span class="block text-sm font-semibold text-ink">Show this slide</span>
                                <span class="block text-xs text-neutral-500 mt-0.5">
                                    Hidden slides stay saved but never render for customers.
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
                        <button @click="saveSlide" :disabled="savingSlide"
                            class="px-6 py-3 bg-ink text-white rounded-xl font-bold text-sm
                                   hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed
                                   transition-all flex items-center gap-2 shadow-sm">
                            <Loader2 v-if="savingSlide" class="w-4 h-4 animate-spin" />
                            <Save v-else class="w-4 h-4" />
                            {{ savingSlide ? 'Saving...' : (editingId ? 'Save Slide' : 'Add Slide') }}
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>

        <!-- Delete confirmation -->
        <Teleport to="body">
            <div v-if="slideToDelete" class="fixed inset-0 z-50 flex items-center justify-center p-4"
                role="dialog" aria-modal="true" aria-labelledby="hero-delete-title">
                <div class="fixed inset-0 bg-ink/60 backdrop-blur-sm" @click="cancelDelete"></div>
                <div class="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6">
                    <div class="flex items-start gap-4">
                        <div class="w-11 h-11 rounded-2xl bg-danger/10 flex items-center justify-center shrink-0">
                            <Trash2 class="w-5 h-5 text-danger" />
                        </div>
                        <div class="min-w-0">
                            <h3 id="hero-delete-title" class="font-bold text-ink">Delete this slide?</h3>
                            <p class="text-sm text-neutral-500 mt-1">
                                “{{ slideToDelete.title }}” will be removed from the hero carousel immediately.
                                This cannot be undone.
                            </p>
                        </div>
                    </div>
                    <div class="flex items-center justify-end gap-3 mt-6">
                        <button @click="cancelDelete" :disabled="deleting"
                            class="px-5 py-2.5 rounded-xl font-bold text-sm text-neutral-600 hover:bg-neutral-100 transition-colors">
                            Cancel
                        </button>
                        <button @click="confirmDelete" :disabled="deleting"
                            class="px-5 py-2.5 bg-danger text-white rounded-xl font-bold text-sm
                                   hover:opacity-90 disabled:opacity-40 transition-all flex items-center gap-2">
                            <Loader2 v-if="deleting" class="w-4 h-4 animate-spin" />
                            <Trash2 v-else class="w-4 h-4" />
                            {{ deleting ? 'Deleting...' : 'Delete' }}
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>
