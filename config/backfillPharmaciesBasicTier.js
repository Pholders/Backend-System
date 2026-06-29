const { query } = require('../config/db');

/**
 * Backfill existing pharmacies to Basic tier group
 * Assigns all registered pharmacies to the Basic tier if not already assigned
 */

async function backfillPharmaciesBasicTier() {
  console.log('🔄 Backfilling existing pharmacies to Basic tier...');

  try {
    // Get the Basic group ID
    const basicGroupResult = await query(`
      SELECT id FROM pharmacy_groups 
      WHERE tier = 'basic' AND is_default = TRUE
      LIMIT 1;
    `);

    if (basicGroupResult.rows.length === 0) {
      console.error('❌ Basic group not found! Please initialize pharmacy groups first.');
      return false;
    }

    const basicGroupId = basicGroupResult.rows[0].id;
    console.log(`📌 Found Basic group ID: ${basicGroupId}`);

    // Find all pharmacies that don't have an active group membership
    const pharmaciesWithoutGroupResult = await query(`
      SELECT p.id, p.pharmacy_name
      FROM pharmacies p
      WHERE NOT EXISTS (
        SELECT 1 FROM pharmacy_group_members pgm
        WHERE pgm.pharmacy_id = p.id AND pgm.left_at IS NULL
      )
      AND p.status = 'active'
      ORDER BY p.created_at ASC;
    `);

    const pharmaciesToAssign = pharmaciesWithoutGroupResult.rows;
    console.log(`📋 Found ${pharmaciesToAssign.length} pharmacies without group assignment`);

    if (pharmaciesToAssign.length === 0) {
      console.log('✅ All pharmacies are already assigned to a tier');
      return true;
    }

    // Assign each pharmacy to Basic tier
    let assignedCount = 0;
    for (const pharmacy of pharmaciesToAssign) {
      try {
        await query(`
          INSERT INTO pharmacy_group_members (group_id, pharmacy_id, is_primary, joined_at)
          VALUES ($1, $2, TRUE, CURRENT_TIMESTAMP)
          ON CONFLICT (pharmacy_id, group_id) DO NOTHING;
        `, [basicGroupId, pharmacy.id]);

        assignedCount++;
        console.log(`  ✅ Assigned pharmacy: ${pharmacy.pharmacy_name} (ID: ${pharmacy.id})`);
      } catch (error) {
        console.error(`  ❌ Failed to assign pharmacy ${pharmacy.pharmacy_name}:`, error.message);
      }
    }

    console.log(`\n✅ Successfully assigned ${assignedCount} pharmacies to Basic tier`);
    return true;
  } catch (error) {
    console.error('❌ Error backfilling pharmacies:', error);
    throw error;
  }
}

if (require.main === module) {
  backfillPharmaciesBasicTier()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = backfillPharmaciesBasicTier;
