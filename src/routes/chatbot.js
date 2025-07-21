const express = require('express');
const router = express.Router();
const chatbotController = require('../controllers/chatbotController');
const { authenticateToken } = require('../middleware/auth');

// Optional authentication middleware - allows both authenticated and anonymous users
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    // If token exists, try to authenticate
    authenticateToken(req, res, (err) => {
      // Continue regardless of authentication result
      next();
    });
  } else {
    // No token, continue as anonymous user
    next();
  }
};

// Get or create conversation
router.get('/conversation/:sessionId', optionalAuth, chatbotController.getConversation);

// Send message and get response
router.post('/conversation/:sessionId/message', optionalAuth, chatbotController.sendMessage);

// Get conversation history (requires authentication)
router.get('/conversations', authenticateToken, chatbotController.getConversationHistory);

// Delete conversation
router.delete('/conversation/:sessionId', optionalAuth, chatbotController.deleteConversation);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Chatbot API is running',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
