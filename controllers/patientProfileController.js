const PatientProfile = require('../models/PatientProfile');
const { query } = require('../config/db');
const cache = require('../services/cacheService');

/**
 * Patient Profile Controller
 * Manages comprehensive patient profiles with dynamic categories
 */

class PatientProfileController {
  /**
   * Get Complete Patient Profile
   */
  static async getCompleteProfile(req, res) {
    try {
      const patientId = req.user?.id || req.params.patientId;
      
      if (!patientId) {
        return res.status(400).json({
          success: false,
          message: 'Patient ID is required'
        });
      }

      // Try cache first
      const cacheKey = `patient_profile_complete_${patientId}`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          message: 'Complete patient profile (from cache)',
          data: cached,
          source: 'cache'
        });
      }

      const profile = await PatientProfile.getCompleteProfile(patientId);
      
      // Cache for 1 hour
      await cache.set(cacheKey, profile, 3600);

      res.json({
        success: true,
        message: 'Complete patient profile retrieved',
        data: profile,
        source: 'database'
      });

    } catch (error) {
      console.error('Error fetching complete profile:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching patient profile',
        error: error.message
      });
    }
  }

  /**
   * Get Profile Summary
   */
  static async getProfileSummary(req, res) {
    try {
      const patientId = req.user?.id;

      const summary = await PatientProfile.getProfileSummary(patientId);

      res.json({
        success: true,
        message: 'Patient profile summary',
        data: summary
      });

    } catch (error) {
      console.error('Error fetching profile summary:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching profile summary',
        error: error.message
      });
    }
  }

  /**
   * Update Personal Details
   */
  static async updatePersonalDetails(req, res) {
    try {
      const patientId = req.user.id;
      const { date_of_birth, gender, marital_status, dependents, biographical_notes } = req.body;

      const upsertQuery = `
        INSERT INTO patient_personal_details (patient_id, date_of_birth, gender, marital_status, dependents, biographical_notes)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (patient_id) DO UPDATE SET
          date_of_birth = COALESCE($2, patient_personal_details.date_of_birth),
          gender = COALESCE($3, patient_personal_details.gender),
          marital_status = COALESCE($4, patient_personal_details.marital_status),
          dependents = COALESCE($5, patient_personal_details.dependents),
          biographical_notes = COALESCE($6, patient_personal_details.biographical_notes),
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;

      const result = await query(upsertQuery, [patientId, date_of_birth, gender, marital_status, dependents, biographical_notes]);
      
      // Invalidate cache
      await cache.delete(`patient_profile_complete_${patientId}`);

      res.json({
        success: true,
        message: 'Personal details updated successfully',
        data: result.rows[0]
      });

    } catch (error) {
      console.error('Error updating personal details:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating personal details',
        error: error.message
      });
    }
  }

  /**
   * Add Allergy
   */
  static async addAllergy(req, res) {
    try {
      const patientId = req.user.id;
      const { allergen, allergen_type, severity, reaction_description, date_identified, notes } = req.body;

      if (!allergen || !allergen_type || !severity) {
        return res.status(400).json({
          success: false,
          message: 'Allergen, type, and severity are required'
        });
      }

      const insertQuery = `
        INSERT INTO patient_allergies (patient_id, allergen, allergen_type, severity, reaction_description, date_identified, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const result = await query(insertQuery, [patientId, allergen, allergen_type, severity, reaction_description, date_identified, notes]);
      
      await cache.delete(`patient_profile_complete_${patientId}`);

      res.status(201).json({
        success: true,
        message: 'Allergy added successfully',
        data: result.rows[0]
      });

    } catch (error) {
      console.error('Error adding allergy:', error);
      res.status(500).json({
        success: false,
        message: 'Error adding allergy',
        error: error.message
      });
    }
  }

  /**
   * Add Medical Condition
   */
  static async addMedicalCondition(req, res) {
    try {
      const patientId = req.user.id;
      const { condition_name, condition_code, severity, date_diagnosed, treating_specialist, notes } = req.body;

      if (!condition_name) {
        return res.status(400).json({
          success: false,
          message: 'Condition name is required'
        });
      }

      const insertQuery = `
        INSERT INTO patient_medical_conditions (patient_id, condition_name, condition_code, severity, date_diagnosed, treating_specialist, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const result = await query(insertQuery, [patientId, condition_name, condition_code, severity, date_diagnosed, treating_specialist, notes]);
      
      await cache.delete(`patient_profile_complete_${patientId}`);

      res.status(201).json({
        success: true,
        message: 'Medical condition added successfully',
        data: result.rows[0]
      });

    } catch (error) {
      console.error('Error adding medical condition:', error);
      res.status(500).json({
        success: false,
        message: 'Error adding medical condition',
        error: error.message
      });
    }
  }

  /**
   * Add Medication
   */
  static async addMedication(req, res) {
    try {
      const patientId = req.user.id;
      const { medication_name, medication_code, dosage, frequency, route_of_administration, start_date, prescribing_doctor, reason_for_medication, notes } = req.body;

      if (!medication_name || !dosage || !frequency) {
        return res.status(400).json({
          success: false,
          message: 'Medication name, dosage, and frequency are required'
        });
      }

      const insertQuery = `
        INSERT INTO patient_medications (patient_id, medication_name, medication_code, dosage, frequency, route_of_administration, start_date, prescribing_doctor, reason_for_medication, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      const result = await query(insertQuery, [patientId, medication_name, medication_code, dosage, frequency, route_of_administration, start_date, prescribing_doctor, reason_for_medication, notes]);
      
      await cache.delete(`patient_profile_complete_${patientId}`);

      res.status(201).json({
        success: true,
        message: 'Medication added successfully',
        data: result.rows[0]
      });

    } catch (error) {
      console.error('Error adding medication:', error);
      res.status(500).json({
        success: false,
        message: 'Error adding medication',
        error: error.message
      });
    }
  }

  /**
   * Add Vaccination
   */
  static async addVaccination(req, res) {
    try {
      const patientId = req.user.id;
      const { vaccine_name, vaccine_code, vaccination_date, expiry_date, dose_number, total_doses, route_of_administration, administration_site, administrator_name, facility_name, batch_number, adverse_reactions, next_dose_due_date, notes } = req.body;

      if (!vaccine_name || !vaccination_date) {
        return res.status(400).json({
          success: false,
          message: 'Vaccine name and date are required'
        });
      }

      const insertQuery = `
        INSERT INTO patient_vaccinations (patient_id, vaccine_name, vaccine_code, vaccination_date, expiry_date, dose_number, total_doses, route_of_administration, administration_site, administrator_name, facility_name, batch_number, adverse_reactions, next_dose_due_date, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
      `;

      const result = await query(insertQuery, [patientId, vaccine_name, vaccine_code, vaccination_date, expiry_date, dose_number, total_doses, route_of_administration, administration_site, administrator_name, facility_name, batch_number, adverse_reactions, next_dose_due_date, notes]);
      
      await cache.delete(`patient_profile_complete_${patientId}`);

      res.status(201).json({
        success: true,
        message: 'Vaccination added successfully',
        data: result.rows[0]
      });

    } catch (error) {
      console.error('Error adding vaccination:', error);
      res.status(500).json({
        success: false,
        message: 'Error adding vaccination',
        error: error.message
      });
    }
  }

  /**
   * Add Test Result
   */
  static async addTestResult(req, res) {
    try {
      const patientId = req.user.id;
      const { test_name, test_code, test_type, test_date, sample_date, results_received_date, result_value, result_unit, reference_range, abnormal_flag, performing_lab, ordering_doctor, clinical_notes, file_attachment_url } = req.body;

      if (!test_name || !test_type || !test_date) {
        return res.status(400).json({
          success: false,
          message: 'Test name, type, and date are required'
        });
      }

      const insertQuery = `
        INSERT INTO patient_test_results (patient_id, test_name, test_code, test_type, test_date, sample_date, results_received_date, result_value, result_unit, reference_range, abnormal_flag, performing_lab, ordering_doctor, clinical_notes, file_attachment_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
      `;

      const result = await query(insertQuery, [patientId, test_name, test_code, test_type, test_date, sample_date, results_received_date, result_value, result_unit, reference_range, abnormal_flag, performing_lab, ordering_doctor, clinical_notes, file_attachment_url]);
      
      await cache.delete(`patient_profile_complete_${patientId}`);

      res.status(201).json({
        success: true,
        message: 'Test result added successfully',
        data: result.rows[0]
      });

    } catch (error) {
      console.error('Error adding test result:', error);
      res.status(500).json({
        success: false,
        message: 'Error adding test result',
        error: error.message
      });
    }
  }

  /**
   * Add Healthcare Provider
   */
  static async addHealthcareProvider(req, res) {
    try {
      const patientId = req.user.id;
      const { provider_type, provider_name, specialty, clinic_name, phone, email, address, is_primary_care, notes } = req.body;

      if (!provider_type || !provider_name) {
        return res.status(400).json({
          success: false,
          message: 'Provider type and name are required'
        });
      }

      const insertQuery = `
        INSERT INTO patient_healthcare_providers (patient_id, provider_type, provider_name, specialty, clinic_name, phone, email, address, is_primary_care, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      const result = await query(insertQuery, [patientId, provider_type, provider_name, specialty, clinic_name, phone, email, address, is_primary_care, notes]);
      
      await cache.delete(`patient_profile_complete_${patientId}`);

      res.status(201).json({
        success: true,
        message: 'Healthcare provider added successfully',
        data: result.rows[0]
      });

    } catch (error) {
      console.error('Error adding healthcare provider:', error);
      res.status(500).json({
        success: false,
        message: 'Error adding healthcare provider',
        error: error.message
      });
    }
  }

  /**
   * Add Lifestyle Data (e.g., blood pressure, glucose)
   */
  static async addLifestyleData(req, res) {
    try {
      const patientId = req.user.id;
      const { data_type, measurement_date, measurement_time, value_numeric, value_text, unit_of_measurement, data_source, notes } = req.body;

      if (!data_type || !measurement_date) {
        return res.status(400).json({
          success: false,
          message: 'Data type and date are required'
        });
      }

      const insertQuery = `
        INSERT INTO patient_lifestyle_data (patient_id, data_type, measurement_date, measurement_time, value_numeric, value_text, unit_of_measurement, data_source, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;

      const result = await query(insertQuery, [patientId, data_type, measurement_date, measurement_time, value_numeric, value_text, unit_of_measurement, data_source, notes]);
      
      await cache.delete(`patient_profile_complete_${patientId}`);

      res.status(201).json({
        success: true,
        message: 'Lifestyle data added successfully',
        data: result.rows[0]
      });

    } catch (error) {
      console.error('Error adding lifestyle data:', error);
      res.status(500).json({
        success: false,
        message: 'Error adding lifestyle data',
        error: error.message
      });
    }
  }

  /**
   * Add Advance Directive
   */
  static async addAdvanceDirective(req, res) {
    try {
      const patientId = req.user.id;
      const { directive_type, directive_date, expiry_date, document_url, designated_agent_name, designated_agent_phone, designated_agent_relationship, medical_preferences } = req.body;

      if (!directive_type || !directive_date) {
        return res.status(400).json({
          success: false,
          message: 'Directive type and date are required'
        });
      }

      const insertQuery = `
        INSERT INTO patient_advance_directives (patient_id, directive_type, directive_date, expiry_date, document_url, designated_agent_name, designated_agent_phone, designated_agent_relationship, medical_preferences)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;

      const result = await query(insertQuery, [patientId, directive_type, directive_date, expiry_date, document_url, designated_agent_name, designated_agent_phone, designated_agent_relationship, medical_preferences]);
      
      await cache.delete(`patient_profile_complete_${patientId}`);

      res.status(201).json({
        success: true,
        message: 'Advance directive added successfully',
        data: result.rows[0]
      });

    } catch (error) {
      console.error('Error adding advance directive:', error);
      res.status(500).json({
        success: false,
        message: 'Error adding advance directive',
        error: error.message
      });
    }
  }

  /**
   * Create Custom Category
   */
  static async createCustomCategory(req, res) {
    try {
      const patientId = req.user.id;
      const { category_name, category_description, display_order } = req.body;

      if (!category_name) {
        return res.status(400).json({
          success: false,
          message: 'Category name is required'
        });
      }

      const insertQuery = `
        INSERT INTO patient_custom_categories (patient_id, category_name, category_description, display_order)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;

      const result = await query(insertQuery, [patientId, category_name, category_description, display_order]);
      
      await cache.delete(`patient_profile_complete_${patientId}`);

      res.status(201).json({
        success: true,
        message: 'Custom category created successfully',
        data: result.rows[0]
      });

    } catch (error) {
      console.error('Error creating custom category:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating custom category',
        error: error.message
      });
    }
  }

  /**
   * Add Data to Custom Category
   */
  static async addCustomCategoryData(req, res) {
    try {
      const { customCategoryId } = req.params;
      const { data_key, data_value, data_type } = req.body;

      if (!data_key || !data_value) {
        return res.status(400).json({
          success: false,
          message: 'Data key and value are required'
        });
      }

      const insertQuery = `
        INSERT INTO patient_custom_category_data (custom_category_id, data_key, data_value, data_type)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;

      const result = await query(insertQuery, [customCategoryId, data_key, data_value, data_type]);

      res.status(201).json({
        success: true,
        message: 'Custom category data added successfully',
        data: result.rows[0]
      });

    } catch (error) {
      console.error('Error adding custom category data:', error);
      res.status(500).json({
        success: false,
        message: 'Error adding custom category data',
        error: error.message
      });
    }
  }
}

module.exports = PatientProfileController;
