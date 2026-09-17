import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dbpool with connect() for transactions
const mockClientRef = { current: null };

vi.mock('../src/database/dbpool.js', () => ({
    default: {
        query: vi.fn(),
        connect: vi.fn().mockImplementation(async () => mockClientRef.current),
    },
}));

vi.mock('../src/model/orderModel.js', () => ({
    getOrderById: vi.fn(),
    updateOrderStatus: vi.fn(),
}));

vi.mock('../src/model/paymentModel.js', () => ({
    getActivePaymentMethods: vi.fn(),
    createPaymentMethod: vi.fn(),
    getPaymentMethodById: vi.fn(),
    createPayment: vi.fn(),
    getPaymentsByOrderId: vi.fn(),
    getPaymentById: vi.fn(),
}));

import db from '../src/database/dbpool.js';
import * as OrderModel from '../src/model/orderModel.js';
import * as PaymentModel from '../src/model/paymentModel.js';
import * as paymentService from '../src/services/paymentService.js';

// ── Shared test data ─────────────────────────────────────────────────────────

const mockOrder = {
    orderId: 500,
    userId: 42,
    status: 'pending',
    totalAmount: 49.99,
    username: 'testuser',
    email: 'test@example.com',
};

const mockPaymentMethod = {
    methodId: 1,
    methodName: 'Credit Card',
    description: 'Pay with card',
    isActive: true,
};

const mockPayment = {
    paymentId: 1000,
    orderId: 500,
    methodId: 1,
    methodName: 'Credit Card',
    discountId: null,
    amount: 49.99,
    status: 'paid',
    paidAt: new Date().toISOString(),
};

let mockClient;

beforeEach(() => {
    vi.clearAllMocks();
    mockClient = { query: vi.fn(), release: vi.fn() };
    mockClientRef.current = mockClient;
});

// ═══════════════════════════════════════════════════════════════════════════════
//  getPaymentMethods
// ═══════════════════════════════════════════════════════════════════════════════

