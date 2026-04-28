const { query } = require('../config/db');

/**
 * Patient Profile Model
 * Comprehensive patient profile with dynamic categories
 */

class PatientProfile {
  /**
   * Create patient profile tables
   */
  static async createTables() {
    const createTablesQuery = `
      -- Personal Details Category
      CREATE TABLE IF NOT EXISTS patient_personal_details (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL UNIQUE,
        date_of_birth DATE,
        gender VARCHAR(20) CHECK (gender IN ('Male', 'Female', 'Other', 'Prefer not to say')),
        marital_status VARCHAR(50) CHECK (marital_status IN ('Single', 'Married', 'Divorced', 'Widowed', 'Prefer not to say')),
        dependents INTEGER DEFAULT 0,
        biographical_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
      );

      -- Contact Information (with history)
      CREATE TABLE IF NOT EXISTS patient_contact_history (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL,
        contact_type VARCHAR(50) CHECK (contact_type IN ('Email', 'Phone', 'Address')),
        contact_value TEXT NOT NULL,
        is_primary BOOLEAN DEFAULT false,
        start_date DATE DEFAULT CURRENT_DATE,
        end_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
      );

      -- Emergency Contacts
      CREATE TABLE IF NOT EXISTS patient_emergency_contacts (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL,
        contact_name VARCHAR(255) NOT NULL,
        relationship VARCHAR(100),
        phone_primary VARCHAR(20) NOT NULL,
        phone_secondary VARCHAR(20),
        email VARCHAR(255),
        address TEXT,
        priority_order INTEGER DEFAULT 1,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
      );

      -- Digital Identifiers
      CREATE TABLE IF NOT EXISTS patient_digital_identifiers (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL,
        identifier_type VARCHAR(100) NOT NULL CHECK (identifier_type IN ('Tax Number', 'Driver License', 'Insurance ID', 'NHS Number', 'Other')),
        identifier_value VARCHAR(255) NOT NULL,
        issuing_country VARCHAR(100),
        expiry_date DATE,
        is_verified BOOLEAN DEFAULT false,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
        UNIQUE(patient_id, identifier_type, identifier_value)
      );

      -- Allergies
      CREATE TABLE IF NOT EXISTS patient_allergies (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL,
        allergen VARCHAR(255) NOT NULL,
        allergen_type VARCHAR(50) CHECK (allergen_type IN ('Medication', 'Food', 'Environmental', 'Other')),
        severity VARCHAR(20) CHECK (severity IN ('Mild', 'Moderate', 'Severe', 'Life-threatening')),
        reaction_description TEXT,
        date_identified DATE,
        is_active BOOLEAN DEFAULT true,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
      );

      -- Chronic Conditions & Diagnoses
      CREATE TABLE IF NOT EXISTS patient_medical_conditions (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL,
        condition_name VARCHAR(255) NOT NULL,
        condition_code VARCHAR(20),
        severity VARCHAR(20) CHECK (severity IN ('Mild', 'Moderate', 'Severe')),
        date_diagnosed DATE,
        date_resolved DATE,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'remission')),
        treating_specialist VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
      );

      -- Medications
      CREATE TABLE IF NOT EXISTS patient_medications (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL,
        medication_name VARCHAR(255) NOT NULL,
        medication_code VARCHAR(20),
        dosage VARCHAR(100) NOT NULL,
        frequency VARCHAR(100) NOT NULL,
        route_of_administration VARCHAR(50) CHECK (route_of_administration IN ('Oral', 'Injectable', 'Topical', 'Inhaled', 'Other')),
        start_date DATE NOT NULL,
        end_date DATE,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'discontinued', 'completed')),
        prescribing_doctor VARCHAR(255),
        reason_for_medication TEXT,
        side_effects TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
      );

      -- Vaccinations
      CREATE TABLE IF NOT EXISTS patient_vaccinations (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL,
        vaccine_name VARCHAR(255) NOT NULL,
        vaccine_code VARCHAR(20),
        vaccination_date DATE NOT NULL,
        expiry_date DATE,
        dose_number INTEGER,
        total_doses INTEGER,
        route_of_administration VARCHAR(50),
        administration_site VARCHAR(100),
        administrator_name VARCHAR(255),
        facility_name VARCHAR(255),
        batch_number VARCHAR(100),
        adverse_reactions TEXT,
        next_dose_due_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
      );

      -- Test Results
      CREATE TABLE IF NOT EXISTS patient_test_results (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL,
        test_name VARCHAR(255) NOT NULL,
        test_code VARCHAR(20),
        test_type VARCHAR(100) CHECK (test_type IN ('Blood', 'Urine', 'Genetic', 'Imaging', 'Other')),
        test_date DATE NOT NULL,
        sample_date DATE,
        results_received_date DATE,
        result_value VARCHAR(255),
        result_unit VARCHAR(50),
        reference_range VARCHAR(100),
        abnormal_flag BOOLEAN DEFAULT false,
        performing_lab VARCHAR(255),
        ordering_doctor VARCHAR(255),
        clinical_notes TEXT,
        file_attachment_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
      );

      -- Doctor/Specialist Contacts
      CREATE TABLE IF NOT EXISTS patient_healthcare_providers (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL,
        provider_type VARCHAR(100) CHECK (provider_type IN ('Primary Care', 'Specialist', 'Surgeon', 'Therapist', 'Pharmacist', 'Other')),
        provider_name VARCHAR(255) NOT NULL,
        specialty VARCHAR(100),
        clinic_name VARCHAR(255),
        phone VARCHAR(20),
        email VARCHAR(255),
        address TEXT,
        is_primary_care BOOLEAN DEFAULT false,
        last_visit_date DATE,
        next_visit_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
      );

      -- Lifestyle Data
      CREATE TABLE IF NOT EXISTS patient_lifestyle_data (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL,
        data_type VARCHAR(100) NOT NULL CHECK (data_type IN ('Blood Pressure', 'Glucose', 'Weight', 'Heart Rate', 'Sleep', 'Exercise', 'Nutrition', 'Other')),
        measurement_date DATE NOT NULL,
        measurement_time TIME,
        value_numeric DECIMAL(10, 2),
        value_text VARCHAR(255),
        unit_of_measurement VARCHAR(50),
        notes TEXT,
        data_source VARCHAR(100) CHECK (data_source IN ('Patient', 'Device', 'Healthcare Provider', 'Other')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
      );

      -- Advanced Directives
      CREATE TABLE IF NOT EXISTS patient_advance_directives (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL,
        directive_type VARCHAR(100) NOT NULL CHECK (directive_type IN ('Living Will', 'Power of Attorney', 'Do Not Resuscitate', 'Organ Donation', 'Other')),
        directive_date DATE NOT NULL,
        expiry_date DATE,
        document_url TEXT,
        designated_agent_name VARCHAR(255),
        designated_agent_phone VARCHAR(20),
        designated_agent_relationship VARCHAR(100),
        directive_status VARCHAR(20) DEFAULT 'active' CHECK (directive_status IN ('active', 'expired', 'revoked')),
        medical_preferences TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
      );

      -- Profile Customization (User-defined categories)
      CREATE TABLE IF NOT EXISTS patient_custom_categories (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL,
        category_name VARCHAR(255) NOT NULL,
        category_description TEXT,
        display_order INTEGER,
        is_visible BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
        UNIQUE(patient_id, category_name)
      );

      -- Custom Category Data
      CREATE TABLE IF NOT EXISTS patient_custom_category_data (
        id SERIAL PRIMARY KEY,
        custom_category_id INTEGER NOT NULL,
        data_key VARCHAR(255) NOT NULL,
        data_value TEXT,
        data_type VARCHAR(50) CHECK (data_type IN ('Text', 'Number', 'Date', 'Boolean', 'URL', 'File', 'JSON')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (custom_category_id) REFERENCES patient_custom_categories(id) ON DELETE CASCADE
      );

      -- Create indexes for better query performance
      CREATE INDEX IF NOT EXISTS idx_patient_personal_details_patient_id ON patient_personal_details(patient_id);
      CREATE INDEX IF NOT EXISTS idx_patient_contact_history_patient_id ON patient_contact_history(patient_id);
      CREATE INDEX IF NOT EXISTS idx_patient_emergency_contacts_patient_id ON patient_emergency_contacts(patient_id);
      CREATE INDEX IF NOT EXISTS idx_patient_digital_identifiers_patient_id ON patient_digital_identifiers(patient_id);
      CREATE INDEX IF NOT EXISTS idx_patient_allergies_patient_id ON patient_allergies(patient_id);
      CREATE INDEX IF NOT EXISTS idx_patient_allergies_active ON patient_allergies(patient_id, is_active);
      CREATE INDEX IF NOT EXISTS idx_patient_medical_conditions_patient_id ON patient_medical_conditions(patient_id);
      CREATE INDEX IF NOT EXISTS idx_patient_medical_conditions_status ON patient_medical_conditions(patient_id, status);
      CREATE INDEX IF NOT EXISTS idx_patient_medications_patient_id ON patient_medications(patient_id);
      CREATE INDEX IF NOT EXISTS idx_patient_medications_status ON patient_medications(patient_id, status);
      CREATE INDEX IF NOT EXISTS idx_patient_vaccinations_patient_id ON patient_vaccinations(patient_id);
      CREATE INDEX IF NOT EXISTS idx_patient_test_results_patient_id ON patient_test_results(patient_id);
      CREATE INDEX IF NOT EXISTS idx_patient_test_results_date ON patient_test_results(patient_id, test_date);
      CREATE INDEX IF NOT EXISTS idx_patient_healthcare_providers_patient_id ON patient_healthcare_providers(patient_id);
      CREATE INDEX IF NOT EXISTS idx_patient_lifestyle_data_patient_id ON patient_lifestyle_data(patient_id);
      CREATE INDEX IF NOT EXISTS idx_patient_lifestyle_data_type ON patient_lifestyle_data(patient_id, data_type);
      CREATE INDEX IF NOT EXISTS idx_patient_advance_directives_patient_id ON patient_advance_directives(patient_id);
      CREATE INDEX IF NOT EXISTS idx_patient_custom_categories_patient_id ON patient_custom_categories(patient_id);
    `;

    try {
      await query(createTablesQuery);
      console.log('✅ Patient profile tables created successfully');
    } catch (error) {
      console.error('❌ Error creating patient profile tables:', error);
      throw error;
    }
  }

