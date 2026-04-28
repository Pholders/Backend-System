const { query } = require('../config/db');

/**
 * Version History & Audit Trail Model
 * Tracks all changes to patient profile data
 */

class VersionHistory {
  /**
   * Create version history tables
   */
  static async createTables() {
    const createTablesQuery = `
      -- Version history for all profile changes
      CREATE TABLE IF NOT EXISTS patient_profile_history (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL,
        item_type VARCHAR(100) NOT NULL CHECK (item_type IN (
          'allergy', 'condition', 'medication', 'vaccination', 'test_result',
          'provider', 'lifestyle_data', 'directive', 'custom_category', 
          'personal_details', 'emergency_contact', 'contact_history', 'digital_identifier'
        )),
        item_id INTEGER NOT NULL,
        action VARCHAR(20) NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'RESTORE')),
        modified_by INTEGER NOT NULL,
        previous_values JSONB,
        new_values JSONB,
        change_summary TEXT,
        change_reason TEXT,
        ip_address VARCHAR(50),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
        FOREIGN KEY (modified_by) REFERENCES patients(id) ON DELETE RESTRICT
      );

      -- Category rename history
      CREATE TABLE IF NOT EXISTS category_rename_history (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL,
        category_id INTEGER,
        category_type VARCHAR(100),
        old_name VARCHAR(255),
        new_name VARCHAR(255),
        renamed_by INTEGER NOT NULL,
        renamed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
        FOREIGN KEY (renamed_by) REFERENCES patients(id) ON DELETE RESTRICT
      );

      -- Restore/recovery log
      CREATE TABLE IF NOT EXISTS patient_restore_log (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL,
        history_id INTEGER NOT NULL,
        item_type VARCHAR(100),
        item_id INTEGER,
        restored_by INTEGER NOT NULL,
        restored_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        restore_reason TEXT,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
        FOREIGN KEY (history_id) REFERENCES patient_profile_history(id) ON DELETE SET NULL,
        FOREIGN KEY (restored_by) REFERENCES patients(id) ON DELETE RESTRICT
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_profile_history_patient_id ON patient_profile_history(patient_id);
      CREATE INDEX IF NOT EXISTS idx_profile_history_item ON patient_profile_history(item_type, item_id);
      CREATE INDEX IF NOT EXISTS idx_profile_history_action ON patient_profile_history(action);
      CREATE INDEX IF NOT EXISTS idx_profile_history_created_at ON patient_profile_history(created_at);
      CREATE INDEX IF NOT EXISTS idx_category_rename_patient_id ON category_rename_history(patient_id);
      CREATE INDEX IF NOT EXISTS idx_restore_log_patient_id ON patient_restore_log(patient_id);
    `;

    try {
      await query(createTablesQuery);
      console.log('✅ Version history tables created successfully');
    } catch (error) {
      console.error('❌ Error creating version history tables:', error);
      throw error;
    }
  }

  /**
   * Record a change to profile data
   */
  static async recordChange(changeData) {
    const {
      patientId,
      itemType,
      itemId,
      action,
      modifiedBy,
      previousValues = null,
      newValues = null,
      changeSummary = null,
      changeReason = null,
      ipAddress = null,
      userAgent = null
    } = changeData;

    const insertQuery = `
      INSERT INTO patient_profile_history (
        patient_id, item_type, item_id, action, modified_by,
        previous_values, new_values, change_summary, change_reason,
        ip_address, user_agent
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    try {
      const result = await query(insertQuery, [
        patientId,
        itemType,
        itemId,
        action,
        modifiedBy,
        previousValues ? JSON.stringify(previousValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        changeSummary,
        changeReason,
        ipAddress,
        userAgent
      ]);

      return result.rows[0];
    } catch (error) {
      console.error('Error recording change:', error);
      throw error;
    }
  }

  /**
   * Get audit trail for specific item
   */
  static async getItemHistory(itemType, itemId, patientId) {
    const selectQuery = `
      SELECT 
        pph.*,
        p.first_name,
        p.last_name,
        p.email
      FROM patient_profile_history pph
      LEFT JOIN patients p ON pph.modified_by = p.id
      WHERE pph.patient_id = $1
        AND pph.item_type = $2
        AND pph.item_id = $3
      ORDER BY pph.created_at DESC
    `;

    try {
      const result = await query(selectQuery, [patientId, itemType, itemId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching item history:', error);
      throw error;
    }
  }

  /**
   * Get recent changes for patient
   */
  static async getRecentChanges(patientId, limit = 50, offsetDays = 30) {
    const selectQuery = `
      SELECT 
        pph.*,
        p.first_name,
        p.last_name,
        p.email
      FROM patient_profile_history pph
      LEFT JOIN patients p ON pph.modified_by = p.id
      WHERE pph.patient_id = $1
        AND pph.created_at > NOW() - INTERVAL '${offsetDays} days'
      ORDER BY pph.created_at DESC
      LIMIT $2
    `;

    try {
      const result = await query(selectQuery, [patientId, limit]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching recent changes:', error);
      throw error;
    }
  }

  /**
   * Get full audit trail for patient
   */
  static async getFullAuditTrail(patientId, filters = {}) {
    const { itemType = null, action = null, startDate = null, endDate = null } = filters;

    let selectQuery = `
      SELECT 
        pph.*,
        p.first_name,
        p.last_name,
        p.email
      FROM patient_profile_history pph
      LEFT JOIN patients p ON pph.modified_by = p.id
      WHERE pph.patient_id = $1
    `;

    const params = [patientId];
    let paramCount = 1;

    if (itemType) {
      paramCount++;
      selectQuery += ` AND pph.item_type = $${paramCount}`;
      params.push(itemType);
    }

    if (action) {
      paramCount++;
      selectQuery += ` AND pph.action = $${paramCount}`;
      params.push(action);
    }

    if (startDate) {
      paramCount++;
      selectQuery += ` AND pph.created_at >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      selectQuery += ` AND pph.created_at <= $${paramCount}`;
      params.push(endDate);
    }

