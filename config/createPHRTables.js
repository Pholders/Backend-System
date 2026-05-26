/**
 * Database Migration: Create PHR Tables
 * Creates all tables needed for Personal Health Record system
 */

const { pool } = require('./db');

async function createPHRTables() {
  try {
    console.log('🔄 Starting PHR tables migration...');

    // Add a small delay to ensure previous tables are committed
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify that patients and doctors tables exist before creating PHR tables
    const tableCheckResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'patients'
      )
    `);

    if (!tableCheckResult.rows[0].exists) {
      throw new Error('Patients table does not exist. Please ensure patients table is created first.');
    }

    // 1. Health Vitals Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS health_vitals (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        systolic_bp INTEGER,
        diastolic_bp INTEGER,
        heart_rate INTEGER,
        weight_kg DECIMAL(5, 2),
        blood_glucose DECIMAL(6, 1),
        oxygen_saturation DECIMAL(5, 2),
        temperature_c DECIMAL(5, 2),
        bmi DECIMAL(5, 2),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_health_vitals_patient_id ON health_vitals(patient_id);
      CREATE INDEX IF NOT EXISTS idx_health_vitals_measured_at ON health_vitals(measured_at DESC);
    `);
    console.log('✅ Created health_vitals table');

    // 2. PHR Documents Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS phr_documents (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        document_name VARCHAR(255) NOT NULL,
        document_type VARCHAR(50), -- 'lab_report', 'x_ray', 'medical_certificate', 'discharge_summary', etc.
        file_path TEXT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        document_date DATE,
        description TEXT,
        related_condition VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_phr_documents_patient_id ON phr_documents(patient_id);
      CREATE INDEX IF NOT EXISTS idx_phr_documents_uploaded_at ON phr_documents(uploaded_at DESC);
      CREATE INDEX IF NOT EXISTS idx_phr_documents_document_type ON phr_documents(document_type);
    `);
    console.log('✅ Created phr_documents table');

    // 3. PHR Access Control Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS phr_access (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
        access_type VARCHAR(50) DEFAULT 'view', -- 'view', 'view_and_note', etc.
        granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        revoked_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(patient_id, doctor_id)
      );
      CREATE INDEX IF NOT EXISTS idx_phr_access_patient_id ON phr_access(patient_id);
      CREATE INDEX IF NOT EXISTS idx_phr_access_doctor_id ON phr_access(doctor_id);
      CREATE INDEX IF NOT EXISTS idx_phr_access_active ON phr_access(revoked_at, expires_at);
    `);
    console.log('✅ Created phr_access table');

    // 4. PHR Access Requests Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS phr_access_requests (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
        reason TEXT,
        status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'denied', 'expired'
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP,
        denial_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_phr_access_requests_patient_id ON phr_access_requests(patient_id);
      CREATE INDEX IF NOT EXISTS idx_phr_access_requests_doctor_id ON phr_access_requests(doctor_id);
      CREATE INDEX IF NOT EXISTS idx_phr_access_requests_status ON phr_access_requests(status);
    `);
    console.log('✅ Created phr_access_requests table');

    // 5. PHR Access Logs (Audit Trail)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS phr_access_logs (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
        access_type VARCHAR(50), -- 'view', 'download', 'print', 'share', etc.
        accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(50),
        user_agent TEXT,
        duration_seconds INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_phr_access_logs_patient_id ON phr_access_logs(patient_id);
      CREATE INDEX IF NOT EXISTS idx_phr_access_logs_doctor_id ON phr_access_logs(doctor_id);
      CREATE INDEX IF NOT EXISTS idx_phr_access_logs_accessed_at ON phr_access_logs(accessed_at DESC);
    `);
    console.log('✅ Created phr_access_logs table');

    // Update patients table to include blood_type and medical_aid_type if not exists
    await pool.query(`
      ALTER TABLE patients 
      ADD COLUMN IF NOT EXISTS blood_type VARCHAR(5),
      ADD COLUMN IF NOT EXISTS medical_aid_type VARCHAR(50)
    `);
    console.log('✅ Updated patient_personal_details table');

    // Create enum types if not exists
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'blood_type_enum') THEN
          CREATE TYPE blood_type_enum AS ENUM ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'Unknown');
        END IF;
      END $$;
    `);

    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'medical_aid_enum') THEN
          CREATE TYPE medical_aid_enum AS ENUM ('Government', 'Private', 'NGO', 'Self-Pay', 'Insurance', 'None', 'Other');
        END IF;
      END $$;
    `);
    console.log('✅ Created enum types');

    console.log('✅ PHR tables migration completed successfully!');
  } catch (error) {
    console.error('❌ Error during PHR migration:', error.message);
    // Don't throw - just log warning. PHR tables are optional for core functionality
    console.warn('⚠️ PHR migration failed but continuing server startup. Check database connection.');
  }
}

module.exports = createPHRTables;
