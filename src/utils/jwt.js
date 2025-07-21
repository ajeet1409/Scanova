const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

class JWTUtils {
  // Generate JWT token
  generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRE,
      issuer: 'image-processing-app',
      audience: 'image-processing-users'
    });
  }

  // Verify JWT token
  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET, {
        issuer: 'image-processing-app',
        audience: 'image-processing-users'
      });
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  // Generate access token for user
  generateAccessToken(user) {
    const payload = {
      userId: user._id,
      username: user.username,
      email: user.email,
      type: 'access'
    };
    return this.generateToken(payload);
  }

  // Generate refresh token for user
  generateRefreshToken(user) {
    const payload = {
      userId: user._id,
      type: 'refresh'
    };
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: '30d',
      issuer: 'image-processing-app',
      audience: 'image-processing-users'
    });
  }

  // Extract token from Authorization header
  extractTokenFromHeader(authHeader) {
    if (!authHeader) {
      throw new Error('No authorization header provided');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new Error('Invalid authorization header format');
    }

    return parts[1];
  }

  // Decode token without verification (for debugging)
  decodeToken(token) {
    return jwt.decode(token);
  }
}

module.exports = new JWTUtils();
