const { query } = require('../config/db');

/**
 * PharmacyGroup Model
 * Handles all database operations for pharmacy groups/chains
 */

class PharmacyGroup {
  /**
   * Create the necessary tables
   */
  static async createTable() {
    const checkTableQuery = `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'pharmacy_groups');`;
    const result = await query(checkTableQuery);
    if (result.rows[0].exists) {
      return;
    }
    // Tables are created by migration, this is just for reference
  }

  /**
   * Create a new pharmacy group
   */
  static async create(groupData) {
    const {
      group_name,
      parent_company,
      tier = 'standard',
      description,
      commission_rate,
      created_by
    } = groupData;

    const insertQuery = `
      INSERT INTO pharmacy_groups (
        group_name, parent_company, tier, description,
        commission_rate, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      group_name,
      parent_company,
      tier,
      description,
      commission_rate,
      created_by
    ];

    const result = await query(insertQuery, values);
    return result.rows[0];
  }

  /**
   * Get group by ID
   */
  static async getById(groupId) {
    const selectQuery = `
      SELECT 
        g.*,
        COUNT(DISTINCT pgm.pharmacy_id) as pharmacy_count
      FROM pharmacy_groups g
      LEFT JOIN pharmacy_group_members pgm ON g.id = pgm.group_id
      WHERE g.id = $1
      GROUP BY g.id
    `;

    const result = await query(selectQuery, [groupId]);
    return result.rows[0];
  }

  /**
   * Get all groups with filters
   */
  static async getAll(filters = {}) {
    let selectQuery = `
      SELECT 
        g.*,
        COUNT(DISTINCT pgm.pharmacy_id) as pharmacy_count
      FROM pharmacy_groups g
      LEFT JOIN pharmacy_group_members pgm ON g.id = pgm.group_id
      WHERE 1=1
    `;

    const values = [];
    let paramCount = 1;

    if (filters.tier) {
      selectQuery += ` AND g.tier = $${paramCount}`;
      values.push(filters.tier);
      paramCount++;
    }

    if (filters.is_active !== undefined) {
      selectQuery += ` AND g.is_active = $${paramCount}`;
      values.push(filters.is_active);
      paramCount++;
    }

    selectQuery += `
      GROUP BY g.id
      ORDER BY g.tier DESC, g.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    values.push(filters.limit || 50);
    values.push(filters.offset || 0);

    const result = await query(selectQuery, values);
    return result.rows;
  }

  /**
   * Update group
   */
  static async update(groupId, updateData) {
    const {
      group_name,
      parent_company,
      tier,
      description,
      commission_rate,
      is_active
    } = updateData;

    const updateQuery = `
      UPDATE pharmacy_groups
      SET
        group_name = COALESCE($1, group_name),
        parent_company = COALESCE($2, parent_company),
        tier = COALESCE($3, tier),
        description = COALESCE($4, description),
        commission_rate = COALESCE($5, commission_rate),
        is_active = COALESCE($6, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `;

    const result = await query(updateQuery, [
      group_name,
      parent_company,
      tier,
      description,
      commission_rate,
      is_active,
      groupId
    ]);

    return result.rows[0];
  }

  /**
   * Add pharmacy to group
   */
  static async addPharmacy(groupId, pharmacyId, isPrimary = true) {
    // Check if pharmacy exists
    const pharmacyCheck = await query('SELECT id FROM pharmacies WHERE id = $1', [pharmacyId]);
    if (pharmacyCheck.rows.length === 0) {
      throw new Error('Pharmacy not found');
    }

    const insertQuery = `
      INSERT INTO pharmacy_group_members (group_id, pharmacy_id, is_primary)
      VALUES ($1, $2, $3)
      ON CONFLICT (pharmacy_id, group_id) DO UPDATE
      SET is_primary = $3, left_at = NULL
      RETURNING *
    `;

    const result = await query(insertQuery, [groupId, pharmacyId, isPrimary]);

    // Update pharmacy count in group
    await this.updatePharmacyCount(groupId);

    return result.rows[0];
  }

  /**
   * Remove pharmacy from group
   */
  static async removePharmacy(groupId, pharmacyId) {
    const deleteQuery = `
      UPDATE pharmacy_group_members
      SET left_at = CURRENT_TIMESTAMP
      WHERE group_id = $1 AND pharmacy_id = $2
      RETURNING *
    `;

    const result = await query(deleteQuery, [groupId, pharmacyId]);

    // Update pharmacy count in group
    await this.updatePharmacyCount(groupId);

    return result.rows[0];
  }

  /**
   * Get all pharmacies in a group
   */
  static async getPharmacies(groupId) {
    const selectQuery = `
      SELECT 
        p.*,
        pgm.is_primary,
        pgm.joined_at
      FROM pharmacy_group_members pgm
      JOIN pharmacies p ON pgm.pharmacy_id = p.id
      WHERE pgm.group_id = $1 AND pgm.left_at IS NULL
      ORDER BY pgm.is_primary DESC, p.pharmacy_name ASC
    `;

    const result = await query(selectQuery, [groupId]);
    return result.rows;
  }

