const { pool } = require('./db');

/**
 * Migration: Add doctor listing fields for the "Find doctors near you" feature
 *
 * Adds the following columns to the doctors table (all nullable / defaulted
 * so existing rows continue to work):
 *   - suburb         VARCHAR(150)   e.g. "Bryanston"
 *   - rating         DECIMAL(2,1)   e.g. 4.9    (0.0 - 5.0)
 *   - review_count   INTEGER        e.g. 2500   (defaults to 0)
 *   - currency       VARCHAR(3)     e.g. "ZAR"  (defaults to 'ZAR')
 *   - opens_at       TIME           e.g. "05:00"
 *   - closes_at      TIME           e.g. "01:00" (may be < opens_at for
 *                                   clinics that close after midnight)
 *
 * Safe to run multiple times.
 */

async function addDoctorListingFields() {
  try {
    console.log('🔄 Adding doctor listing fields to doctors table...');

    await pool.query(`
      ALTER TABLE doctors
      ADD COLUMN IF NOT EXISTS suburb VARCHAR(150),
      ADD COLUMN IF NOT EXISTS rating DECIMAL(2, 1),
      ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'ZAR',
      ADD COLUMN IF NOT EXISTS opens_at TIME,
      ADD COLUMN IF NOT EXISTS closes_at TIME;
    `);
    console.log('✅ Added suburb, rating, review_count, currency, opens_at, closes_at');

    // Validate rating range when present
    await pool.query(`
      ALTER TABLE doctors
      ADD CONSTRAINT check_rating_range
      CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5));
    `).catch((err) => {
      if (err.code === '42710' /* duplicate_object */) {
        console.log('ℹ️  rating constraint already exists, skipping');
      } else {
        throw err;
      }
    });

    // Validate review_count non-negative
    await pool.query(`
      ALTER TABLE doctors
      ADD CONSTRAINT check_review_count_nonneg
      CHECK (review_count IS NULL OR review_count >= 0);
    `).catch((err) => {
      if (err.code === '42710') {
        console.log('ℹ️  review_count constraint already exists, skipping');
      } else {
        throw err;
      }
    });

    // Index to speed up specialty + fee filtering on the listing endpoint
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_doctors_specialization_fee
      ON doctors (specialization, consultation_fee)
      WHERE status = 'active';
    `);
    console.log('✅ Created specialization+fee filter index');

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

if (require.main === module) {
  addDoctorListingFields()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { addDoctorListingFields };
