const { query } = require('../config/db');
const { tierCheckList } = require('./tiers');

/**
 * pharmacy_groups.tier allows exactly the tiers in config/tiers.js
 * (basic, premium, enterprise) and defaults to basic.
 *
 * 'standard' was dropped. Postgres checks a new CHECK against existing rows,
 * so a leftover Standard group would stop the server booting; any such group
 * is moved to basic first, with a warning, since everyone is on Basic for now.
 */
async function updatePharmacyGroupsTierConstraint() {
  try {
    console.log('🔄 Updating pharmacy_groups tier constraint...');

    const moved = await query(
      `UPDATE pharmacy_groups SET tier = 'basic', updated_at = CURRENT_TIMESTAMP
        WHERE tier NOT IN (${tierCheckList()})
        RETURNING id, group_name`
    );
    if (moved.rowCount) {
      console.warn(`⚠️  Moved ${moved.rowCount} pharmacy group(s) with a retired tier to basic:`,
        moved.rows.map((g) => `${g.id} ${g.group_name}`).join(', '));
    }

    await query(`ALTER TABLE pharmacy_groups ALTER COLUMN tier SET DEFAULT 'basic';`);
    await query(`ALTER TABLE pharmacy_groups DROP CONSTRAINT IF EXISTS pharmacy_groups_tier_check;`);
    await query(`
      ALTER TABLE pharmacy_groups
      ADD CONSTRAINT pharmacy_groups_tier_check
      CHECK (tier IN (${tierCheckList()}));
    `);

    console.log('✅ pharmacy_groups tier constraint: basic, premium, enterprise');
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
