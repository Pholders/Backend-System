const jwt = require('jsonwebtoken');

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user info to request
 */

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Access denied.',
        code: 'NO_TOKEN'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    req.user = decoded;
    next();
    
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please refresh token.',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Access denied.',
        code: 'INVALID_TOKEN'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error authenticating user',
      error: error.message
    });
  }
};

module.exports = authMiddleware;

/**
 * Prevent authenticated users from accessing guest-only routes (signup, login).
 * If a valid token is present, the request is rejected.
 * If the token is missing or invalid, the request proceeds normally.
 */
const preventAuthenticated = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(); // No token — allow through
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Valid token found — user is already logged in
    return res.status(403).json({
      success: false,
      message: `Already logged in as ${decoded.role}. Please log out first.`
    });
  } catch {
    // Token is invalid/expired — treat as unauthenticated and allow through
    return next();
  }
};

module.exports.preventAuthenticated = preventAuthenticated;

/**
 * Role-based access control middleware
 * Usage: requireRole('patient') or requireRole('admin')
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}.`
      });
    }

    next();
  };
};

module.exports.requireRole = requireRole;