describe('paymentService — getPaymentMethods', () => {
    it('returns active payment methods', async () => {
        PaymentModel.getActivePaymentMethods.mockResolvedValue([mockPaymentMethod]);

        const result = await paymentService.getPaymentMethods();
        expect(result).toHaveLength(1);
        expect(result[0].methodName).toBe('Credit Card');
    });

    it('returns empty array when no active methods exist', async () => {
        PaymentModel.getActivePaymentMethods.mockResolvedValue([]);

        const result = await paymentService.getPaymentMethods();
        expect(result).toEqual([]);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  createPaymentMethod
// ═══════════════════════════════════════════════════════════════════════════════

describe('paymentService — createPaymentMethod', () => {
    it('creates a payment method (admin)', async () => {
        PaymentModel.createPaymentMethod.mockResolvedValue(mockPaymentMethod);

        const result = await paymentService.createPaymentMethod(
            { method_name: 'PayPal', description: 'Fast checkout', is_active: true },
            1
        );

        expect(result.methodName).toBe('Credit Card');
        expect(PaymentModel.createPaymentMethod).toHaveBeenCalledWith({
            method_name: 'PayPal',
            description: 'Fast checkout',
            is_active: true,
            // fee defaults to 0 when the request omits it
            fee: 0,
        });
    });

    it('passes an explicit fee through to the model', async () => {
        PaymentModel.createPaymentMethod.mockResolvedValue(mockPaymentMethod);

        await paymentService.createPaymentMethod(
            { method_name: 'Cash on Delivery', description: 'Pay at the door', is_active: true, fee: 2.5 },
            1
        );

        expect(PaymentModel.createPaymentMethod).toHaveBeenCalledWith({
            method_name: 'Cash on Delivery',
            description: 'Pay at the door',
            is_active: true,
            fee: 2.5,
        });
    });

    it('allows admin role_id 2 to create', async () => {
        PaymentModel.createPaymentMethod.mockResolvedValue(mockPaymentMethod);

        const result = await paymentService.createPaymentMethod(
            { method_name: 'PayPal' },
            2
        );

        expect(result).toBeDefined();
    });

    it('throws 403 for non-admin user', async () => {
        await expect(
            paymentService.createPaymentMethod({ method_name: 'Test' }, 3)
        ).rejects.toMatchObject({ status: 403, message: /Admin privileges/i });
    });

    it('throws 400 when method_name is missing', async () => {
        await expect(
            paymentService.createPaymentMethod({}, 1)
        ).rejects.toMatchObject({ status: 400, message: /method_name/i });
    });

    it('throws 400 when method_name is empty string', async () => {
        await expect(
            paymentService.createPaymentMethod({ method_name: '  ' }, 1)
        ).rejects.toMatchObject({ status: 400, message: /method_name/i });
    });

    it('throws 409 when method name already exists (DB unique violation)', async () => {
        const uniqueError = new Error('duplicate key');
        uniqueError.code = '23505';
        PaymentModel.createPaymentMethod.mockRejectedValue(uniqueError);

        await expect(
            paymentService.createPaymentMethod({ method_name: 'Credit Card' }, 1)
        ).rejects.toMatchObject({ status: 409, message: /already exists/i });
    });

    it('re-throws non-unique DB errors', async () => {
        const dbError = new Error('Connection lost');
        PaymentModel.createPaymentMethod.mockRejectedValue(dbError);

        await expect(
            paymentService.createPaymentMethod({ method_name: 'Test' }, 1)
        ).rejects.toThrow('Connection lost');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  recordPayment
// ═══════════════════════════════════════════════════════════════════════════════

describe('paymentService — recordPayment', () => {
    beforeEach(() => {
        OrderModel.getOrderById.mockResolvedValue(mockOrder);
        PaymentModel.getPaymentMethodById.mockResolvedValue(mockPaymentMethod);
        PaymentModel.createPayment.mockResolvedValue(mockPayment);
        PaymentModel.getPaymentById.mockResolvedValue(mockPayment);
    });

    it('records a payment successfully with transaction', async () => {
        mockClient.query
            .mockResolvedValueOnce({ rows: [] })    // BEGIN
            .mockResolvedValueOnce({ rows: [] })    // createPayment (via client)
            .mockResolvedValueOnce({ rows: [] })    // updateOrderStatus (via client)
            .mockResolvedValueOnce({ rows: [] });   // COMMIT

        const result = await paymentService.recordPayment(42, 3, 500, {
            method_id: 1,
            amount: 49.99,
        });

        expect(result.status).toBe('paid');
        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
        expect(OrderModel.getOrderById).toHaveBeenCalledWith(500);
    });

    it('allows admin to pay for any order', async () => {
        OrderModel.getOrderById.mockResolvedValue({ ...mockOrder, userId: 99 });

        mockClient.query
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] });

        const result = await paymentService.recordPayment(1, 1, 500, {
            method_id: 1,
            amount: 49.99,
        });

        expect(result).toBeDefined();
    });

    it('throws 404 when order does not exist', async () => {
        OrderModel.getOrderById.mockResolvedValue(null);

        await expect(
            paymentService.recordPayment(42, 3, 999, { method_id: 1, amount: 10 })
        ).rejects.toMatchObject({ status: 404, message: /Order not found/i });
    });

    it('throws 403 when non-admin pays for another user order', async () => {
        OrderModel.getOrderById.mockResolvedValue({ ...mockOrder, userId: 99 });

        await expect(
            paymentService.recordPayment(42, 3, 500, { method_id: 1, amount: 10 })
        ).rejects.toMatchObject({ status: 403, message: /Not authorized/i });
    });

    it('throws 400 when method_id is missing', async () => {
        await expect(
            paymentService.recordPayment(42, 3, 500, { amount: 10 })
        ).rejects.toMatchObject({ status: 400, message: /method_id/i });
    });

    it('throws 404 when payment method not found', async () => {
        PaymentModel.getPaymentMethodById.mockResolvedValue(null);

        await expect(
            paymentService.recordPayment(42, 3, 500, { method_id: 999, amount: 10 })
        ).rejects.toMatchObject({ status: 404, message: /Payment method not found/i });
    });

    it('throws 400 when payment method is not active', async () => {
        PaymentModel.getPaymentMethodById.mockResolvedValue({ ...mockPaymentMethod, isActive: false });

        await expect(
            paymentService.recordPayment(42, 3, 500, { method_id: 1, amount: 10 })
        ).rejects.toMatchObject({ status: 400, message: /not active/i });
    });

    it('throws 400 when amount is zero', async () => {
        await expect(
            paymentService.recordPayment(42, 3, 500, { method_id: 1, amount: 0 })
        ).rejects.toMatchObject({ status: 400, message: /greater than 0/i });
    });

    it('throws 400 when amount is negative', async () => {
        await expect(
            paymentService.recordPayment(42, 3, 500, { method_id: 1, amount: -10 })
        ).rejects.toMatchObject({ status: 400, message: /greater than 0/i });
    });

    it('throws 400 when amount does not match order total', async () => {
        await expect(
            paymentService.recordPayment(42, 3, 500, { method_id: 1, amount: 5.00 })
        ).rejects.toMatchObject({ status: 400, message: /does not match/i });
    });

    it('allows exact amount matching order total', async () => {
        mockClient.query
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] });

        const result = await paymentService.recordPayment(42, 3, 500, {
            method_id: 1,
            amount: 49.99, // exact match
        });

        expect(result).toBeDefined();
    });

    it('throws 400 when discount_id is not an integer', async () => {
        await expect(
            paymentService.recordPayment(42, 3, 500, { method_id: 1, amount: 49.99, discount_id: 1.5 })
        ).rejects.toMatchObject({ status: 400, message: /integer/i });
    });

    it('throws 404 when discount_id does not exist', async () => {
        db.query.mockResolvedValue({ rowCount: 0 });

        await expect(
            paymentService.recordPayment(42, 3, 500, { method_id: 1, amount: 49.99, discount_id: 999 })
        ).rejects.toMatchObject({ status: 404, message: /Discount not found/i });
    });

    it('advances order status from pending to confirmed after payment', async () => {
        mockClient.query
            .mockResolvedValueOnce({ rows: [] })    // BEGIN
            .mockResolvedValueOnce({ rows: [] })    // createPayment
            .mockResolvedValueOnce({ rows: [] })    // updateOrderStatus
            .mockResolvedValueOnce({ rows: [] });   // COMMIT

        await paymentService.recordPayment(42, 3, 500, { method_id: 1, amount: 49.99 });

        expect(OrderModel.updateOrderStatus).toHaveBeenCalledWith(500, 'confirmed', mockClient);
    });

    it('rolls back transaction on failure and re-throws', async () => {
        PaymentModel.createPayment.mockRejectedValue(new Error('DB error'));

        // Set up mockClient.query to return resolved promises so ROLLBACK works
        mockClient.query.mockResolvedValue({ rows: [] });

        await expect(
            paymentService.recordPayment(42, 3, 500, { method_id: 1, amount: 49.99 })
        ).rejects.toThrow('DB error');

        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
        expect(mockClient.release).toHaveBeenCalled();
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  getOrderPayments
// ═══════════════════════════════════════════════════════════════════════════════

describe('paymentService — getOrderPayments', () => {
    it('returns payments for user-owned order', async () => {
        OrderModel.getOrderById.mockResolvedValue(mockOrder);
        PaymentModel.getPaymentsByOrderId.mockResolvedValue([mockPayment]);

        const result = await paymentService.getOrderPayments(42, 3, 500);

        expect(result).toHaveLength(1);
        expect(result[0].paymentId).toBe(1000);
    });

    it('allows admin to view payments for any order', async () => {
        OrderModel.getOrderById.mockResolvedValue({ ...mockOrder, userId: 99 });

        const result = await paymentService.getOrderPayments(1, 1, 500);

        expect(result).toBeDefined();
    });

    it('throws 404 when order not found', async () => {
        OrderModel.getOrderById.mockResolvedValue(null);

        await expect(
            paymentService.getOrderPayments(42, 3, 999)
        ).rejects.toMatchObject({ status: 404, message: /Order not found/i });
    });

    it('throws 403 when non-admin views another user order payments', async () => {
        OrderModel.getOrderById.mockResolvedValue({ ...mockOrder, userId: 99 });

        await expect(
            paymentService.getOrderPayments(42, 3, 500)
        ).rejects.toMatchObject({ status: 403, message: /Not authorized/i });
    });
});
