const { query } = require('../config/db');
const PharmacyGroup = require('../models/PharmacyGroup');
const PharmacyAgreement = require('../models/PharmacyAgreement');

/**
 * Pharmacy Routing Service
 * Implements intelligent prescription claim routing based on:
 * - Pharmacy proximity to patient
 * - Partnership tier (premium > standard > basic)
 * - Agreement status and SLA
 * - Current compliance metrics
 * - Acceptance rates
 */

class PharmacyRoutingService {
  /**
   * Main routing method - routes prescription to best pharmacy
   */
  static async routePrescription(prescriptionId, patientLocation) {
    try {
      console.log(`🔄 Routing prescription ${prescriptionId}`);

      // Get prescription details
      const prescription = await query(
        'SELECT * FROM prescriptions WHERE id = $1',
        [prescriptionId]
      );

      if (prescription.rows.length === 0) {
        throw new Error('Prescription not found');
      }

      const pres = prescription.rows[0];

      // Get all active pharmacies with valid agreements
      const candidates = await this.getCandidatePharmacies(patientLocation);

      if (candidates.length === 0) {
        console.warn(`⚠️ No candidate pharmacies found for prescription ${prescriptionId}`);
        return { success: false, error: 'No available pharmacies' };
      }

      // Rank candidates by tier and compliance
      const ranked = await this.rankPharmacies(candidates);

      // Route to top pharmacy (tier-based)
      let routed = false;
      for (let i = 0; i < ranked.length; i++) {
        const pharmacy = ranked[i];

        const routeResult = await this.sendClaimToPharmacy(
          prescriptionId,
          pharmacy,
          i + 1 // routing order
        );

        if (routeResult.success) {
          console.log(
            `✅ Prescription ${prescriptionId} routed to ${pharmacy.pharmacy_name} (Tier: ${pharmacy.tier})`
          );
          routed = true;
          break;
        } else {
          console.log(
            `⚠️ Failed to route to ${pharmacy.pharmacy_name}, trying next...`
          );
        }
      }

      return {
        success: routed,
        message: routed ? 'Prescription routed successfully' : 'All pharmacies declined',
        routingDetails: {
          prescriptionId,
          candidatesCount: candidates.length,
          routedSuccessfully: routed
        }
      };
    } catch (error) {
      console.error('❌ Error in prescription routing:', error);
      throw error;
    }
  }

  /**
   * Get candidate pharmacies with active agreements
   */
  static async getCandidatePharmacies(patientLocation) {
    try {
      // Get all pharmacies with delivery capability near patient
      const candidatesQuery = `
        SELECT DISTINCT
          p.id,
          p.pharmacy_name,
          p.latitude,
          p.longitude,
          p.delivery_available,
          p.delivery_radius,
          pg.tier,
          pg.group_id,
          ppm.is_primary,
          pa.commission_rate,
          pa.claim_response_time_hours,
          pa.dispensing_time_hours,
          pa.id as agreement_id,
          CASE
            WHEN pg.tier = 'premium' THEN 1
            WHEN pg.tier = 'standard' THEN 2
            ELSE 3
          END as tier_rank,
          -- Calculate distance
          SQRT(
            POW(CAST(p.latitude - $1 AS FLOAT), 2) +
            POW(CAST(p.longitude - $2 AS FLOAT), 2)
          ) as distance
        FROM pharmacies p
        LEFT JOIN pharmacy_group_members ppm ON p.id = ppm.pharmacy_id AND ppm.left_at IS NULL
        LEFT JOIN pharmacy_groups pg ON ppm.group_id = pg.id
        LEFT JOIN pharmacy_agreements pa ON (
          (pa.entity_type = 'pharmacy' AND pa.pharmacy_or_group_id = p.id)
          OR (pa.entity_type = 'group' AND pa.pharmacy_or_group_id = pg.id)
        )
        WHERE p.status = 'active'
        AND pa.status = 'active'
        AND pa.start_date <= CURRENT_DATE
        AND (pa.end_date IS NULL OR pa.end_date >= CURRENT_DATE)
        ORDER BY tier_rank ASC, distance ASC
      `;

      const result = await query(candidatesQuery, [
        patientLocation.latitude || 0,
        patientLocation.longitude || 0
      ]);

      return result.rows;
    } catch (error) {
      console.error('❌ Error getting candidate pharmacies:', error);
      return [];
    }
  }

