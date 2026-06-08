const { query } = require('./db');

/**
 * Add Details Column to Doctors Table
 * Migration to add a details/about paragraph for doctors
 */

async function addDetailsColumnToDoctors() {
  try {
    console.log('🔄 Adding details column to doctors table...');
    
    await query(`
      ALTER TABLE doctors
      ADD COLUMN IF NOT EXISTS details TEXT;
    `);
    
    console.log('✅ Details column added to doctors table successfully');
  } catch (error) {
    console.error('❌ Error adding details column to doctors table:', error);
    throw error;
  }
}

module.exports = { addDetailsColumnToDoctors };
