const { query } = require('../config/db');

/**
 * AgreementCompliance Model
 * Handles tracking and management of pharmacy agreement compliance metrics
 */

class AgreementCompliance {
  /**
   * Create a compliance record for a month
   */
  static async create(complianceData) {
    const {
      agreement_id,
      month_date,
      total_claims = 0,
      claims_accepted = 0,
      claims_rejected = 0,
      claims_expired = 0,
      on_time_responses = 0,
      on_time_dispensed = 0,
      monthly_revenue = 0,
      commission_paid = 0
    } = complianceData;

    // Verify agreement exists
    const agreementCheck = await query(
      'SELECT id FROM pharmacy_agreements WHERE id = $1',
      [agreement_id]
    );
    if (agreementCheck.rows.length === 0) {
      throw new Error('Agreement not found');
    }

    // Calculate compliance rates
    const responseCompliance = total_claims > 0 
      ? Math.round((on_time_responses / total_claims) * 100 * 100) / 100 
      : 0;

    const dispensingCompliance = claims_accepted > 0 
      ? Math.round((on_time_dispensed / claims_accepted) * 100 * 100) / 100 
      : 0;

    // Calculate overall compliance score
    const complianceScore = (responseCompliance + dispensingCompliance) / 2;

    const insertQuery = `
      INSERT INTO agreement_compliance (
        agreement_id, month_date,
        total_claims, claims_accepted, claims_rejected, claims_expired,
        on_time_responses, on_time_dispensed,
        response_time_compliance, dispensing_time_compliance,
        monthly_revenue, commission_paid,
        compliance_score
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (agreement_id, month_date) DO UPDATE
      SET
        total_claims = $3,
        claims_accepted = $4,
        claims_rejected = $5,
        claims_expired = $6,
        on_time_responses = $7,
        on_time_dispensed = $8,
        response_time_compliance = $9,
        dispensing_time_compliance = $10,
        monthly_revenue = $11,
        commission_paid = $12,
        compliance_score = $13,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await query(insertQuery, [
      agreement_id,
      month_date,
      total_claims,
      claims_accepted,
      claims_rejected,
      claims_expired,
      on_time_responses,
      on_time_dispensed,
      responseCompliance,
      dispensingCompliance,
      monthly_revenue,
      commission_paid,
      complianceScore
    ]);

    return result.rows[0];
  }

  /**
   * Get compliance records for an agreement
   */
  static async getByAgreement(agreementId, limit = 12) {
    const selectQuery = `
      SELECT * FROM agreement_compliance
      WHERE agreement_id = $1
      ORDER BY month_date DESC
      LIMIT $2
    `;

    const result = await query(selectQuery, [agreementId, limit]);
    return result.rows;
  }

  /**
   * Get compliance for specific month
   */
  static async getMonthCompliance(agreementId, monthDate) {
    const selectQuery = `
      SELECT * FROM agreement_compliance
      WHERE agreement_id = $1 AND month_date = $2
    `;

    const result = await query(selectQuery, [agreementId, monthDate]);
    return result.rows[0];
  }

  /**
   * Update compliance record
   */
  static async update(complianceId, updateData) {
    const {
      total_claims,
      claims_accepted,
      claims_rejected,
      claims_expired,
      on_time_responses,
      on_time_dispensed,
      monthly_revenue,
      commission_paid
    } = updateData;

    // Recalculate compliance scores
    const responseCompliance = total_claims > 0 
      ? Math.round((on_time_responses / total_claims) * 100 * 100) / 100 
      : 0;

    const dispensingCompliance = claims_accepted > 0 
      ? Math.round((on_time_dispensed / claims_accepted) * 100 * 100) / 100 
      : 0;

    const complianceScore = (responseCompliance + dispensingCompliance) / 2;

    const updateQuery = `
      UPDATE agreement_compliance
      SET
        total_claims = COALESCE($1, total_claims),
        claims_accepted = COALESCE($2, claims_accepted),
        claims_rejected = COALESCE($3, claims_rejected),
        claims_expired = COALESCE($4, claims_expired),
        on_time_responses = COALESCE($5, on_time_responses),
        on_time_dispensed = COALESCE($6, on_time_dispensed),
        response_time_compliance = $7,
        dispensing_time_compliance = $8,
        compliance_score = $9,
        monthly_revenue = COALESCE($10, monthly_revenue),
        commission_paid = COALESCE($11, commission_paid),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $12
      RETURNING *
    `;

    const result = await query(updateQuery, [
      total_claims,
      claims_accepted,
      claims_rejected,
      claims_expired,
      on_time_responses,
      on_time_dispensed,
      responseCompliance,
      dispensingCompliance,
      complianceScore,
      monthly_revenue,
      commission_paid,
      complianceId
    ]);

    return result.rows[0];
  }

  /**
   * Get current month compliance
   */
  static async getCurrentMonthCompliance(agreementId) {
    const currentMonth = new Date();
    const monthDate = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-01`;

    const selectQuery = `
      SELECT * FROM agreement_compliance
      WHERE agreement_id = $1 AND month_date = $2::DATE
    `;

    const result = await query(selectQuery, [agreementId, monthDate]);
    return result.rows[0];
  }

