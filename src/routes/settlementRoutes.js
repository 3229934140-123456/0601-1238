const express = require('express');
const router = express.Router();
const settlementController = require('../controllers/settlementController');
const { authMiddleware, staffAuth, customerAuth } = require('../middleware/auth');

router.get('/settlements', authMiddleware, settlementController.getSettlementList);
router.get('/settlements/:id', authMiddleware, settlementController.getSettlementDetail);
router.post('/settlements/generate', authMiddleware, staffAuth, settlementController.generateSettlement);
router.put('/settlements/:id/confirm', authMiddleware, staffAuth, settlementController.confirmSettlement);
router.put('/settlements/:id/customer-confirm', authMiddleware, settlementController.customerConfirmSettlement);
router.put('/settlements/:id/dispute', authMiddleware, settlementController.disputeSettlement);

router.get('/reviews', authMiddleware, settlementController.getReviewList);
router.get('/reviews/:id', authMiddleware, settlementController.getReviewDetail);
router.post('/reviews', authMiddleware, settlementController.createReview);
router.put('/reviews/:id/reply', authMiddleware, staffAuth, settlementController.replyReview);

module.exports = router;
