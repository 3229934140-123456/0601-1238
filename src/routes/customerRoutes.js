const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authMiddleware, staffAuth, customerAuth } = require('../middleware/auth');

router.post('/login', customerController.customerLogin);

router.get('/profile', authMiddleware, customerAuth, customerController.getCustomerProfile);
router.put('/profile', authMiddleware, customerAuth, customerController.updateCustomerProfile);

router.get('/', authMiddleware, staffAuth, customerController.getCustomerList);
router.get('/:id', authMiddleware, staffAuth, customerController.getCustomerDetail);
router.post('/', authMiddleware, staffAuth, customerController.createCustomer);
router.put('/:id', authMiddleware, staffAuth, customerController.updateCustomer);
router.delete('/:id', authMiddleware, staffAuth, customerController.deleteCustomer);

module.exports = router;
