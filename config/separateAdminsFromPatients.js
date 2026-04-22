const { query } = require('./db');

const runMigration = async () => {
  console.log('🔄 Separating admins from patients table...');
  try {
    // Create admins table
    await query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_admins_status ON admins(status)`);
    console.log('✅ Created admins table');

    // Move existing admins from patients into admins table
    const moved = await query(`
      INSERT INTO admins (first_name, last_name, email, password_hash, phone, status, created_at, updated_at)
      SELECT first_name, last_name, email, password_hash, phone, status, created_at, updated_at
      FROM patients
      WHERE role = 'admin'
      ON CONFLICT (email) DO NOTHING
    `);
    console.log(`✅ Moved ${moved.rowCount} admin(s) to admins table`);

    // Remove admins from patients table
    const deleted = await query(`DELETE FROM patients WHERE role = 'admin'`);
    console.log(`✅ Removed ${deleted.rowCount} admin row(s) from patients table`);

    // Drop admin from patients role CHECK constraint and lock it to patient only
    await query(`ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_role_check`);
    await query(`ALTER TABLE patients ADD CONSTRAINT patients_role_check CHECK (role IN ('patient'))`);
    console.log('✅ Updated patients role constraint to patient only');

    console.log('✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

runMigration();
