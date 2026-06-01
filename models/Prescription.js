const { query } = require('../config/db');
const crypto = require('crypto');

/**
 * Prescription Model
 * Handles all database operations for e-prescriptions
 */

class Prescription {
  /**
   * Create the prescriptions table
   */
  static async createTable() {
    // Check if table already exists
    const checkTableQuery = `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'prescriptions');`;
    const result = await query(checkTableQuery);
    if (result.rows[0].exists) {
      return; // Table exists, skip creation and logging
    }

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS prescriptions (
        id SERIAL PRIMARY KEY,
        appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
        doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        prescription_number VARCHAR(50) UNIQUE NOT NULL,
        prescriber_name VARCHAR(255) NOT NULL,
        prescriber_hpcsa VARCHAR(100) NOT NULL,
        prescriber_phone VARCHAR(20),
        prescriber_email VARCHAR(255),
        patient_name VARCHAR(255) NOT NULL,
        patient_id_number VARCHAR(20),
        patient_dob DATE,
        patient_phone VARCHAR(20),
        patient_email VARCHAR(255),
        diagnosis TEXT NOT NULL,
        clinical_notes TEXT,
        signature_status VARCHAR(20) DEFAULT 'pending' CHECK (signature_status IN ('pending', 'signed', 'revoked')),
        digital_signature TEXT,
        signature_timestamp TIMESTAMP,
        otp_hash VARCHAR(255),
        otp_expiry TIMESTAMP,
        qr_code_data TEXT,
        is_revoked BOOLEAN DEFAULT FALSE,
        revoke_reason TEXT,
        revoke_timestamp TIMESTAMP,
        share_audit JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_prescriptions_appointment ON prescriptions(appointment_id);
      CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor ON prescriptions(doctor_id);
      CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
      CREATE INDEX IF NOT EXISTS idx_prescriptions_number ON prescriptions(prescription_number);
      CREATE INDEX IF NOT EXISTS idx_prescriptions_signature_status ON prescriptions(signature_status);
      CREATE INDEX IF NOT EXISTS idx_prescriptions_created ON prescriptions(created_at);
    `;

    try {
      await query(createTableQuery);
      console.log('✅ Prescriptions table created successfully');
    } catch (error) {
      console.error('❌ Error creating prescriptions table:', error);
      throw error;
    }
  }

  /**
   * Create the prescription items table
   */
  static async createItemsTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS prescription_items (
        id SERIAL PRIMARY KEY,
        prescription_id INTEGER NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
        medicine_name VARCHAR(255) NOT NULL,
        generic_name VARCHAR(255),
        dosage VARCHAR(100) NOT NULL,
        dosage_form VARCHAR(50) NOT NULL CHECK (dosage_form IN ('tablet', 'capsule', 'liquid', 'injection', 'cream', 'ointment', 'drops', 'spray', 'inhaler', 'patch', 'other')),
        quantity INTEGER NOT NULL,
        quantity_unit VARCHAR(20) DEFAULT 'pills',
        frequency VARCHAR(100) NOT NULL,
        route_of_administration VARCHAR(50) NOT NULL CHECK (route_of_administration IN ('oral', 'topical', 'intramuscular', 'intravenous', 'subcutaneous', 'inhalation', 'sublingual', 'rectal', 'other')),
        duration VARCHAR(50),
        special_instructions TEXT,
        schedule_classification VARCHAR(20) CHECK (schedule_classification IN ('schedule0', 'schedule1', 'schedule2', 'schedule3', 'schedule4', 'schedule5', 'schedule6')),
        possible_interactions JSONB DEFAULT '[]'::jsonb,
        contraindications JSONB DEFAULT '[]'::jsonb,
        warnings TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_prescription_items_prescription ON prescription_items(prescription_id);
      CREATE INDEX IF NOT EXISTS idx_prescription_items_medicine ON prescription_items(medicine_name);
      CREATE INDEX IF NOT EXISTS idx_prescription_items_schedule ON prescription_items(schedule_classification);
    `;

    try {
      await query(createTableQuery);
      console.log('✅ Prescription items table created successfully');
    } catch (error) {
      console.error('❌ Error creating prescription items table:', error);
      throw error;
    }
  }

  /**
   * Create the prescription shares audit table
   */
  static async createShareAuditTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS prescription_shares (
        id SERIAL PRIMARY KEY,
        prescription_id INTEGER NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
        shared_by INTEGER NOT NULL REFERENCES patients(id),
        shared_with_email VARCHAR(255) NOT NULL,
        share_method VARCHAR(50) NOT NULL CHECK (share_method IN ('email', 'link', 'qrcode')),
        share_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        access_count INTEGER DEFAULT 0,
        last_accessed TIMESTAMP,
        expiry_date TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_prescription_shares_prescription ON prescription_shares(prescription_id);
      CREATE INDEX IF NOT EXISTS idx_prescription_shares_shared_by ON prescription_shares(shared_by);
      CREATE INDEX IF NOT EXISTS idx_prescription_shares_email ON prescription_shares(shared_with_email);
    `;

    try {
      await query(createTableQuery);
      console.log('✅ Prescription shares audit table created successfully');
    } catch (error) {
      console.error('❌ Error creating prescription shares table:', error);
      throw error;
    }
  }

  /**
   * Create a new prescription
   */
  static async create(prescriptionData) {
    const {
      appointment_id,
      doctor_id,
      patient_id,
      prescriber_name,
      prescriber_hpcsa,
      prescriber_phone,
      prescriber_email,
      patient_name,
      patient_id_number,
      patient_dob,
      patient_phone,
      patient_email,
      diagnosis,
      clinical_notes
    } = prescriptionData;

    const prescription_number = `RX-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const createQuery = `
      INSERT INTO prescriptions (
        appointment_id, doctor_id, patient_id, prescription_number,
        prescriber_name, prescriber_hpcsa, prescriber_phone, prescriber_email,
        patient_name, patient_id_number, patient_dob, patient_phone, patient_email,
        diagnosis, clinical_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *;
    `;

    try {
      const result = await query(createQuery, [
        appointment_id,
        doctor_id,
        patient_id,
        prescription_number,
        prescriber_name,
        prescriber_hpcsa,
        prescriber_phone,
        prescriber_email,
        patient_name,
        patient_id_number,
        patient_dob,
        patient_phone,
        patient_email,
        diagnosis,
        clinical_notes
      ]);

      return result.rows[0];
    } catch (error) {
      console.error('❌ Error creating prescription:', error);
      throw error;
    }
  }

  /**
   * Get prescription by ID
   */
  static async getById(prescriptionId) {
    const getQuery = `
      SELECT p.*,
        COALESCE(
          json_agg(json_build_object(
            'id', pi.id,
            'medicine_name', pi.medicine_name,
            'generic_name', pi.generic_name,
            'dosage', pi.dosage,
            'dosage_form', pi.dosage_form,
            'quantity', pi.quantity,
            'quantity_unit', pi.quantity_unit,
            'frequency', pi.frequency,
            'route_of_administration', pi.route_of_administration,
            'duration', pi.duration,
            'special_instructions', pi.special_instructions,
            'schedule_classification', pi.schedule_classification,
            'possible_interactions', pi.possible_interactions,
            'contraindications', pi.contraindications,
            'warnings', pi.warnings
          ) ORDER BY pi.id) FILTER (WHERE pi.id IS NOT NULL),
          '[]'::json
        ) as items
      FROM prescriptions p
      LEFT JOIN prescription_items pi ON p.id = pi.prescription_id
      WHERE p.id = $1 AND p.is_revoked = FALSE
      GROUP BY p.id;
    `;

    try {
      const result = await query(getQuery, [prescriptionId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ Error fetching prescription:', error);
      throw error;
    }
  }

  /**
   * Get prescriptions by patient
   */
  static async getByPatientId(patientId, limit = 50, offset = 0) {
    const getQuery = `
      SELECT id, prescription_number, diagnosis, signature_status, created_at, 
             prescriber_name, doctor_id, is_revoked, appointment_id
      FROM prescriptions
      WHERE patient_id = $1 AND is_revoked = FALSE
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    try {
      const result = await query(getQuery, [patientId, limit, offset]);
      return result.rows;
    } catch (error) {
      console.error('❌ Error fetching patient prescriptions:', error);
      throw error;
    }
  }

  /**
   * Get prescriptions by doctor
   */
  static async getByDoctorId(doctorId, limit = 50, offset = 0) {
    const getQuery = `
      SELECT id, prescription_number, diagnosis, signature_status, created_at,
             patient_name, patient_id, is_revoked, appointment_id
      FROM prescriptions
      WHERE doctor_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    try {
      const result = await query(getQuery, [doctorId, limit, offset]);
      return result.rows;
    } catch (error) {
      console.error('❌ Error fetching doctor prescriptions:', error);
      throw error;
    }
  }

  /**
   * Get signed prescriptions with appointment details for a doctor
   */
  static async getSignedPrescriptionsWithAppointments(doctorId, limit = 50, offset = 0) {
    const getQuery = `
      SELECT 
        p.id,
        p.prescription_number,
        p.diagnosis,
        p.clinical_notes,
        p.signature_status,
        p.digital_signature,
        p.signature_timestamp,
        p.created_at,
        p.patient_name,
        p.patient_id,
        p.patient_email,
        p.patient_phone,
        p.appointment_id,
        a.appointment_date,
        a.time_slot,
        a.reason_for_visit,
        a.status as appointment_status,
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name,
        d.hpcsa_number,
        json_agg(json_build_object(
          'id', pi.id,
          'medicine_name', pi.medicine_name,
          'dosage', pi.dosage,
          'dosage_form', pi.dosage_form,
          'frequency', pi.frequency,
          'route_of_administration', pi.route_of_administration,
          'duration', pi.duration,
          'quantity', pi.quantity,
          'instructions', pi.special_instructions
        ) ORDER BY pi.id) FILTER (WHERE pi.id IS NOT NULL) as medicines
      FROM prescriptions p
      LEFT JOIN appointments a ON p.appointment_id = a.id
      LEFT JOIN doctors d ON p.doctor_id = d.id
      LEFT JOIN prescription_items pi ON p.id = pi.prescription_id
      WHERE p.doctor_id = $1 AND p.signature_status = 'signed' AND p.is_revoked = FALSE
      GROUP BY p.id, a.id, d.id
      ORDER BY p.signature_timestamp DESC
      LIMIT $2 OFFSET $3;
    `;

    try {
      const result = await query(getQuery, [doctorId, limit, offset]);
      return result.rows;
    } catch (error) {
      console.error('❌ Error fetching signed prescriptions with appointments:', error);
      throw error;
    }
  }

  /**
   * Update prescription signature
   */
  static async updateSignature(prescriptionId, digitalSignature, signatureTimestamp) {
    const updateQuery = `
      UPDATE prescriptions
      SET digital_signature = $1,
          signature_timestamp = $2,
          signature_status = 'signed',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *;
    `;

    try {
      const result = await query(updateQuery, [digitalSignature, signatureTimestamp, prescriptionId]);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error updating prescription signature:', error);
      throw error;
    }
  }

  /**
   * Store OTP for signature verification
   */
  static async storeOTP(prescriptionId, otpHash, expiryTime) {
    const updateQuery = `
      UPDATE prescriptions
      SET otp_hash = $1,
          otp_expiry = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *;
    `;

    try {
      const result = await query(updateQuery, [otpHash, expiryTime, prescriptionId]);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error storing OTP:', error);
      throw error;
    }
  }

  /**
   * Verify OTP for signature
   */
  static async verifyOTP(prescriptionId, otpHash) {
    const getQuery = `
      SELECT otp_hash, otp_expiry FROM prescriptions
      WHERE id = $1 AND signature_status = 'pending';
    `;

    try {
      const result = await query(getQuery, [prescriptionId]);
      if (result.rows.length === 0) return { valid: false, message: 'Prescription not found or already signed' };

      const { otp_hash, otp_expiry } = result.rows[0];

      // Check if OTP has expired
      if (new Date(otp_expiry) < new Date()) {
        return { valid: false, message: 'OTP has expired' };
      }

      // In production, use bcrypt.compare for secure comparison
      if (otp_hash !== otpHash) {
        return { valid: false, message: 'Invalid OTP' };
      }

      return { valid: true };
    } catch (error) {
      console.error('❌ Error verifying OTP:', error);
      throw error;
    }
  }

  /**
   * Revoke prescription
   */
  static async revoke(prescriptionId, revokeReason) {
    const updateQuery = `
      UPDATE prescriptions
      SET is_revoked = TRUE,
          revoke_reason = $1,
          revoke_timestamp = CURRENT_TIMESTAMP,
          signature_status = 'revoked',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;

    try {
      const result = await query(updateQuery, [revokeReason, prescriptionId]);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error revoking prescription:', error);
      throw error;
    }
  }

  /**
   * Add share audit entry
   */
  static async addShareAudit(prescriptionId, shareData) {
    const updateQuery = `
      UPDATE prescriptions
      SET share_audit = share_audit || $1::jsonb,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING share_audit;
    `;

    const shareEntry = JSON.stringify({
      shared_with: shareData.shared_with,
      share_method: shareData.share_method,
      shared_at: new Date().toISOString()
    });

    try {
      const result = await query(updateQuery, [shareEntry, prescriptionId]);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error adding share audit:', error);
      throw error;
    }
  }

  /**
   * Generate and store one-time use QR code
   */
  static async generateQRCodeAccess(prescriptionId, qrToken, expiryDays = 90) {
    const createQuery = `
      INSERT INTO prescription_qr_access (
        prescription_id, qr_token, expires_at, max_access_count, is_active
      ) VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '${expiryDays} days', 1, TRUE)
      RETURNING *;
    `;

    try {
      const result = await query(createQuery, [prescriptionId, qrToken]);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error generating QR code access:', error);
      throw error;
    }
  }

  /**
   * Verify and consume one-time QR code
   * Returns true if valid and not used, marks as used, returns false if already accessed
   */
  static async verifyAndConsumeQRCode(qrToken, ipAddress = '', deviceInfo = '') {
    const getQuery = `
      SELECT * FROM prescription_qr_access
      WHERE qr_token = $1 AND is_active = TRUE;
    `;

    try {
      const result = await query(getQuery, [qrToken]);
      
      if (result.rows.length === 0) {
        return {
          valid: false,
          message: 'Invalid or expired QR code',
          prescriptionId: null
        };
      }

      const qrAccess = result.rows[0];
      const prescriptionId = qrAccess.prescription_id;

      // Check if already accessed
      if (qrAccess.accessed === true) {
        return {
          valid: false,
          message: 'QR code has already been used',
          prescriptionId
        };
      }

      // Check expiry
      if (new Date(qrAccess.expires_at) < new Date()) {
        return {
          valid: false,
          message: 'QR code has expired',
          prescriptionId
        };
      }

      // Mark as accessed (one-time use)
      const updateQuery = `
        UPDATE prescription_qr_access
        SET accessed = TRUE,
            accessed_at = CURRENT_TIMESTAMP,
            accessed_by_ip = $1,
            access_device_info = $2,
            access_count = access_count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE qr_token = $3
        RETURNING *;
      `;

      const updateResult = await query(updateQuery, [ipAddress, deviceInfo, qrToken]);

      // Also update prescriptions table
      const updatePrescQuery = `
        UPDATE prescriptions
        SET qr_code_accessed = TRUE,
            qr_code_accessed_at = CURRENT_TIMESTAMP,
            qr_code_token = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *;
      `;

      await query(updatePrescQuery, [qrToken, prescriptionId]);

      return {
        valid: true,
        message: 'QR code verified and consumed successfully',
        prescriptionId,
        accessedAt: updateResult.rows[0].accessed_at
      };
    } catch (error) {
      console.error('❌ Error verifying QR code:', error);
      throw error;
    }
  }

  /**
   * Get QR code access history
   */
  static async getQRCodeAccessHistory(prescriptionId) {
    const getQuery = `
      SELECT id, prescription_id, qr_token, accessed, accessed_at, 
             accessed_by_ip, access_device_info, expires_at, 
             access_count, is_active, created_at
      FROM prescription_qr_access
      WHERE prescription_id = $1
      ORDER BY created_at DESC;
    `;

    try {
      const result = await query(getQuery, [prescriptionId]);
      return result.rows;
    } catch (error) {
      console.error('❌ Error fetching QR access history:', error);
      throw error;
    }
  }

  /**
   * Check if QR code has been used
   */
  static async checkQRCodeStatus(qrToken) {
    const getQuery = `
      SELECT prescription_id, accessed, accessed_at, expires_at, is_active
      FROM prescription_qr_access
      WHERE qr_token = $1;
    `;

    try {
      const result = await query(getQuery, [qrToken]);
      
      if (result.rows.length === 0) {
        return {
          exists: false,
          message: 'QR code not found'
        };
      }

      const qrAccess = result.rows[0];
      const isExpired = new Date(qrAccess.expires_at) < new Date();

      return {
        exists: true,
        prescriptionId: qrAccess.prescription_id,
        used: qrAccess.accessed,
        usedAt: qrAccess.accessed_at,
        expires: qrAccess.expires_at,
        isActive: qrAccess.is_active,
        isExpired,
        status: qrAccess.accessed ? 'USED' : isExpired ? 'EXPIRED' : 'VALID'
      };
    } catch (error) {
      console.error('❌ Error checking QR code status:', error);
      throw error;
    }
  }

  /**
   * Claim prescription at pharmacy (one-time use)
   * Mark prescription as used after claiming medicine
   */
  static async claimPrescription(prescriptionId, patientId, pharmacyInfo, ipAddress, deviceInfo) {
    const claimQuery = `
      UPDATE prescriptions
      SET claimed = TRUE,
          claimed_at = CURRENT_TIMESTAMP,
          claimed_by_pharmacy_id = $2,
          claimed_by_pharmacy_name = $3,
          claim_location = $4,
          claim_verified_at = CURRENT_TIMESTAMP,
          claim_verification_method = 'QR',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND patient_id = $5 AND claimed = FALSE AND claim_expires_at > CURRENT_TIMESTAMP
      RETURNING id, prescription_number, claimed_at, claimed_by_pharmacy_name;
    `;

    const auditQuery = `
      INSERT INTO prescription_claims 
      (prescription_id, patient_id, pharmacy_id, pharmacy_name, pharmacy_location, 
       claim_method, claim_status, claimed_by_ip_address, claimed_device_info)
      VALUES ($1, $2, $3, $4, $5, 'QR', 'CLAIMED', $6, $7)
      RETURNING id, claimed_at;
    `;

    try {
      const result = await query(claimQuery, [
        prescriptionId,
        pharmacyInfo.id,
        pharmacyInfo.name,
        JSON.stringify(pharmacyInfo.location || {}),
        patientId
      ]);

      if (result.rows.length === 0) {
        return {
          success: false,
          message: 'Prescription not found, not yours, already claimed, or expired'
        };
      }

      // Record the claim in audit table
      await query(auditQuery, [
        prescriptionId,
        patientId,
        pharmacyInfo.id,
        pharmacyInfo.name,
        JSON.stringify(pharmacyInfo.location || {}),
        ipAddress,
        deviceInfo
      ]);

      return {
        success: true,
        message: 'Prescription claimed successfully',
        prescription: result.rows[0],
        claimTime: new Date()
      };
    } catch (error) {
      console.error('❌ Error claiming prescription:', error);
      throw error;
    }
  }

  /**
   * Check if prescription is already claimed
   */
  static async checkClaimStatus(prescriptionId) {
    const checkQuery = `
      SELECT claimed, claimed_at, claimed_by_pharmacy_name, 
             claim_expires_at, claim_expires_at > CURRENT_TIMESTAMP as is_valid
      FROM prescriptions
      WHERE id = $1;
    `;

    try {
      const result = await query(checkQuery, [prescriptionId]);
      
      if (result.rows.length === 0) {
        return {
          exists: false,
          message: 'Prescription not found'
        };
      }

      const prescription = result.rows[0];
      return {
        exists: true,
        claimed: prescription.claimed,
        claimedAt: prescription.claimed_at,
        claimedBy: prescription.claimed_by_pharmacy_name,
        expiresAt: prescription.claim_expires_at,
        isExpired: !prescription.is_valid,
        status: prescription.claimed ? 'USED' : !prescription.is_valid ? 'EXPIRED' : 'AVAILABLE'
      };
    } catch (error) {
      console.error('❌ Error checking claim status:', error);
      throw error;
    }
  }

  /**
   * Get prescription claim history
   */
  static async getClaimInfo(prescriptionId) {
    const getQuery = `
      SELECT pc.id, pc.claimed_at, pc.pharmacy_name, pc.pharmacy_location,
             pc.claim_method, pc.claim_status, pc.claimed_by_ip_address,
             pc.verified_at, pc.claim_notes, pc.reverted_at, pc.reverted_reason
      FROM prescription_claims pc
      WHERE pc.prescription_id = $1
      ORDER BY pc.claimed_at DESC
      LIMIT 1;
    `;

    try {
      const result = await query(getQuery, [prescriptionId]);
      
      if (result.rows.length === 0) {
        return {
          claimed: false,
          message: 'Prescription has not been claimed yet'
        };
      }

      const claim = result.rows[0];
      return {
        claimed: true,
        claimedAt: claim.claimed_at,
        pharmacy: {
          name: claim.pharmacy_name,
          location: claim.pharmacy_location
        },
        method: claim.claim_method,
        status: claim.claim_status,
        verifiedAt: claim.verified_at,
        ipAddress: claim.claimed_by_ip_address,
        notes: claim.claim_notes
      };
    } catch (error) {
      console.error('❌ Error fetching claim info:', error);
      throw error;
    }
  }

  /**
   * Revert prescription claim (Admin only)
   * Used to reverse a claim in case of error or fraud detection
   */
  static async revertClaim(prescriptionId, adminId, reason) {
    const revertQuery = `
      UPDATE prescriptions
      SET claimed = FALSE,
          claimed_at = NULL,
          claimed_by_pharmacy_id = NULL,
          claimed_by_pharmacy_name = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND claimed = TRUE
      RETURNING id, prescription_number;
    `;

    const auditUpdateQuery = `
      UPDATE prescription_claims
      SET claim_status = 'REVERTED',
          claim_reverted_at = CURRENT_TIMESTAMP,
          reverted_by = $2,
          reverted_reason = $3
      WHERE prescription_id = $1;
    `;

    try {
      const result = await query(revertQuery, [prescriptionId]);

      if (result.rows.length === 0) {
        return {
          success: false,
          message: 'Prescription not found or not claimed'
        };
      }

      // Update audit record
      await query(auditUpdateQuery, [prescriptionId, adminId, reason]);

      return {
        success: true,
        message: 'Prescription claim reverted',
        prescription: result.rows[0]
      };
    } catch (error) {
      console.error('❌ Error reverting claim:', error);
      throw error;
    }
  }

  /**
   * Get signed prescriptions with appointment details for a doctor
   */
  static async getSignedPrescriptionsWithAppointments(doctorId, limit = 50, offset = 0) {
    const getQuery = `
      SELECT 
        p.id,
        p.prescription_number,
        p.diagnosis,
        p.clinical_notes,
        p.signature_status,
        p.digital_signature,
        p.signature_timestamp,
        p.created_at,
        p.patient_name,
        p.patient_id,
        p.patient_email,
        p.patient_phone,
        p.appointment_id,
        a.appointment_date,
        a.time_slot,
        a.reason_for_visit,
        a.status as appointment_status,
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name,
        d.hpcsa_number,
        json_agg(json_build_object(
          'id', pi.id,
          'medicine_name', pi.medicine_name,
          'dosage', pi.dosage,
          'dosage_form', pi.dosage_form,
          'frequency', pi.frequency,
          'route_of_administration', pi.route_of_administration,
          'duration', pi.duration,
          'quantity', pi.quantity,
          'instructions', pi.special_instructions
        ) ORDER BY pi.id) FILTER (WHERE pi.id IS NOT NULL) as medicines
      FROM prescriptions p
      LEFT JOIN appointments a ON p.appointment_id = a.id
      LEFT JOIN doctors d ON p.doctor_id = d.id
      LEFT JOIN prescription_items pi ON p.id = pi.prescription_id
      WHERE p.doctor_id = $1 AND p.signature_status = 'signed' AND p.is_revoked = FALSE
      GROUP BY p.id, a.id, d.id
      ORDER BY p.signature_timestamp DESC
      LIMIT $2 OFFSET $3;
    `;

    try {
      const result = await query(getQuery, [doctorId, limit, offset]);
      return result.rows;
    } catch (error) {
      console.error('❌ Error fetching signed prescriptions with appointments:', error);
      throw error;
    }
  }
}

module.exports = Prescription;
