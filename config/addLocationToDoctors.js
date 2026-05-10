const { query } = require('./db');

/**
 * Migration: Add geolocation columns to doctors table
 * Adds latitude and longitude for nearby doctor search
 */

async function addLocationToDoctors() {
  try {
    console.log('🔄 Adding geolocation columns to doctors table...');

    // Add latitude and longitude columns
    await query(`
      ALTER TABLE doctors 
      ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
      ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
    `);

    console.log('✅ Geolocation columns added to doctors table');

    // Create index for faster queries
    await query(`
      CREATE INDEX IF NOT EXISTS idx_doctors_location 
      ON doctors(latitude, longitude);
    `);

    console.log('✅ Location index created');

    console.log('✨ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

addLocationToDoctors();
