const crypto = require('crypto');
const jwt = require('jsonwebtoken');

/**
 * Doctor two-factor: "first sign-in of the day" on each browser.
 *
 * After a doctor enters their emailed code, the browser is handed a
 * "verified today" token. While it is valid, signing in on that browser skips
 * the code. It is a signed JWT, so there is no table to keep:
 *   - it expires at the next midnight in South Africa (SAST, UTC+2, no DST);
 *   - it names the doctor, so it cannot skip the code for anyone else;
 *   - it carries a fingerprint of the password hash, so changing or
 *     resetting the password ends it at once.
 */

const PURPOSE = 'doctor_2fa_day';
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;

/** How many codes a doctor may get wrong in an hour before they stop working. */
const MAX_WRONG_LOGIN_CODES = 5;

/** Minutes a sign-in code lasts; matches the "expires in 10 minutes" email. */
const LOGIN_CODE_MINUTES = 10;

const secret = () => process.env.JWT_SECRET || 'jwtSecret';

const passwordFingerprint = (passwordHash) =>
  crypto.createHash('sha256').update(String(passwordHash || '')).digest('hex').slice(0, 16);

/** Seconds from [now] until the next midnight in South Africa. */
function secondsUntilSastMidnight(now = new Date()) {
  const sast = new Date(now.getTime() + SAST_OFFSET_MS);
  const nextMidnightSast = Date.UTC(
    sast.getUTCFullYear(), sast.getUTCMonth(), sast.getUTCDate() + 1
  );
  return Math.max(60, Math.floor((nextMidnightSast - sast.getTime()) / 1000));
}

/** A token that lets this browser skip the code until midnight. */
function issueTrustedToday(doctor, now = new Date()) {
  return jwt.sign(
    { id: doctor.id, purpose: PURPOSE, pwd: passwordFingerprint(doctor.password_hash) },
    secret(),
    { expiresIn: secondsUntilSastMidnight(now) }
  );
}

/** True when [token] was issued to this doctor today and the password is unchanged. */
function isTrustedToday(token, doctor) {
  if (!token || typeof token !== 'string') return false;
  try {
    const claims = jwt.verify(token, secret());
    return claims.purpose === PURPOSE &&
      claims.id === doctor.id &&
      claims.pwd === passwordFingerprint(doctor.password_hash);
  } catch {
    return false;
  }
}

module.exports = {
  issueTrustedToday,
  isTrustedToday,
  secondsUntilSastMidnight,
  MAX_WRONG_LOGIN_CODES,
  LOGIN_CODE_MINUTES,
};
