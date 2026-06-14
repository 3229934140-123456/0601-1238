const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware, staffAuth } = require('../middleware/auth');

router.post('/login', authController.login);
router.get('/me', authMiddleware, authController.getCurrentUser);
router.put('/change-password', authMiddleware, authController.changePassword);

module.exports = router;
