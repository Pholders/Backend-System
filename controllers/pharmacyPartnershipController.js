const PharmacyGroup = require('../models/PharmacyGroup');
const PharmacyAgreement = require('../models/PharmacyAgreement');
const AgreementCompliance = require('../models/AgreementCompliance');
const ComplianceTrackingService = require('../services/complianceTrackingService');

/**
 * Pharmacy Partnership Controller
 * Handles all partnership management endpoints
 */

class PharmacyPartnershipController {
  /**
   * Create a new pharmacy group
   */
  static async createGroup(req, res) {
    try {
      const { group_name, parent_company, tier, description, commission_rate } = req.body;

      // Validate required fields
      if (!group_name) {
        return res.status(400).json({
          status: 'error',
          message: 'Group name is required'
        });
      }

      if (!['premium', 'standard', 'basic'].includes(tier)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid tier. Must be premium, standard, or basic'
        });
      }

      const group = await PharmacyGroup.create({
        group_name,
        parent_company,
        tier,
        description,
        commission_rate,
        created_by: req.user.id
      });

      return res.status(201).json({
        status: 'success',
        message: 'Pharmacy group created',
        data: group
      });
    } catch (error) {
      console.error('❌ Error creating pharmacy group:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error creating pharmacy group',
        error: error.message
      });
    }
  }

  /**
   * Get all pharmacy groups
   */
  static async getAllGroups(req, res) {
    try {
      const { tier, is_active, limit = 50, offset = 0 } = req.query;

      const groups = await PharmacyGroup.getAll({
        tier,
        is_active: is_active === 'true',
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      return res.status(200).json({
        status: 'success',
        data: groups,
        total: groups.length
      });
    } catch (error) {
      console.error('❌ Error getting pharmacy groups:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error retrieving pharmacy groups'
      });
    }
  }

  /**
   * Get group by ID
   */
  static async getGroupById(req, res) {
    try {
      const { groupId } = req.params;

      const group = await PharmacyGroup.getById(groupId);

      if (!group) {
        return res.status(404).json({
          status: 'error',
          message: 'Pharmacy group not found'
        });
      }

      // Get pharmacies in group
      const pharmacies = await PharmacyGroup.getPharmacies(groupId);

      // Get statistics
      const stats = await PharmacyGroup.getStats(groupId);

      return res.status(200).json({
        status: 'success',
        data: {
          ...group,
          pharmacies,
          statistics: stats
        }
      });
    } catch (error) {
      console.error('❌ Error getting pharmacy group:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error retrieving pharmacy group'
      });
    }
  }

  /**
   * Update group
   */
  static async updateGroup(req, res) {
    try {
      const { groupId } = req.params;
      const { group_name, parent_company, tier, description, commission_rate, is_active } = req.body;

      if (tier && !['premium', 'standard', 'basic'].includes(tier)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid tier'
        });
      }

      const group = await PharmacyGroup.update(groupId, {
        group_name,
        parent_company,
        tier,
        description,
        commission_rate,
        is_active
      });

      if (!group) {
        return res.status(404).json({
          status: 'error',
          message: 'Pharmacy group not found'
        });
      }

      return res.status(200).json({
        status: 'success',
        message: 'Pharmacy group updated',
        data: group
      });
    } catch (error) {
      console.error('❌ Error updating pharmacy group:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error updating pharmacy group'
      });
    }
  }

  /**
   * Add pharmacy to group
   */
  static async addPharmacyToGroup(req, res) {
    try {
      const { groupId } = req.params;
      const { pharmacy_id, is_primary = true } = req.body;

      if (!pharmacy_id) {
        return res.status(400).json({
          status: 'error',
          message: 'Pharmacy ID is required'
        });
      }

      const result = await PharmacyGroup.addPharmacy(groupId, pharmacy_id, is_primary);

      return res.status(200).json({
        status: 'success',
        message: 'Pharmacy added to group',
        data: result
      });
    } catch (error) {
      console.error('❌ Error adding pharmacy to group:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message || 'Error adding pharmacy to group'
      });
    }
  }

  /**
   * Remove pharmacy from group
   */
  static async removePharmacyFromGroup(req, res) {
    try {
      const { groupId, pharmacyId } = req.params;

      const result = await PharmacyGroup.removePharmacy(groupId, pharmacyId);

      if (!result) {
        return res.status(404).json({
          status: 'error',
          message: 'Pharmacy not found in group'
        });
      }

      return res.status(200).json({
        status: 'success',
        message: 'Pharmacy removed from group',
        data: result
      });
    } catch (error) {
      console.error('❌ Error removing pharmacy from group:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error removing pharmacy from group'
      });
    }
  }

  /**
   * Create partnership agreement
   */
  static async createAgreement(req, res) {
    try {
      const {
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
        payment_terms
      } = req.body;

      // Validate required fields
      if (!pharmacy_or_group_id || !entity_type) {
        return res.status(400).json({
          status: 'error',
          message: 'Pharmacy/Group ID and entity type are required'
        });
      }

      if (!['pharmacy', 'group'].includes(entity_type)) {
        return res.status(400).json({
          status: 'error',
          message: 'Entity type must be pharmacy or group'
        });
      }

      if (!commission_rate) {
        return res.status(400).json({
          status: 'error',
          message: 'Commission rate is required'
        });
      }

      const agreement = await PharmacyAgreement.create({
        pharmacy_or_group_id,
        entity_type,
        agreement_type,
        start_date,
        end_date,
        auto_renew: auto_renew || false,
        commission_rate,
        service_fee,
        minimum_monthly_transactions,
        claim_response_time_hours,
        dispensing_time_hours,
        payment_terms,
        created_by: req.user.id
      });

      return res.status(201).json({
        status: 'success',
        message: 'Partnership agreement created',
        data: agreement
      });
    } catch (error) {
      console.error('❌ Error creating agreement:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message || 'Error creating agreement'
      });
    }
  }

  /**
   * Get all agreements
   */
  static async getAllAgreements(req, res) {
    try {
      const { entity_type, status, pharmacy_or_group_id, limit = 50, offset = 0 } = req.query;

      const agreements = await PharmacyAgreement.getAll({
        entity_type,
        status,
        pharmacy_or_group_id,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      return res.status(200).json({
        status: 'success',
        data: agreements,
        total: agreements.length
      });
    } catch (error) {
      console.error('❌ Error getting agreements:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error retrieving agreements'
      });
    }
  }

  /**
   * Get agreement by ID
   */
  static async getAgreementById(req, res) {
    try {
      const { agreementId } = req.params;

      const agreement = await PharmacyAgreement.getDetailedAgreement(agreementId);

      if (!agreement) {
        return res.status(404).json({
          status: 'error',
          message: 'Agreement not found'
        });
      }

      // Get compliance data
      const compliance = await AgreementCompliance.getAverageCompliance(agreementId);
      const trends = await AgreementCompliance.getComplianceTrends(agreementId, 12);

      return res.status(200).json({
        status: 'success',
        data: {
          ...agreement,
          compliance,
          trends
        }
      });
    } catch (error) {
      console.error('❌ Error getting agreement:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error retrieving agreement'
      });
    }
  }

  /**
   * Update agreement
   */
  static async updateAgreement(req, res) {
    try {
      const { agreementId } = req.params;
      const {
        commission_rate,
        service_fee,
        claim_response_time_hours,
        dispensing_time_hours,
        payment_terms,
        status,
        end_date
      } = req.body;

      const agreement = await PharmacyAgreement.update(agreementId, {
        commission_rate,
        service_fee,
        claim_response_time_hours,
        dispensing_time_hours,
        payment_terms,
        status,
        end_date
      });

      if (!agreement) {
        return res.status(404).json({
          status: 'error',
          message: 'Agreement not found'
        });
      }

      return res.status(200).json({
        status: 'success',
        message: 'Agreement updated',
        data: agreement
      });
    } catch (error) {
      console.error('❌ Error updating agreement:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error updating agreement'
      });
    }
  }

  /**
   * Activate agreement
   */
  static async activateAgreement(req, res) {
    try {
      const { agreementId } = req.params;

      const agreement = await PharmacyAgreement.activate(agreementId);

      if (!agreement) {
        return res.status(404).json({
          status: 'error',
          message: 'Agreement not found'
        });
      }

      return res.status(200).json({
        status: 'success',
        message: 'Agreement activated',
        data: agreement
      });
    } catch (error) {
      console.error('❌ Error activating agreement:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error activating agreement'
      });
    }
  }

  /**
   * Suspend agreement
   */
  static async suspendAgreement(req, res) {
    try {
      const { agreementId } = req.params;

      const agreement = await PharmacyAgreement.suspend(agreementId);

      if (!agreement) {
        return res.status(404).json({
          status: 'error',
          message: 'Agreement not found'
        });
      }

      return res.status(200).json({
        status: 'success',
        message: 'Agreement suspended',
        data: agreement
      });
    } catch (error) {
      console.error('❌ Error suspending agreement:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error suspending agreement'
      });
    }
  }

  /**
   * Get compliance dashboard
   */
  static async getComplianceDashboard(req, res) {
    try {
      const dashboardData = await ComplianceTrackingService.getDashboardData();

      const topPerformers = await ComplianceTrackingService.getTopPerformers(5);
      const lowPerformers = await ComplianceTrackingService.getLowPerformers(5);

      return res.status(200).json({
        status: 'success',
        data: {
          summary: dashboardData,
          topPerformers,
          lowPerformers
        }
      });
    } catch (error) {
      console.error('❌ Error getting compliance dashboard:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error retrieving dashboard'
      });
    }
  }

  /**
   * Get pharmacy compliance status
   */
  static async getPharmacyCompliance(req, res) {
    try {
      const { pharmacyId } = req.params;

      const complianceStatus = await ComplianceTrackingService.getPharmacyComplianceStatus(pharmacyId);

      return res.status(200).json({
        status: 'success',
        data: complianceStatus
      });
    } catch (error) {
      console.error('❌ Error getting pharmacy compliance:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error retrieving pharmacy compliance'
      });
    }
  }

  /**
   * Get compliance report
   */
  static async getComplianceReport(req, res) {
    try {
      const { start_date, end_date } = req.query;

      if (!start_date || !end_date) {
        return res.status(400).json({
          status: 'error',
          message: 'Start date and end date are required'
        });
      }

      const report = await ComplianceTrackingService.getComplianceReport(start_date, end_date);

      return res.status(200).json({
        status: 'success',
        data: report,
        total: report.length
      });
    } catch (error) {
      console.error('❌ Error getting compliance report:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error retrieving report'
      });
    }
  }

  /**
   * Search groups
   */
  static async searchGroups(req, res) {
    try {
      const { q } = req.query;

      if (!q) {
        return res.status(400).json({
          status: 'error',
          message: 'Search term required'
        });
      }

      const results = await PharmacyGroup.search(q);

      return res.status(200).json({
        status: 'success',
        data: results,
        total: results.length
      });
    } catch (error) {
      console.error('❌ Error searching groups:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error searching groups'
      });
    }
  }

  /**
   * Get expiring agreements
   */
  static async getExpiringAgreements(req, res) {
    try {
      const { days = 30 } = req.query;

      const agreements = await PharmacyAgreement.getExpiringAgreements(parseInt(days));

      return res.status(200).json({
        status: 'success',
        data: agreements,
        total: agreements.length
      });
    } catch (error) {
      console.error('❌ Error getting expiring agreements:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error retrieving expiring agreements'
      });
    }
  }

  /**
   * Upgrade pharmacy tier
   */
  static async upgradePharmacyTier(req, res) {
    try {
      const { toTier } = req.body;
      const pharmacyId = req.user.id;
      const pharmacyEmail = req.user.email;

      if (!toTier) {
        return res.status(400).json({
          success: false,
          message: 'Target tier is required'
        });
      }

      // Validate tier
      const validTiers = ['basic', 'premium', 'enterprise'];
      if (!validTiers.includes(toTier)) {
        return res.status(400).json({
          success: false,
          message: `Invalid tier. Must be one of: ${validTiers.join(', ')}`
        });
      }

      // Get current group
      const currentGroupQuery = await require('../config/db').query(`
        SELECT pgm.group_id, g.tier 
        FROM pharmacy_group_members pgm
        JOIN pharmacy_groups g ON pgm.group_id = g.id
        WHERE pgm.pharmacy_id = $1 AND pgm.left_at IS NULL
        LIMIT 1;
      `, [pharmacyId]);

      if (currentGroupQuery.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Pharmacy not assigned to any group'
        });
      }

      const currentGroup = currentGroupQuery.rows[0];
      const currentTier = currentGroup.tier;

      // Check if trying to downgrade
      const tierOrder = { basic: 0, premium: 1, enterprise: 2 };
      if (tierOrder[toTier] < tierOrder[currentTier]) {
        return res.status(400).json({
          success: false,
          message: `Cannot downgrade from ${currentTier} to ${toTier}. Downgrades require admin approval.`
        });
      }

      // Get target group
      const targetGroup = await PharmacyGroup.getGroupByTierName(toTier);
      if (!targetGroup) {
        return res.status(404).json({
          success: false,
          message: `${toTier} tier group not found`
        });
      }

      // Perform upgrade
      await PharmacyGroup.upgradePharmacyTier(
        pharmacyId,
        currentGroup.group_id,
        targetGroup.id
      );

      // Log the upgrade
      const AuditLog = require('../models/AuditLog');
      await AuditLog.logSecurityEvent(
        req,
        pharmacyId,
        'pharmacy',
        pharmacyEmail,
        'tier_upgrade',
        'success',
        `Upgraded from ${currentTier} to ${toTier} tier`
      );

      return res.status(200).json({
        success: true,
        message: `Successfully upgraded to ${toTier} tier`,
        data: {
          previousTier: currentTier,
          newTier: toTier,
          features: targetGroup.features,
          commissionRate: targetGroup.commission_rate,
          upgradedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('❌ Error upgrading pharmacy tier:', error);
      return res.status(500).json({
        success: false,
        message: 'Error upgrading pharmacy tier',
        error: error.message
      });
    }
  }

  /**
   * Get current pharmacy tier
   */
  static async getCurrentTier(req, res) {
    try {
      const pharmacyId = req.user.id;

      const tierQuery = await require('../config/db').query(`
        SELECT g.*, pgm.joined_at
        FROM pharmacy_group_members pgm
        JOIN pharmacy_groups g ON pgm.group_id = g.id
        WHERE pgm.pharmacy_id = $1 AND pgm.left_at IS NULL
        LIMIT 1;
      `, [pharmacyId]);

      if (tierQuery.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Pharmacy tier not found'
        });
      }

      const tier = tierQuery.rows[0];

      return res.status(200).json({
        success: true,
        data: {
          currentTier: tier.tier,
          groupName: tier.group_name,
          features: tier.features,
          commissionRate: tier.commission_rate,
          joinedAt: tier.joined_at,
          description: tier.description
        }
      });
    } catch (error) {
      console.error('❌ Error getting pharmacy tier:', error);
      return res.status(500).json({
        success: false,
        message: 'Error retrieving pharmacy tier',
        error: error.message
      });
    }
  }
}

module.exports = PharmacyPartnershipController;
