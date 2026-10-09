/**
 * File storage — one interface, two drivers.
 *
 * Uploads used to be written straight to the server's disk. On Render that
 * filesystem is ephemeral: every deploy and restart wipes it, while the
 * database keeps the path, so a medical aid card uploaded today becomes a
 * broken download tomorrow.
 *
 * Callers work in terms of a storage KEY — an opaque, forward-slashed path
 * like `medical-aid/patient_16_front_1791.jpg`. That key is what goes in the
 * database, and it means the same thing to every driver, so moving from
 * local disk to Firebase (and later to S3) changes where bytes live without
 * touching a single stored row.
 *
 * Driver is chosen by STORAGE_DRIVER: `local` (the default, unchanged
 * behaviour) or `firebase`.
 *
 * Deliberately NOT exposing public or signed provider URLs. Downloads keep
 * going through our own route, which verifies a signed token and re-checks
 * ownership against the owning table before serving a byte. For patient
 * medical documents that check belongs on our side, not in a bucket ACL.
 */

const DRIVERS = {
  local: () => require('./localDriver'),
  firebase: () => require('./firebaseDriver'),
};

let active = null;

function driver() {
  if (active) return active;

  const name = (process.env.STORAGE_DRIVER || 'local').toLowerCase();
  const load = DRIVERS[name];

  if (!load) {
    console.warn(
      `⚠️  Unknown STORAGE_DRIVER "${name}" — falling back to local disk. ` +
        `Valid values: ${Object.keys(DRIVERS).join(', ')}`
    );
    active = DRIVERS.local();
    return active;
  }

  active = load();
  console.log(`📁 File storage driver: ${active.name}`);
  return active;
}

/**
 * Stores bytes and returns the key to keep in the database.
 *
 * @param {object}  file         a multer memoryStorage file
 * @param {string}  file.buffer
 * @param {string} [file.mimetype]
 * @param {string}  destination  folder within the store, e.g. 'medical-aid'
 * @param {string}  filename     the name within that folder
 * @returns {Promise<string>} the storage key
 */
async function put(file, destination, filename) {
  return driver().put(file, destination, filename);
}

/** Reads a stored file back. Rejects if the key is unknown. */
async function get(key) {
  return driver().get(key);
}

/** True when the key resolves to something stored. */
async function exists(key) {
  return driver().exists(key);
}

/** Removes a stored file. Idempotent — a missing key is not an error. */
async function remove(key) {
  return driver().remove(key);
}

/**
 * Rejects a key that tries to climb out of the store.
 *
 * The local driver needs this against path traversal; the others do not, but
 * it is applied everywhere so one driver cannot be stricter than another and
 * hide a bad key until the day we switch.
 */
function isSafeKey(key) {
  if (typeof key !== 'string' || key.length === 0 || key.length > 400) return false;
  if (key.startsWith('/') || key.includes(String.fromCharCode(92))) return false;
  // A Windows absolute path ('C:/...') is not a key either. Without this it
  // reads as relative and gets joined under the store root, which turns an
  // old absolute path into a plausible-looking key that resolves nowhere.
  if (/^[A-Za-z]:/.test(key)) return false;
  return !key.split('/').some((seg) => seg === '' || seg === '.' || seg === '..');
}

module.exports = { put, get, exists, remove, isSafeKey, driverName: () => driver().name };