  /**
   * Get complete patient profile
   */
  static async getCompleteProfile(patientId) {
    const profileQueries = {
      basic: `SELECT * FROM patients WHERE id = $1`,
      personal: `SELECT * FROM patient_personal_details WHERE patient_id = $1`,
      contacts: `SELECT * FROM patient_contact_history WHERE patient_id = $1 ORDER BY start_date DESC`,
      emergency: `SELECT * FROM patient_emergency_contacts WHERE patient_id = $1 ORDER BY priority_order`,
      identifiers: `SELECT * FROM patient_digital_identifiers WHERE patient_id = $1`,
      allergies: `SELECT * FROM patient_allergies WHERE patient_id = $1 AND is_active = true`,
      conditions: `SELECT * FROM patient_medical_conditions WHERE patient_id = $1 AND status = 'active'`,
      medications: `SELECT * FROM patient_medications WHERE patient_id = $1 AND status = 'active'`,
      vaccinations: `SELECT * FROM patient_vaccinations WHERE patient_id = $1 ORDER BY vaccination_date DESC LIMIT 10`,
      recent_tests: `SELECT * FROM patient_test_results WHERE patient_id = $1 ORDER BY test_date DESC LIMIT 10`,
      providers: `SELECT * FROM patient_healthcare_providers WHERE patient_id = $1`,
      advance_directives: `SELECT * FROM patient_advance_directives WHERE patient_id = $1 AND directive_status = 'active'`,
      custom_categories: `SELECT * FROM patient_custom_categories WHERE patient_id = $1 ORDER BY display_order`
    };

    try {
      const profile = {};
      for (const [key, sql] of Object.entries(profileQueries)) {
        const result = await query(sql, [patientId]);
        profile[key] = result.rows;
      }
      return profile;
    } catch (error) {
      console.error('Error fetching complete profile:', error);
      throw error;
    }
  }

