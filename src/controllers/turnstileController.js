const axios = require('axios');

/**
 * Verify Cloudflare Turnstile token
 */
const verifyTurnstile = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Turnstile token is required'
      });
    }

    // Cloudflare Turnstile secret key (should be in environment variables)
    const secretKey = process.env.TURNSTILE_SECRET_KEY

    // Verify token with Cloudflare
    const verificationResponse = await axios.post(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        secret: secretKey,
        response: token,
        remoteip: req.ip || req.connection.remoteAddress
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      }
    );

    const { success, 'error-codes': errorCodes } = verificationResponse.data;

    if (success) {
      // Get Cloudflare Ray ID from request headers
      const rayId = req.headers['cf-ray'] ||
                   req.headers['CF-RAY'] ||
                   req.headers['Cf-Ray'] ||
                   req.get('cf-ray') ||
                   req.get('CF-RAY') ||
                   req.get('Cf-Ray')

      // Verification successful
      res.json({
        success: true,
        message: 'Verification successful',
        timestamp: new Date().toISOString(),
        rayId: rayId || null
      });
    } else {
      // Verification failed
      console.error('Turnstile verification failed:', errorCodes);
      res.status(400).json({
        success: false,
        message: 'Verification failed',
        errors: errorCodes
      });
    }

  } catch (error) {
    console.error('Turnstile verification error:', error);

    if (error.code === 'ECONNABORTED') {
      return res.status(408).json({
        success: false,
        message: 'Verification timeout. Please try again.'
      });
    }

    if (error.response) {
      return res.status(500).json({
        success: false,
        message: 'Verification service error'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during verification'
    });
  }
};

/**
 * Get Turnstile configuration (site key, etc.)
 */
const getTurnstileConfig = async (req, res) => {
  try {
    const siteKey = process.env.TURNSTILE_SITE_KEY || '0x4AAAAAAABkMYinukE_NVJu';

    res.json({
      success: true,
      siteKey: siteKey,
      theme: 'auto' // Can be 'light', 'dark', or 'auto'
    });
  } catch (error) {
    console.error('Error getting Turnstile config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get configuration'
    });
  }
};

module.exports = {
  verifyTurnstile,
  getTurnstileConfig
};
