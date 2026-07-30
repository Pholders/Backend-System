const Appointment = require('../models/Appointment');

/**
 * Create Appointments Table
 * This migration creates the appointments table for booking doctor appointments
 */

async function addAppointmentsTable() {
  try {
    console.log('🔄 Creating appointments table...');
    await Appointment.createTable();
    console.log('✅ Appointments table migration completed successfully');
  } catch (error) {
    console.error('❌ Error during appointments table migration:', error);
    throw error;
  }
}

module.exports = { addAppointmentsTable };
