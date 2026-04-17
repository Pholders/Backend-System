const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Pharmacy = require('../models/Pharmacy');

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
