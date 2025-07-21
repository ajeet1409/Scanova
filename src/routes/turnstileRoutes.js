const express = require('express');
const { verifyTurnstile, getTurnstileConfig } = require('../controllers/turnstileController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   POST /api/verify-turnstile
 * @desc    Verify Cloudflare Turnstile token
 * @access  Private (requires authentication)
 */
router.post('/verify-turnstile', authenticateToken, verifyTurnstile);

/**
 * @route   GET /api/turnstile-config
 * @desc    Get Turnstile configuration
 * @access  Private (requires authentication)
 */
router.get('/turnstile-config', authenticateToken, getTurnstileConfig);

module.exports = router;
