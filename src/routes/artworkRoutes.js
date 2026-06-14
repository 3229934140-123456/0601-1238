const express = require('express');
const router = express.Router();
const artworkController = require('../controllers/artworkController');
const { authMiddleware, staffAuth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

router.get('/', authMiddleware, artworkController.getArtworkList);
router.get('/:id', authMiddleware, artworkController.getArtworkDetail);
router.post('/', authMiddleware, artworkController.createArtwork);
router.put('/:id', authMiddleware, artworkController.updateArtwork);
router.delete('/:id', authMiddleware, staffAuth, artworkController.deleteArtwork);

router.post('/upload', authMiddleware, upload.single('file'), artworkController.uploadArtworkVersion);

router.get('/:artworkId/versions', authMiddleware, artworkController.getArtworkVersions);
router.post('/:artworkId/versions/upload', authMiddleware, upload.single('file'), artworkController.uploadArtworkVersion);

router.get('/:artworkId/comments', authMiddleware, artworkController.getArtworkComments);
router.post('/:artworkId/comments', authMiddleware, artworkController.addArtworkComment);
router.put('/comments/:commentId/resolve', authMiddleware, staffAuth, artworkController.resolveComment);

router.post('/:id/submit-review', authMiddleware, artworkController.submitForReview);

module.exports = router;
