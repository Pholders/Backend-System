const { query } = require('../config/db');
const AgreementCompliance = require('../models/AgreementCompliance');
const PharmacyAgreement = require('../models/PharmacyAgreement');

/**
 * Compliance Tracking Service
 * Monitors pharmacy performance and compliance metrics
 * Auto-suspends non-compliant agreements
 * Provides compliance dashboards and reports
 */

class ComplianceTrackingService {
  /**
   * Initialize compliance tracking (run on server startup)
   */
  static async initialize() {
    try {
      console.log('🔄 Initializing Compliance Tracking Service...');

      // Auto-renew expired agreements if configured
      await PharmacyAgreement.autoRenewExpired();

      // Check for expiring agreements
      const expiringAgreements = await PharmacyAgreement.getExpiringAgreements(30);
      if (expiringAgreements.length > 0) {
        console.log(`⚠️ ${expiringAgreements.length} agreements expiring within 30 days`);
      }

      // Check low compliance agreements
      const lowCompliance = await AgreementCompliance.getLowComplianceAgreements(80);
      if (lowCompliance.length > 0) {
        console.log(`⚠️ ${lowCompliance.length} agreements with low compliance (<80%)`);
        await this.handleLowCompliance(lowCompliance);
      }

      console.log('✅ Compliance Tracking Service initialized');
    } catch (error) {
      console.error('❌ Error initializing compliance tracking:', error);
    }
  }

  /**
   * Calculate monthly compliance for all agreements
   */
  static async calculateMonthlyCompliance() {
    try {
      console.log('🔄 Calculating monthly compliance metrics...');

      // Get all active agreements
      const agreementsResult = await query(`
        SELECT id FROM pharmacy_agreements WHERE status = 'active'
      `);

      const agreements = agreementsResult.rows;

      for (const agreement of agreements) {
        await this.calculateAgreementCompliance(agreement.id);
      }

      console.log(`✅ Calculated compliance for ${agreements.length} agreements`);
    } catch (error) {
      console.error('❌ Error calculating monthly compliance:', error);
    }
  }

