const pool = require('./db');

async function addSessionBasedSignatures() {
  try {
    console.log('🔄 Adding session-based signature support...');

    // 1. Update prescriptions table - add session-based signature fields
    await pool.query(`
      ALTER TABLE prescriptions
      ADD COLUMN IF NOT EXISTS signature_method VARCHAR(20) DEFAULT 'session',
      ADD COLUMN IF NOT EXISTS signature_session_id VARCHAR(500),
      ADD COLUMN IF NOT EXISTS signature_device_id VARCHAR(100),
      ADD COLUMN IF NOT EXISTS signature_ip_address INET,
      ADD COLUMN IF NOT EXISTS signature_verified BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS signature_hash VARCHAR(500),
      ADD COLUMN IF NOT EXISTS signature_fingerprint VARCHAR(500),
      ADD COLUMN IF NOT EXISTS is_signed BOOLEAN DEFAULT false
    `);

    console.log('✅ Updated prescriptions table');

    // 2. Create doctor_sessions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS doctor_sessions (
        id SERIAL PRIMARY KEY,
        doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
        session_token VARCHAR(500) UNIQUE NOT NULL,
        device_id VARCHAR(100) NOT NULL,
        ip_address INET NOT NULL,
        user_agent VARCHAR(500),
        
        -- Session management
        issued_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP NOT NULL,
        last_activity TIMESTAMP DEFAULT NOW(),
        is_active BOOLEAN DEFAULT true,
        
        -- Security
        device_fingerprint VARCHAR(500),
        trusted BOOLEAN DEFAULT false,
        
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes for doctor_sessions
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_doctor_sessions_token ON doctor_sessions(session_token)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_doctor_sessions_doctor ON doctor_sessions(doctor_id)
    `);

    console.log('✅ Created doctor_sessions table');

    // 3. Create signature_audit table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS signature_audit (
        id SERIAL PRIMARY KEY,
        prescription_id INTEGER NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
        doctor_id INTEGER NOT NULL REFERENCES doctors(id),
        session_id INTEGER REFERENCES doctor_sessions(id),
        
        -- Signature details
        action VARCHAR(20), -- 'signed' or 'revoked'
        signed_at TIMESTAMP DEFAULT NOW(),
        signature_hash VARCHAR(500),
        signature_algorithm VARCHAR(50),
        
        -- Device/Network info
        device_id VARCHAR(100),
        ip_address INET,
        user_agent VARCHAR(500),
        
        -- Revocation (if applicable)
        revoke_reason TEXT,
        
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes for signature_audit
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_signature_audit_prescription ON signature_audit(prescription_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_signature_audit_doctor ON signature_audit(doctor_id)
    `);

    console.log('✅ Created signature_audit table');

    console.log('✅ Session-based signature support added successfully');
  } catch (error) {
    console.error('❌ Error adding session-based signatures:', error);
    throw error;
  }
}

module.exports = { addSessionBasedSignatures };
