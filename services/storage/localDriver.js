const fs = require('fs');
const path = require('path');

/**
 * Local disk — what the app did before, kept as the default so nothing
 * changes until STORAGE_DRIVER says otherwise.
 *
 * Fine for a developer machine. On a host with an ephemeral filesystem the
 * files do not survive a deploy, which is the reason the firebase driver
 * exists.
 */

const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');

function absoluteFor(key) {
  const abs = path.join(UPLOAD_ROOT, key);
  // Second line of defence: isSafeKey screens the key, this catches anything
  // that still resolves outside the store.
  if (!abs.startsWith(UPLOAD_ROOT)) {
    throw new Error('Refusing a storage key that escapes the upload root');
  }
  return abs;
}

async function put(file, destination, filename) {
  const key = `${destination}/${filename}`;
  const abs = absoluteFor(key);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, file.buffer);
  return key;
}

async function get(key) {
  const abs = absoluteFor(key);
  if (!fs.existsSync(abs)) {
    const err = new Error('File not found');
    err.code = 'STORAGE_NOT_FOUND';
    throw err;
  }
  return { buffer: fs.readFileSync(abs), contentType: null };
}

async function exists(key) {
  try {
    return fs.existsSync(absoluteFor(key));
  } catch (_) {
    return false;
  }
}

async function remove(key) {
  try {
    const abs = absoluteFor(key);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch (_) {
    // Idempotent by contract.
  }
}

module.exports = { name: 'local disk', put, get, exists, remove, UPLOAD_ROOT };