  /**
   * Calculate compliance for a specific agreement
   */
  static async calculateAgreementCompliance(agreementId) {
    try {
      const currentMonth = new Date();
      const monthStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-01`;

      // Get all routing history for this month
      const routingResult = await query(`
        SELECT
          COUNT(*) as total_routes,
          SUM(CASE WHEN accepted = true THEN 1 ELSE 0 END) as accepted,
          SUM(CASE WHEN accepted = false THEN 1 ELSE 0 END) as rejected,
          SUM(CASE WHEN accepted IS NULL THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN accepted = true AND response_time_seconds <= 
            (SELECT claim_response_time_hours * 3600 FROM pharmacy_agreements WHERE id = $1)
            THEN 1 ELSE 0 END) as on_time_responses,
          SUM(CASE WHEN dispensing_time_seconds <= 
            (SELECT dispensing_time_hours * 3600 FROM pharmacy_agreements WHERE id = $1)
            THEN 1 ELSE 0 END) as on_time_dispensed,
          AVG(response_time_seconds) as avg_response_time,
          AVG(dispensing_time_seconds) as avg_dispensing_time
        FROM claim_routing_history
        WHERE (routed_to_pharmacy_id IN (
          SELECT pharmacy_or_group_id FROM pharmacy_agreements 
          WHERE id = $1 AND entity_type = 'pharmacy'
        ) OR routed_to_group_id IN (
          SELECT pharmacy_or_group_id FROM pharmacy_agreements 
          WHERE id = $1 AND entity_type = 'group'
        ))
        AND DATE_TRUNC('month', claim_sent_at) = $2::DATE
      `, [agreementId, monthStr]);

      const metrics = routingResult.rows[0] || {};

      // Calculate compliance
      const complianceScore = await this.calculateComplianceScore(
        agreementId,
        metrics.total_routes || 0,
        metrics.on_time_responses || 0,
        metrics.on_time_dispensed || 0,
        metrics.accepted || 0
      );

      // Create or update compliance record
      await AgreementCompliance.create({
        agreement_id: agreementId,
        month_date: monthStr,
        total_claims: metrics.total_routes || 0,
        claims_accepted: metrics.accepted || 0,
        claims_rejected: metrics.rejected || 0,
        on_time_responses: metrics.on_time_responses || 0,
        on_time_dispensed: metrics.on_time_dispensed || 0,
        compliance_score: complianceScore
      });

      return { success: true, complianceScore };
    } catch (error) {
      console.error(`❌ Error calculating compliance for agreement ${agreementId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate compliance score (0-100)
   */
  static calculateComplianceScore(
    agreementId,
    totalClaims,
    onTimeResponses,
    onTimeDispensed,
    acceptedClaims
  ) {
    if (totalClaims === 0) return 100; // No claims = full compliance

    // Component scores (each 0-100)
    const responseScore = totalClaims > 0 
      ? (onTimeResponses / totalClaims) * 100 
      : 100;

    const dispensingScore = acceptedClaims > 0 
      ? (onTimeDispensed / acceptedClaims) * 100 
      : 100;

    const acceptanceScore = totalClaims > 0 
      ? (acceptedClaims / totalClaims) * 100 
      : 100;

    // Weighted average (response: 40%, dispensing: 40%, acceptance: 20%)
    const score = (responseScore * 0.4) + (dispensingScore * 0.4) + (acceptanceScore * 0.2);

    return Math.round(score * 100) / 100;
  }

  /**
   * Handle low compliance agreements
   */
  static async handleLowCompliance(lowComplianceAgreements) {
    try {
      for (const agreement of lowComplianceAgreements) {
        // Get full agreement details
        const fullAgreement = await PharmacyAgreement.getById(agreement.id);

        if (agreement.compliance_score < 60) {
          // Critical: Suspend agreement
          console.log(
            `🚨 SUSPENDING agreement ${agreement.id} (${agreement.entity_name}) - Compliance: ${agreement.compliance_score}%`
          );

          await PharmacyAgreement.suspend(agreement.id);

          // TODO: Send notification to pharmacy
        } else if (agreement.compliance_score < 80) {
          // Warning: Log alert
          console.log(
            `⚠️ LOW COMPLIANCE: Agreement ${agreement.id} (${agreement.entity_name}) - Compliance: ${agreement.compliance_score}%`
          );

          // TODO: Send warning notification
        }
      }
    } catch (error) {
      console.error('❌ Error handling low compliance:', error);
    }
  }

  /**
   * Get pharmacy compliance status
   */
  static async getPharmacyComplianceStatus(pharmacyId) {
    try {
      // Get active agreements
      const agreements = await PharmacyAgreement.getPharmacyAgreements(pharmacyId);

      if (agreements.length === 0) {
        return { status: 'no_agreements', pharmacyId };
      }

      // Get compliance for each agreement
      const complianceData = await Promise.all(
        agreements.map(async (agreement) => {
          const compliance = await AgreementCompliance.getAverageCompliance(agreement.id);
          return {
            agreementId: agreement.id,
            agreementType: agreement.agreement_type,
            ...compliance
          };
        })
      );

      // Calculate overall compliance
      const overallCompliance = complianceData.length > 0
        ? Math.round(
            complianceData.reduce((sum, c) => sum + (c.avg_compliance || 0), 0) /
            complianceData.length
          )
        : 0;

      return {
        pharmacyId,
        overallCompliance,
        agreementCount: agreements.length,
        agreements: complianceData,
        status: overallCompliance >= 90
          ? 'excellent'
          : overallCompliance >= 80
            ? 'good'
            : overallCompliance >= 70
              ? 'fair'
              : 'poor'
      };
    } catch (error) {
      console.error('❌ Error getting pharmacy compliance status:', error);
      throw error;
    }
  }

  /**
   * Get compliance report for a period
   */
  static async getComplianceReport(startDate, endDate) {
    try {
      const reportQuery = `
        SELECT
          pa.id as agreement_id,
          pa.entity_type,
          CASE 
            WHEN pa.entity_type = 'pharmacy' THEN (SELECT pharmacy_name FROM pharmacies WHERE id = pa.pharmacy_or_group_id)
            WHEN pa.entity_type = 'group' THEN (SELECT group_name FROM pharmacy_groups WHERE id = pa.pharmacy_or_group_id)
          END as entity_name,
          pa.status,
          ac.compliance_score,
          ac.total_claims,
          ac.claims_accepted,
          ac.on_time_responses,
          ac.on_time_dispensed,
          ac.month_date
        FROM pharmacy_agreements pa
        LEFT JOIN agreement_compliance ac ON pa.id = ac.agreement_id
        WHERE ac.month_date >= $1::DATE
        AND ac.month_date <= $2::DATE
        ORDER BY pa.entity_type DESC, ac.month_date DESC
      `;

      const result = await query(reportQuery, [startDate, endDate]);
      return result.rows;
    } catch (error) {
      console.error('❌ Error getting compliance report:', error);
      return [];
    }
  }

  /**
   * Get top performing pharmacies
   */
  static async getTopPerformers(limit = 10) {
    try {
      const perfQuery = `
        SELECT
          p.id,
          p.pharmacy_name,
          ppm.group_id,
          pg.group_name,
          ppm.group_id,
          ppm.is_primary,
          ppm.group_id,
          ppm.group_id,
          ppm.group_id,
          ppm.group_id,
          ppm.group_id,
          ppm.group_id,
          ppm.group_id,
          ppm.group_id,
          ppm.group_id
        FROM pharmacy_performance_metrics ppm
        JOIN pharmacies p ON ppm.pharmacy_id = p.id
        LEFT JOIN pharmacy_group_members pgm ON p.id = pgm.pharmacy_id AND pgm.left_at IS NULL
        LEFT JOIN pharmacy_groups pg ON pgm.group_id = pg.id
        ORDER BY ppm.overall_score DESC
        LIMIT $1
      `;

      const result = await query(perfQuery, [limit]);
      return result.rows;
    } catch (error) {
      console.error('❌ Error getting top performers:', error);
      return [];
    }
  }

  /**
   * Get low performing pharmacies
   */
  static async getLowPerformers(limit = 10) {
    try {
      const perfQuery = `
        SELECT
          ppm.pharmacy_id,
          p.pharmacy_name,
          ppm.overall_score,
          ppm.acceptance_rate,
          ppm.on_time_response_rate,
          ppm.on_time_dispensing_rate,
          ppm.total_claims_accepted,
          ppm.total_claims_routed
        FROM pharmacy_performance_metrics ppm
        JOIN pharmacies p ON ppm.pharmacy_id = p.id
        WHERE ppm.overall_score < 70
        ORDER BY ppm.overall_score ASC
        LIMIT $1
      `;

      const result = await query(perfQuery, [limit]);
      return result.rows;
    } catch (error) {
      console.error('❌ Error getting low performers:', error);
      return [];
    }
  }

  /**
   * Update pharmacy performance metrics
   */
  static async updatePharmacyMetrics(pharmacyId) {
    try {
      // Get all agreements for pharmacy
      const agreementsResult = await query(`
        SELECT id FROM pharmacy_agreements
        WHERE pharmacy_or_group_id = $1 AND entity_type = 'pharmacy'
      `, [pharmacyId]);

      if (agreementsResult.rows.length === 0) {
        return;
      }

      // Calculate aggregate metrics
      const metricsQuery = `
        SELECT
          COUNT(DISTINCT crh.prescription_id) as total_claims_routed,
          SUM(CASE WHEN crh.accepted = true THEN 1 ELSE 0 END) as total_claims_accepted,
          AVG(CASE WHEN crh.accepted = true AND crh.response_time_seconds <= 
            (SELECT claim_response_time_hours * 3600 FROM pharmacy_agreements 
             WHERE id = ANY($1::INT[]))
            THEN 100 ELSE 0 END)::INT as on_time_response_rate,
          AVG(CASE WHEN crh.dispensing_time_seconds <= 
            (SELECT dispensing_time_hours * 3600 FROM pharmacy_agreements 
             WHERE id = ANY($1::INT[]))
            THEN 100 ELSE 0 END)::INT as on_time_dispensing_rate
        FROM claim_routing_history crh
        WHERE crh.routed_to_pharmacy_id = $2
      `;

      const metrics = await query(metricsQuery, [
        agreementsResult.rows.map(r => r.id),
        pharmacyId
      ]);

      const data = metrics.rows[0];

      // Calculate overall score
      const acceptanceRate = data.total_claims_routed > 0 
        ? Math.round((data.total_claims_accepted / data.total_claims_routed) * 100)
        : 85;

      const overallScore = (
        (acceptanceRate * 0.4) +
        ((data.on_time_response_rate || 90) * 0.35) +
        ((data.on_time_dispensing_rate || 90) * 0.25)
      ) / 100 * 100;

      // Update or insert metrics
      const updateQuery = `
        INSERT INTO pharmacy_performance_metrics (
          pharmacy_id,
          total_claims_routed,
          total_claims_accepted,
          acceptance_rate,
          on_time_response_rate,
          on_time_dispensing_rate,
          overall_score
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (pharmacy_id) DO UPDATE SET
          total_claims_routed = $2,
          total_claims_accepted = $3,
          acceptance_rate = $4,
          on_time_response_rate = $5,
          on_time_dispensing_rate = $6,
          overall_score = $7,
          last_updated = CURRENT_TIMESTAMP
      `;

      await query(updateQuery, [
        pharmacyId,
        data.total_claims_routed || 0,
        data.total_claims_accepted || 0,
        acceptanceRate,
        data.on_time_response_rate || 90,
        data.on_time_dispensing_rate || 90,
        Math.round(overallScore * 100) / 100
      ]);

      return { success: true, overallScore };
    } catch (error) {
      console.error(`❌ Error updating pharmacy metrics for ${pharmacyId}:`, error);
      throw error;
    }
  }

  /**
   * Generate compliance dashboard data
   */
  static async getDashboardData() {
    try {
      const dashboardQuery = `
        SELECT
          COUNT(DISTINCT pa.id) as total_agreements,
          SUM(CASE WHEN pa.status = 'active' THEN 1 ELSE 0 END) as active_agreements,
          SUM(CASE WHEN pa.status = 'suspended' THEN 1 ELSE 0 END) as suspended_agreements,
          AVG(ac.compliance_score) as avg_compliance_score,
          SUM(CASE WHEN ac.compliance_score >= 90 THEN 1 ELSE 0 END) as excellent_count,
          SUM(CASE WHEN ac.compliance_score >= 80 AND ac.compliance_score < 90 THEN 1 ELSE 0 END) as good_count,
          SUM(CASE WHEN ac.compliance_score < 80 THEN 1 ELSE 0 END) as poor_count
        FROM pharmacy_agreements pa
        LEFT JOIN agreement_compliance ac ON pa.id = ac.agreement_id
        WHERE ac.month_date = (
          SELECT MAX(month_date) FROM agreement_compliance
        )
      `;

      const result = await query(dashboardQuery);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error getting dashboard data:', error);
      return null;
    }
  }
}

module.exports = ComplianceTrackingService;
