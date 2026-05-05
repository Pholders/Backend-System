const { pool } = require('./db');

/**
 * Migration: Add geolocation support to doctors table
 * Adds latitude, longitude, and clinic_address fields
 * Allows patient login to fetch nearby doctors
 */

async function addGeolocationToDoctors() {
  try {
    console.log('🔄 Adding geolocation fields to doctors table...');

    // Add new columns
    await pool.query(`
      ALTER TABLE doctors
      ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
      ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
      ADD COLUMN IF NOT EXISTS clinic_address TEXT;
    `);

    console.log('✅ Added latitude, longitude, clinic_address columns');

    // Create geographic index for faster nearby queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_doctors_geolocation 
      ON doctors (latitude, longitude) 
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
    `);

    console.log('✅ Created geolocation index');

    // Add constraint to ensure valid coordinates if provided
    await pool.query(`
      ALTER TABLE doctors
      ADD CONSTRAINT check_latitude_range 
      CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));
    `);

    console.log('✅ Added latitude validation constraint');

    await pool.query(`
      ALTER TABLE doctors
      ADD CONSTRAINT check_longitude_range 
      CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));
    `);

    console.log('✅ Added longitude validation constraint');

    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

addGeolocationToDoctors();
