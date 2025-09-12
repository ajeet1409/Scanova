const express = require('express');
const imageController = require('../controllers/imageController');
const { validateTextInput, validatePagination, validateObjectId } = require('../middleware/validation');
const { optionalAuth, authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Process extracted text and get AI solution (with optional auth)
router.post('/process-text', optionalAuth, validateTextInput, imageController.processText);

// Stream AI solution in real-time (with optional auth)
router.post('/stream-solution', optionalAuth, validateTextInput, imageController.streamSolution);

// Get processing history (protected - requires auth)
router.get('/history', authenticateToken, validatePagination, imageController.getHistory);

// Get specific record by ID (protected - requires auth)
router.get('/history/:id', authenticateToken, validateObjectId, imageController.getById);

// Delete record (protected - requires auth)
router.delete('/history/:id', authenticateToken, validateObjectId, imageController.deleteRecord);

// Get analytics/stats
router.get('/stats', imageController.getStats);

// Health check for API
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Image Processing API is healthy',
    timestamp: new Date().toISOString(),
    endpoints: {
      'POST /process-text': 'Process extracted text and get AI solution',
      'POST /stream-solution': 'Stream AI solution in real-time',
      'GET /history': 'Get processing history with pagination',
      'GET /history/:id': 'Get specific record by ID',
      'DELETE /history/:id': 'Delete specific record',
      'GET /stats': 'Get processing statistics'
    }
  });
});

module.exports = router;
