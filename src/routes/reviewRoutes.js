const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { authMiddleware, staffAuth } = require('../middleware/auth');

router.get('/artworks', authMiddleware, staffAuth, reviewController.getReviewList);
router.get('/artworks/:id', authMiddleware, reviewController.getReviewDetail);
router.post('/artworks/:artworkId/comments', authMiddleware, reviewController.addReviewComment);
router.get('/artworks/:artworkId/comments', authMiddleware, reviewController.getReviewComments);

router.put('/artworks/:id/return', authMiddleware, staffAuth, reviewController.returnForRevision);
router.put('/artworks/:id/approve', authMiddleware, staffAuth, reviewController.approveArtwork);

router.put('/orders/:orderId/proof/start', authMiddleware, staffAuth, reviewController.startProofing);
router.put('/orders/:orderId/proof/approve', authMiddleware, reviewController.approveProof);
router.put('/orders/:orderId/proof/reject', authMiddleware, reviewController.rejectProof);

module.exports = router;
