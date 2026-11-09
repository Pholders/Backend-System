const { query } = require('./db');

/**
 * Migration: every doctor and pharmacy is on the Basic tier for now.
 *
 * Pharmacies: the tier is the pharmacy_groups row a pharmacy belongs to.
 * Only the signup OTP step put a pharmacy in the default Basic group, so
 * seeded pharmacies and any created another way belonged to no group and had
 * no tier at all. Any pharmacy with no current membership is added to Basic,
 * whatever its status. Pharmacies already in a group are left where they are.
 *
 * Doctors: had no tier anywhere. doctors.tier is added, NOT NULL with
 * default 'basic', so existing and future doctors start on Basic. Nothing
 * reads it yet; the values match pharmacy_groups.tier.
 *
 * Idempotent. Runs after the default pharmacy groups exist.
 */
const runMigration = async () => {
  console.log('🔄 Assigning the Basic tier...');
  try {
    await query(`
      ALTER TABLE doctors
        ADD COLUMN IF NOT EXISTS tier VARCHAR(20) NOT NULL DEFAULT 'basic';
    `);
    await query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'doctors_tier_check') THEN
          ALTER TABLE doctors
            ADD CONSTRAINT doctors_tier_check
            CHECK (tier IN ('basic', 'standard', 'premium', 'enterprise'));
        END IF;
      END $$;
    `);
    console.log('✅ doctors.tier ready (default basic)');

    const basic = await query(`
      SELECT id FROM pharmacy_groups
       WHERE group_name = 'Basic' AND tier = 'basic' AND is_default = true
       LIMIT 1
    `);
    if (!basic.rows[0]) {
      console.warn('⚠️  Default Basic pharmacy group not found; pharmacies not assigned');
      return true;
    }

    const assigned = await query(
      `INSERT INTO pharmacy_group_members (group_id, pharmacy_id, is_primary, joined_at)
       SELECT $1, p.id, TRUE, CURRENT_TIMESTAMP
         FROM pharmacies p
        WHERE NOT EXISTS (
          SELECT 1 FROM pharmacy_group_members m
           WHERE m.pharmacy_id = p.id AND m.left_at IS NULL
        )
       -- One that left Basic earlier still has its old row: rejoin it.
       ON CONFLICT (pharmacy_id, group_id)
         DO UPDATE SET left_at = NULL, is_primary = TRUE, joined_at = CURRENT_TIMESTAMP
       RETURNING pharmacy_id`,
      [basic.rows[0].id]
    );
    console.log(`✅ ${assigned.rowCount} pharmacies added to the Basic group`);
    return true;
  } catch (error) {
    console.error('❌ Basic tier migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runMigration };
