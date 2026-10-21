const { query } = require('../config/db');

/**
 * Initialize default pharmacy groups and tiers
 */

async function initializePharmacyGroups() {
  console.log('🏪 Initializing default pharmacy groups...');

  try {
    // Check if Basic group already exists
    const checkBasic = await query(`
      SELECT id FROM pharmacy_groups 
      WHERE group_name = 'Basic' AND tier = 'basic'
      LIMIT 1;
    `);

    if (checkBasic.rows.length === 0) {
      // Create Basic tier group
      await query(`
        INSERT INTO pharmacy_groups (
          group_name, parent_company, tier, description, 
          commission_rate, features, is_default, status
        )
        VALUES (
          'Basic', 'Individual Pharmacies', 'basic',
          'Default tier for newly registered pharmacies - Independent operation',
          5.0,
          '["prescription_dispensing", "patient_records", "basic_analytics"]'::jsonb,
          TRUE,
          'active'
        )
        ON CONFLICT DO NOTHING;
      `);
      console.log('✅ Created Basic tier group');
    } else {
      console.log('✅ Basic tier group already exists');
    }

    // Check if Premium group exists
    const checkPremium = await query(`
      SELECT id FROM pharmacy_groups 
      WHERE group_name = 'Premium' AND tier = 'premium'
      LIMIT 1;
    `);

    if (checkPremium.rows.length === 0) {
      // Create Premium tier group
      await query(`
        INSERT INTO pharmacy_groups (
          group_name, parent_company, tier, description,
          commission_rate, features, is_default, status
        )
        VALUES (
          'Premium', 'Premium Network', 'premium',
          'Premium tier - Multi-location support, advanced analytics, priority support',
          3.5,
          '["prescription_dispensing", "patient_records", "advanced_analytics", "multi_location", "priority_support", "bulk_ordering"]'::jsonb,
          FALSE,
          'active'
        )
        ON CONFLICT DO NOTHING;
      `);
      console.log('✅ Created Premium tier group');
    } else {
      console.log('✅ Premium tier group already exists');
    }

    // Check if Enterprise group exists
    const checkEnterprise = await query(`
      SELECT id FROM pharmacy_groups 
      WHERE group_name = 'Enterprise' AND tier = 'enterprise'
      LIMIT 1;
    `);

    if (checkEnterprise.rows.length === 0) {
      // Create Enterprise tier group
      await query(`
        INSERT INTO pharmacy_groups (
          group_name, parent_company, tier, description,
          commission_rate, features, is_default, status
        )
        VALUES (
          'Enterprise', 'Enterprise Network', 'enterprise',
          'Enterprise tier - Full features, dedicated account manager, custom integration',
          2.0,
          '["prescription_dispensing", "patient_records", "advanced_analytics", "multi_location", "priority_support", "bulk_ordering", "api_access", "custom_integration", "dedicated_support"]'::jsonb,
          FALSE,
          'active'
        )
        ON CONFLICT DO NOTHING;
      `);
      console.log('✅ Created Enterprise tier group');
    } else {
      console.log('✅ Enterprise tier group already exists');
    }

    console.log('✅ Pharmacy groups initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Error initializing pharmacy groups:', error);
    throw error;
  }
}

if (require.main === module) {
  initializePharmacyGroups()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = initializePharmacyGroups;
