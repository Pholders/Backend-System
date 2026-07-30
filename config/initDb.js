const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Pharmacy = require('../models/Pharmacy');
const AccountDeletionToken = require('../models/AccountDeletionToken');
const ActionToken = require('../models/ActionToken');
const Notification = require('../models/Notification');
const NotificationPreferences = require('../models/NotificationPreferences');
const DeviceToken = require('../models/DeviceToken');
const { runMigration: addProfileSecurityColumns } = require('./addProfileSecurityColumns');
const { runMigration: createLinkedServicesTables } = require('./createLinkedServicesTables');
const { runMigration: createMedicalAidTables } = require('./createMedicalAidTables');
const { runMigration: createSupportTicketsTable } = require('./createSupportTicketsTable');
const { runMigration: createOrdersTables } = require('./createOrdersTables');
const Appointment = require('../models/Appointment');
const AppointmentReminder = require('../models/AppointmentReminder');
const PharmacyGroup = require('../models/PharmacyGroup');
const PharmacyAgreement = require('../models/PharmacyAgreement');
const AgreementCompliance = require('../models/AgreementCompliance');
const DoctorReview = require('../models/DoctorReview');
const Payment = require('../models/Payment');
const Prescription = require('../models/Prescription');
const Session = require('../models/Session');
const AuditLog = require('../models/AuditLog');
const { addPendingPaymentStatus } = require('./addPendingPaymentStatus');
const { addPaymentColumnsToAppointments } = require('./addPaymentColumnsToAppointments');
const createPHRTables = require('./createPHRTables');
const { addSessionBasedSignatures } = require('./addSessionBasedSignatures');
const addPharmacyDispensingSupport = require('./addPharmacyDispensingSupport');
const addAppointmentReminders = require('./addAppointmentReminders');
const addPharmacyPartnerships = require('./addPharmacyPartnerships');
const addPharmacyTierFeatures = require('./addPharmacyTierFeatures');
const updatePharmacyTierConstraint = require('./updatePharmacyTierConstraint');
const initializePharmacyGroups = require('./initPharmacyGroups');

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

    // Action tokens (generic single-use tokens: email change, account unfreeze, 2FA enable)
    await ActionToken.createTable();

    // Create Sessions and Audit Logs early — many migrations alter audit_logs constraints
    await Session.createTable();
    await AuditLog.createTable();

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
    // Create Appointments table
    await Appointment.createTable();

    // Create Doctor Reviews table
    await DoctorReview.createTable();

    // Create Payments table
    await Payment.createTable();

    // Add profile/security columns to patients
    await addProfileSecurityColumns();

    // Add pending_payment status to appointments
    await addPendingPaymentStatus();

    // Add payment_status and payment_method columns to appointments
    await addPaymentColumnsToAppointments();

    // Create Prescription tables (required by PHR + session-based signatures + pharmacy dispensing)
    await Prescription.createTable();
    

    // Create PHR tables (health vitals, documents, access control)
    await createPHRTables();

    // Add session-based signature support
    await addSessionBasedSignatures();

    // Add pharmacy dispensing support
    await addPharmacyDispensingSupport();

    // Orders v1 (orders table, status history, link claims to orders, add 'order' notification type)
    await createOrdersTables();

    // Create appointment reminders tables
    await AppointmentReminder.createTable();
    await AppointmentReminder.createNotificationHistoryTable();

    // Run appointment reminders migration
    await addAppointmentReminders();

    // Create pharmacy partnership tables
    await addPharmacyPartnerships();

    // Add pharmacy tier features columns
    await addPharmacyTierFeatures();

    // Update tier constraint to include 'enterprise'
    await updatePharmacyTierConstraint();

    // Initialize default pharmacy groups and tiers
    await initializePharmacyGroups();
    
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
