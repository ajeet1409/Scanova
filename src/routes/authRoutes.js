const express = require('express');
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { validateRegistration, validateLogin, validatePasswordChange } = require('../middleware/validation');

const router = express.Router();

// Public routes
router.post('/register', validateRegistration, authController.register);
router.post('/login', validateLogin, authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authController.logout);

// Protected routes
router.get('/profile', authenticateToken, authController.getProfile);
router.put('/profile', authenticateToken, authController.updateProfile);
router.put('/change-password', authenticateToken, validatePasswordChange, authController.changePassword);

// Health check for auth API
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Authentication API is healthy',
    timestamp: new Date().toISOString(),
    endpoints: {
      'POST /register': 'Register new user',
      'POST /login': 'Login user',
      'POST /refresh-token': 'Refresh access token',
      'POST /logout': 'Logout user and clear cookies',
      'GET /profile': 'Get user profile (protected)',
      'PUT /profile': 'Update user profile (protected)',
      'PUT /change-password': 'Change password (protected)'
    }
  });
});

module.exports = router;
