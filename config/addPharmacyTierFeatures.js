const { query } = require('../config/db');

/**
 * Add tier features and default flags to pharmacy groups
 */

async function addPharmacyTierFeatures() {
  console.log('🔄 Adding tier features to pharmacy groups...');

  try {
    // Check if columns already exist
    const checkColumns = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'pharmacy_groups' 
      AND column_name IN ('features', 'is_default', 'status');
    `);

    const existingColumns = checkColumns.rows.map(row => row.column_name);

    if (!existingColumns.includes('features')) {
      await query(`
        ALTER TABLE pharmacy_groups
        ADD COLUMN features JSONB DEFAULT '[]'::jsonb;
      `);
      console.log('✅ Added features column');
    }

    if (!existingColumns.includes('is_default')) {
      await query(`
        ALTER TABLE pharmacy_groups
        ADD COLUMN is_default BOOLEAN DEFAULT FALSE;
      `);
      console.log('✅ Added is_default column');
    }

    if (!existingColumns.includes('status')) {
      await query(`
        ALTER TABLE pharmacy_groups
        ADD COLUMN status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended'));
      `);
      console.log('✅ Added status column');
    }

    // Create index on tier for faster lookups
    await query(`
      CREATE INDEX IF NOT EXISTS idx_pharmacy_groups_tier ON pharmacy_groups(tier);
      CREATE INDEX IF NOT EXISTS idx_pharmacy_groups_status ON pharmacy_groups(status);
      CREATE INDEX IF NOT EXISTS idx_pharmacy_groups_is_default ON pharmacy_groups(is_default);
    `);
    console.log('✅ Created indexes for pharmacy groups');

    console.log('✅ Pharmacy tier features setup completed successfully!');
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('✅ Pharmacy tier features already exist');
    } else {
      console.error('❌ Error adding pharmacy tier features:', error);
      throw error;
    }
  }
}

if (require.main === module) {
  addPharmacyTierFeatures()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = addPharmacyTierFeatures;
