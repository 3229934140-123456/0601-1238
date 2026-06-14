const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authMiddleware, staffAuth } = require('../middleware/auth');

router.get('/', authMiddleware, orderController.getOrderList);
router.get('/:id', authMiddleware, orderController.getOrderDetail);
router.post('/', authMiddleware, orderController.createOrder);
router.put('/:id', authMiddleware, staffAuth, orderController.updateOrder);

router.put('/:id/confirm', authMiddleware, staffAuth, orderController.confirmOrder);
router.put('/:id/start-production', authMiddleware, staffAuth, orderController.startProduction);
router.put('/:id/complete', authMiddleware, staffAuth, orderController.completeOrder);
router.put('/:id/deliver', authMiddleware, staffAuth, orderController.deliverOrder);
router.put('/:id/cancel', authMiddleware, staffAuth, orderController.cancelOrder);

router.put('/:id/assign', authMiddleware, staffAuth, orderController.assignOrder);

router.get('/:orderId/status-logs', authMiddleware, orderController.getOrderStatusLogs);

router.get('/:orderId/payments', authMiddleware, orderController.getOrderPayments);
router.post('/:orderId/payments', authMiddleware, staffAuth, orderController.registerPayment);

router.put('/:id/invoice', authMiddleware, staffAuth, orderController.updateInvoiceInfo);

module.exports = router;
