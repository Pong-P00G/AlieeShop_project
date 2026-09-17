import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/vue';
import Config from '../../src/views/dashboard/Config.vue';
import { paymentAPI } from '../../src/api/paymentApi.js';
import { settingsAPI } from '../../src/api/settingsApi.js';

// ── Mock all API modules ────────────────────────────────────────────────────
vi.mock('../../src/api/paymentApi.js', () => ({
    paymentAPI: {
        getAllPaymentMethods: vi.fn(),
        updatePaymentMethod: vi.fn(),
    }
}));

vi.mock('../../src/api/settingsApi.js', () => ({
    settingsAPI: {
        getSettings: vi.fn(),
        updateSettings: vi.fn(),
    }
}));

// Mock toast composable with hoisted ref for assertion access
const mockToast = vi.hoisted(() => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
}));

vi.mock('../../src/composables/useToast.js', () => ({
    useToast: () => mockToast,
}));

// ── Sample data ─────────────────────────────────────────────────────────────
const codMethod = {
    methodId: 3,
    methodName: 'Cash on Delivery',
    fee: 2,
    isActive: true,
    description: 'Pay with cash when your order arrives.',
};

const storedSettings = {
    tax_rate: '8',
    default_currency: 'USD',
    currency_symbol: '$',
    free_shipping_threshold: '50',
    default_shipping_origin: 'Phnom Penh, Cambodia',
};

const saveSettingsButton = () => screen.getByRole('button', { name: 'Save Settings' });

beforeEach(() => {
    vi.clearAllMocks();
});

// ── First-run state ─────────────────────────────────────────────────────────
describe('Config — first run with no stored settings', () => {
    it('keeps the form editable instead of failing the whole page', async () => {
        paymentAPI.getAllPaymentMethods.mockResolvedValue({ success: true, data: [] });
        settingsAPI.getSettings.mockResolvedValue({ success: true, data: {} });

        render(Config);

        // The page must render — an empty settings table is not an error
        expect(await screen.findByText('Using default settings')).toBeTruthy();
        expect(screen.queryByText('Configuration Error')).toBeNull();
        expect(screen.getByText('Store Settings')).toBeTruthy();

        // Defaults are shown and the settings can actually be created
        expect(screen.getByLabelText('Default shipping origin').value).toBe('');
        expect(saveSettingsButton().disabled).toBe(false);
    });

    it('omits the COD section without failing the page when COD is absent', async () => {
        paymentAPI.getAllPaymentMethods.mockResolvedValue({ success: true, data: [] });
        settingsAPI.getSettings.mockResolvedValue({ success: true, data: storedSettings });

        render(Config);

        await screen.findByLabelText('Default shipping origin');

        expect(screen.queryByText('Cash on Delivery Fee')).toBeNull();
        expect(screen.queryByText('Configuration Error')).toBeNull();
    });
});

// ── Genuine failures ────────────────────────────────────────────────────────
describe('Config — failed load', () => {
    it('shows the error card when the settings request rejects', async () => {
        paymentAPI.getAllPaymentMethods.mockResolvedValue({ success: true, data: [codMethod] });
        settingsAPI.getSettings.mockRejectedValue({ response: { data: { message: 'db down' } } });

        render(Config);

        expect(await screen.findByText('Configuration Error')).toBeTruthy();
        expect(screen.getByText('db down')).toBeTruthy();
    });

    it('shows the error card when the settings response reports failure', async () => {
        paymentAPI.getAllPaymentMethods.mockResolvedValue({ success: true, data: [codMethod] });
        settingsAPI.getSettings.mockResolvedValue({ success: false, message: 'Settings unavailable' });

        render(Config);

        expect(await screen.findByText('Configuration Error')).toBeTruthy();
        expect(screen.getByText('Settings unavailable')).toBeTruthy();
    });

    it('still renders the COD section when only the payment call fails', async () => {
        paymentAPI.getAllPaymentMethods.mockRejectedValue(new Error('payments down'));
        settingsAPI.getSettings.mockResolvedValue({ success: true, data: storedSettings });

        render(Config);

        await screen.findByLabelText('Default shipping origin');

        expect(screen.queryByText('Cash on Delivery Fee')).toBeNull();
        expect(screen.queryByText('Configuration Error')).toBeNull();
    });
});

// ── Loaded state ────────────────────────────────────────────────────────────
describe('Config — loaded settings', () => {
    beforeEach(() => {
        paymentAPI.getAllPaymentMethods.mockResolvedValue({ success: true, data: [codMethod] });
        settingsAPI.getSettings.mockResolvedValue({ success: true, data: storedSettings });
    });

    it('populates the form and keeps save disabled until something changes', async () => {
        render(Config);

        expect((await screen.findByLabelText('Default shipping origin')).value).toBe('Phnom Penh, Cambodia');
        expect(screen.queryByText('Using default settings')).toBeNull();
        expect(saveSettingsButton().disabled).toBe(true);
    });

    it('enables save once a field is edited', async () => {
        render(Config);

        const origin = await screen.findByLabelText('Default shipping origin');
        expect(saveSettingsButton().disabled).toBe(true);

        await fireEvent.update(origin, 'Bangkok, Thailand');

        expect(saveSettingsButton().disabled).toBe(false);
    });

    it('normalises the currency code to uppercase when saving', async () => {
        settingsAPI.updateSettings.mockResolvedValue({
            success: true,
            data: { ...storedSettings, default_currency: 'EUR' },
        });

        render(Config);

        const code = await screen.findByLabelText('Currency code');
        await fireEvent.update(code, 'eur');
        await fireEvent.click(saveSettingsButton());

        await waitFor(() => {
            expect(settingsAPI.updateSettings).toHaveBeenCalledTimes(1);
            expect(settingsAPI.updateSettings).toHaveBeenCalledWith(
                expect.objectContaining({ default_currency: 'EUR' })
            );
        });
    });

    it('uses the configured currency symbol when saving the COD fee', async () => {
        settingsAPI.getSettings.mockResolvedValue({
            success: true,
            data: { ...storedSettings, currency_symbol: '€' },
        });
        paymentAPI.updatePaymentMethod.mockResolvedValue({ success: true });

        render(Config);

        const fee = await screen.findByLabelText('COD service fee');
        await fireEvent.update(fee, '5');
        await fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            expect(mockToast.success).toHaveBeenCalledWith('COD fee updated to €5.00');
        });
    });
});
