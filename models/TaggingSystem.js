const { query } = require('../config/db');

/**
 * Tagging System Model
 * Supports tagging across all profile sections
 */

class TaggingSystem {
  /**
   * Create tagging tables
   */
  static async createTables() {
    const createTablesQuery = `
      -- Tags (reusable across profile)
      CREATE TABLE IF NOT EXISTS patient_tags (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL,
        tag_name VARCHAR(100) NOT NULL,
        tag_color VARCHAR(7),
        description TEXT,
        usage_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
        UNIQUE(patient_id, tag_name)
      );

      -- Tag assignments to any profile item
      CREATE TABLE IF NOT EXISTS patient_tag_assignments (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        item_type VARCHAR(100) NOT NULL CHECK (item_type IN (
          'allergy', 'condition', 'medication', 'vaccination', 'test_result',
          'provider', 'lifestyle_data', 'directive', 'custom_category', 'file'
        )),
        item_id INTEGER NOT NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES patient_tags(id) ON DELETE CASCADE,
        UNIQUE(tag_id, item_type, item_id)
      );

      -- Full-text search index
      CREATE TABLE IF NOT EXISTS patient_search_index (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL,
        searchable_text TEXT,
        item_type VARCHAR(100),
        item_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_patient_tags_patient_id ON patient_tags(patient_id);
      CREATE INDEX IF NOT EXISTS idx_patient_tags_name ON patient_tags(tag_name);
      CREATE INDEX IF NOT EXISTS idx_patient_tag_assignments_patient_id ON patient_tag_assignments(patient_id);
      CREATE INDEX IF NOT EXISTS idx_patient_tag_assignments_tag_id ON patient_tag_assignments(tag_id);
      CREATE INDEX IF NOT EXISTS idx_patient_tag_assignments_item ON patient_tag_assignments(item_type, item_id);
      CREATE INDEX IF NOT EXISTS idx_patient_search_index_patient_id ON patient_search_index(patient_id);
      CREATE INDEX IF NOT EXISTS idx_patient_search_index_text ON patient_search_index USING GIN(to_tsvector('english', searchable_text));

      -- Create full-text search trigger
      CREATE OR REPLACE FUNCTION update_search_index() RETURNS TRIGGER AS $$
      BEGIN
        DELETE FROM patient_search_index WHERE item_type = TG_ARGV[0] AND item_id = NEW.id;
        INSERT INTO patient_search_index (patient_id, searchable_text, item_type, item_id)
        VALUES (NEW.patient_id, TG_ARGV[1], TG_ARGV[0], NEW.id);
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `;

    try {
      await query(createTablesQuery);
      console.log('✅ Tagging system tables created successfully');
    } catch (error) {
      console.error('❌ Error creating tagging system tables:', error);
      throw error;
    }
  }

