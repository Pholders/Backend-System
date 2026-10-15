const { query } = require('./db');

/**
 * Migration: repair stored image URLs that were written as http://.
 *
 * Doctor profile images and patient avatars are stored as absolute URLs,
 * built from req.protocol. Behind Render's proxy that read "http" until
 * `trust proxy` was set, so rows written before that carry an http:// URL on
 * a host that only answers HTTPS. The browser refuses to load it as a
 * subresource and the 301 to HTTPS does not rescue it.
 *
 * localhost is left alone: http is correct there.
 *
 * Idempotent — the WHERE clause stops matching once a row is fixed.
 */

const COLUMNS = [
  { table: 'doctors', column: 'profile_image' },
  { table: 'patients', column: 'avatar_url' },
];

const runMigration = async () => {
  try {
    console.log('🔄 Repairing stored http:// image URLs...');

    for (const { table, column } of COLUMNS) {
      const present = await query(
        `SELECT 1
           FROM information_schema.columns
          WHERE table_name = $1 AND column_name = $2`,
        [table, column]
      );
      if (!present.rows.length) {
        console.log(`   ${table}.${column} not present, skipping`);
        continue;
      }

      const result = await query(
        `UPDATE ${table}
            SET ${column} = 'https://' || substring(${column} from 8)
          WHERE ${column} LIKE 'http://%'
            AND ${column} NOT LIKE 'http://localhost%'
            AND ${column} NOT LIKE 'http://127.0.0.1%'`
      );
      console.log(`   ${table}.${column}: ${result.rowCount} row(s) repaired`);
    }

    console.log('✅ stored image URLs checked');
  } catch (error) {
    console.error('❌ Error repairing stored image URLs:', error.message);
    throw error;
  }
};

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runMigration };
