const express = require('express');
const router = express.Router();
const specController = require('../controllers/specController');
const { authMiddleware, staffAuth } = require('../middleware/auth');

router.get('/paper', authMiddleware, specController.getPaperSpecList);
router.get('/paper/:id', authMiddleware, specController.getPaperSpecDetail);
router.post('/paper', authMiddleware, staffAuth, specController.createPaperSpec);
router.put('/paper/:id', authMiddleware, staffAuth, specController.updatePaperSpec);
router.delete('/paper/:id', authMiddleware, staffAuth, specController.deletePaperSpec);

router.get('/process', authMiddleware, specController.getProcessSpecList);
router.get('/process/:id', authMiddleware, specController.getProcessSpecDetail);
router.post('/process', authMiddleware, staffAuth, specController.createProcessSpec);
router.put('/process/:id', authMiddleware, staffAuth, specController.updateProcessSpec);
router.delete('/process/:id', authMiddleware, staffAuth, specController.deleteProcessSpec);

module.exports = router;
