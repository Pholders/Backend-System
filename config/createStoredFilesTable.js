const { query } = require('./db');

/**
 * Migration: stored_files — the table behind the `postgres` storage driver.
 *
 * Keeping uploaded bytes in the database is not where they belong long term,
 * but it is the one durable place this deployment already has. Render's disk
 * is wiped on every deploy and there is no hosted file store yet, so without
 * this an uploaded document survives until the next
 * deploy and no further.
 *
 * The key is the primary key, which is the same opaque path every other
 * driver uses, so switching drivers never rewrites a stored row.
 *
 * Idempotent.
 */

const runMigration = async () => {
  try {
    console.log('🔄 Creating stored_files table...');

    await query(`
      CREATE TABLE IF NOT EXISTS stored_files (
        key          TEXT PRIMARY KEY,
        content_type VARCHAR(255),
        byte_size    INTEGER NOT NULL,
        data         BYTEA NOT NULL,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Finding everything under a folder, for a future migration off this
    // driver: the keys are paths, so a prefix scan is the natural query.
    await query(`
      CREATE INDEX IF NOT EXISTS idx_stored_files_key_prefix
        ON stored_files (key text_pattern_ops);
    `);

    console.log('✅ stored_files ready');
  } catch (error) {
    console.error('❌ Error creating stored_files table:', error.message);
    throw error;
  }
};

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runMigration };
