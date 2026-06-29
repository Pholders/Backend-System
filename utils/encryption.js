const crypto = require('crypto');

/**
 * Encryption Utility
 * AES-256-GCM symmetric encryption for sensitive fields (e.g. ID number,
 * medical aid membership numbers, dependent codes).
 *
 * Requires env var ENCRYPTION_KEY. The key may be supplied as either:
 *   - 64 hex characters (32 bytes), or
 *   - a passphrase of any length (will be SHA-256 hashed to 32 bytes).
 *
 * Output format (string): "<iv_hex>:<auth_tag_hex>:<ciphertext_hex>"
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM

let cachedKey = null;

function getKey() {
  if (cachedKey) return cachedKey;

  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  // Accept 32-byte hex, otherwise derive via SHA-256
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    cachedKey = Buffer.from(raw, 'hex');
  } else {
    cachedKey = crypto.createHash('sha256').update(raw).digest();
  }
  return cachedKey;
}

/**
 * Encrypt a plaintext string.
 * Returns null for null/undefined input.
 */
function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined || plaintext === '') {
    return null;
  }

  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(String(plaintext), 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/**
 * Decrypt a previously encrypted string. Returns null on failure or empty input.
 */
function decrypt(payload) {
  if (!payload) return null;

  try {
    const parts = String(payload).split(':');
    if (parts.length !== 3) return null;

    const [ivHex, authTagHex, ciphertextHex] = parts;
    const key = getKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);

    return plaintext.toString('utf8');
  } catch (error) {
    console.error('❌ Decryption failed:', error.message);
    return null;
  }
}

/**
 * Mask a value, exposing only the last `visible` characters.
 * e.g. maskLast4('1234567890') === '******7890'
 */
function maskLast4(value, visible = 4) {
  if (value === null || value === undefined) return null;
  const s = String(value);
  if (s.length <= visible) return s;
  return '*'.repeat(s.length - visible) + s.slice(-visible);
}

/**
 * Convenience: decrypt then mask. Returns null if decryption fails.
 */
function decryptAndMask(payload, visible = 4) {
  const plain = decrypt(payload);
  if (plain === null) return null;
  return maskLast4(plain, visible);
}

module.exports = {
  encrypt,
  decrypt,
  maskLast4,
  decryptAndMask
};
