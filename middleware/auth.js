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
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Access denied.',
        code: 'NO_TOKEN'
      });
    }

    const token = authHeader.split(' ')[1];
    console.log('[AUTH] Step 1: Token extracted from header');
    console.log('[AUTH]   Token length:', token.length);
    console.log('[AUTH]   Token prefix:', token.substring(0, 30) + '...');
    
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('[AUTH] Step 2: JWT verified successfully');
      console.log('[AUTH]   User ID:', decoded.id, '| Role:', decoded.role);
    } catch (jwtError) {
      console.error('[AUTH] Step 2: JWT verification FAILED');
      console.error('[AUTH]   Error name:', jwtError.name);
      console.error('[AUTH]   Error message:', jwtError.message);
      throw jwtError;
    }
    
    // Verify session is still active
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    console.log('[AUTH] Step 3: Token hash generated');
    console.log('[AUTH]   Hash:', tokenHash.substring(0, 40) + '...');
    
    const session = await Session.findByTokenHash(tokenHash);
    console.log('[AUTH] Step 4: Session lookup completed');
    console.log('[AUTH]   Session found:', !!session);
    
    if (!session) {
      console.warn('[AUTH] Step 5: SESSION NOT FOUND');
      console.warn('[AUTH]   Token hash:', tokenHash.substring(0, 40) + '...');
      console.warn('[AUTH]   User ID from token:', decoded.id);
      return res.status(401).json({
        success: false,
        message: 'Session expired or revoked. Please login again.',
        debug: process.env.NODE_ENV === 'development' ? { tokenHashStart: tokenHash.substring(0, 16) } : undefined
      });
    }

    console.log('[AUTH] Step 5: Session found and valid');
    console.log('[AUTH]   Session ID:', session.id);
    console.log('[AUTH]   Session expires at:', session.expires_at);

    // Update last activity
    await Session.updateLastActivity(session.id);
    console.log('[AUTH] Step 6: Session activity updated');
    
    // Attach user info and session to request.
    // NOTE: use req.authSession (not req.session) to avoid colliding with
    // express-session middleware, which owns req.session and calls
    // req.session.touch() when the response is sent.
    req.user = decoded;
    req.authSession = session;
    
    console.log('[AUTH] ✅ Authentication successful');
    next();
    
  } catch (error) {
    console.error('[AUTH MIDDLEWARE] Error caught:', {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n')[0]
    });

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

    // For database or other errors, log and respond
    console.error('[AUTH MIDDLEWARE] Unhandled error in auth:', error);
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
