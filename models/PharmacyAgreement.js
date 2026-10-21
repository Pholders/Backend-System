const { query } = require('../config/db');

/**
 * PharmacyAgreement Model
 * Handles all database operations for partnership agreements
 */

class PharmacyAgreement {
  /**
   * Create a new agreement
   */
  static async create(agreementData) {
    const {
      pharmacy_or_group_id,
      entity_type,
      agreement_type,
      start_date,
      end_date,
      auto_renew = false,
      commission_rate,
      service_fee,
      minimum_monthly_transactions,
      claim_response_time_hours = 24,
      dispensing_time_hours = 48,
      payment_terms,
      created_by
    } = agreementData;

    // Validate entity exists
    if (entity_type === 'pharmacy') {
      const pharmaCheck = await query(
        'SELECT id FROM pharmacies WHERE id = $1',
        [pharmacy_or_group_id]
      );
      if (pharmaCheck.rows.length === 0) {
        throw new Error('Pharmacy not found');
      }
    } else if (entity_type === 'group') {
      const groupCheck = await query(
        'SELECT id FROM pharmacy_groups WHERE id = $1',
        [pharmacy_or_group_id]
      );
      if (groupCheck.rows.length === 0) {
        throw new Error('Pharmacy group not found');
      }
    }

    const insertQuery = `
      INSERT INTO pharmacy_agreements (
        pharmacy_or_group_id, entity_type, agreement_type,
        start_date, end_date, auto_renew,
        commission_rate, service_fee, minimum_monthly_transactions,
        claim_response_time_hours, dispensing_time_hours,
        payment_terms, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const result = await query(insertQuery, [
      pharmacy_or_group_id,
      entity_type,
      agreement_type,
      start_date,
      end_date,
      auto_renew,
      commission_rate,
      service_fee,
      minimum_monthly_transactions,
      claim_response_time_hours,
      dispensing_time_hours,
      payment_terms,
      created_by
    ]);

    return result.rows[0];
  }

  /**
   * Get agreement by ID
   */
  static async getById(agreementId) {
    const selectQuery = `
      SELECT * FROM pharmacy_agreements
      WHERE id = $1
    `;

    const result = await query(selectQuery, [agreementId]);
    return result.rows[0];
  }

  /**
   * Get all agreements with filters
   */
  static async getAll(filters = {}) {
    let selectQuery = `
      SELECT * FROM pharmacy_agreements
      WHERE 1=1
    `;

    const values = [];
    let paramCount = 1;

    if (filters.entity_type) {
      selectQuery += ` AND entity_type = $${paramCount}`;
      values.push(filters.entity_type);
      paramCount++;
    }

    if (filters.status) {
      selectQuery += ` AND status = $${paramCount}`;
      values.push(filters.status);
      paramCount++;
    }

    if (filters.pharmacy_or_group_id) {
      selectQuery += ` AND pharmacy_or_group_id = $${paramCount}`;
      values.push(filters.pharmacy_or_group_id);
      paramCount++;
    }

    selectQuery += `
      ORDER BY created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    values.push(filters.limit || 50);
    values.push(filters.offset || 0);

    const result = await query(selectQuery, values);
    return result.rows;
  }

  /**
   * Get agreements for a pharmacy
   */
  static async getPharmacyAgreements(pharmacyId) {
    const selectQuery = `
      SELECT * FROM pharmacy_agreements
      WHERE pharmacy_or_group_id = $1 AND entity_type = 'pharmacy'
      AND status IN ('active', 'pending')
      ORDER BY created_at DESC
    `;

    const result = await query(selectQuery, [pharmacyId]);
    return result.rows;
  }

  /**
   * Get agreements for a group
   */
  static async getGroupAgreements(groupId) {
    const selectQuery = `
      SELECT * FROM pharmacy_agreements
      WHERE pharmacy_or_group_id = $1 AND entity_type = 'group'
      AND status IN ('active', 'pending')
      ORDER BY created_at DESC
    `;

    const result = await query(selectQuery, [groupId]);
    return result.rows;
  }

  /**
   * Get active agreements for a pharmacy (including group agreements)
   */
  static async getActiveAgreementsForPharmacy(pharmacyId) {
    const selectQuery = `
      SELECT DISTINCT pa.*
      FROM pharmacy_agreements pa
      WHERE (
        (pa.entity_type = 'pharmacy' AND pa.pharmacy_or_group_id = $1)
        OR (
          pa.entity_type = 'group' 
          AND pa.pharmacy_or_group_id IN (
            SELECT group_id FROM pharmacy_group_members 
            WHERE pharmacy_id = $1 AND left_at IS NULL
          )
        )
      )
      AND pa.status = 'active'
      AND pa.start_date <= CURRENT_DATE
      AND (pa.end_date IS NULL OR pa.end_date >= CURRENT_DATE)
      ORDER BY pa.created_at DESC
    `;

    const result = await query(selectQuery, [pharmacyId]);
    return result.rows;
  }

