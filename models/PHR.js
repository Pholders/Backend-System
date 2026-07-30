/**
 * Personal Health Record (PHR) Model
 * Comprehensive medical record system aggregating patient health data
 */

const { query } = require('../config/db');

class PHR {
  /**
   * Get complete PHR for a patient
   * Aggregates: personal details, medical conditions, allergies, medications, appointments, prescriptions
   */
  static async getCompletePHR(patientId) {
    try {
      const phr = {
        personalCard: await this.getPersonalCard(patientId),
        medicalSummary: await this.getMedicalSummary(patientId),
        activePrescriptions: await this.getActivePrescriptions(patientId),
        currentMedications: await this.getCurrentMedications(patientId),
        allergies: await this.getAllergies(patientId),
        medicalConditions: await this.getMedicalConditions(patientId),
        upcomingAppointments: await this.getUpcomingAppointments(patientId),
        healthHistory: await this.getHealthHistory(patientId),
        healthVitals: await this.getRecentHealthVitals(patientId),
        emergencyContacts: await this.getEmergencyContacts(patientId),
        documents: await this.getPHRDocuments(patientId),
      };

      return phr;
    } catch (error) {
      console.error('Error fetching complete PHR:', error);
      throw error;
    }
  }

  /**
   * Get personal card information with critical health details
   */
  static async getPersonalCard(patientId) {
    try {
      const result = await query(
        `SELECT 
          id,
          first_name,
          last_name,
          email,
          phone as phone_number,
          date_of_birth,
          gender,
          blood_type,
          medical_aid_type,
          emergency_contact_name,
          emergency_contact_phone
        FROM patients
        WHERE id = $1`,
        [patientId]
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error fetching personal card:', error);
      throw error;
    }
  }

  /**
   * Get medical summary (conditions count, allergies count, etc.)
   */
  static async getMedicalSummary(patientId) {
    try {
      const result = await query(
        `SELECT 
          (SELECT COUNT(*) FROM patient_medical_conditions WHERE patient_id = $1) as active_conditions,
          (SELECT COUNT(*) FROM patient_allergies WHERE patient_id = $1) as allergy_count,
          (SELECT COUNT(*) FROM prescriptions WHERE patient_id = $1 AND status = 'signed') as total_prescriptions,
          (SELECT COUNT(*) FROM appointments WHERE patient_id = $1 AND status IN ('scheduled', 'pending_payment')) as upcoming_appointments,
          (SELECT COUNT(*) FROM patient_medications WHERE patient_id = $1 AND status = 'active') as active_medications`,
        [patientId]
      );

      return result.rows[0] || {};
    } catch (error) {
      console.error('Error fetching medical summary:', error);
      throw error;
    }
  }

  /**
   * Get active prescriptions (signed, not revoked)
   */
  static async getActivePrescriptions(patientId) {
    try {
      const result = await query(
        `SELECT 
          p.id,
          p.prescription_number,
          p.created_at,
          p.diagnosis,
          d.first_name as doctor_first_name,
          d.last_name as doctor_last_name,
          d.specialization,
          COUNT(pi.id) as medicine_count
        FROM prescriptions p
        LEFT JOIN doctors d ON p.doctor_id = d.id
        LEFT JOIN prescription_items pi ON p.id = pi.prescription_id
        WHERE p.patient_id = $1 
        AND p.status = 'signed'
        AND p.revoked_at IS NULL
        GROUP BY p.id, d.id
        ORDER BY p.created_at DESC
        LIMIT 10`,
        [patientId]
      );

      return result.rows || [];
    } catch (error) {
      console.error('Error fetching active prescriptions:', error);
      throw error;
    }
  }

  /**
   * Get current medications from patient profile
   */
  static async getCurrentMedications(patientId) {
    try {
      const result = await query(
        `SELECT 
          id,
          medication_name,
          dosage,
          frequency,
          route,
          start_date,
          end_date,
          reason,
          status,
          prescribed_by,
          notes
        FROM patient_medications
        WHERE patient_id = $1 
        AND status = 'active'
        ORDER BY start_date DESC`,
        [patientId]
      );

      return result.rows || [];
    } catch (error) {
      console.error('Error fetching current medications:', error);
      throw error;
    }
  }

  /**
   * Get allergies with severity and reactions
   */
  static async getAllergies(patientId) {
    try {
      const result = await query(
        `SELECT 
          id,
          allergen,
          reaction,
          severity,
          notes,
          identified_at
        FROM patient_allergies
        WHERE patient_id = $1
        ORDER BY severity DESC, identified_at DESC`,
        [patientId]
      );

      return result.rows || [];
    } catch (error) {
      console.error('Error fetching allergies:', error);
      throw error;
    }
  }

  /**
   * Get medical conditions (diagnoses, chronic conditions)
   */
  static async getMedicalConditions(patientId) {
    try {
      const result = await query(
        `SELECT 
          id,
          condition_name,
          diagnosis_date,
          status,
          severity,
          notes,
          icd10_code
        FROM patient_medical_conditions
        WHERE patient_id = $1
        ORDER BY diagnosis_date DESC`,
        [patientId]
      );

      return result.rows || [];
    } catch (error) {
      console.error('Error fetching medical conditions:', error);
      throw error;
    }
  }

  /**
   * Get upcoming appointments
   */
  static async getUpcomingAppointments(patientId) {
    try {
      const result = await query(
        `SELECT 
          a.id,
          a.appointment_date,
          a.time_period,
          a.time_slot,
          a.status,
          a.reason_for_visit,
          a.notes,
          d.first_name as doctor_first_name,
          d.last_name as doctor_last_name,
          d.specialization,
          d.clinic_name
        FROM appointments a
        LEFT JOIN doctors d ON a.doctor_id = d.id
        WHERE a.patient_id = $1 
        AND a.appointment_date >= CURRENT_DATE
        AND a.status IN ('scheduled', 'pending_payment')
        ORDER BY a.appointment_date, a.time_slot
        LIMIT 10`,
        [patientId]
      );

      return result.rows || [];
    } catch (error) {
      console.error('Error fetching upcoming appointments:', error);
      throw error;
    }
  }

  /**
   * Get health history (completed appointments, past prescriptions, etc.)
   */
  static async getHealthHistory(patientId) {
    try {
      const result = await query(
        `SELECT 
          a.id,
          a.appointment_date,
          a.status,
          'appointment' as record_type,
          d.first_name || ' ' || d.last_name as provider_name,
          d.specialization,
          a.notes
        FROM appointments a
        LEFT JOIN doctors d ON a.doctor_id = d.id
        WHERE a.patient_id = $1 
        AND a.status IN ('completed', 'no-show')
        UNION ALL
        SELECT 
          p.id,
          p.created_at::date as appointment_date,
          p.status,
          'prescription' as record_type,
          d.first_name || ' ' || d.last_name as provider_name,
          d.specialization,
          p.diagnosis as notes
        FROM prescriptions p
        LEFT JOIN doctors d ON p.doctor_id = d.id
        WHERE p.patient_id = $1
        ORDER BY appointment_date DESC
        LIMIT 50`,
        [patientId]
      );

      return result.rows || [];
    } catch (error) {
      console.error('Error fetching health history:', error);
      throw error;
    }
  }

  /**
   * Get recent health vitals (BP, HR, weight, glucose, etc.)
   */
  static async getRecentHealthVitals(patientId, limit = 30) {
    try {
      const result = await query(
        `SELECT 
          id,
          measured_at,
          systolic_bp,
          diastolic_bp,
          heart_rate,
          weight_kg,
          blood_glucose,
          oxygen_saturation,
          temperature_c,
          bmi,
          notes
        FROM health_vitals
        WHERE patient_id = $1
        ORDER BY measured_at DESC
        LIMIT $2`,
        [patientId, limit]
      );

      return result.rows || [];
    } catch (error) {
      console.error('Error fetching health vitals:', error);
      throw error;
    }
  }

  /**
   * Get emergency contacts
   */
  static async getEmergencyContacts(patientId) {
    try {
      const result = await query(
        `SELECT 
          id,
          emergency_contact_name,
          emergency_contact_phone,
          emergency_contact_relationship,
          priority,
          notes
        FROM patient_emergency_contacts
        WHERE patient_id = $1
        ORDER BY priority`,
        [patientId]
      );

      return result.rows || [];
    } catch (error) {
      console.error('Error fetching emergency contacts:', error);
      throw error;
    }
  }

  /**
   * Get PHR documents (medical reports, lab results, etc.)
   */
  static async getPHRDocuments(patientId) {
    try {
      const result = await query(
        `SELECT 
          id,
          document_name,
          document_type,
          file_path,
          uploaded_at,
          document_date,
          description,
          related_condition,
          notes
        FROM phr_documents
        WHERE patient_id = $1
        ORDER BY uploaded_at DESC
        LIMIT 50`,
        [patientId]
      );

      return result.rows || [];
    } catch (error) {
      console.error('Error fetching PHR documents:', error);
      throw error;
    }
  }

  /**
   * Record health vital measurement
   */
  static async recordHealthVital(patientId, vitals) {
    try {
      const {
        systolic_bp,
        diastolic_bp,
        heart_rate,
        weight_kg,
        blood_glucose,
        oxygen_saturation,
        temperature_c,
        bmi,
        notes,
      } = vitals;

      const result = await query(
        `INSERT INTO health_vitals (
          patient_id, systolic_bp, diastolic_bp, heart_rate, weight_kg, 
          blood_glucose, oxygen_saturation, temperature_c, bmi, notes, measured_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
        RETURNING *`,
        [
          patientId,
          systolic_bp,
          diastolic_bp,
          heart_rate,
          weight_kg,
          blood_glucose,
          oxygen_saturation,
          temperature_c,
          bmi,
          notes,
        ]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error recording health vital:', error);
      throw error;
    }
  }

  /**
   * Upload PHR document
   */
  static async uploadDocument(patientId, documentData) {
    try {
      const {
        document_name,
        document_type,
        file_path,
        document_date,
        description,
        related_condition,
        notes,
      } = documentData;

      const result = await query(
        `INSERT INTO phr_documents (
          patient_id, document_name, document_type, file_path, 
          document_date, description, related_condition, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          patientId,
          document_name,
          document_type,
          file_path,
          document_date,
          description,
          related_condition,
          notes,
        ]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error uploading PHR document:', error);
      throw error;
    }
  }

  /**
   * Get health vitals for a date range
   */
  static async getHealthVitalsRange(patientId, startDate, endDate) {
    try {
      const result = await query(
        `SELECT 
          id,
          measured_at,
          systolic_bp,
          diastolic_bp,
          heart_rate,
          weight_kg,
          blood_glucose,
          oxygen_saturation,
          temperature_c,
          bmi,
          notes
        FROM health_vitals
        WHERE patient_id = $1
        AND measured_at::date >= $2
        AND measured_at::date <= $3
        ORDER BY measured_at DESC`,
        [patientId, startDate, endDate]
      );

      return result.rows || [];
    } catch (error) {
      console.error('Error fetching health vitals range:', error);
      throw error;
    }
  }

  /**
   * Update personal health details (blood type, medical aid type)
   */
  static async updatePersonalHealthDetails(patientId, details) {
    try {
      const { blood_type, medical_aid_type } = details;

      const result = await query(
        `UPDATE patients
        SET blood_type = COALESCE($2, blood_type),
            medical_aid_type = COALESCE($3, medical_aid_type),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *`,
        [patientId, blood_type, medical_aid_type]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error updating personal health details:', error);
      throw error;
    }
  }
}

module.exports = PHR;
