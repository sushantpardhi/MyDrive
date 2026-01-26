const express = require('express');
const router = express.Router();
const zipController = require('../controllers/zipController');
const { authenticateToken } = require('../middleware/auth');

// Request a new zip job
router.post('/', authenticateToken, zipController.requestZip);

// Get zip job status
router.get('/:jobId/status', authenticateToken, zipController.getZipStatus);

// Download completed zip
router.get('/:jobId', authenticateToken, zipController.downloadZip);

module.exports = router;
