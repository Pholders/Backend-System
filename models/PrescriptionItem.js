const { query } = require('../config/db');

/**
 * Prescription Item Model
 * Handles individual medicines in a prescription
 */

class PrescriptionItem {
  /**
   * Create a new prescription item (medicine)
   */
  static async create(itemData) {
    const {
      prescription_id,
      medicine_name,
      generic_name,
      dosage,
      dosage_form,
      quantity,
      quantity_unit,
      frequency,
      route_of_administration,
      duration,
      special_instructions,
      schedule_classification,
      possible_interactions,
      contraindications,
      warnings
    } = itemData;

    const createQuery = `
      INSERT INTO prescription_items (
        prescription_id, medicine_name, generic_name, dosage, dosage_form,
        quantity, quantity_unit, frequency, route_of_administration, duration,
        special_instructions, schedule_classification, possible_interactions,
        contraindications, warnings
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *;
    `;

    try {
      const result = await query(createQuery, [
        prescription_id,
        medicine_name,
        generic_name,
        dosage,
        dosage_form,
        quantity,
        quantity_unit,
        frequency,
        route_of_administration,
        duration,
        special_instructions,
        schedule_classification,
        JSON.stringify(possible_interactions || []),
        JSON.stringify(contraindications || []),
        warnings
      ]);

      return result.rows[0];
    } catch (error) {
      console.error('❌ Error creating prescription item:', error);
      throw error;
    }
  }

  /**
   * Get items for a prescription
   */
  static async getByPrescriptionId(prescriptionId) {
    const getQuery = `
      SELECT * FROM prescription_items
      WHERE prescription_id = $1
      ORDER BY id;
    `;

    try {
      const result = await query(getQuery, [prescriptionId]);
      return result.rows;
    } catch (error) {
      console.error('❌ Error fetching prescription items:', error);
      throw error;
    }
  }

  /**
   * Update prescription item
   */
  static async update(itemId, itemData) {
    const {
      medicine_name,
      generic_name,
      dosage,
      dosage_form,
      quantity,
      quantity_unit,
      frequency,
      route_of_administration,
      duration,
      special_instructions,
      schedule_classification,
      warnings
    } = itemData;

    const updateQuery = `
      UPDATE prescription_items
      SET medicine_name = COALESCE($1, medicine_name),
          generic_name = COALESCE($2, generic_name),
          dosage = COALESCE($3, dosage),
          dosage_form = COALESCE($4, dosage_form),
          quantity = COALESCE($5, quantity),
          quantity_unit = COALESCE($6, quantity_unit),
          frequency = COALESCE($7, frequency),
          route_of_administration = COALESCE($8, route_of_administration),
          duration = COALESCE($9, duration),
          special_instructions = COALESCE($10, special_instructions),
          schedule_classification = COALESCE($11, schedule_classification),
          warnings = COALESCE($12, warnings),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $13
      RETURNING *;
    `;

    try {
      const result = await query(updateQuery, [
        medicine_name,
        generic_name,
        dosage,
        dosage_form,
        quantity,
        quantity_unit,
        frequency,
        route_of_administration,
        duration,
        special_instructions,
        schedule_classification,
        warnings,
        itemId
      ]);

      return result.rows[0];
    } catch (error) {
      console.error('❌ Error updating prescription item:', error);
      throw error;
    }
  }

  /**
   * Delete prescription item
   */
  static async delete(itemId) {
    const deleteQuery = `
      DELETE FROM prescription_items WHERE id = $1 RETURNING *;
    `;

    try {
      const result = await query(deleteQuery, [itemId]);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error deleting prescription item:', error);
      throw error;
    }
  }
}

module.exports = PrescriptionItem;
