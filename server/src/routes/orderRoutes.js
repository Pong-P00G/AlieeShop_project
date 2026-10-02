import express from 'express';
import * as orderController from '../controller/orderController.js';
import * as paymentController from '../controller/paymentController.js';
import protect, { isAdmin } from '../middleware/authMiddleWare.js';

const router = express.Router();

router.post('/', protect, orderController.createOrder);
router.get('/', protect, orderController.getOrders);
router.get('/export', protect, isAdmin, orderController.exportOrders);
router.get('/:id', protect, orderController.getOrder);
router.post('/:id/pay', protect, paymentController.recordPayment);
router.get('/:id/payments', protect, paymentController.getOrderPayments);
router.put('/:id/status', protect, isAdmin, orderController.updateStatus);
router.put('/:id/mark-paid', protect, isAdmin, paymentController.markPaymentAsPaid);

export default router;
