const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Pharmacy = require('../models/Pharmacy');
const AccountDeletionToken = require('../models/AccountDeletionToken');
<<<<<<< HEAD
const ActionToken = require('../models/ActionToken');
const Notification = require('../models/Notification');
const NotificationPreferences = require('../models/NotificationPreferences');
const DeviceToken = require('../models/DeviceToken');
const { runMigration: addProfileSecurityColumns } = require('./addProfileSecurityColumns');
const { runMigration: createLinkedServicesTables } = require('./createLinkedServicesTables');
const { runMigration: createMedicalAidTables } = require('./createMedicalAidTables');
const { runMigration: createSupportTicketsTable } = require('./createSupportTicketsTable');
=======
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
>>>>>>> dc64845b1ada069271c2ae6cf957fa89d3d5894e

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

<<<<<<< HEAD
    // Action tokens (generic single-use tokens: email change, account unfreeze, 2FA enable)
    await ActionToken.createTable();

    // Add profile/security columns to patients (avatar_url, suburb, id_number_encrypted,
    // password_changed_at, password_strength, biometric/2FA flags, account_frozen)
    await addProfileSecurityColumns();

    // Linked services (connected_doctors, connected_pharmacies, family_dependents)
    await createLinkedServicesTables();

    // Medical aid (medical_aid_schemes, medical_aid_claims, invoices)
    await createMedicalAidTables();

    // Support tickets
    await createSupportTicketsTable();

    // Notifications stack
    await Notification.createTable();
    await NotificationPreferences.createTable();
    await DeviceToken.createTable();
    await DeviceToken.addDeviceTokenColumns();
=======
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
>>>>>>> dc64845b1ada069271c2ae6cf957fa89d3d5894e
    
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
