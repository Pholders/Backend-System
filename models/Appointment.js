const { query } = require('../config/db');

/**
 * Appointment Model
 * Handles all database operations for doctor appointments
 */

class Appointment {
  /**
   * Create the appointments table
   */
  static async createTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY,
        doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        appointment_date DATE NOT NULL,
        time_period VARCHAR(20) NOT NULL CHECK (time_period IN ('morning', 'afternoon', 'evening', 'night')),
        time_slot VARCHAR(10) NOT NULL,
        consultation_fee DECIMAL(10, 2) NOT NULL,
        reason_for_visit TEXT,
        status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no-show', 'rescheduled')),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date ON appointments(doctor_id, appointment_date);
      CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
      CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
    `;
    
    try {
      await query(createTableQuery);
      console.log('✅ Appointments table created successfully');
    } catch (error) {
      console.error('❌ Error creating appointments table:', error);
      throw error;
    }
  }

  /**
   * Book a new appointment
   */
  static async create(appointmentData) {
    const {
      doctor_id,
      patient_id,
      appointment_date,
      time_period,
      time_slot,
      consultation_fee,
      reason_for_visit
    } = appointmentData;

    const insertQuery = `
      INSERT INTO appointments (
        doctor_id, patient_id, appointment_date, time_period, 
        time_slot, consultation_fee, reason_for_visit, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled')
      RETURNING *
    `;

    const values = [
      doctor_id,
      patient_id,
      appointment_date,
      time_period,
      time_slot,
      consultation_fee,
      reason_for_visit || null
    ];

    const result = await query(insertQuery, values);
    return result.rows[0];
  }

  /**
   * Get appointment by ID
   */
  static async findById(id) {
    const result = await query(
      `SELECT a.*, 
              d.first_name as doctor_first_name, d.last_name as doctor_last_name, 
              d.specialization, d.phone as doctor_phone,
              u.first_name as patient_first_name, u.last_name as patient_last_name
       FROM appointments a
       LEFT JOIN doctors d ON a.doctor_id = d.id
       LEFT JOIN patients u ON a.patient_id = u.id
       WHERE a.id = $1`,
      [id]
    );
    return result.rows[0];
  }

  /**
   * Get all appointments for a patient
   */
  static async findByPatient(patient_id) {
    const result = await query(
      `SELECT a.*, 
              d.first_name as doctor_first_name, d.last_name as doctor_last_name, 
              d.specialization, d.phone as doctor_phone, d.clinic_name, d.city
       FROM appointments a
       LEFT JOIN doctors d ON a.doctor_id = d.id
       WHERE a.patient_id = $1
       ORDER BY a.appointment_date DESC, a.time_slot DESC`,
      [patient_id]
    );
    return result.rows;
  }

  /**
   * Get all appointments for a doctor
   */
  static async findByDoctor(doctor_id) {
    const result = await query(
      `SELECT a.*, 
              u.first_name as patient_first_name, u.last_name as patient_last_name,
              u.email as patient_email, u.phone as patient_phone
       FROM appointments a
       LEFT JOIN patients u ON a.patient_id = u.id
       WHERE a.doctor_id = $1
       ORDER BY a.appointment_date ASC, a.time_slot ASC`,
      [doctor_id]
    );
    return result.rows;
  }

  /**
   * Get appointments for a doctor on a specific date
   */
  static async findByDoctorAndDate(doctor_id, appointment_date) {
    const result = await query(
      `SELECT * FROM appointments 
       WHERE doctor_id = $1 AND appointment_date = $2
       ORDER BY time_slot ASC`,
      [doctor_id, appointment_date]
    );
    return result.rows;
  }

  /**
   * Cancel an appointment
   */
  static async cancel(appointment_id) {
    const result = await query(
      `UPDATE appointments 
       SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [appointment_id]
    );
    return result.rows[0];
  }

  /**
   * Reschedule an appointment
   */
  static async reschedule(appointment_id, new_date, new_time_period, new_time_slot) {
    const result = await query(
      `UPDATE appointments 
       SET appointment_date = $2, time_period = $3, time_slot = $4, 
           status = 'rescheduled', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [appointment_id, new_date, new_time_period, new_time_slot]
    );
    return result.rows[0];
  }

  /**
   * Update appointment status
   */
  static async updateStatus(appointment_id, status) {
    const result = await query(
      `UPDATE appointments 
       SET status = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [appointment_id, status]
    );
    return result.rows[0];
  }

  /**
   * Get patient's upcoming appointments
   */
  static async getUpcomingAppointments(patient_id, limit = 10) {
    const result = await query(
      `SELECT a.*, 
              d.first_name as doctor_first_name, d.last_name as doctor_last_name, 
              d.specialization, d.phone as doctor_phone, d.clinic_name, d.city
       FROM appointments a
       LEFT JOIN doctors d ON a.doctor_id = d.id
       WHERE a.patient_id = $1 
       AND a.appointment_date >= CURRENT_DATE
       AND a.status IN ('scheduled', 'rescheduled')
       ORDER BY a.appointment_date ASC, a.time_slot ASC
       LIMIT $2`,
      [patient_id, limit]
    );
    return result.rows;
  }

  /**
   * Get doctor's upcoming appointments
   */
  static async getDoctorUpcomingAppointments(doctor_id, limit = 20) {
    const result = await query(
      `SELECT a.*, 
              u.first_name as patient_first_name, u.last_name as patient_last_name,
              u.email as patient_email, u.phone as patient_phone
       FROM appointments a
       LEFT JOIN patients u ON a.patient_id = u.id
       WHERE a.doctor_id = $1 
       AND a.appointment_date >= CURRENT_DATE
       AND a.status IN ('scheduled', 'rescheduled')
       ORDER BY a.appointment_date ASC, a.time_slot ASC
       LIMIT $2`,
      [doctor_id, limit]
    );
    return result.rows;
  }

  /**
   * Check if time slot is available for a doctor on a specific date
   */
  static async isTimeSlotAvailable(doctor_id, appointment_date, time_period, time_slot) {
    const result = await query(
      `SELECT COUNT(*) as count FROM appointments 
       WHERE doctor_id = $1 
       AND appointment_date = $2 
       AND time_period = $3 
       AND time_slot = $4
       AND status IN ('scheduled', 'rescheduled')`,
      [doctor_id, appointment_date, time_period, time_slot]
    );
    return result.rows[0].count === '0';
  }

  /**
   * Get available time slots for a doctor on a specific date and time period
   */
  static async getAvailableSlots(doctor_id, appointment_date, time_period) {
    const bookedSlots = await query(
      `SELECT time_slot FROM appointments 
       WHERE doctor_id = $1 
       AND appointment_date = $2 
       AND time_period = $3
       AND status IN ('scheduled', 'rescheduled')`,
      [doctor_id, appointment_date, time_period]
    );

    const bookedSlotsList = bookedSlots.rows.map(slot => slot.time_slot);
    const allSlots = Appointment.getTimeSlots(time_period);
    const availableSlots = allSlots.filter(slot => !bookedSlotsList.includes(slot));

    return availableSlots;
  }

  /**
   * Generate time slots based on time period
   * Returns array of time slot strings
   */
  static getTimeSlots(time_period) {
    const slots = {
      morning: ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30'],
      afternoon: ['12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30'],
      evening: ['16:00', '16:30', '17:00', '17:30', '18:00', '18:30'],
      night: ['19:00', '19:30', '20:00', '20:30', '21:00']
    };
    return slots[time_period] || [];
  }

  /**
   * Get all available doctors for a specific date and time period
   */
  static async getAvailableDoctors(appointment_date, time_period) {
    const result = await query(
      `SELECT DISTINCT d.* FROM doctors d
       WHERE d.status = 'active'
       AND d.id NOT IN (
         SELECT doctor_id FROM appointments
         WHERE appointment_date = $1
         AND time_period = $2
         AND status IN ('scheduled', 'rescheduled')
         GROUP BY doctor_id
         HAVING COUNT(*) >= 8
       )
       ORDER BY d.specialization ASC, d.first_name ASC`,
      [appointment_date, time_period]
    );
    return result.rows;
  }

  /**
   * Check if a patient has ever had a completed appointment with a doctor
   */
  static async hasPatientVisitedDoctor(doctor_id, patient_id) {
    try {
      const result = await query(
        `SELECT COUNT(*) as count FROM appointments
         WHERE doctor_id = $1 AND patient_id = $2 AND status = 'completed'`,
        [doctor_id, patient_id]
      );
      return result.rows[0].count > 0;
    } catch (error) {
      console.error('Error checking patient visit history:', error);
      return false;
    }
  }

  /**
   * Get appointments by patient and status
   */
  static async getByPatientIdAndStatus(patient_id, status) {
    try {
      const result = await query(
        `SELECT * FROM appointments WHERE patient_id = $1 AND status = $2 ORDER BY created_at DESC`,
        [patient_id, status]
      );
      return result.rows;
    } catch (error) {
      console.error('Error fetching appointments by status:', error);
      return [];
    }
  }
}

module.exports = Appointment;
