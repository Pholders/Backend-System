const { query } = require('../config/db');

/**
 * Update pharmacy_groups tier constraint to support 'enterprise' tier
 */

async function updatePharmacyGroupsTierConstraint() {
  try {
    console.log('🔄 Updating pharmacy_groups tier constraint...');

    // Drop the existing constraint and recreate it with 'enterprise' added
    await query(`
      ALTER TABLE pharmacy_groups 
      DROP CONSTRAINT IF EXISTS pharmacy_groups_tier_check;
    `);

    // Add the new constraint that includes 'enterprise'
    await query(`
      ALTER TABLE pharmacy_groups
      ADD CONSTRAINT pharmacy_groups_tier_check 
      CHECK (tier IN ('premium', 'standard', 'basic', 'enterprise'));
    `);

    console.log('✅ Updated pharmacy_groups tier constraint to support enterprise tier');
    return true;
  } catch (error) {
    console.error('❌ Error updating tier constraint:', error);
    throw error;
  }
}

if (require.main === module) {
  updatePharmacyGroupsTierConstraint()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = updatePharmacyGroupsTierConstraint;