  /**
   * Rank pharmacies by compliance and performance
   */
  static async rankPharmacies(candidates) {
    try {
      // Enrich candidates with performance data
      const ranked = await Promise.all(
        candidates.map(async (pharmacy) => {
          // Get performance metrics
          const perfQuery = `
            SELECT
              overall_score,
              acceptance_rate,
              on_time_response_rate,
              on_time_dispensing_rate
            FROM pharmacy_performance_metrics
            WHERE pharmacy_id = $1
          `;

          const perfResult = await query(perfQuery, [pharmacy.id]);
          const perf = perfResult.rows[0] || {
            overall_score: 80,
            acceptance_rate: 85,
            on_time_response_rate: 90
          };

          return {
            ...pharmacy,
            performance: perf,
            score: this.calculateRoutingScore(pharmacy, perf)
          };
        })
      );

      // Sort by score (highest first)
      return ranked.sort((a, b) => b.score - a.score);
    } catch (error) {
      console.error('❌ Error ranking pharmacies:', error);
      return candidates;
    }
  }

  /**
   * Calculate routing score for a pharmacy (0-100)
   * Higher score = better candidate
   */
  static calculateRoutingScore(pharmacy, performance) {
    let score = 0;

    // Tier weighting (40 points)
    const tierScores = { premium: 40, standard: 25, basic: 10 };
    score += tierScores[pharmacy.tier] || 10;

    // Performance score (40 points)
    const perfScore = (performance.overall_score || 80) * 0.4;
    score += perfScore;

    // Acceptance rate (15 points)
    const acceptanceScore = (performance.acceptance_rate || 85) * 0.15;
    score += acceptanceScore;

    // Response time compliance (5 points)
    const responseScore = (performance.on_time_response_rate || 90) * 0.05;
    score += responseScore;

    return Math.min(100, Math.round(score * 100) / 100);
  }