  /**
   * Update pharmacy count for group
   */
  static async updatePharmacyCount(groupId) {
    const updateQuery = `
      UPDATE pharmacy_groups
      SET total_pharmacies = (
        SELECT COUNT(*) FROM pharmacy_group_members
        WHERE group_id = $1 AND left_at IS NULL
      )
      WHERE id = $1
    `;

    await query(updateQuery, [groupId]);
  }

  /**
   * Get group statistics
   */
  static async getStats(groupId) {
    const statsQuery = `
      SELECT
        g.id,
        g.group_name,
        g.tier,
        (SELECT COUNT(*) FROM pharmacy_group_members 
         WHERE group_id = $1 AND left_at IS NULL) as active_pharmacies,
        (SELECT COUNT(*) FROM pharmacy_agreements 
         WHERE pharmacy_or_group_id = $1 AND entity_type = 'group' 
         AND status = 'active') as active_agreements,
        (SELECT SUM(total_claims_handled) FROM pharmacy_groups WHERE id = $1) as total_claims,
        (SELECT SUM(total_revenue) FROM pharmacy_groups WHERE id = $1) as total_revenue,
        g.commission_rate,
        g.created_at
      FROM pharmacy_groups g
      WHERE g.id = $1
    `;

    const result = await query(statsQuery, [groupId]);
    return result.rows[0];
  }

  /**
   * Get groups by tier
   */
  static async getByTier(tier) {
    const selectQuery = `
      SELECT 
        g.*,
        COUNT(DISTINCT pgm.pharmacy_id) as pharmacy_count
      FROM pharmacy_groups g
      LEFT JOIN pharmacy_group_members pgm ON g.id = pgm.group_id
      WHERE g.tier = $1 AND g.is_active = true
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `;

    const result = await query(selectQuery, [tier]);
    return result.rows;
  }

  /**
   * Get primary pharmacy for a group
   */
  static async getPrimaryPharmacy(groupId) {
    const selectQuery = `
      SELECT p.*
      FROM pharmacy_group_members pgm
      JOIN pharmacies p ON pgm.pharmacy_id = p.id
      WHERE pgm.group_id = $1 AND pgm.is_primary = true AND pgm.left_at IS NULL
      LIMIT 1
    `;

    const result = await query(selectQuery, [groupId]);
    return result.rows[0];
  }

  /**
   * Deactivate group
   */
  static async deactivate(groupId) {
    const updateQuery = `
      UPDATE pharmacy_groups
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await query(updateQuery, [groupId]);
    return result.rows[0];
  }

  /**
   * Delete group
   */
  static async delete(groupId) {
    const deleteQuery = `
      DELETE FROM pharmacy_groups
      WHERE id = $1
      RETURNING *
    `;

    const result = await query(deleteQuery, [groupId]);
    return result.rows[0];
  }

  /**
   * Update group commission and revenue
   */
  static async updateFinancials(groupId, commissionRate, revenueIncrease) {
    const updateQuery = `
      UPDATE pharmacy_groups
      SET
        commission_rate = COALESCE($1, commission_rate),
        total_revenue = total_revenue + COALESCE($2, 0),
        total_claims_handled = total_claims_handled + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `;

    const result = await query(updateQuery, [commissionRate, revenueIncrease, groupId]);
    return result.rows[0];
  }

  /**
   * Search groups by name
   */
  static async search(searchTerm) {
    const searchQuery = `
      SELECT 
        g.*,
        COUNT(DISTINCT pgm.pharmacy_id) as pharmacy_count
      FROM pharmacy_groups g
      LEFT JOIN pharmacy_group_members pgm ON g.id = pgm.group_id
      WHERE g.group_name ILIKE $1 OR g.parent_company ILIKE $1
      GROUP BY g.id
      ORDER BY g.tier DESC, g.created_at DESC
      LIMIT 20
    `;

    const result = await query(searchQuery, [`%${searchTerm}%`]);
    return result.rows;
  }

  /**
   * Get default Basic group for new pharmacies
   */
  static async getDefaultGroup() {
    const selectQuery = `
      SELECT * FROM pharmacy_groups 
      WHERE group_name = 'Basic' AND tier = 'basic' AND is_default = true
      LIMIT 1;
    `;

    const result = await query(selectQuery);
    return result.rows[0];
  }

  /**
   * Get group by tier name
   */
  static async getGroupByTierName(tierName) {
    const selectQuery = `
      SELECT * FROM pharmacy_groups 
      WHERE tier = $1 AND is_active = true
      LIMIT 1;
    `;

    const result = await query(selectQuery, [tierName]);
    return result.rows[0];
  }

  /**
   * Upgrade pharmacy to new tier
   */
  static async upgradePharmacyTier(pharmacyId, fromGroupId, toGroupId) {
    try {
      // Remove from old group
      await query(`
        UPDATE pharmacy_group_members
        SET left_at = CURRENT_TIMESTAMP
        WHERE pharmacy_id = $1 AND group_id = $2;
      `, [pharmacyId, fromGroupId]);

      // Add to new group
      const result = await query(`
        INSERT INTO pharmacy_group_members (
          group_id, pharmacy_id, is_primary, joined_at
        ) VALUES ($1, $2, true, CURRENT_TIMESTAMP)
        RETURNING *;
      `, [toGroupId, pharmacyId]);

      return result.rows[0];
    } catch (error) {
      console.error('Error upgrading pharmacy tier:', error);
      throw error;
    }
  }
}

module.exports = PharmacyGroup;
