import { describe, it, expect, vi, beforeEach } from 'vitest';

// calculateRates reads the free_shipping_threshold store setting. Mock dbpool
// so tests are deterministic whether or not a local Postgres is running.
vi.mock('../src/database/dbpool.js', () => ({
    default: { query: vi.fn(async () => ({ rows: [] })) },
}));

import db from '../src/database/dbpool.js';
import * as shippingService from '../src/services/shippingService.js';

beforeEach(() => {
    db.query.mockClear();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  calculateRates
// ═══════════════════════════════════════════════════════════════════════════════

describe('shippingService — calculateRates', () => {
    it('returns free standard shipping for US orders over $50', async () => {
        const rates = await shippingService.calculateRates({
            subtotal: 100,
            itemCount: 3,
            country: 'US',
            state: 'CA',
            zipCode: '90210',
        });

        const standard = rates.find(r => r.id === 'standard');
        expect(standard.price).toBe(0);
        expect(standard.estimatedDays).toBe('5-7');
    });

    it('charges $5.99 standard shipping for US orders under $50', async () => {
        const rates = await shippingService.calculateRates({
            subtotal: 25,
            itemCount: 1,
            country: 'US',
            state: 'NY',
            zipCode: '10001',
        });

        const standard = rates.find(r => r.id === 'standard');
        expect(standard.price).toBe(5.99);
    });

    it('charges $5.99 for exactly $49.99 subtotal (under $50 threshold)', async () => {
        const rates = await shippingService.calculateRates({
            subtotal: 49.99, country: 'US', state: 'CA', zipCode: '90210',
        });

        const standard = rates.find(r => r.id === 'standard');
        expect(standard.price).toBe(5.99);
    });

    it('gives free shipping for exactly $50 subtotal', async () => {
        const rates = await shippingService.calculateRates({
            subtotal: 50, country: 'US', state: 'CA', zipCode: '90210',
        });

        const standard = rates.find(r => r.id === 'standard');
        expect(standard.price).toBe(0);
    });

    it('includes express shipping for US orders', async () => {
        const rates = await shippingService.calculateRates({
            subtotal: 100, country: 'US', state: 'TX', zipCode: '77001',
        });

        const express = rates.find(r => r.id === 'express');
        expect(express).toBeDefined();
        expect(express.price).toBeGreaterThan(0);
        expect(express.estimatedDays).toBe('2-3');
    });

    it('includes overnight shipping for domestic orders (US)', async () => {
        const rates = await shippingService.calculateRates({
            subtotal: 100, country: 'US', state: 'FL', zipCode: '33101',
        });

        const overnight = rates.find(r => r.id === 'overnight');
        expect(overnight).toBeDefined();
        expect(overnight.estimatedDays).toBe('1');
    });

    it('does NOT include overnight for international orders', async () => {
        const rates = await shippingService.calculateRates({
            subtotal: 200, country: 'UK', state: 'London', zipCode: 'SW1A 1AA',
        });

        const overnight = rates.find(r => r.id === 'overnight');
        expect(overnight).toBeUndefined();
    });

    it('charges Canadian standard shipping at 8% of subtotal with $5.99 minimum', async () => {
        const rates = await shippingService.calculateRates({
            subtotal: 50, country: 'CA', state: 'ON', zipCode: 'M5A 1A1',
        });

        const standard = rates.find(r => r.id === 'standard');
        // 8% of 50 = 4, min 5.99
        expect(standard.price).toBe(5.99);
    });

    it('charges Canadian standard shipping above minimum', async () => {
        const rates = await shippingService.calculateRates({
            subtotal: 200, country: 'CA', state: 'BC', zipCode: 'V6B 4Y8',
        });

        const standard = rates.find(r => r.id === 'standard');
        // 8% of 200 = 16, above 5.99 min
        expect(standard.price).toBe(16);
    });

    it('charges international standard at 15% of subtotal with $9.99 minimum', async () => {
        const rates = await shippingService.calculateRates({
            subtotal: 50, country: 'DE', state: 'Berlin', zipCode: '10115',
        });

        const standard = rates.find(r => r.id === 'standard');
        // 15% of 50 = 7.5, below 9.99 min
        expect(standard.price).toBe(9.99);
    });

    it('charges international standard above minimum threshold', async () => {
        const rates = await shippingService.calculateRates({
            subtotal: 300, country: 'JP', state: 'Tokyo', zipCode: '100-0001',
        });

        const standard = rates.find(r => r.id === 'standard');
        // 15% of 300 = 45, above 9.99 min
        expect(standard.price).toBe(45);
    });

    it('includes express shipping for international orders', async () => {
        const rates = await shippingService.calculateRates({
            subtotal: 100, country: 'AU', state: 'NSW', zipCode: '2000',
        });

        const express = rates.find(r => r.id === 'express');
        expect(express).toBeDefined();
        expect(express.estimatedDays).toBe('5-8');
    });

    it('handles very small subtotals gracefully', async () => {
        const rates = await shippingService.calculateRates({
            subtotal: 5, country: 'US', state: 'CA', zipCode: '90210',
        });

        const standard = rates.find(r => r.id === 'standard');
        expect(standard.price).toBe(5.99); // not free, below $50

        const express = rates.find(r => r.id === 'express');
        expect(express.price).toBe(12.99); // minimum express
    });

    it('handles zero subtotal gracefully', async () => {
        const rates = await shippingService.calculateRates({
            subtotal: 0, country: 'US', state: 'CA', zipCode: '90210',
        });

        const standard = rates.find(r => r.id === 'standard');
        expect(standard.price).toBe(5.99);
    });

    it('returns exactly 3 methods for US orders', async () => {
        const rates = await shippingService.calculateRates({
            subtotal: 100, country: 'US', state: 'IL', zipCode: '60601',
        });

        expect(rates).toHaveLength(3);
        expect(rates.map(r => r.id)).toEqual(['standard', 'express', 'overnight']);
    });

    it('returns exactly 2 methods for international orders', async () => {
        const rates = await shippingService.calculateRates({
            subtotal: 100, country: 'FR', state: 'Paris', zipCode: '75001',
        });

        expect(rates).toHaveLength(2);
        expect(rates.map(r => r.id)).toEqual(['standard', 'express']);
    });

    it('rounds prices to 2 decimal places', async () => {
        const rates = await shippingService.calculateRates({
            subtotal: 33.33, country: 'US', state: 'CA', zipCode: '90210',
        });

        rates.forEach(r => {
            const hasTwoDecimals = (r.price * 100) % 1 === 0;
            expect(hasTwoDecimals).toBe(true);
        });
    });

    it('returns all required fields for each method', async () => {
        const rates = await shippingService.calculateRates({
            subtotal: 75, country: 'US', state: 'WA', zipCode: '98101',
        });

        rates.forEach(r => {
            expect(r).toHaveProperty('id');
            expect(r).toHaveProperty('name');
            expect(r).toHaveProperty('description');
            expect(r).toHaveProperty('price');
            expect(r).toHaveProperty('estimatedDays');
        });
    });

    it('throws 400 when country is missing', async () => {
        await expect(
            shippingService.calculateRates({ subtotal: 50, state: 'CA', zipCode: '90210' })
        ).rejects.toMatchObject({ status: 400, message: /country/i });
    });

    it('throws 400 when state is missing', async () => {
        await expect(
            shippingService.calculateRates({ subtotal: 50, country: 'US', zipCode: '90210' })
        ).rejects.toMatchObject({ status: 400, message: /state/i });
    });

    it('throws 400 when zipCode is missing', async () => {
        await expect(
            shippingService.calculateRates({ subtotal: 50, country: 'US', state: 'CA' })
        ).rejects.toMatchObject({ status: 400, message: /zipCode/i });
    });

    it('uses the free_shipping_threshold store setting when present', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ setting_value: '20' }] });

        const rates = await shippingService.calculateRates({
            subtotal: 25, country: 'US', state: 'CA', zipCode: '90210',
        });

        // 25 >= 20 → free under the configured threshold (would be $5.99 at the default 50)
        expect(rates.find(r => r.id === 'standard').price).toBe(0);
    });

    it('charges shipping when the configured threshold is not met', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ setting_value: '150' }] });

        const rates = await shippingService.calculateRates({
            subtotal: 100, country: 'US', state: 'CA', zipCode: '90210',
        });

        expect(rates.find(r => r.id === 'standard').price).toBe(5.99);
    });

    it('disables free shipping entirely when the threshold is 0', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ setting_value: '0' }] });

        const rates = await shippingService.calculateRates({
            subtotal: 500, country: 'US', state: 'CA', zipCode: '90210',
        });

        expect(rates.find(r => r.id === 'standard').price).toBe(5.99);
    });

    it('falls back to the 50 default when the setting row is missing', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const rates = await shippingService.calculateRates({
            subtotal: 60, country: 'US', state: 'CA', zipCode: '90210',
        });

        expect(rates.find(r => r.id === 'standard').price).toBe(0);
    });

    it('falls back to the 50 default when the settings query fails', async () => {
        db.query.mockRejectedValueOnce(new Error('settings table missing'));

        const rates = await shippingService.calculateRates({
            subtotal: 60, country: 'US', state: 'CA', zipCode: '90210',
        });

        expect(rates.find(r => r.id === 'standard').price).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  validateShippingAddress
// ═══════════════════════════════════════════════════════════════════════════════

describe('shippingService — validateShippingAddress', () => {
    it('validates a supported country address', async () => {
        const result = await shippingService.validateShippingAddress({
            country: 'US', state: 'CA', zipCode: '90210',
        });

        expect(result.valid).toBe(true);
    });

    it('validates Canada address', async () => {
        const result = await shippingService.validateShippingAddress({
            country: 'CA', state: 'ON', zipCode: 'M5A 1A1',
        });

        expect(result.valid).toBe(true);
    });

    it('rejects unsupported country', async () => {
        const result = await shippingService.validateShippingAddress({
            country: 'XX', state: 'Somewhere', zipCode: '00000',
        });

        expect(result.valid).toBe(false);
        expect(result.message).toContain('do not ship');
    });

    it('returns invalid for incomplete address (missing country)', async () => {
        const result = await shippingService.validateShippingAddress({
            state: 'CA', zipCode: '90210',
        });

        expect(result.valid).toBe(false);
        expect(result.message).toContain('Incomplete');
    });

    it('returns invalid for incomplete address (missing state)', async () => {
        const result = await shippingService.validateShippingAddress({
            country: 'US', zipCode: '90210',
        });

        expect(result.valid).toBe(false);
        expect(result.message).toContain('Incomplete');
    });

    it('returns invalid for incomplete address (missing zipCode)', async () => {
        const result = await shippingService.validateShippingAddress({
            country: 'US', state: 'CA',
        });

        expect(result.valid).toBe(false);
        expect(result.message).toContain('Incomplete');
    });

    it('supports all expected countries', async () => {
        const supported = ['US', 'CA', 'UK', 'AU', 'DE', 'FR', 'JP'];
        for (const country of supported) {
            const result = await shippingService.validateShippingAddress({
                country, state: 'Test', zipCode: '00000',
            });
            expect(result.valid).toBe(true);
        }
    });
});