  /**
   * Send claim to specific pharmacy
   */
  static async sendClaimToPharmacy(prescriptionId, pharmacy, routingOrder) {
    try {
      // Record routing in history
      const routingQuery = `
        INSERT INTO claim_routing_history (
          prescription_id,
          routed_to_pharmacy_id,
          routed_to_group_id,
          routing_reason,
          routing_order,
          claim_sent_at
        )
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        RETURNING *
      `;

      const reason = `Tier: ${pharmacy.tier}, Score: ${pharmacy.score}`;

      const result = await query(routingQuery, [
        prescriptionId,
        pharmacy.id,
        pharmacy.group_id || null,
        reason,
        routingOrder
      ]);

      // TODO: Send notification to pharmacy via email/API
      console.log(`📧 Claim notification sent to pharmacy ${pharmacy.pharmacy_name}`);

      return { success: true, routingId: result.rows[0].id };
    } catch (error) {
      console.error(
        `❌ Error sending claim to pharmacy ${pharmacy.id}:`,
        error
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Record claim response (acceptance/rejection)
   */
  static async recordClaimResponse(routingId, accepted, reason = null) {
    try {
      const updateQuery = `
        UPDATE claim_routing_history
        SET
          accepted = $1,
          acceptance_reason = $2,
          claim_response_at = CURRENT_TIMESTAMP,
          response_time_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - claim_sent_at))::INT
        WHERE id = $3
        RETURNING *
      `;

      const result = await query(updateQuery, [accepted, reason, routingId]);
      const routing = result.rows[0];

      // If accepted, update compliance metrics
      if (accepted) {
        await this.updatePharmacyCompliance(
          routing.routed_to_pharmacy_id,
          true,
          routing.response_time_seconds
        );
      }

      return routing;
    } catch (error) {
      console.error('❌ Error recording claim response:', error);
      throw error;
    }
  }

  /**
   * Update pharmacy compliance after claim handling
   */
  static async updatePharmacyCompliance(pharmacyId, accepted, responseTimeSeconds) {
    try {
      // Get pharmacy's agreement
      const agreementResult = await query(
        `SELECT id, claim_response_time_hours, dispensing_time_hours
         FROM pharmacy_agreements
         WHERE pharmacy_or_group_id = $1 AND entity_type = 'pharmacy'
         AND status = 'active' LIMIT 1`,
        [pharmacyId]
      );

      if (agreementResult.rows.length === 0) {
        return; // No active agreement
      }

      const agreement = agreementResult.rows[0];

      // Check if response was on time
      const maxResponseSeconds = agreement.claim_response_time_hours * 3600;
      const isOnTime = responseTimeSeconds <= maxResponseSeconds;

      // Get or create current month compliance record
      const monthDate = new Date();
      const monthStr = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-01`;

      const complianceResult = await query(
        `SELECT id FROM agreement_compliance
         WHERE agreement_id = $1 AND month_date = $2::DATE`,
        [agreement.id, monthStr]
      );

      if (complianceResult.rows.length === 0) {
        // Create new compliance record
        await query(
          `INSERT INTO agreement_compliance (
            agreement_id, month_date, total_claims, claims_accepted,
            on_time_responses, response_time_compliance, compliance_score
          ) VALUES ($1, $2::DATE, 1, $3, $4, $5, $6)`,
          [
            agreement.id,
            monthStr,
            accepted ? 1 : 0,
            isOnTime ? 1 : 0,
            isOnTime ? 100 : 0,
            isOnTime ? 100 : 0
          ]
        );
      } else {
        // Update existing record
        const complianceId = complianceResult.rows[0].id;
        await query(
          `UPDATE agreement_compliance
           SET
             total_claims = total_claims + 1,
             claims_accepted = claims_accepted + CASE WHEN $1 THEN 1 ELSE 0 END,
             on_time_responses = on_time_responses + CASE WHEN $2 THEN 1 ELSE 0 END
           WHERE id = $3`,
          [accepted, isOnTime, complianceId]
        );
      }

      console.log(
        `✅ Compliance updated for pharmacy ${pharmacyId}: accepted=${accepted}, onTime=${isOnTime}`
      );
    } catch (error) {
      console.error('❌ Error updating compliance:', error);
    }
  }

  /**
   * Get routing history for a prescription
   */
  static async getRoutingHistory(prescriptionId) {
    try {
      const query_str = `
        SELECT
          crh.*,
          p.pharmacy_name,
          pa.commission_rate,
          pa.claim_response_time_hours
        FROM claim_routing_history crh
        LEFT JOIN pharmacies p ON crh.routed_to_pharmacy_id = p.id
        LEFT JOIN pharmacy_agreements pa ON crh.routed_to_pharmacy_id = pa.pharmacy_or_group_id
        WHERE crh.prescription_id = $1
        ORDER BY crh.routing_order ASC
      `;

      const result = await query(query_str, [prescriptionId]);
      return result.rows;
    } catch (error) {
      console.error('❌ Error getting routing history:', error);
      return [];
    }
  }

  /**
   * Get next tier fallback candidates
   */
  static async getNextTierCandidates(currentTier, patientLocation) {
    const tierOrder = {
      premium: ['standard', 'basic'],
      standard: ['basic'],
      basic: []
    };

    const nextTiers = tierOrder[currentTier] || [];
    if (nextTiers.length === 0) {
      return [];
    }

    const candidatesQuery = `
      SELECT DISTINCT
        p.id,
        p.pharmacy_name,
        p.latitude,
        p.longitude,
        pg.tier,
        pa.commission_rate
      FROM pharmacies p
      LEFT JOIN pharmacy_group_members ppm ON p.id = ppm.pharmacy_id AND ppm.left_at IS NULL
      LEFT JOIN pharmacy_groups pg ON ppm.group_id = pg.id
      LEFT JOIN pharmacy_agreements pa ON (
        (pa.entity_type = 'pharmacy' AND pa.pharmacy_or_group_id = p.id)
        OR (pa.entity_type = 'group' AND pa.pharmacy_or_group_id = pg.id)
      )
      WHERE p.status = 'active'
      AND pg.tier = ANY($1)
      AND pa.status = 'active'
      ORDER BY pg.tier ASC
    `;

    const result = await query(candidatesQuery, [nextTiers]);
    return result.rows;
  }

  /**
   * Get routing statistics
   */
  static async getRoutingStatistics(startDate = null, endDate = null) {
    try {
      const statsQuery = `
        SELECT
          COUNT(*) as total_routes,
          SUM(CASE WHEN accepted THEN 1 ELSE 0 END) as accepted_count,
          SUM(CASE WHEN accepted IS NULL THEN 1 ELSE 0 END) as pending_count,
          SUM(CASE WHEN accepted = false THEN 1 ELSE 0 END) as rejected_count,
          AVG(response_time_seconds) as avg_response_time,
          MIN(response_time_seconds) as min_response_time,
          MAX(response_time_seconds) as max_response_time
        FROM claim_routing_history
        WHERE ($1::DATE IS NULL OR claim_sent_at >= $1)
        AND ($2::DATE IS NULL OR claim_sent_at <= $2)
      `;

      const result = await query(statsQuery, [startDate, endDate]);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error getting routing statistics:', error);
      return null;
    }
  }
}

module.exports = PharmacyRoutingService;
