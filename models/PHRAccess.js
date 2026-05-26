/**
 * PHR Access Control Model
 * Manages which doctors can access which patient PHR records
 */

const { query } = require('../config/db');

class PHRAccess {
  /**
   * Grant doctor access to patient PHR
   */
  static async grantAccess(patientId, doctorId, accessType = 'view', expiresAt = null) {
    try {
      const result = await query(
        `INSERT INTO phr_access (patient_id, doctor_id, access_type, expires_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (patient_id, doctor_id) 
        DO UPDATE SET 
          access_type = $3,
          expires_at = $4,
          granted_at = CURRENT_TIMESTAMP,
          revoked_at = NULL
        RETURNING *`,
        [patientId, doctorId, accessType, expiresAt]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error granting PHR access:', error);
      throw error;
    }
  }

  /**
   * Revoke doctor access to patient PHR
   */
  static async revokeAccess(patientId, doctorId) {
    try {
      const result = await query(
        `UPDATE phr_access
        SET revoked_at = CURRENT_TIMESTAMP,
            access_type = NULL
        WHERE patient_id = $1 AND doctor_id = $2
        RETURNING *`,
        [patientId, doctorId]
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error revoking PHR access:', error);
      throw error;
    }
  }

  /**
   * Check if doctor has access to patient PHR
   */
  static async hasAccess(patientId, doctorId) {
    try {
      const result = await query(
        `SELECT * FROM phr_access
        WHERE patient_id = $1 
        AND doctor_id = $2
        AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
        [patientId, doctorId]
      );

      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking PHR access:', error);
      throw error;
    }
  }

  /**
   * Get all doctors with access to patient PHR
   */
  static async getAccessList(patientId) {
    try {
      const result = await query(
        `SELECT 
          pa.id,
          pa.doctor_id,
          d.first_name,
          d.last_name,
          d.specialization,
          d.clinic_name,
          pa.access_type,
          pa.granted_at,
          pa.expires_at,
          pa.revoked_at,
          CASE WHEN pa.revoked_at IS NOT NULL THEN 'revoked'
               WHEN pa.expires_at IS NOT NULL AND pa.expires_at < CURRENT_TIMESTAMP THEN 'expired'
               ELSE 'active'
          END as access_status
        FROM phr_access pa
        LEFT JOIN doctors d ON pa.doctor_id = d.id
        WHERE pa.patient_id = $1
        ORDER BY pa.granted_at DESC`,
        [patientId]
      );

      return result.rows || [];
    } catch (error) {
      console.error('Error fetching access list:', error);
      throw error;
    }
  }

  /**
   * Request access to patient PHR (doctor-initiated)
   */
  static async requestAccess(patientId, doctorId, reason = null) {
    try {
      const result = await query(
        `INSERT INTO phr_access_requests (patient_id, doctor_id, reason, status)
        VALUES ($1, $2, $3, 'pending')
        RETURNING *`,
        [patientId, doctorId, reason]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error requesting PHR access:', error);
      throw error;
    }
  }

  /**
   * Get pending access requests for patient
   */
  static async getPendingRequests(patientId) {
    try {
      const result = await query(
        `SELECT 
          par.id,
          par.doctor_id,
          d.first_name,
          d.last_name,
          d.specialization,
          d.clinic_name,
          par.reason,
          par.requested_at,
          par.status
        FROM phr_access_requests par
        LEFT JOIN doctors d ON par.doctor_id = d.id
        WHERE par.patient_id = $1 AND par.status = 'pending'
        ORDER BY par.requested_at DESC`,
        [patientId]
      );

      return result.rows || [];
    } catch (error) {
      console.error('Error fetching pending access requests:', error);
      throw error;
    }
  }

  /**
   * Approve access request
   */
  static async approveAccessRequest(requestId, expiresAt = null) {
    try {
      // Get request details first
      const requestResult = await query(
        `SELECT * FROM phr_access_requests WHERE id = $1`,
        [requestId]
      );

      if (requestResult.rows.length === 0) {
        throw new Error('Access request not found');
      }

      const { patient_id, doctor_id } = requestResult.rows[0];

      // Grant access
      const accessResult = await query(
        `INSERT INTO phr_access (patient_id, doctor_id, access_type, expires_at)
        VALUES ($1, $2, 'view', $3)
        ON CONFLICT (patient_id, doctor_id) 
        DO UPDATE SET 
          access_type = 'view',
          expires_at = $3,
          revoked_at = NULL
        RETURNING *`,
        [patient_id, doctor_id, expiresAt]
      );

      // Update request status
      await query(
        `UPDATE phr_access_requests
        SET status = 'approved', approved_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
        [requestId]
      );

      return accessResult.rows[0];
    } catch (error) {
      console.error('Error approving access request:', error);
      throw error;
    }
  }

  /**
   * Deny access request
   */
  static async denyAccessRequest(requestId, reason = null) {
    try {
      const result = await query(
        `UPDATE phr_access_requests
        SET status = 'denied', denial_reason = $2
        WHERE id = $1
        RETURNING *`,
        [requestId, reason]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error denying access request:', error);
      throw error;
    }
  }

  /**
   * Log PHR access (audit trail)
   */
  static async logAccess(patientId, doctorId, accessType, ipAddress = null) {
    try {
      const result = await query(
        `INSERT INTO phr_access_logs (patient_id, doctor_id, access_type, ip_address)
        VALUES ($1, $2, $3, $4)
        RETURNING *`,
        [patientId, doctorId, accessType, ipAddress]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error logging PHR access:', error);
      throw error;
    }
  }

  /**
   * Get access logs for patient PHR
   */
  static async getAccessLogs(patientId, limit = 100) {
    try {
      const result = await query(
        `SELECT 
          pal.id,
          pal.doctor_id,
          d.first_name,
          d.last_name,
          d.specialization,
          pal.access_type,
          pal.accessed_at,
          pal.ip_address
        FROM phr_access_logs pal
        LEFT JOIN doctors d ON pal.doctor_id = d.id
        WHERE pal.patient_id = $1
        ORDER BY pal.accessed_at DESC
        LIMIT $2`,
        [patientId, limit]
      );

      return result.rows || [];
    } catch (error) {
      console.error('Error fetching access logs:', error);
      throw error;
    }
  }

  /**
   * Get all doctors requesting access
   */
  static async getAccessRequests(patientId, status = 'pending') {
    try {
      const result = await query(
        `SELECT 
          par.id,
          par.doctor_id,
          d.first_name,
          d.last_name,
          d.specialization,
          d.clinic_name,
          d.phone_number,
          par.reason,
          par.requested_at,
          par.status
        FROM phr_access_requests par
        LEFT JOIN doctors d ON par.doctor_id = d.id
        WHERE par.patient_id = $1 AND par.status = $2
        ORDER BY par.requested_at DESC`,
        [patientId, status]
      );

      return result.rows || [];
    } catch (error) {
      console.error('Error fetching access requests:', error);
      throw error;
    }
  }

  /**
   * Auto-expire old access grants
   */
  static async expireOldAccess() {
    try {
      const result = await query(
        `UPDATE phr_access
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE expires_at IS NOT NULL 
        AND expires_at < CURRENT_TIMESTAMP
        AND revoked_at IS NULL`
      );

      return result.rowCount;
    } catch (error) {
      console.error('Error expiring old access:', error);
      throw error;
    }
  }
}

module.exports = PHRAccess;
