const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const DoctorReview = require('../models/DoctorReview');
const User = require('../models/User');

/**
 * Appointment Controller
 * Handles appointment booking, scheduling, and management
 */

class AppointmentController {
  /**
   * Get all available doctors (for doctor selection)
   */
  static async getAvailableDoctors(req, res) {
    try {
      const result = await Doctor.findAll();
      const doctors = result.filter(doc => doc.status === 'active');

      // Fetch ratings and reviews for each doctor
      const doctorsWithRatings = await Promise.all(
        doctors.map(async (doc) => {
          const ratingStats = await DoctorReview.getAverageRating(doc.id);
          const reviews = await DoctorReview.getByDoctorId(doc.id, 5, 0); // Fetch first 5 recent reviews
          
          return {
            id: doc.id,
            firstName: doc.first_name,
            lastName: doc.last_name,
            specialization: doc.specialization,
            experience: doc.experience,
            clinicName: doc.clinic_name,
            city: doc.city,
            consultationFee: doc.consultation_fee,
            profileImage: doc.profile_image,
            phone: doc.phone,
            address: doc.address,
            bio: doc.bio,
            rating: {
              averageRating: parseFloat(ratingStats.average_rating) || 0,
              totalReviews: parseInt(ratingStats.total_reviews),
              highestRating: ratingStats.highest_rating,
              lowestRating: ratingStats.lowest_rating
            },
            recentReviews: reviews.map(review => ({
              reviewId: review.id,
              rating: review.rating,
              reviewText: review.review_text,
              patientName: `${review.first_name} ${review.last_name}`,
              isVerified: review.is_verified,
              createdAt: review.created_at
            }))
          };
        })
      );

      res.json({
        success: true,
        message: 'Available doctors retrieved successfully',
        data: doctorsWithRatings
      });
    } catch (error) {
      console.error('❌ Error fetching available doctors:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch available doctors',
        error: error.message
      });
    }
  }

  /**
   * Get available time slots for a doctor on a specific date and time period
   */
  static async getAvailableTimeSlots(req, res) {
    try {
      const { doctorId, date, timePeriod } = req.query;

      // Validate required parameters
      if (!doctorId || !date || !timePeriod) {
        return res.status(400).json({
          success: false,
          message: 'Missing required parameters: doctorId, date, timePeriod'
        });
      }

      // Validate date is today or in the future
      const selectedDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (selectedDate < today) {
        return res.status(400).json({
          success: false,
          message: 'Cannot book appointment for past dates'
        });
      }

      // Validate time period
      const validPeriods = ['morning', 'afternoon', 'evening', 'night'];
      if (!validPeriods.includes(timePeriod)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid time period. Must be one of: morning, afternoon, evening, night'
        });
      }

      // Verify doctor exists
      const doctor = await Doctor.findById(doctorId);
      if (!doctor) {
        return res.status(404).json({
          success: false,
          message: 'Doctor not found'
        });
      }

      if (doctor.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Doctor is not available for appointments'
        });
      }

      // Get available time slots
      const availableSlots = await Appointment.getAvailableSlots(
        doctorId,
        date,
        timePeriod
      );

      // Get all possible time slots for display
      const allSlots = Appointment.getTimeSlots(timePeriod);

      res.json({
        success: true,
        message: 'Available time slots retrieved successfully',
        data: {
          doctorId: parseInt(doctorId),
          date,
          timePeriod,
          availableSlots,
          allSlots,
          slotsAvailable: availableSlots.length,
          totalSlots: allSlots.length,
          slotDetails: allSlots.map(slot => ({
            time: slot,
            available: availableSlots.includes(slot)
          }))
        }
      });
    } catch (error) {
      console.error('❌ Error fetching available time slots:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch available time slots',
        error: error.message
      });
    }
  }

  /**
   * Get time period options and date range info
   */
  static async getBookingInfo(req, res) {
    try {
      const today = new Date();
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 90); // Allow booking up to 90 days in advance

      const timePeriods = [
        {
          name: 'morning',
          label: 'Morning',
          timeRange: '08:00 - 11:30',
          slots: Appointment.getTimeSlots('morning')
        },
        {
          name: 'afternoon',
          label: 'Afternoon',
          timeRange: '12:00 - 15:30',
          slots: Appointment.getTimeSlots('afternoon')
        },
        {
          name: 'evening',
          label: 'Evening',
          timeRange: '16:00 - 18:30',
          slots: Appointment.getTimeSlots('evening')
        },
        {
          name: 'night',
          label: 'Night',
          timeRange: '19:00 - 21:00',
          slots: Appointment.getTimeSlots('night')
        }
      ];

      res.json({
        success: true,
        message: 'Booking information retrieved successfully',
        data: {
          timePeriods,
          dateRange: {
            startDate: today.toISOString().split('T')[0],
            endDate: maxDate.toISOString().split('T')[0],
            maxDaysInAdvance: 90
          }
        }
      });
    } catch (error) {
      console.error('❌ Error fetching booking info:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch booking information',
        error: error.message
      });
    }
  }

  /**
   * Book an appointment
   */
  static async bookAppointment(req, res) {
    try {
      const patientId = req.user.id;
      const {
        doctorId,
        appointmentDate,
        timePeriod,
        timeSlot,
        reasonForVisit
      } = req.body;

      // Validate required fields
      if (!doctorId || !appointmentDate || !timePeriod || !timeSlot) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: doctorId, appointmentDate, timePeriod, timeSlot'
        });
      }

      // Validate time period and slot format
      const validPeriods = ['morning', 'afternoon', 'evening', 'night'];
      if (!validPeriods.includes(timePeriod)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid time period'
        });
      }

      const validSlots = Appointment.getTimeSlots(timePeriod);
      if (!validSlots.includes(timeSlot)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid time slot for the selected time period'
        });
      }

      // Validate appointment date
      const selectedDate = new Date(appointmentDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (selectedDate < today) {
        return res.status(400).json({
          success: false,
          message: 'Cannot book appointment for past dates'
        });
      }

      // Check max advance booking (90 days)
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 90);
      if (selectedDate > maxDate) {
        return res.status(400).json({
          success: false,
          message: 'Cannot book appointment more than 90 days in advance'
        });
      }

      // Verify doctor exists and is active
      const doctor = await Doctor.findById(doctorId);
      if (!doctor) {
        return res.status(404).json({
          success: false,
          message: 'Doctor not found'
        });
      }

      if (doctor.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Doctor is not available for appointments'
        });
      }

      // Check if patient already has an appointment at the same time
      const existingAppointment = await Appointment.findByDoctorAndDate(doctorId, appointmentDate);
      const conflictingSlot = existingAppointment.find(
        apt => apt.time_period === timePeriod && apt.time_slot === timeSlot && apt.status !== 'cancelled'
      );

      if (conflictingSlot) {
        return res.status(409).json({
          success: false,
          message: 'Time slot already booked. Please select another slot.'
        });
      }

      // Check if slot is available
      const isAvailable = await Appointment.isTimeSlotAvailable(
        doctorId,
        appointmentDate,
        timePeriod,
        timeSlot
      );

      if (!isAvailable) {
        return res.status(409).json({
          success: false,
          message: 'Selected time slot is no longer available'
        });
      }

      // Create appointment
      const appointment = await Appointment.create({
        doctor_id: doctorId,
        patient_id: patientId,
        appointment_date: appointmentDate,
        time_period: timePeriod,
        time_slot: timeSlot,
        consultation_fee: doctor.consultation_fee,
        reason_for_visit: reasonForVisit || null
      });

      res.status(201).json({
        success: true,
        message: 'Appointment booked successfully',
        data: {
          appointmentId: appointment.id,
          doctorName: `${doctor.first_name} ${doctor.last_name}`,
          specialization: doctor.specialization,
          date: appointment.appointment_date,
          timePeriod: appointment.time_period,
          timeSlot: appointment.time_slot,
          consultationFee: appointment.consultation_fee,
          status: appointment.status,
          clinicName: doctor.clinic_name,
          clinicAddress: doctor.address,
          clinicPhone: doctor.phone
        }
      });
    } catch (error) {
      console.error('❌ Error booking appointment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to book appointment',
        error: error.message
      });
    }
  }

  /**
   * Get patient's appointments
   */
  static async getPatientAppointments(req, res) {
    try {
      const patientId = req.user.id;

      const appointments = await Appointment.findByPatient(patientId);

      res.json({
        success: true,
        message: 'Patient appointments retrieved successfully',
        data: {
          total: appointments.length,
          appointments: appointments.map(apt => ({
            appointmentId: apt.id,
            doctorName: `${apt.doctor_first_name} ${apt.doctor_last_name}`,
            specialization: apt.specialization,
            date: apt.appointment_date,
            timePeriod: apt.time_period,
            timeSlot: apt.time_slot,
            consultationFee: apt.consultation_fee,
            status: apt.status,
            clinicName: apt.clinic_name,
            city: apt.city,
            reasonForVisit: apt.reason_for_visit,
            doctorPhone: apt.doctor_phone,
            createdAt: apt.created_at
          }))
        }
      });
    } catch (error) {
      console.error('❌ Error fetching patient appointments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch appointments',
        error: error.message
      });
    }
  }

  /**
   * Get patient's upcoming appointments
   */
  static async getUpcomingAppointments(req, res) {
    try {
      const patientId = req.user.id;
      const limit = req.query.limit ? parseInt(req.query.limit) : 10;

      const appointments = await Appointment.getUpcomingAppointments(patientId, limit);

      res.json({
        success: true,
        message: 'Upcoming appointments retrieved successfully',
        data: {
          total: appointments.length,
          appointments: appointments.map(apt => ({
            appointmentId: apt.id,
            doctorName: `${apt.doctor_first_name} ${apt.doctor_last_name}`,
            specialization: apt.specialization,
            date: apt.appointment_date,
            timePeriod: apt.time_period,
            timeSlot: apt.time_slot,
            consultationFee: apt.consultation_fee,
            status: apt.status,
            clinicName: apt.clinic_name,
            city: apt.city,
            doctorPhone: apt.doctor_phone
          }))
        }
      });
    } catch (error) {
      console.error('❌ Error fetching upcoming appointments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch upcoming appointments',
        error: error.message
      });
    }
  }

  /**
   * Cancel an appointment
   */
  static async cancelAppointment(req, res) {
    try {
      const patientId = req.user.id;
      const { appointmentId } = req.params;

      // Verify appointment exists and belongs to patient
      const appointment = await Appointment.findById(appointmentId);

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Appointment not found'
        });
      }

      if (appointment.patient_id !== patientId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to cancel this appointment'
        });
      }

      if (appointment.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          message: 'Appointment is already cancelled'
        });
      }

      // Check if appointment is in the past
      const appointmentDate = new Date(appointment.appointment_date);
      const now = new Date();
      if (appointmentDate < now) {
        return res.status(400).json({
          success: false,
          message: 'Cannot cancel past appointments'
        });
      }

      const cancelledAppointment = await Appointment.cancel(appointmentId);

      res.json({
        success: true,
        message: 'Appointment cancelled successfully',
        data: {
          appointmentId: cancelledAppointment.id,
          status: cancelledAppointment.status,
          cancelledAt: cancelledAppointment.updated_at
        }
      });
    } catch (error) {
      console.error('❌ Error cancelling appointment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel appointment',
        error: error.message
      });
    }
  }

  /**
   * Reschedule an appointment
   */
  static async rescheduleAppointment(req, res) {
    try {
      const patientId = req.user.id;
      const { appointmentId } = req.params;
      const { newDate, newTimePeriod, newTimeSlot } = req.body;

      // Validate required fields
      if (!newDate || !newTimePeriod || !newTimeSlot) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: newDate, newTimePeriod, newTimeSlot'
        });
      }

      // Verify appointment exists and belongs to patient
      const appointment = await Appointment.findById(appointmentId);

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Appointment not found'
        });
      }

      if (appointment.patient_id !== patientId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to reschedule this appointment'
        });
      }

      // Validate new date is in the future
      const selectedDate = new Date(newDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (selectedDate < today) {
        return res.status(400).json({
          success: false,
          message: 'Cannot reschedule to a past date'
        });
      }

      // Validate time period
      const validPeriods = ['morning', 'afternoon', 'evening', 'night'];
      if (!validPeriods.includes(newTimePeriod)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid time period'
        });
      }

      // Validate time slot
      const validSlots = Appointment.getTimeSlots(newTimePeriod);
      if (!validSlots.includes(newTimeSlot)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid time slot for the selected time period'
        });
      }

      // Check if new slot is available
      const isAvailable = await Appointment.isTimeSlotAvailable(
        appointment.doctor_id,
        newDate,
        newTimePeriod,
        newTimeSlot
      );

      if (!isAvailable) {
        return res.status(409).json({
          success: false,
          message: 'Selected time slot is not available'
        });
      }

      // Reschedule appointment
      const rescheduledAppointment = await Appointment.reschedule(
        appointmentId,
        newDate,
        newTimePeriod,
        newTimeSlot
      );

      res.json({
        success: true,
        message: 'Appointment rescheduled successfully',
        data: {
          appointmentId: rescheduledAppointment.id,
          newDate: rescheduledAppointment.appointment_date,
          newTimePeriod: rescheduledAppointment.time_period,
          newTimeSlot: rescheduledAppointment.time_slot,
          status: rescheduledAppointment.status,
          rescheduledAt: rescheduledAppointment.updated_at
        }
      });
    } catch (error) {
      console.error('❌ Error rescheduling appointment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reschedule appointment',
        error: error.message
      });
    }
  }

  /**
   * Get appointment details
   */
  static async getAppointmentDetails(req, res) {
    try {
      const patientId = req.user.id;
      const { appointmentId } = req.params;

      const appointment = await Appointment.findById(appointmentId);

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Appointment not found'
        });
      }

      if (appointment.patient_id !== patientId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to view this appointment'
        });
      }

      res.json({
        success: true,
        message: 'Appointment details retrieved successfully',
        data: {
          appointmentId: appointment.id,
          doctorName: `${appointment.doctor_first_name} ${appointment.doctor_last_name}`,
          specialization: appointment.specialization,
          date: appointment.appointment_date,
          timePeriod: appointment.time_period,
          timeSlot: appointment.time_slot,
          consultationFee: appointment.consultation_fee,
          status: appointment.status,
          reasonForVisit: appointment.reason_for_visit,
          notes: appointment.notes,
          clinicName: appointment.clinic_name,
          city: appointment.city,
          doctorPhone: appointment.doctor_phone,
          createdAt: appointment.created_at,
          updatedAt: appointment.updated_at
        }
      });
    } catch (error) {
      console.error('❌ Error fetching appointment details:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch appointment details',
        error: error.message
      });
    }
  }

  /**
   * Get all time periods availability for a doctor on a specific date
   * Shows which periods are fully booked
   */
  static async getDayAvailability(req, res) {
    try {
      const { doctorId, date } = req.query;

      // Validate required parameters
      if (!doctorId || !date) {
        return res.status(400).json({
          success: false,
          message: 'Missing required parameters: doctorId, date'
        });
      }

      // Validate date is today or in the future
      const selectedDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (selectedDate < today) {
        return res.status(400).json({
          success: false,
          message: 'Cannot check appointments for past dates'
        });
      }

      // Verify doctor exists
      const doctor = await Doctor.findById(doctorId);
      if (!doctor) {
        return res.status(404).json({
          success: false,
          message: 'Doctor not found'
        });
      }

      if (doctor.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Doctor is not available'
        });
      }

      // Get availability for all time periods
      const availability = await Appointment.getDayAvailability(doctorId, date);

      res.json({
        success: true,
        message: 'Daily availability retrieved successfully',
        data: {
          doctorId: parseInt(doctorId),
          doctorName: `${doctor.first_name} ${doctor.last_name}`,
          date,
          availability,
          summary: {
            periodStatus: Object.entries(availability).map(([period, data]) => ({
              period: period.charAt(0).toUpperCase() + period.slice(1),
              available: !data.isFullyBooked,
              availableSlots: data.availableSlots,
              totalSlots: data.totalSlots,
              bookedSlots: data.bookedSlots,
              fullyBooked: data.isFullyBooked
            }))
          }
        }
      });
    } catch (error) {
      console.error('Error getting day availability:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch day availability',
        error: error.message
      });
    }
  }

  /**
   * Auto-cancel pending payments that have expired
   * Admin endpoint - triggers automatic cancellation of unpaid appointments
   */
  static async autoCancelExpiredPayments(req, res) {
    try {
      const { timeoutMinutes = 30 } = req.body;

      // Validate timeout is reasonable (between 5 and 1440 minutes / 1 day)
      if (timeoutMinutes < 5 || timeoutMinutes > 1440) {
        return res.status(400).json({
          success: false,
          message: 'Timeout must be between 5 and 1440 minutes'
        });
      }

      // Auto-cancel expired pending payments
      const cancelledCount = await Appointment.autoCancelExpiredPendingPayments(timeoutMinutes);

      res.json({
        success: true,
        message: `Successfully auto-cancelled ${cancelledCount} expired pending payment appointments`,
        data: {
          cancelledCount,
          timeoutMinutes,
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('Error auto-cancelling expired payments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to auto-cancel expired payments',
        error: error.message
      });
    }
  }

  /**
   * Doctor: Accept appointment (acknowledge and prepare for consultation)
   * Must be called before creating prescription
   */
  static async acceptAppointment(req, res) {
    try {
      const doctorId = req.user.id;
      const { appointmentId } = req.params;
      const { doctorNotes = '' } = req.body;

      // Get appointment
      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Appointment not found'
        });
      }

      // Verify doctor owns this appointment
      if (appointment.doctor_id !== doctorId) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to accept this appointment'
        });
      }

      // Verify appointment is in correct status (scheduled or completed)
      if (appointment.status !== 'scheduled' && appointment.status !== 'completed') {
        return res.status(400).json({
          success: false,
          message: `Cannot accept appointment with status: ${appointment.status}`
        });
      }

      // Update appointment to mark as accepted by doctor
      const updateQuery = `
        UPDATE appointments
        SET doctor_accepted = TRUE,
            doctor_accepted_at = CURRENT_TIMESTAMP,
            doctor_notes = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *;
      `;

      const { query } = require('../config/db');
      const result = await query(updateQuery, [doctorNotes, appointmentId]);
      const updatedAppointment = result.rows[0];

      res.status(200).json({
        success: true,
        message: 'Appointment accepted successfully',
        data: {
          appointmentId: updatedAppointment.id,
          patientName: `${updatedAppointment.patient_first_name} ${updatedAppointment.patient_last_name}`,
          appointmentDate: updatedAppointment.appointment_date,
          timePeriod: updatedAppointment.time_period,
          timeSlot: updatedAppointment.time_slot,
          doctorAccepted: true,
          doctorAcceptedAt: updatedAppointment.doctor_accepted_at,
          readyForPrescription: true
        }
      });
    } catch (error) {
      console.error('❌ Error accepting appointment:', error);
      res.status(500).json({
        success: false,
        message: 'Error accepting appointment',
        error: error.message
      });
    }
  }

  /**
   * Doctor: Get appointments awaiting acceptance
   */
  static async getDoctorAppointments(req, res) {
    try {
      const doctorId = req.user.id;
      const { status = 'scheduled', limit = 50, offset = 0 } = req.query;

      const query_string = `
        SELECT a.*, 
               u.first_name as patient_first_name, u.last_name as patient_last_name,
               u.email as patient_email, u.phone as patient_phone
        FROM appointments a
        LEFT JOIN patients u ON a.patient_id = u.id
        WHERE a.doctor_id = $1 
          AND a.status = $2
          AND a.doctor_accepted = FALSE
        ORDER BY a.appointment_date ASC, a.time_slot ASC
        LIMIT $3 OFFSET $4;
      `;

      const { query } = require('../config/db');
      const result = await query(query_string, [doctorId, status, parseInt(limit), parseInt(offset)]);

      res.status(200).json({
        success: true,
        message: 'Doctor appointments retrieved',
        data: {
          total: result.rows.length,
          appointments: result.rows.map(apt => ({
            id: apt.id,
            patientName: `${apt.patient_first_name} ${apt.patient_last_name}`,
            patientEmail: apt.patient_email,
            patientPhone: apt.patient_phone,
            appointmentDate: apt.appointment_date,
            timePeriod: apt.time_period,
            timeSlot: apt.time_slot,
            reason: apt.reason_for_visit,
            consultationFee: apt.consultation_fee,
            status: apt.status,
            doctorAccepted: apt.doctor_accepted,
            action: 'Ready to create prescription'
          }))
        }
      });
    } catch (error) {
      console.error('❌ Error fetching doctor appointments:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching appointments',
        error: error.message
      });
    }
  }
}

module.exports = AppointmentController;
