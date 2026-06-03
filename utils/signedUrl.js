const jwt = require('jsonwebtoken');

/**
 * Sign a short-lived URL for accessing a private file.
 * Returns a JWT-encoded token clients append as ?token=... to the download route.
 *
 *  Payload: { sub: userId, path: relativeStoragePath, kind: 'medical_aid_card'|'claim'|'invoice'|'receipt' }
 *  Default TTL: 10 minutes
 */
function sign({ userId, path, kind, ttlSeconds = 600 }) {
  if (!userId || !path || !kind) {
    throw new Error('sign(): userId, path and kind are required');
  }
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return jwt.sign(
    { sub: String(userId), path, kind },
    secret,
    { expiresIn: ttlSeconds }
  );
}

/**
 * Verify a signed-URL token and return its payload, or null if invalid/expired.
 */
function verify(token) {
  try {
    const secret = process.env.JWT_SECRET;
    return jwt.verify(token, secret);
  } catch (_err) {
    return null;
  }
}

module.exports = { sign, verify };
