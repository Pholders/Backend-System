const { query } = require('./db');

/**
 * Add doctor acceptance tracking to appointments
 * Allows doctors to accept appointments before creating prescriptions
 */

async function addDoctorAcceptanceToAppointments() {
  console.log('🔄 Adding doctor acceptance tracking to appointments...\n');

  try {
    const addColumnQuery = `
      ALTER TABLE appointments
      ADD COLUMN IF NOT EXISTS doctor_accepted BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS doctor_accepted_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS doctor_notes TEXT;

      CREATE INDEX IF NOT EXISTS idx_appointments_doctor_accepted ON appointments(doctor_accepted);
    `;

    await query(addColumnQuery);
    console.log('✅ Doctor acceptance columns added successfully\n');

    console.log(`
      📋 Changes made:
      • Added doctor_accepted (BOOLEAN) - marks if doctor has viewed/accepted appointment
      • Added doctor_accepted_at (TIMESTAMP) - when doctor accepted appointment
      • Added doctor_notes (TEXT) - notes from doctor about appointment
      • Created index on doctor_accepted for fast queries

      🔄 Workflow:
      1. Patient books appointment (status: pending_payment)
      2. Patient pays (status: scheduled)
      3. Doctor views appointment (doctor_accepted: TRUE)
      4. Doctor creates prescription
      5. Patient views prescription
    `);

    return true;
  } catch (error) {
    console.error('❌ Error adding doctor acceptance columns:', error.message);
    throw error;
  }
}

// Execute if run directly
if (require.main === module) {
  addDoctorAcceptanceToAppointments()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addDoctorAcceptanceToAppointments;
