const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Pharmacy = require('../models/Pharmacy');
const AccountDeletionToken = require('../models/AccountDeletionToken');
const Appointment = require('../models/Appointment');
const DoctorReview = require('../models/DoctorReview');
const Payment = require('../models/Payment');
const Session = require('../models/Session');
const AuditLog = require('../models/AuditLog');
const { addPendingPaymentStatus } = require('./addPendingPaymentStatus');
const { addPaymentColumnsToAppointments } = require('./addPaymentColumnsToAppointments');
const createPHRTables = require('./createPHRTables');
const { addSessionBasedSignatures } = require('./addSessionBasedSignatures');
const addPharmacyDispensingSupport = require('./addPharmacyDispensingSupport');

/**
 * Initialize Database Tables
 * Creates all necessary tables for the application
 */

const initializeDatabase = async () => {
  console.log('🔄 Starting database initialization...');
  
  try {
    // Create Users table
    await User.createTable();
    
    // Create Doctors table
    await Doctor.createTable();
    
    // Create Pharmacies table
    await Pharmacy.createTable();

    // Create Account Deletion Tokens table
    await AccountDeletionToken.createTable();

    // Create Appointments table
    await Appointment.createTable();

    // Create Doctor Reviews table
    await DoctorReview.createTable();

    // Create Payments table
    await Payment.createTable();

    // Create Sessions table (for session tracking)
    await Session.createTable();

    // Create Audit Logs table
    await AuditLog.createTable();

    // Add pending_payment status to appointments
    await addPendingPaymentStatus();

    // Add payment_status and payment_method columns to appointments
    await addPaymentColumnsToAppointments();

    // Create PHR tables (health vitals, documents, access control)
    await createPHRTables();

    // Add session-based signature support
    await addSessionBasedSignatures();

    // Add pharmacy dispensing support
    await addPharmacyDispensingSupport();
    
    console.log('✅ Database initialization completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
};

// Run initialization if this script is executed directly
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('👍 All tables created successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('👎 Failed to initialize database:', error);
      process.exit(1);
    });
}

module.exports = { initializeDatabase };
