const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Session = require('../models/Session');

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user info to request
 * Also validates active session
 */

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Access denied.'
      });
    }

    // Extract token
    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify session is still active
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const session = await Session.findByTokenHash(tokenHash);
    
    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Session expired or revoked. Please login again.'
      });
    }

    // Update last activity
    await Session.updateLastActivity(session.id);
    
    // Attach user info and session to request
    req.user = decoded;
    req.session = session;
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Access denied.'
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
