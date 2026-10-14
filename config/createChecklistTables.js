const { query } = require('./db');

/**
 * Migration: the phase 1 testing checklist's shared results.
 *
 * This is team tooling, not product: it backs the shared checklist page the
 * team ticks off while testing. It holds no patient data and nothing here is
 * read by any other part of the platform, so the whole thing can be
 * truncated without consequence.
 *
 * One row per (story, tester) so a second tester's verdict never overwrites
 * the first — two people disagreeing about a story is worth seeing.
 *
 * Idempotent.
 */

const runMigration = async () => {
  try {
    console.log('🔄 Creating testing checklist tables...');

    await query(`
      CREATE TABLE IF NOT EXISTS checklist_results (
        story_id   VARCHAR(16) NOT NULL,
        tester     VARCHAR(60) NOT NULL,
        status     VARCHAR(10) NOT NULL CHECK (status IN ('pass', 'fail', 'blocked')),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (story_id, tester)
      );
    `);
    console.log('✅ checklist_results ready');

    await query(`
      CREATE TABLE IF NOT EXISTS checklist_notes (
        id         SERIAL PRIMARY KEY,
        story_id   VARCHAR(16) NOT NULL,
        tester     VARCHAR(60) NOT NULL,
        body       TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_checklist_notes_story
        ON checklist_notes(story_id, created_at);
    `);
    console.log('✅ checklist_notes ready');
  } catch (error) {
    console.error('❌ Error creating checklist tables:', error.message);
    throw error;
  }
};

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runMigration };
