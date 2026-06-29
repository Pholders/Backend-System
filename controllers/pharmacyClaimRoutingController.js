const PharmacyRoutingService = require('../services/pharmacyRoutingService');
const { query } = require('../config/db');

/**
 * Pharmacy Claim Routing Controller
 * Handles prescription routing to pharmacies
 */

class PharmacyClaimRoutingController {
  /**
   * Route prescription to pharmacy
   */
  static async routePrescription(req, res) {
    try {
      const { prescriptionId } = req.params;
      const { latitude, longitude } = req.body;

      if (!prescriptionId) {
        return res.status(400).json({
          status: 'error',
          message: 'Prescription ID is required'
        });
      }

      // Verify prescription exists
      const prescResult = await query(
        'SELECT id FROM prescriptions WHERE id = $1',
        [prescriptionId]
      );

      if (prescResult.rows.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Prescription not found'
        });
      }

      // Route prescription
      const routingResult = await PharmacyRoutingService.routePrescription(
        prescriptionId,
        { latitude: latitude || 0, longitude: longitude || 0 }
      );

      if (!routingResult.success) {
        return res.status(400).json({
          status: 'error',
          message: routingResult.error || 'No available pharmacies'
        });
      }

      return res.status(200).json({
        status: 'success',
        message: 'Prescription routed successfully',
        data: routingResult.routingDetails
      });
    } catch (error) {
      console.error('❌ Error routing prescription:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error routing prescription'
      });
    }
  }

  /**
   * Get candidate pharmacies for a prescription
   */
  static async getCandidatePharmacies(req, res) {
    try {
      const { latitude, longitude } = req.query;

      const candidates = await PharmacyRoutingService.getCandidatePharmacies({
        latitude: parseFloat(latitude) || 0,
        longitude: parseFloat(longitude) || 0
      });

      return res.status(200).json({
        status: 'success',
        data: candidates,
        total: candidates.length
      });
    } catch (error) {
      console.error('❌ Error getting candidate pharmacies:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error retrieving candidates'
      });
    }
  }

  /**
   * Record claim response
   */
  static async recordClaimResponse(req, res) {
    try {
      const { routingId } = req.params;
      const { accepted, reason } = req.body;

      if (accepted === undefined) {
        return res.status(400).json({
          status: 'error',
          message: 'Acceptance status is required'
        });
      }

      const result = await PharmacyRoutingService.recordClaimResponse(
        routingId,
        accepted,
        reason
      );

      if (!result) {
        return res.status(404).json({
          status: 'error',
          message: 'Routing record not found'
        });
      }

      return res.status(200).json({
        status: 'success',
        message: 'Claim response recorded',
        data: result
      });
    } catch (error) {
      console.error('❌ Error recording claim response:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error recording response'
      });
    }
  }

  /**
   * Get routing history for prescription
   */
  static async getRoutingHistory(req, res) {
    try {
      const { prescriptionId } = req.params;

      const history = await PharmacyRoutingService.getRoutingHistory(prescriptionId);

      return res.status(200).json({
        status: 'success',
        data: history,
        total: history.length
      });
    } catch (error) {
      console.error('❌ Error getting routing history:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error retrieving routing history'
      });
    }
  }

  /**
   * Get routing statistics
   */
  static async getRoutingStatistics(req, res) {
    try {
      const { start_date, end_date } = req.query;

      const stats = await PharmacyRoutingService.getRoutingStatistics(start_date, end_date);

      return res.status(200).json({
        status: 'success',
        data: stats
      });
    } catch (error) {
      console.error('❌ Error getting routing statistics:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error retrieving statistics'
      });
    }
  }

  /**
   * Get pending claims for pharmacy
   */
  static async getPendingClaims(req, res) {
    try {
      const pharmacyId = req.user.id; // Assuming pharmacy is authenticated

      const pendingQuery = `
        SELECT
          crh.*,
          p.patient_name,
          p.prescription_number,
          p.medication_name,
          p.created_at
        FROM claim_routing_history crh
        JOIN prescriptions p ON crh.prescription_id = p.id
        WHERE crh.routed_to_pharmacy_id = $1
        AND crh.accepted IS NULL
        AND crh.claim_sent_at >= NOW() - INTERVAL '24 hours'
        ORDER BY crh.claim_sent_at DESC
      `;

      const result = await query(pendingQuery, [pharmacyId]);

      return res.status(200).json({
        status: 'success',
        data: result.rows,
        total: result.rows.length
      });
    } catch (error) {
      console.error('❌ Error getting pending claims:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error retrieving pending claims'
      });
    }
  }

  /**
   * Accept claim
   */
  static async acceptClaim(req, res) {
    try {
      const { routingId } = req.params;
      const { notes } = req.body;

      const result = await PharmacyRoutingService.recordClaimResponse(
        routingId,
        true,
        notes || 'Claim accepted by pharmacy'
      );

      return res.status(200).json({
        status: 'success',
        message: 'Claim accepted',
        data: result
      });
    } catch (error) {
      console.error('❌ Error accepting claim:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error accepting claim'
      });
    }
  }

  /**
   * Reject claim
   */
  static async rejectClaim(req, res) {
    try {
      const { routingId } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          status: 'error',
          message: 'Rejection reason is required'
        });
      }

      const result = await PharmacyRoutingService.recordClaimResponse(
        routingId,
        false,
        reason
      );

      return res.status(200).json({
        status: 'success',
        message: 'Claim rejected',
        data: result
      });
    } catch (error) {
      console.error('❌ Error rejecting claim:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error rejecting claim'
      });
    }
  }

  /**
   * Get routing performance by pharmacy
   */
  static async getPharmacyRoutingPerformance(req, res) {
    try {
      const { pharmacyId } = req.params;

      const perfQuery = `
        SELECT
          routed_to_pharmacy_id,
          COUNT(*) as total_routed,
          SUM(CASE WHEN accepted = true THEN 1 ELSE 0 END) as accepted,
          SUM(CASE WHEN accepted = false THEN 1 ELSE 0 END) as rejected,
          SUM(CASE WHEN accepted IS NULL THEN 1 ELSE 0 END) as pending,
          AVG(response_time_seconds) as avg_response_time,
          AVG(dispensing_time_seconds) as avg_dispensing_time,
          ROUND(
            (SUM(CASE WHEN accepted = true THEN 1 ELSE 0 END)::FLOAT / 
             COUNT(*)) * 100
          )::INT as acceptance_rate
        FROM claim_routing_history
        WHERE routed_to_pharmacy_id = $1
        GROUP BY routed_to_pharmacy_id
      `;

      const result = await query(perfQuery, [pharmacyId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'No routing data found for pharmacy'
        });
      }

      return res.status(200).json({
        status: 'success',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('❌ Error getting routing performance:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error retrieving performance data'
      });
    }
  }

  /**
   * Get routing by tier
   */
  static async getRoutingByTier(req, res) {
    try {
      const tierQuery = `
        SELECT
          pg.tier,
          COUNT(*) as total_routes,
          SUM(CASE WHEN crh.accepted = true THEN 1 ELSE 0 END) as accepted,
          SUM(CASE WHEN crh.accepted = false THEN 1 ELSE 0 END) as rejected,
          ROUND(
            (SUM(CASE WHEN crh.accepted = true THEN 1 ELSE 0 END)::FLOAT / 
             COUNT(*)) * 100
          )::INT as acceptance_rate
        FROM claim_routing_history crh
        JOIN pharmacies p ON crh.routed_to_pharmacy_id = p.id
        JOIN pharmacy_group_members pgm ON p.id = pgm.pharmacy_id AND pgm.left_at IS NULL
        JOIN pharmacy_groups pg ON pgm.group_id = pg.id
        GROUP BY pg.tier
        ORDER BY 
          CASE 
            WHEN pg.tier = 'premium' THEN 1
            WHEN pg.tier = 'standard' THEN 2
            ELSE 3
          END
      `;

      const result = await query(tierQuery);

      return res.status(200).json({
        status: 'success',
        data: result.rows
      });
    } catch (error) {
      console.error('❌ Error getting routing by tier:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error retrieving tier statistics'
      });
    }
  }
}

module.exports = PharmacyClaimRoutingController;
