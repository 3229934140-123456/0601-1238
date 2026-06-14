const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authMiddleware, staffAuth } = require('../middleware/auth');

router.get('/', authMiddleware, notificationController.getNotificationList);
router.get('/unread-count', authMiddleware, notificationController.getUnreadCount);
router.get('/:id', authMiddleware, notificationController.getNotificationDetail);
router.put('/:id/read', authMiddleware, notificationController.markAsRead);
router.put('/read-all', authMiddleware, notificationController.markAllAsRead);
router.delete('/:id', authMiddleware, notificationController.deleteNotification);
router.post('/send', authMiddleware, staffAuth, notificationController.sendNotification);
router.post('/trigger-delivery-reminders', authMiddleware, staffAuth, notificationController.triggerDeliveryReminders);

module.exports = router;
