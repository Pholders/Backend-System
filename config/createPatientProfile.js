const PatientProfile = require('../models/PatientProfile');

/**
 * Migration: Create Comprehensive Patient Profile Tables
 * Adds support for dynamic patient profile categories and medical data
 */

async function setupPatientProfileTables() {
  try {
    console.log('🔄 Starting migration: Create comprehensive patient profile tables...\n');
    
    await PatientProfile.createTables();
    
    console.log('\n✅ Migration completed successfully!\n');
    console.log('📊 New tables created:');
    console.log('   • patient_personal_details');
    console.log('   • patient_contact_history');
    console.log('   • patient_emergency_contacts');
    console.log('   • patient_digital_identifiers');
    console.log('   • patient_allergies');
    console.log('   • patient_medical_conditions');
    console.log('   • patient_medications');
    console.log('   • patient_vaccinations');
    console.log('   • patient_test_results');
    console.log('   • patient_healthcare_providers');
    console.log('   • patient_lifestyle_data');
    console.log('   • patient_advance_directives');
    console.log('   • patient_custom_categories');
    console.log('   • patient_custom_category_data\n');
    
    console.log('🎯 Features enabled:');
    console.log('   ✓ Comprehensive medical profiles');
    console.log('   ✓ Dynamic user-defined categories');
    console.log('   ✓ Contact history tracking');
    console.log('   ✓ Advanced directives support');
    console.log('   ✓ Medication & vaccination tracking');
    console.log('   ✓ Lifestyle monitoring');
  } catch (error) {
    throw error;
  }
}

if (require.main === module) {
  setupPatientProfileTables().then(() => process.exit(0)).catch(err => {
    console.error('❌ Migration error:', err.message);
    process.exit(1);
  });
}

module.exports = setupPatientProfileTables;