  /**
   * Update agreement
   */
  static async update(agreementId, updateData) {
    const {
      commission_rate,
      service_fee,
      minimum_monthly_transactions,
      claim_response_time_hours,
      dispensing_time_hours,
      payment_terms,
      status,
      end_date,
      auto_renew
    } = updateData;

    const updateQuery = `
      UPDATE pharmacy_agreements
      SET
        commission_rate = COALESCE($1, commission_rate),
        service_fee = COALESCE($2, service_fee),
        minimum_monthly_transactions = COALESCE($3, minimum_monthly_transactions),
        claim_response_time_hours = COALESCE($4, claim_response_time_hours),
        dispensing_time_hours = COALESCE($5, dispensing_time_hours),
        payment_terms = COALESCE($6, payment_terms),
        status = COALESCE($7, status),
        end_date = COALESCE($8, end_date),
        auto_renew = COALESCE($9, auto_renew),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
    `;

    const result = await query(updateQuery, [
      commission_rate,
      service_fee,
      minimum_monthly_transactions,
      claim_response_time_hours,
      dispensing_time_hours,
      payment_terms,
      status,
      end_date,
      auto_renew,
      agreementId
    ]);

    return result.rows[0];
  }

  /**
   * Activate agreement (change status to active)
   */
  static async activate(agreementId) {
    const updateQuery = `
      UPDATE pharmacy_agreements
      SET status = 'active', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await query(updateQuery, [agreementId]);
    return result.rows[0];
  }

  /**
   * Suspend agreement (change status to suspended)
   */
  static async suspend(agreementId, reason = null) {
    const updateQuery = `
      UPDATE pharmacy_agreements
      SET status = 'suspended', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await query(updateQuery, [agreementId]);
    return result.rows[0];
  }

  /**
   * Terminate agreement (change status to terminated)
   */
  static async terminate(agreementId) {
    const updateQuery = `
      UPDATE pharmacy_agreements
      SET status = 'terminated', end_date = CURRENT_DATE, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await query(updateQuery, [agreementId]);
    return result.rows[0];
  }

  /**
   * Get agreements expiring soon
   */
  static async getExpiringAgreements(daysUntilExpiry = 30) {
    const selectQuery = `
      SELECT * FROM pharmacy_agreements
      WHERE status = 'active'
      AND end_date IS NOT NULL
      AND end_date <= CURRENT_DATE + INTERVAL '${daysUntilExpiry} days'
      AND end_date > CURRENT_DATE
      ORDER BY end_date ASC
    `;

    const result = await query(selectQuery);
    return result.rows;
  }

  /**
   * Get expired agreements
   */
  static async getExpiredAgreements() {
    const selectQuery = `
      SELECT * FROM pharmacy_agreements
      WHERE status = 'active'
      AND end_date IS NOT NULL
      AND end_date < CURRENT_DATE
    `;

    const result = await query(selectQuery);
    return result.rows;
  }

  /**
   * Auto-renew expired agreements if configured
   */
  static async autoRenewExpired() {
    const updateQuery = `
      UPDATE pharmacy_agreements
      SET
        start_date = CURRENT_DATE,
        end_date = CURRENT_DATE + INTERVAL '1 year',
        status = 'active',
        updated_at = CURRENT_TIMESTAMP
      WHERE auto_renew = true
      AND status = 'active'
      AND end_date < CURRENT_DATE
      RETURNING *
    `;

    const result = await query(updateQuery);
    return result.rows;
  }

  /**
   * Get agreement with detailed info
   */
  static async getDetailedAgreement(agreementId) {
    const selectQuery = `
      SELECT
        pa.*,
        CASE 
          WHEN pa.entity_type = 'pharmacy' THEN (SELECT pharmacy_name FROM pharmacies WHERE id = pa.pharmacy_or_group_id)
          WHEN pa.entity_type = 'group' THEN (SELECT group_name FROM pharmacy_groups WHERE id = pa.pharmacy_or_group_id)
        END as entity_name,
        (SELECT COUNT(*) FROM agreement_compliance 
         WHERE agreement_id = pa.id) as compliance_records
      FROM pharmacy_agreements pa
      WHERE pa.id = $1
    `;

    const result = await query(selectQuery, [agreementId]);
    return result.rows[0];
  }

  /**
   * Delete agreement
   */
  static async delete(agreementId) {
    const deleteQuery = `
      DELETE FROM pharmacy_agreements
      WHERE id = $1
      RETURNING *
    `;

    const result = await query(deleteQuery, [agreementId]);
    return result.rows[0];
  }
}

module.exports = PharmacyAgreement;