    selectQuery += ` ORDER BY pph.created_at DESC`;

    try {
      const result = await query(selectQuery, params);
      return result.rows;
    } catch (error) {
      console.error('Error fetching full audit trail:', error);
      throw error;
    }
  }

  /**
   * Record category rename
   */
  static async recordCategoryRename(patientId, categoryId, categoryType, oldName, newName, renamedBy) {
    const insertQuery = `
      INSERT INTO category_rename_history (
        patient_id, category_id, category_type, old_name, new_name, renamed_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    try {
      const result = await query(insertQuery, [
        patientId,
        categoryId,
        categoryType,
        oldName,
        newName,
        renamedBy
      ]);

      return result.rows[0];
    } catch (error) {
      console.error('Error recording category rename:', error);
      throw error;
    }
  }

  /**
   * Get category rename history
   */
  static async getCategoryRenameHistory(patientId, categoryId = null) {
    let selectQuery = `
      SELECT 
        crh.*,
        p.first_name,
        p.last_name
      FROM category_rename_history crh
      LEFT JOIN patients p ON crh.renamed_by = p.id
      WHERE crh.patient_id = $1
    `;

    const params = [patientId];

    if (categoryId) {
      selectQuery += ` AND crh.category_id = $2`;
      params.push(categoryId);
    }

    selectQuery += ` ORDER BY crh.renamed_at DESC`;

    try {
      const result = await query(selectQuery, params);
      return result.rows;
    } catch (error) {
      console.error('Error fetching category rename history:', error);
      throw error;
    }
  }

  /**
   * Record item restoration
   */
  static async recordRestore(patientId, historyId, itemType, itemId, restoredBy, restoreReason) {
    const insertQuery = `
      INSERT INTO patient_restore_log (
        patient_id, history_id, item_type, item_id, restored_by, restore_reason
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    try {
      const result = await query(insertQuery, [
        patientId,
        historyId,
        itemType,
        itemId,
        restoredBy,
        restoreReason
      ]);

      return result.rows[0];
    } catch (error) {
      console.error('Error recording restore:', error);
      throw error;
    }
  }

  /**
   * Get restore log
   */
  static async getRestoreLog(patientId, limit = 50) {
    const selectQuery = `
      SELECT 
        prl.*,
        p.first_name,
        p.last_name
      FROM patient_restore_log prl
      LEFT JOIN patients p ON prl.restored_by = p.id
      WHERE prl.patient_id = $1
      ORDER BY prl.restored_at DESC
      LIMIT $2
    `;

    try {
      const result = await query(selectQuery, [patientId, limit]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching restore log:', error);
      throw error;
    }
  }

  /**
   * Generate audit report
   */
  static async generateAuditReport(patientId, startDate, endDate) {
    const reportQuery = `
      SELECT 
        DATE(pph.created_at) as date,
        pph.action,
        pph.item_type,
        COUNT(*) as change_count,
        string_agg(DISTINCT p.email, ', ') as modified_by_users
      FROM patient_profile_history pph
      LEFT JOIN patients p ON pph.modified_by = p.id
      WHERE pph.patient_id = $1
        AND pph.created_at >= $2
        AND pph.created_at <= $3
      GROUP BY DATE(pph.created_at), pph.action, pph.item_type
      ORDER BY date DESC, action
    `;

    try {
      const result = await query(reportQuery, [patientId, startDate, endDate]);
      return result.rows;
    } catch (error) {
      console.error('Error generating audit report:', error);
      throw error;
    }
  }
}

module.exports = VersionHistory;