  /**
   * Increment claim counters for current month
   */
  static async incrementClaim(agreementId, claimType, isOnTime = false) {
    const currentMonth = new Date();
    const monthDate = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-01`;

    let updateQuery;

    if (claimType === 'total') {
      updateQuery = `
        UPDATE agreement_compliance
        SET total_claims = total_claims + 1
        WHERE agreement_id = $1 AND month_date = $2::DATE
        RETURNING *
      `;
    } else if (claimType === 'accepted') {
      updateQuery = `
        UPDATE agreement_compliance
        SET 
          claims_accepted = claims_accepted + 1,
          on_time_dispensed = on_time_dispensed + CASE WHEN $3::BOOLEAN THEN 1 ELSE 0 END
        WHERE agreement_id = $1 AND month_date = $2::DATE
        RETURNING *
      `;
    } else if (claimType === 'response') {
      updateQuery = `
        UPDATE agreement_compliance
        SET on_time_responses = on_time_responses + 1
        WHERE agreement_id = $1 AND month_date = $2::DATE
        RETURNING *
      `;
    } else if (claimType === 'rejected') {
      updateQuery = `
        UPDATE agreement_compliance
        SET claims_rejected = claims_rejected + 1
        WHERE agreement_id = $1 AND month_date = $2::DATE
        RETURNING *
      `;
    }

    const result = await query(updateQuery, [agreementId, monthDate, isOnTime]);
    return result.rows[0];
  }

  /**
   * Get average compliance across all months
   */
  static async getAverageCompliance(agreementId) {
    const selectQuery = `
      SELECT
        AVG(compliance_score) as avg_compliance,
        AVG(response_time_compliance) as avg_response_compliance,
        AVG(dispensing_time_compliance) as avg_dispensing_compliance,
        MIN(compliance_score) as min_compliance,
        MAX(compliance_score) as max_compliance,
        COUNT(*) as record_count
      FROM agreement_compliance
      WHERE agreement_id = $1
    `;

    const result = await query(selectQuery, [agreementId]);
    return result.rows[0];
  }

  /**
   * Get low compliance agreements (below threshold)
   */
  static async getLowComplianceAgreements(threshold = 80) {
    const selectQuery = `
      SELECT DISTINCT
        pa.id,
        pa.pharmacy_or_group_id,
        pa.entity_type,
        CASE 
          WHEN pa.entity_type = 'pharmacy' THEN (SELECT pharmacy_name FROM pharmacies WHERE id = pa.pharmacy_or_group_id)
          WHEN pa.entity_type = 'group' THEN (SELECT group_name FROM pharmacy_groups WHERE id = pa.pharmacy_or_group_id)
        END as entity_name,
        ac.compliance_score,
        ac.month_date
      FROM pharmacy_agreements pa
      JOIN agreement_compliance ac ON pa.id = ac.agreement_id
      WHERE pa.status = 'active'
      AND ac.compliance_score < $1
      AND ac.month_date = (
        SELECT MAX(month_date) FROM agreement_compliance 
        WHERE agreement_id = pa.id
      )
      ORDER BY ac.compliance_score ASC
    `;

    const result = await query(selectQuery, [threshold]);
    return result.rows;
  }

  /**
   * Get high performing agreements
   */
  static async getHighPerformanceAgreements(threshold = 95) {
    const selectQuery = `
      SELECT DISTINCT
        pa.id,
        pa.pharmacy_or_group_id,
        pa.entity_type,
        CASE 
          WHEN pa.entity_type = 'pharmacy' THEN (SELECT pharmacy_name FROM pharmacies WHERE id = pa.pharmacy_or_group_id)
          WHEN pa.entity_type = 'group' THEN (SELECT group_name FROM pharmacy_groups WHERE id = pa.pharmacy_or_group_id)
        END as entity_name,
        ac.compliance_score,
        ac.month_date
      FROM pharmacy_agreements pa
      JOIN agreement_compliance ac ON pa.id = ac.agreement_id
      WHERE pa.status = 'active'
      AND ac.compliance_score >= $1
      AND ac.month_date = (
        SELECT MAX(month_date) FROM agreement_compliance 
        WHERE agreement_id = pa.id
      )
      ORDER BY ac.compliance_score DESC
    `;

    const result = await query(selectQuery, [threshold]);
    return result.rows;
  }

  /**
   * Get compliance trends
   */
  static async getComplianceTrends(agreementId, months = 12) {
    const selectQuery = `
      SELECT
        month_date,
        total_claims,
        claims_accepted,
        compliance_score,
        response_time_compliance,
        dispensing_time_compliance
      FROM agreement_compliance
      WHERE agreement_id = $1
      ORDER BY month_date DESC
      LIMIT $2
    `;

    const result = await query(selectQuery, [agreementId, months]);
    return result.rows;
  }

  /**
   * Get revenue summary for agreement
   */
  static async getRevenueSummary(agreementId) {
    const selectQuery = `
      SELECT
        SUM(monthly_revenue) as total_revenue,
        SUM(commission_paid) as total_commission,
        AVG(monthly_revenue) as avg_monthly_revenue,
        COUNT(*) as months_tracked
      FROM agreement_compliance
      WHERE agreement_id = $1
    `;

    const result = await query(selectQuery, [agreementId]);
    return result.rows[0];
  }

  /**
   * Delete compliance record
   */
  static async delete(complianceId) {
    const deleteQuery = `
      DELETE FROM agreement_compliance
      WHERE id = $1
      RETURNING *
    `;

    const result = await query(deleteQuery, [complianceId]);
    return result.rows[0];
  }
}

module.exports = AgreementCompliance;
