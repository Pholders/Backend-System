const { query } = require('../config/db');

const DEFAULT_OPEN_TIME = '09:00';
const DEFAULT_CLOSE_TIME = '17:00';
const SLOT_INTERVAL_MINUTES = 30;
const PERIOD_RANGES = {
  morning: { start: '05:00', end: '11:59' },
  afternoon: { start: '12:00', end: '15:59' },
  evening: { start: '16:00', end: '18:59' },
  night: { start: '19:00', end: '23:59' },
};

/**
 * Appointment Model
 * Handles all database operations for doctor appointments
 */

class Appointment {
  static parseTimeToMinutes(timeValue) {
    if (typeof timeValue !== 'string') {
      return null;
    }

    const match = timeValue.match(/^(\d{2}):(\d{2})$/);
    if (!match) {
      return null;
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) {
      return null;
    }

    return hours * 60 + minutes;
  }

  static formatMinutes(totalMinutes) {
    const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const minutes = String(totalMinutes % 60).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  static getWeekdayKey(appointmentDate) {
    const date = new Date(appointmentDate);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }).toLowerCase();
  }

  static normalizeAvailabilityIntervals(rawIntervals) {
    if (!Array.isArray(rawIntervals)) {
      return [];
    }

    return rawIntervals
      .map((interval) => {
        if (typeof interval !== 'string') {
          return null;
        }

        const [start, end] = interval.split('-').map((value) => value && value.trim());
        const startMinutes = this.parseTimeToMinutes(start);
        const endMinutes = this.parseTimeToMinutes(end);

        if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) {
          return null;
        }

        return { startMinutes, endMinutes };
      })
      .filter(Boolean);
  }

  static buildSlotsFromIntervals(intervals) {
    const slots = [];

    intervals.forEach(({ startMinutes, endMinutes }) => {
      for (
        let currentMinutes = startMinutes;
        currentMinutes + SLOT_INTERVAL_MINUTES <= endMinutes;
        currentMinutes += SLOT_INTERVAL_MINUTES
      ) {
        slots.push(this.formatMinutes(currentMinutes));
      }
    });

    return [...new Set(slots)].sort();
  }

  static getDefaultIntervals(doctor = {}) {
    const openMinutes = this.parseTimeToMinutes(doctor.opens_at || DEFAULT_OPEN_TIME) ?? this.parseTimeToMinutes(DEFAULT_OPEN_TIME);
    const closeMinutes = this.parseTimeToMinutes(doctor.closes_at || DEFAULT_CLOSE_TIME) ?? this.parseTimeToMinutes(DEFAULT_CLOSE_TIME);

    if (closeMinutes <= openMinutes) {
      return [{ startMinutes: this.parseTimeToMinutes(DEFAULT_OPEN_TIME), endMinutes: this.parseTimeToMinutes(DEFAULT_CLOSE_TIME) }];
    }

    return [{ startMinutes: openMinutes, endMinutes: closeMinutes }];
  }

  static getIntervalsForDoctor(doctor, appointmentDate) {
    const weekdayKey = this.getWeekdayKey(appointmentDate);
    const rawAvailability = doctor && typeof doctor.availability === 'object' ? doctor.availability : null;

    if (weekdayKey && rawAvailability && Object.prototype.hasOwnProperty.call(rawAvailability, weekdayKey)) {
      const parsedIntervals = this.normalizeAvailabilityIntervals(rawAvailability[weekdayKey]);
      return parsedIntervals;
    }

    return this.getDefaultIntervals(doctor);
  }

  static isTimeInPeriod(timeValue, timePeriod) {
    const range = PERIOD_RANGES[timePeriod];
    const minutes = this.parseTimeToMinutes(timeValue);
    if (!range || minutes == null) {
      return false;
    }

    const startMinutes = this.parseTimeToMinutes(range.start);
    const endMinutes = this.parseTimeToMinutes(range.end);
    return minutes >= startMinutes && minutes <= endMinutes;
  }

  static getTimeSlots(time_period, doctor = {}, appointmentDate = null) {
    const intervals = this.getIntervalsForDoctor(doctor, appointmentDate);
    const allDoctorSlots = this.buildSlotsFromIntervals(intervals);

    if (!time_period) {
      return allDoctorSlots;
    }

    return allDoctorSlots.filter((slot) => this.isTimeInPeriod(slot, time_period));
  }

  /**
   * Create the appointments table
   */
  static async createTable() {
    // Check if table already exists
    const checkTableQuery = `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'appointments');`;
    const result = await query(checkTableQuery);
    if (result.rows[0].exists) {
      return; // Table exists, skip creation and logging
    }

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
        status VARCHAR(20) DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'scheduled', 'completed', 'cancelled', 'no-show', 'rescheduled')),
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
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending_payment')
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
   * Get appointment by ID (alias for findById)
   */
  static async getById(id) {
    return this.findById(id);
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
   * Confirm payment and change status from pending_payment to scheduled
   */
  static async confirmPaymentAndSchedule(appointment_id) {
    const result = await query(
      `UPDATE appointments 
       SET status = 'scheduled', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'pending_payment'
       RETURNING *`,
      [appointment_id]
    );
    return result.rows[0] || null;
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
   * Reserves slot during pending_payment to prevent double-booking
   */
  static async isTimeSlotAvailable(doctor_id, appointment_date, time_period, time_slot) {
    const Doctor = require('./Doctor');
    const doctor = await Doctor.findById(doctor_id);
    if (!doctor) {
      return false;
    }

    const validSlots = this.getTimeSlots(time_period, doctor, appointment_date);
    if (!validSlots.includes(time_slot)) {
      return false;
    }

    const result = await query(
      `SELECT COUNT(*) as count FROM appointments 
       WHERE doctor_id = $1 
       AND appointment_date = $2 
       AND time_period = $3 
       AND time_slot = $4
       AND status IN ('pending_payment', 'scheduled', 'rescheduled')`,
      [doctor_id, appointment_date, time_period, time_slot]
    );
    return result.rows[0].count === '0';
  }

  /**
   * Get available time slots for a doctor on a specific date and time period
   * Reserves slots during pending_payment to prevent double-booking
   */
  static async getAvailableSlots(doctor_id, appointment_date, time_period) {
    const Doctor = require('./Doctor');
    const doctor = await Doctor.findById(doctor_id);
    if (!doctor) {
      return [];
    }

    const bookedSlots = await query(
      `SELECT time_slot FROM appointments 
       WHERE doctor_id = $1 
       AND appointment_date = $2 
       AND time_period = $3
       AND status IN ('pending_payment', 'scheduled', 'rescheduled')`,
      [doctor_id, appointment_date, time_period]
    );

    const bookedSlotsList = bookedSlots.rows.map(slot => slot.time_slot);
    const allSlots = Appointment.getTimeSlots(time_period, doctor, appointment_date);
    const availableSlots = allSlots.filter(slot => !bookedSlotsList.includes(slot));

    return availableSlots;
  }

  /**
   * Generate time slots based on time period
   * Returns array of time slot strings
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

  /**
   * Get all time periods availability for a doctor on a specific date
   * Shows which periods are fully booked
   */
  static async getDayAvailability(doctor_id, appointment_date) {
    try {
      const Doctor = require('./Doctor');
      const doctor = await Doctor.findById(doctor_id);
      if (!doctor) {
        return null;
      }

      const timePeriods = ['morning', 'afternoon', 'evening', 'night'];
      const availability = {};

      for (const period of timePeriods) {
        const allSlots = this.getTimeSlots(period);
        const availableSlots = await this.getAvailableSlots(doctor_id, appointment_date, period);
        
        availability[period] = {
          totalSlots: allSlots.length,
          availableSlots: availableSlots.length,
          bookedSlots: allSlots.length - availableSlots.length,
          isFullyBooked: availableSlots.length === 0,
          slots: allSlots.map(slot => ({
            time: slot,
            available: availableSlots.includes(slot)
          }))
        };
      }

      return availability;
    } catch (error) {
      console.error('Error getting day availability:', error);
      return null;
    }
  }

  /**
   * Auto-cancel pending payments that have expired (default: 30 minutes)
   * Returns count of cancelled appointments
   */
  static async autoCancelExpiredPendingPayments(timeoutMinutes = 30) {
    try {
      const result = await query(
        `UPDATE appointments 
         SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
         WHERE status = 'pending_payment'
         AND created_at < NOW() - INTERVAL '${timeoutMinutes} minutes'
         RETURNING id`,
        []
      );
      
      const count = result.rows.length;
      if (count > 0) {
        console.log(`✅ Auto-cancelled ${count} expired pending payment appointments`);
      }
      return count;
    } catch (error) {
      console.error('Error auto-cancelling expired pending payments:', error);
      return 0;
    }
  }
}

module.exports = Appointment;
