const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Session = require('../models/Session');

async function medicationAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'A valid access token is required.' }
    });
  }

  try {
    const token = authHeader.slice('Bearer '.length);
    const user = jwt.verify(token, process.env.JWT_SECRET);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const session = await Session.findByTokenHash(tokenHash);

    if (!session) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'A valid access token is required.' }
      });
    }
    if (user.role !== 'patient') {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Only patients can manage medications.' }
      });
    }

    await Session.updateLastActivity(session.id);
    req.user = user;
    req.authSession = session;
    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'A valid access token is required.' }
      });
    }

    console.error('Error authenticating medication request:', error);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Unable to authenticate the request.' }
    });
  }
}

module.exports = medicationAuth;