  /**
   * Get profile summary
   */
  static async getProfileSummary(patientId) {
    const summaryQuery = `
      SELECT
        p.id,
        p.first_name,
        p.last_name,
        p.email,
        p.phone,
        ppd.date_of_birth,
        ppd.gender,
        ppd.marital_status,
        (SELECT COUNT(*) FROM patient_allergies WHERE patient_id = $1 AND is_active = true) as active_allergies,
        (SELECT COUNT(*) FROM patient_medical_conditions WHERE patient_id = $1 AND status = 'active') as active_conditions,
        (SELECT COUNT(*) FROM patient_medications WHERE patient_id = $1 AND status = 'active') as current_medications,
        (SELECT MAX(vaccination_date) FROM patient_vaccinations WHERE patient_id = $1) as last_vaccination,
        (SELECT MAX(test_date) FROM patient_test_results WHERE patient_id = $1) as last_test_date,
        (SELECT COUNT(*) FROM patient_advance_directives WHERE patient_id = $1 AND directive_status = 'active') as active_directives
      FROM patients p
      LEFT JOIN patient_personal_details ppd ON p.id = ppd.patient_id
      WHERE p.id = $1
    `;

    try {
      const result = await query(summaryQuery, [patientId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error fetching profile summary:', error);
      throw error;
    }
  }

  /**
   * Rename custom category
   */
  static async renameCustomCategory(categoryId, patientId, newName) {
    // Get old name first
    const getOldNameQuery = `SELECT category_name FROM patient_custom_categories WHERE id = $1 AND patient_id = $2`;
    const oldNameResult = await query(getOldNameQuery, [categoryId, patientId]);
    
    if (oldNameResult.rows.length === 0) {
      throw new Error('Category not found');
    }

    const oldName = oldNameResult.rows[0].category_name;

    const updateQuery = `
      UPDATE patient_custom_categories
      SET category_name = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND patient_id = $3
      RETURNING *
    `;

    try {
      const result = await query(updateQuery, [categoryId, newName, patientId]);
      
      // Record in version history
      if (result.rows.length > 0) {
        const VersionHistory = require('./VersionHistory');
        await VersionHistory.recordCategoryRename(patientId, categoryId, 'custom_category', oldName, newName, patientId);
      }
      
      return result.rows[0];
    } catch (error) {
      console.error('Error renaming category:', error);
      throw error;
    }
  }

  /**
   * Add custom category
   */
  static async addCustomCategory(patientId, categoryName, categoryDescription = null, displayOrder = null) {
    const insertQuery = `
      INSERT INTO patient_custom_categories (patient_id, category_name, category_description, display_order)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    try {
      const result = await query(insertQuery, [patientId, categoryName, categoryDescription, displayOrder]);
      return result.rows[0];
    } catch (error) {
      console.error('Error adding custom category:', error);
      throw error;
    }
  }

  /**
   * Delete custom category
   */
  static async deleteCustomCategory(categoryId, patientId) {
    const deleteQuery = `
      DELETE FROM patient_custom_categories
      WHERE id = $1 AND patient_id = $2
      RETURNING *
    `;

    try {
      const result = await query(deleteQuery, [categoryId, patientId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error deleting custom category:', error);
      throw error;
    }
  }

  /**
   * Reorder custom categories
   */
  static async reorderCategories(patientId, categoryOrders) {
    try {
      // categoryOrders is array of {id, display_order}
      for (const categoryOrder of categoryOrders) {
        await query(
          `UPDATE patient_custom_categories SET display_order = $1 WHERE id = $2 AND patient_id = $3`,
          [categoryOrder.display_order, categoryOrder.id, patientId]
        );
      }
      return { success: true, message: 'Categories reordered successfully' };
    } catch (error) {
      console.error('Error reordering categories:', error);
      throw error;
    }
  }

  /**
   * Rename built-in category (for display purposes, creates an alias)
   */
  static async createCategoryAlias(patientId, builtInCategory, aliasName) {
    // Create a custom category as an alias to built-in category
    const insertQuery = `
      INSERT INTO patient_custom_categories (patient_id, category_name, category_description)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    try {
      const result = await query(insertQuery, [patientId, aliasName, `Alias for ${builtInCategory}`]);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating category alias:', error);
      throw error;
    }
  }
}

module.exports = PatientProfile;
