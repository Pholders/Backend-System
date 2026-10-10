const InventoryItem = require('../models/InventoryItem');

/**
 * Migration: Inventory v1
 *
 *   - Creates `inventory_items` table
 *   - Creates `inventory_adjustments` audit table
 *
 * Idempotent — safe to run multiple times.
 */

const runMigration = async () => {
  console.log('🔄 Running Inventory v1 migration...');
  try {
    await InventoryItem.createTable();
    console.log('✅ Inventory v1 migration completed');
    return true;
  } catch (error) {
    console.error('❌ Inventory v1 migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runMigration };
