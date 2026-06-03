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
