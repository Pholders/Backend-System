/**
 * Clean up old seeded doctors
 * Usage: node tests/cleanup-doctors.js
 */

const { pool, query } = require('../config/db');

async function cleanupDoctors() {
  console.log('\n═'.repeat(60));
  console.log('🧹 CLEANUP: Removing old seeded doctors...');
  console.log('═'.repeat(60));

  try {
    // Delete old seeded doctors
    const result = await query(
      `DELETE FROM doctors WHERE email LIKE $1`,
      ['seed.doc%@seed.test']
    );
    
    console.log(`\n✅ Deleted ${result.rowCount} old doctor records`);
    console.log('\n📝 Next: Run seed-test-doctors.js again to add doctors with addresses');
    console.log('   node tests/seed-test-doctors.js\n');

    return true;
  } catch (error) {
    console.error('\n❌ Cleanup failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  cleanupDoctors()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { cleanupDoctors };

