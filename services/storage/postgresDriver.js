const { query } = require('../../config/db');

/**
 * The database as a file store.
 *
 * Not where bytes belong long term — it grows the database and its backups,
 * and it puts file reads on the same connection pool as everything else. It
 * is here because it is the only durable store this deployment already has:
 * the disk is wiped on every deploy, and Firebase Storage requires a billing
 * account.
 *
 * It is a reasonable fit for what is actually stored. Every upload route
 * caps at 10MB or less, the files are read one at a time behind an ownership
 * check, and nothing streams. When that stops being true, the key in each
 * row is driver-independent, so moving to S3 is a copy and an env var rather
 * than a data migration.
 */

async function put(file, destination, filename) {
  const key = `${destination}/${filename}`;
  const buffer = file.buffer;

  if (!Buffer.isBuffer(buffer)) {
    throw new Error('Storage expected a buffered upload — use multer memoryStorage');
  }

  await query(
    `INSERT INTO stored_files (key, content_type, byte_size, data)
          VALUES ($1, $2, $3, $4)
     ON CONFLICT (key)
     DO UPDATE SET content_type = EXCLUDED.content_type,
                   byte_size    = EXCLUDED.byte_size,
                   data         = EXCLUDED.data,
                   updated_at   = CURRENT_TIMESTAMP`,
    [key, file.mimetype || null, buffer.length, buffer]
  );

  return key;
}

async function get(key) {
  const result = await query(
    'SELECT data, content_type FROM stored_files WHERE key = $1',
    [key]
  );

  if (!result.rows.length) {
    const err = new Error('File not found');
    err.code = 'STORAGE_NOT_FOUND';
    throw err;
  }

  const row = result.rows[0];
  return {
    // node-postgres hands BYTEA back as a Buffer already.
    buffer: Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data),
    contentType: row.content_type || null,
  };
}

async function exists(key) {
  try {
    const result = await query('SELECT 1 FROM stored_files WHERE key = $1', [key]);
    return result.rows.length > 0;
  } catch (_) {
    return false;
  }
}

async function remove(key) {
  try {
    await query('DELETE FROM stored_files WHERE key = $1', [key]);
  } catch (err) {
    // Idempotent by contract; a missing row is not a failure.
    console.warn(`⚠️  Could not delete ${key}: ${err && err.message}`);
  }
}

module.exports = { name: 'postgres', put, get, exists, remove };
