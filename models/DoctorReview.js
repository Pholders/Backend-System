const pool = require('../config/db');

class DoctorReview {
  /**
   * Create reviews table if it doesn't exist
   */
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS doctor_reviews (
        id SERIAL PRIMARY KEY,
        doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        review_text TEXT,
        is_verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(doctor_id, patient_id)
      );

      CREATE INDEX IF NOT EXISTS idx_doctor_reviews_doctor_id ON doctor_reviews(doctor_id);
      CREATE INDEX IF NOT EXISTS idx_doctor_reviews_patient_id ON doctor_reviews(patient_id);
      CREATE INDEX IF NOT EXISTS idx_doctor_reviews_rating ON doctor_reviews(rating);
      CREATE INDEX IF NOT EXISTS idx_doctor_reviews_created_at ON doctor_reviews(created_at);
    `;

    try {
      await pool.query(query);
      console.log('✅ Doctor reviews table created successfully');
    } catch (error) {
      console.error('❌ Error creating doctor_reviews table:', error);
      throw error;
    }
  }

  /**
   * Create a new review
   */
  static async create(doctorId, patientId, rating, reviewText = null) {
    const query = `
      INSERT INTO doctor_reviews (doctor_id, patient_id, rating, review_text, is_verified)
      VALUES ($1, $2, $3, $4, true)
      ON CONFLICT (doctor_id, patient_id) 
      DO UPDATE SET 
        rating = $3,
        review_text = $4,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;

    try {
      const result = await pool.query(query, [doctorId, patientId, rating, reviewText]);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating/updating review:', error);
      throw error;
    }
  }

  /**
   * Get all reviews for a doctor
   */
  static async getByDoctorId(doctorId, limit = 10, offset = 0) {
    const query = `
      SELECT 
        dr.id,
        dr.doctor_id,
        dr.patient_id,
        dr.rating,
        dr.review_text,
        dr.is_verified,
        dr.created_at,
        dr.updated_at,
        u.first_name,
        u.last_name
      FROM doctor_reviews dr
      LEFT JOIN patients u ON dr.patient_id = u.id
      WHERE dr.doctor_id = $1
      ORDER BY dr.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    try {
      const result = await pool.query(query, [doctorId, limit, offset]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching reviews for doctor:', error);
      throw error;
    }
  }

  /**
   * Get review count for a doctor
   */
  static async getReviewCount(doctorId) {
    const query = `
      SELECT COUNT(*) as total_reviews FROM doctor_reviews WHERE doctor_id = $1;
    `;

    try {
      const result = await pool.query(query, [doctorId]);
      return result.rows[0].total_reviews;
    } catch (error) {
      console.error('Error fetching review count:', error);
      throw error;
    }
  }

  /**
   * Get average rating for a doctor
   */
  static async getAverageRating(doctorId) {
    const query = `
      SELECT 
        ROUND(AVG(rating)::NUMERIC, 2) as average_rating,
        COUNT(*) as total_reviews,
        MAX(rating) as highest_rating,
        MIN(rating) as lowest_rating,
        ROUND((COUNT(CASE WHEN rating = 5 THEN 1 END)::NUMERIC / COUNT(*) * 100), 1) as five_star_percentage,
        ROUND((COUNT(CASE WHEN rating = 4 THEN 1 END)::NUMERIC / COUNT(*) * 100), 1) as four_star_percentage,
        ROUND((COUNT(CASE WHEN rating = 3 THEN 1 END)::NUMERIC / COUNT(*) * 100), 1) as three_star_percentage,
        ROUND((COUNT(CASE WHEN rating = 2 THEN 1 END)::NUMERIC / COUNT(*) * 100), 1) as two_star_percentage,
        ROUND((COUNT(CASE WHEN rating = 1 THEN 1 END)::NUMERIC / COUNT(*) * 100), 1) as one_star_percentage
      FROM doctor_reviews 
      WHERE doctor_id = $1;
    `;

    try {
      const result = await pool.query(query, [doctorId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error fetching average rating:', error);
      throw error;
    }
  }

  /**
   * Get rating distribution for a doctor
   */
  static async getRatingDistribution(doctorId) {
    const query = `
      SELECT 
        rating,
        COUNT(*) as count
      FROM doctor_reviews
      WHERE doctor_id = $1
      GROUP BY rating
      ORDER BY rating DESC;
    `;

    try {
      const result = await pool.query(query, [doctorId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching rating distribution:', error);
      throw error;
    }
  }

  /**
   * Get a specific review by ID
   */
  static async getById(reviewId) {
    const query = `
      SELECT 
        dr.id,
        dr.doctor_id,
        dr.patient_id,
        dr.rating,
        dr.review_text,
        dr.is_verified,
        dr.created_at,
        dr.updated_at,
        u.first_name,
        u.last_name,
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name
      FROM doctor_reviews dr
      LEFT JOIN patients u ON dr.patient_id = u.id
      LEFT JOIN doctors d ON dr.doctor_id = d.id
      WHERE dr.id = $1;
    `;

    try {
      const result = await pool.query(query, [reviewId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error fetching review:', error);
      throw error;
    }
  }

  /**
   * Get review by doctor and patient (check if patient already reviewed)
   */
  static async getByDoctorAndPatient(doctorId, patientId) {
    const query = `
      SELECT * FROM doctor_reviews 
      WHERE doctor_id = $1 AND patient_id = $2;
    `;

    try {
      const result = await pool.query(query, [doctorId, patientId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error fetching review:', error);
      throw error;
    }
  }

  /**
   * Update a review
   */
  static async update(reviewId, rating, reviewText) {
    const query = `
      UPDATE doctor_reviews
      SET rating = $2, review_text = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;

    try {
      const result = await pool.query(query, [reviewId, rating, reviewText]);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating review:', error);
      throw error;
    }
  }

  /**
   * Delete a review
   */
  static async delete(reviewId) {
    const query = `
      DELETE FROM doctor_reviews WHERE id = $1
      RETURNING *;
    `;

    try {
      const result = await pool.query(query, [reviewId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error deleting review:', error);
      throw error;
    }
  }

  /**
   * Get patient reviews
   */
  static async getByPatientId(patientId, limit = 10, offset = 0) {
    const query = `
      SELECT 
        dr.id,
        dr.doctor_id,
        dr.patient_id,
        dr.rating,
        dr.review_text,
        dr.is_verified,
        dr.created_at,
        dr.updated_at,
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name,
        d.specialization,
        d.clinic_name,
        d.city
      FROM doctor_reviews dr
      LEFT JOIN doctors d ON dr.doctor_id = d.id
      WHERE dr.patient_id = $1
      ORDER BY dr.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    try {
      const result = await pool.query(query, [patientId, limit, offset]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching patient reviews:', error);
      throw error;
    }
  }
}

module.exports = DoctorReview;
