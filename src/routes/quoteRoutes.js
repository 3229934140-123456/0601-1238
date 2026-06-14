const express = require('express');
const router = express.Router();
const quoteController = require('../controllers/quoteController');
const { authMiddleware, staffAuth } = require('../middleware/auth');

router.get('/', authMiddleware, quoteController.getQuoteList);
router.get('/:id', authMiddleware, quoteController.getQuoteDetail);
router.post('/', authMiddleware, quoteController.createQuote);
router.post('/calculate', authMiddleware, quoteController.calculateQuotePrice);
router.put('/:id/adjust', authMiddleware, staffAuth, quoteController.adjustQuotePrice);
router.put('/:id/confirm', authMiddleware, quoteController.confirmQuote);
router.put('/:id/reject', authMiddleware, quoteController.rejectQuote);

module.exports = router;