  /**
   * Create a new tag
   */
  static async createTag(patientId, tagName, tagColor = '#2196F3', description = null) {
    const insertQuery = `
      INSERT INTO patient_tags (patient_id, tag_name, tag_color, description)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (patient_id, tag_name) DO UPDATE SET
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    try {
      const result = await query(insertQuery, [patientId, tagName, tagColor, description]);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating tag:', error);
      throw error;
    }
  }

  /**
   * Assign tag to an item
   */
  static async assignTag(patientId, tagId, itemType, itemId) {
    const assignQuery = `
      INSERT INTO patient_tag_assignments (patient_id, tag_id, item_type, item_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (tag_id, item_type, item_id) DO NOTHING
      RETURNING *
    `;

    try {
      const result = await query(assignQuery, [patientId, tagId, itemType, itemId]);
      if (result.rows.length > 0) {
        // Increment usage count
        await query('UPDATE patient_tags SET usage_count = usage_count + 1 WHERE id = $1', [tagId]);
      }
      return result.rows[0];
    } catch (error) {
      console.error('Error assigning tag:', error);
      throw error;
    }
  }

  /**
   * Remove tag from item
   */
  static async removeTag(tagId, itemType, itemId) {
    const removeQuery = `
      DELETE FROM patient_tag_assignments
      WHERE tag_id = $1 AND item_type = $2 AND item_id = $3
      RETURNING *
    `;

    try {
      const result = await query(removeQuery, [tagId, itemType, itemId]);
      if (result.rows.length > 0) {
        // Decrement usage count
        await query('UPDATE patient_tags SET usage_count = GREATEST(usage_count - 1, 0) WHERE id = $1', [tagId]);
      }
      return result.rows[0];
    } catch (error) {
      console.error('Error removing tag:', error);
      throw error;
    }
  }

  /**
   * Get all tags for a patient
   */
  static async getPatientTags(patientId) {
    const selectQuery = `
      SELECT * FROM patient_tags
      WHERE patient_id = $1
      ORDER BY usage_count DESC, created_at DESC
    `;

    try {
      const result = await query(selectQuery, [patientId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching patient tags:', error);
      throw error;
    }
  }

  /**
   * Search across all profile items
   */
  static async search(patientId, searchTerm, itemTypes = null, tags = null) {
    let searchQuery = `
      SELECT DISTINCT
        si.item_type,
        si.item_id,
        si.searchable_text,
        si.created_at,
        string_agg(DISTINCT pt.tag_name, ', ') as tags
      FROM patient_search_index si
      LEFT JOIN patient_tag_assignments pta ON si.item_type = pta.item_type AND si.item_id = pta.item_id
      LEFT JOIN patient_tags pt ON pta.tag_id = pt.id
      WHERE si.patient_id = $1
        AND to_tsvector('english', si.searchable_text) @@ plainto_tsquery('english', $2)
    `;

    const params = [patientId, searchTerm];
    let paramCount = 2;

    if (itemTypes && itemTypes.length > 0) {
      paramCount++;
      searchQuery += ` AND si.item_type = ANY($${paramCount}::text[])`;
      params.push(itemTypes);
    }

    searchQuery += ` GROUP BY si.item_type, si.item_id, si.searchable_text, si.created_at ORDER BY si.created_at DESC`;

    try {
      const result = await query(searchQuery, params);
      return result.rows;
    } catch (error) {
      console.error('Error searching profile:', error);
      throw error;
    }
  }

  /**
   * Filter items by tags
   */
  static async filterByTags(patientId, tagIds) {
    const filterQuery = `
      SELECT DISTINCT
        pta.item_type,
        pta.item_id,
        string_agg(DISTINCT pt.tag_name, ', ') as tags
      FROM patient_tag_assignments pta
      JOIN patient_tags pt ON pta.tag_id = pt.id
      WHERE pta.patient_id = $1
        AND pta.tag_id = ANY($2::integer[])
      GROUP BY pta.item_type, pta.item_id
    `;

    try {
      const result = await query(filterQuery, [patientId, tagIds]);
      return result.rows;
    } catch (error) {
      console.error('Error filtering by tags:', error);
      throw error;
    }
  }

  /**
   * Get items by tag
   */
  static async getItemsByTag(patientId, tagId, itemType) {
    const selectQuery = `
      SELECT pta.*
      FROM patient_tag_assignments pta
      WHERE pta.patient_id = $1
        AND pta.tag_id = $2
        ${itemType ? 'AND pta.item_type = $3' : ''}
      ORDER BY pta.assigned_at DESC
    `;

    try {
      const params = [patientId, tagId];
      if (itemType) params.push(itemType);
      
      const result = await query(selectQuery, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting items by tag:', error);
      throw error;
    }
  }

  /**
   * Update tag
   */
  static async updateTag(tagId, updates) {
    const { tag_name, tag_color, description } = updates;
    const updateQuery = `
      UPDATE patient_tags
      SET 
        tag_name = COALESCE($2, tag_name),
        tag_color = COALESCE($3, tag_color),
        description = COALESCE($4, description),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    try {
      const result = await query(updateQuery, [tagId, tag_name, tag_color, description]);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating tag:', error);
      throw error;
    }
  }

  /**
   * Delete tag
   */
  static async deleteTag(tagId) {
    const deleteQuery = `
      DELETE FROM patient_tags
      WHERE id = $1
      RETURNING *
    `;

    try {
      const result = await query(deleteQuery, [tagId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error deleting tag:', error);
      throw error;
    }
  }
}

module.exports = TaggingSystem;
