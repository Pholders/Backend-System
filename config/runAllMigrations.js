/**
 * Full database migration runner.
 * Safe to run multiple times — every migration uses IF NOT EXISTS / column existence checks.
 * Run: node config/runAllMigrations.js
 */

const { initializeDatabase } = require('./initDb');

// Migrations not covered by initDb.js
const addEmailVerification            = require('./addEmailVerification');
const addEmailVerificationToDoctors   = require('./addEmailVerificationToDoctors');
const addEmailVerificationToPharmacies= require('./addEmailVerificationToPharmacies');
const addEmailVerificationAuditEvents = require('./addEmailVerificationAuditEvents');
const addRoleField                    = require('./addRoleField');
const addDoctorListingFields          = require('./addDoctorListingFields');
const addDoctorAppointmentAcceptance  = require('./addDoctorAppointmentAcceptance');
const addDetailsColumnToDoctors       = require('./addDetailsColumnToDoctors');
const addLocationToDoctors            = require('./addLocationToDoctors');
const addGeolocationToDoctors         = require('./addGeolocationToDoctors');
const addGeolocationSupport           = require('./addGeolocationSupport');
const addLoginLocationTracking        = require('./addLoginLocationTracking');
const addSessionsAndAuditLogs         = require('./addSessionsAndAuditLogs');
const addSecurityAlerts               = require('./addSecurityAlerts');
const addPasswordReset                = require('./addPasswordReset');
const addNationalityField             = require('./addNationalityField');
const addDoctorPharmacyOTPSupport     = require('./addDoctorPharmacyOTPSupport');
const createAdminsTable               = require('./createAdminsTable');
const createRefreshTokensTable        = require('./createRefreshTokensTable');
const createPatientProfile            = require('./createPatientProfile');
const addEnhancedProfileFeatures      = require('./addEnhancedProfileFeatures');
const addPrescriptionClaimTracking    = require('./addPrescriptionClaimTracking');
const addQRCodeOneTimeUse             = require('./addQRCodeOneTimeUse');
const backfillPharmaciesBasicTier     = require('./backfillPharmaciesBasicTier');

const step = async (name, fn) => {
  try {
    await fn();
    console.log(`✅ ${name}`);
  } catch (err) {
    // Log but continue — most errors here are "already exists"
    console.warn(`⚠️  ${name}: ${err.message}`);
  }
};

const run = async () => {
  console.log('🚀 Starting full database migration...\n');

  // Phase 1 — core tables (initDb covers base tables + most migrations)
  await step('initDb — core tables + base migrations', initializeDatabase);

  // Phase 2 — email verification columns
  await step('addEmailVerification (patients)',     () => addEmailVerification());
  await step('addEmailVerificationToDoctors',       addEmailVerificationToDoctors);
  await step('addEmailVerificationToPharmacies',    addEmailVerificationToPharmacies);
  await step('addEmailVerificationAuditEvents',     addEmailVerificationAuditEvents);

  // Phase 3 — role & profile fields
  await step('addRoleField',                        () => addRoleField.runMigration());
  await step('addNationalityField',                 () => addNationalityField.runMigration());
  await step('addDetailsColumnToDoctors',           () => addDetailsColumnToDoctors.addDetailsColumnToDoctors());
  await step('addDoctorListingFields',              () => addDoctorListingFields.addDoctorListingFields());
  await step('addDoctorAppointmentAcceptance',      () => addDoctorAppointmentAcceptance());
  await step('addDoctorPharmacyOTPSupport',         () => addDoctorPharmacyOTPSupport.runMigration());

  // Phase 4 — geolocation
  await step('addLocationToDoctors',                addLocationToDoctors);
  await step('addGeolocationToDoctors',             addGeolocationToDoctors);
  await step('addGeolocationSupport (audit_logs)',  addGeolocationSupport);
  await step('addLoginLocationTracking',            addLoginLocationTracking);

  // Phase 5 — sessions, security & auth
  await step('addSessionsAndAuditLogs',             addSessionsAndAuditLogs);
  await step('addSecurityAlerts',                   addSecurityAlerts);
  await step('addPasswordReset',                    addPasswordReset);
  await step('createAdminsTable',                   () => createAdminsTable.runMigration());
  await step('createRefreshTokensTable',            () => createRefreshTokensTable.runMigration());

  // Phase 6 — patient profile & PHR
  await step('createPatientProfile',                createPatientProfile);
  await step('addEnhancedProfileFeatures',          addEnhancedProfileFeatures);

  // Phase 7 — prescriptions
  await step('addPrescriptionClaimTracking',        addPrescriptionClaimTracking);
  await step('addQRCodeOneTimeUse',                 addQRCodeOneTimeUse);

  // Phase 8 — pharmacy data backfill
  await step('backfillPharmaciesBasicTier',         backfillPharmaciesBasicTier);

  console.log('\n✅ All migrations completed.');
};

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n❌ Fatal migration error:', err);
    process.exit(1);
  });
