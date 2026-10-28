const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const DoctorReview = require('../models/DoctorReview');
const User = require('../models/User');
const Payment = require('../models/Payment');
const notificationService = require('../services/notificationService');
const StripeService = require('../services/stripeService');
const AppointmentCleanupService = require('../services/appointmentCleanupService');

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

      const defaultDoctorSchedule = { opens_at: '09:00', closes_at: '17:00' };

      const timePeriods = [
        {
          name: 'morning',
          label: 'Morning',
          timeRange: '09:00 - 11:30',
          slots: Appointment.getTimeSlots('morning', defaultDoctorSchedule)
        },
        {
          name: 'afternoon',
          label: 'Afternoon',
          timeRange: '12:00 - 15:30',
          slots: Appointment.getTimeSlots('afternoon', defaultDoctorSchedule)
        },
        {
          name: 'evening',
          label: 'Evening',
          timeRange: '16:00 - 18:30',
          slots: Appointment.getTimeSlots('evening', defaultDoctorSchedule)
        },
        {
          name: 'night',
          label: 'Night',
          timeRange: '19:00 - 21:00',
          slots: Appointment.getTimeSlots('night', defaultDoctorSchedule)
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

      const validSlots = Appointment.getTimeSlots(timePeriod, doctor, appointmentDate);
      if (!validSlots.includes(timeSlot)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid time slot for the selected time period'
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
        consultation_fee: Doctor.consultationFeeFor(doctor),
        reason_for_visit: reasonForVisit || null
      });

      // Notify patient — fire-and-forget
      notificationService.sendToPatient({
        patientId,
        type: 'appointment',
        title: 'Appointment Booked',
        body: `Your appointment with Dr. ${doctor.first_name} ${doctor.last_name} on ${appointmentDate} at ${timeSlot} has been booked. Please complete payment to confirm.`,
        data: { appointmentId: appointment.id, status: 'pending_payment' }
      }).catch(err => console.error('Notification error (non-blocking):', err.message));

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
            doctorId: apt.doctor_id,
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
            doctorProfileImage: apt.doctor_profile_image,
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
            doctorId: apt.doctor_id,
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
            doctorProfileImage: apt.doctor_profile_image,
            createdAt: apt.created_at
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

      // Retire any unfinished payment first so its PaymentIntent can't be paid later
      if (appointment.status === 'pending_payment') {
        const outcome = await StripeService.cancelPendingPaymentForAppointment(appointment.id);
        if (outcome === 'completed' || outcome === 'processing') {
          return res.status(409).json({
            success: false,
            message: outcome === 'completed'
              ? 'Your card payment for this appointment has already gone through. Please refresh and try again.'
              : 'Your card payment for this appointment is still processing. Please try again shortly.'
          });
        }
      }

      const cancelledAppointment = await Appointment.cancel(appointmentId);

      // Notify patient — fire-and-forget
      notificationService.sendToPatient({
        patientId,
        type: 'appointment',
        title: 'Appointment Cancelled',
        body: `Your appointment on ${new Date(appointment.appointment_date).toDateString()} at ${appointment.time_slot} has been cancelled.`,
        data: { appointmentId: parseInt(appointmentId) }
      }).catch(err => console.error('Notification error (non-blocking):', err.message));

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

      const eligibility = await Appointment.rescheduleEligibility(appointment.id);
      if (eligibility !== 'ok') {
        return res.status(409).json({
          success: false,
          message: eligibility === 'status'
            ? 'Only upcoming appointments can be rescheduled'
            : `Appointments can't be rescheduled within ${Appointment.RESCHEDULE_CUTOFF_HOURS} hours of their start time`
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
      const doctor = await Doctor.findById(appointment.doctor_id);
      if (!doctor) {
        return res.status(404).json({
          success: false,
          message: 'Doctor not found'
        });
      }

      const validSlots = Appointment.getTimeSlots(newTimePeriod, doctor, newDate);
      if (!validSlots.includes(newTimeSlot)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid time slot for the selected time period'
        });
      }

      // The date check above allows today, so a slot earlier today gets through it
      if (!(await Appointment.isSlotInFuture(newDate, newTimeSlot))) {
        return res.status(400).json({
          success: false,
          message: 'Cannot reschedule to a time that has already passed'
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

      // Cancelled or crossed the cut-off since the check above
      if (!rescheduledAppointment) {
        return res.status(409).json({
          success: false,
          message: 'This appointment can no longer be rescheduled. Please refresh and try again.'
        });
      }

      // Notify patient — fire-and-forget
      notificationService.sendToPatient({
        patientId,
        type: 'appointment',
        title: 'Appointment Rescheduled',
        body: `Your appointment has been rescheduled to ${newDate} at ${newTimeSlot}.`,
        data: { appointmentId: parseInt(appointmentId) }
      }).catch(err => console.error('Notification error (non-blocking):', err.message));

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
          doctorId: appointment.doctor_id,
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
          doctorProfileImage: appointment.doctor_profile_image,
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
      if (!Number.isFinite(Number(timeoutMinutes)) || timeoutMinutes < 5 || timeoutMinutes > 1440) {
        return res.status(400).json({
          success: false,
          message: 'Timeout must be between 5 and 1440 minutes'
        });
      }

      // Auto-cancel expired pending payments
      const cancelledCount = await AppointmentCleanupService.cancelExpiredPendingPayments(timeoutMinutes);

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

      // Notify patient that the doctor has accepted — fire-and-forget
      notificationService.sendToPatient({
        patientId: appointment.patient_id,
        type: 'appointment',
        title: 'Doctor Accepted Your Appointment',
        body: `Dr. ${appointment.doctor_first_name} ${appointment.doctor_last_name} has accepted your appointment on ${appointment.appointment_date} at ${appointment.time_slot}.`,
        data: { appointmentId: parseInt(appointmentId) }
      }).catch(err => console.error('Notification error (non-blocking):', err.message));

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
   * Doctor: Mark appointment as completed after consultation
   * Also updates payment status to 'completed'
   */
  static async completeAppointment(req, res) {
    try {
      const doctorId = req.user.id;
      const { appointmentId } = req.params;
      const { completionNotes = '' } = req.body;

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
          message: 'You do not have permission to complete this appointment'
        });
      }

      // Verify appointment is in scheduled status
      if (appointment.status !== 'scheduled') {
        return res.status(400).json({
          success: false,
          message: `Cannot complete appointment with status: ${appointment.status}. Appointment must be scheduled.`
        });
      }

      // Update appointment to mark as completed
      const completedAppointment = await Appointment.updateStatus(appointmentId, 'completed');

      // Also update the payment status to 'completed' if payment exists
      const payment = await Payment.getByAppointmentId(appointmentId);
      if (payment && payment.payment_status !== 'completed') {
        await Payment.updatePaymentStatus(payment.id, 'completed');
      }

      // Notify patient that consultation is complete — fire-and-forget
      notificationService.sendToPatient({
        patientId: appointment.patient_id,
        type: 'appointment',
        title: 'Consultation Completed',
        body: `Your consultation with Dr. ${appointment.doctor_first_name} ${appointment.doctor_last_name} has been marked as completed.`,
        data: { appointmentId: parseInt(appointmentId) }
      }).catch(err => console.error('Notification error (non-blocking):', err.message));

      res.status(200).json({
        success: true,
        message: 'Appointment marked as completed successfully',
        data: {
          appointmentId: completedAppointment.id,
          status: completedAppointment.status,
          completedAt: completedAppointment.updated_at,
          patientName: `${appointment.patient_first_name} ${appointment.patient_last_name}`,
          consultationFee: appointment.consultation_fee,
          paymentUpdated: payment ? true : false
        }
      });
    } catch (error) {
      console.error('❌ Error completing appointment:', error);
      res.status(500).json({
        success: false,
        message: 'Error completing appointment',
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
      const { limit = 50, offset = 0, scope = 'inbox' } = req.query;

      // `inbox` is what this endpoint has always returned: bookings the doctor
      // has not accepted yet. That leaves no way to see the day's confirmed
      // appointments, so `upcoming` and `all` were added alongside it. The
      // default is unchanged so existing callers keep working.
      const scopeFilters = {
        inbox: `AND a.status IN ('pending_payment', 'scheduled')
                AND a.doctor_accepted = FALSE`,
        upcoming: `AND a.status = 'scheduled'
                   AND a.doctor_accepted = TRUE
                   AND a.appointment_date >= CURRENT_DATE`,
        all: `AND a.status IN ('pending_payment', 'scheduled', 'completed')`
      };
      const scopeFilter = scopeFilters[scope];
      if (!scopeFilter) {
        return res.status(400).json({
          success: false,
          message: `Unknown scope '${scope}'. Use inbox, upcoming or all.`
        });
      }

      const query_string = `
        SELECT a.*, 
               u.first_name as patient_first_name, u.last_name as patient_last_name,
               u.email as patient_email, u.phone as patient_phone
        FROM appointments a
        LEFT JOIN patients u ON a.patient_id = u.id
        WHERE a.doctor_id = $1
          ${scopeFilter}
        ORDER BY a.appointment_date ASC, a.time_slot ASC
        LIMIT $2 OFFSET $3;
      `;

      const { query } = require('../config/db');
      const result = await query(query_string, [doctorId, parseInt(limit), parseInt(offset)]);

      res.status(200).json({
        success: true,
        message: 'Doctor appointments retrieved',
        data: {
          total: result.rows.length,
          scope,
          appointments: result.rows.map(apt => ({
            id: apt.id,
            patientId: apt.patient_id,
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

  /**
   * Doctor: Get de-duplicated list of patients this doctor has ever seen.
   * Includes summary (last/next appointment, total visit count) and whether
   * PHR access is currently granted — used by the doctor UI to decide between
   * "Request PHR access" and "View PHR" actions.
   *
   * Query params:
   *   search    — free-text on patient first/last name or email
   *   limit     — default 50, cap 200
   *   offset    — default 0
   */
  static async getDoctorPatients(req, res) {
    try {
      const doctorId = req.user.id;
      const { search } = req.query;
      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
      const offset = parseInt(req.query.offset, 10) || 0;

      const params = [doctorId];
      let searchClause = '';
      if (search && search.trim()) {
        params.push(`%${search.trim()}%`);
        const p = `$${params.length}`;
        searchClause = ` AND (p.first_name ILIKE ${p} OR p.last_name ILIKE ${p} OR p.email ILIKE ${p})`;
      }

      const listParams = [...params, limit, offset];
      const listSql = `
        SELECT
          p.id AS patient_id,
          p.first_name,
          p.last_name,
          p.email,
          p.phone,
          p.date_of_birth,
          p.gender,
          MAX(a.appointment_date) AS last_appointment_date,
          MIN(a.appointment_date) FILTER (
            WHERE a.appointment_date >= CURRENT_DATE
              AND a.status IN ('scheduled','pending_payment')
          ) AS next_appointment_date,
          COUNT(a.id) AS total_appointments,
          COUNT(a.id) FILTER (
            WHERE a.appointment_date >= CURRENT_DATE
              AND a.status IN ('scheduled','pending_payment')
          ) AS upcoming_appointments,
          BOOL_OR(
            pa.doctor_id IS NOT NULL
            AND pa.revoked_at IS NULL
            AND (pa.expires_at IS NULL OR pa.expires_at > CURRENT_TIMESTAMP)
          ) AS has_phr_access
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        LEFT JOIN phr_access pa ON pa.patient_id = p.id AND pa.doctor_id = $1
        WHERE a.doctor_id = $1
          ${searchClause}
        GROUP BY p.id
        ORDER BY MAX(a.appointment_date) DESC NULLS LAST
        LIMIT $${listParams.length - 1} OFFSET $${listParams.length}
      `;

      const countSql = `
        SELECT COUNT(DISTINCT p.id)::int AS total
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        WHERE a.doctor_id = $1
          ${searchClause}
      `;

      const { query } = require('../config/db');
      const [listRes, countRes] = await Promise.all([
        query(listSql, listParams),
        query(countSql, params),
      ]);

      res.status(200).json({
        success: true,
        message: 'Doctor patients retrieved',
        data: {
          patients: listRes.rows.map((row) => ({
            patientId: row.patient_id,
            firstName: row.first_name,
            lastName: row.last_name,
            fullName: `${row.first_name} ${row.last_name}`,
            email: row.email,
            phone: row.phone,
            dateOfBirth: row.date_of_birth,
            gender: row.gender,
            lastAppointmentDate: row.last_appointment_date,
            nextAppointmentDate: row.next_appointment_date,
            totalAppointments: parseInt(row.total_appointments, 10),
            upcomingAppointments: parseInt(row.upcoming_appointments, 10),
            hasPhrAccess: !!row.has_phr_access,
          })),
          pagination: {
            total: countRes.rows[0].total,
            limit,
            offset,
            returned: listRes.rows.length,
          },
        },
      });
    } catch (error) {
      console.error('❌ Error fetching doctor patients:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching patients',
        error: error.message,
      });
    }
  }

  /**
   * Set or update reminder for an appointment
   */
  static async setAppointmentReminder(req, res) {
    try {
      const patientId = req.user.id;
      const { appointmentId } = req.params;
      const { reminderTimes, reminderMethods } = req.body;

      // Validate appointment exists and belongs to patient
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
          message: 'Unauthorized to set reminder for this appointment'
        });
      }

      // Validate reminder times (must be positive integers - minutes before appointment)
      if (!Array.isArray(reminderTimes) || reminderTimes.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'reminderTimes must be a non-empty array of minutes (e.g., [1440, 60])'
        });
      }

      if (!reminderTimes.every(time => Number.isInteger(time) && time > 0)) {
        return res.status(400).json({
          success: false,
          message: 'All reminder times must be positive integers (minutes before appointment)'
        });
      }

      // Validate reminder methods
      const validMethods = ['email', 'sms', 'push', 'in-app'];
      if (!Array.isArray(reminderMethods) || reminderMethods.length === 0) {
        return res.status(400).json({
          success: false,
          message: `reminderMethods must be a non-empty array. Valid options: ${validMethods.join(', ')}`
        });
      }

      if (!reminderMethods.every(method => validMethods.includes(method))) {
        return res.status(400).json({
          success: false,
          message: `Invalid reminder method. Valid options: ${validMethods.join(', ')}`
        });
      }

      // Set reminder
      const AppointmentReminder = require('../models/AppointmentReminder');
      const reminder = await AppointmentReminder.setReminder(
        appointmentId,
        patientId,
        reminderTimes,
        reminderMethods
      );

      res.json({
        success: true,
        message: 'Reminder set successfully',
        data: {
          reminderId: reminder.id,
          appointmentId: reminder.appointment_id,
          reminderTimes: reminder.reminder_times,
          reminderMethods: reminder.reminder_methods,
          isEnabled: reminder.is_enabled,
          createdAt: reminder.created_at
        }
      });
    } catch (error) {
      console.error('❌ Error setting appointment reminder:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to set reminder',
        error: error.message
      });
    }
  }

  /**
   * Get reminder for an appointment
   */
  static async getAppointmentReminder(req, res) {
    try {
      const patientId = req.user.id;
      const { appointmentId } = req.params;

      // Validate appointment exists and belongs to patient
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
          message: 'Unauthorized to view reminder for this appointment'
        });
      }

      // Get reminder
      const AppointmentReminder = require('../models/AppointmentReminder');
      const reminder = await AppointmentReminder.getReminder(appointmentId);

      if (!reminder) {
        return res.status(404).json({
          success: false,
          message: 'No reminder set for this appointment'
        });
      }

      res.json({
        success: true,
        message: 'Reminder retrieved successfully',
        data: {
          reminderId: reminder.id,
          appointmentId: reminder.appointment_id,
          reminderTimes: reminder.reminder_times,
          reminderMethods: reminder.reminder_methods,
          isEnabled: reminder.is_enabled,
          createdAt: reminder.created_at,
          updatedAt: reminder.updated_at
        }
      });
    } catch (error) {
      console.error('❌ Error fetching appointment reminder:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch reminder',
        error: error.message
      });
    }
  }

  /**
   * Get all reminders for patient (all appointments with reminders)
   */
  static async getPatientReminders(req, res) {
    try {
      const patientId = req.user.id;

      const AppointmentReminder = require('../models/AppointmentReminder');
      const reminders = await AppointmentReminder.getRemindersByPatient(patientId);

      res.json({
        success: true,
        message: 'Patient reminders retrieved successfully',
        data: {
          total: reminders.length,
          reminders: reminders.map(reminder => ({
            reminderId: reminder.id,
            appointmentId: reminder.appointment_id,
            doctorName: `${reminder.doctor_first_name} ${reminder.doctor_last_name}`,
            appointmentDate: reminder.appointment_date,
            appointmentTime: reminder.time_slot,
            reminderTimes: reminder.reminder_times,
            reminderMethods: reminder.reminder_methods,
            isEnabled: reminder.is_enabled
          }))
        }
      });
    } catch (error) {
      console.error('❌ Error fetching patient reminders:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch patient reminders',
        error: error.message
      });
    }
  }

  /**
   * Get upcoming reminders (reminders due in next 24 hours)
   */
  static async getUpcomingReminders(req, res) {
    try {
      const patientId = req.user.id;

      const AppointmentReminder = require('../models/AppointmentReminder');
      const upcomingReminders = await AppointmentReminder.getUpcomingReminders(patientId);

      res.json({
        success: true,
        message: 'Upcoming reminders retrieved successfully',
        data: {
          total: upcomingReminders.length,
          reminders: upcomingReminders.map(reminder => ({
            reminderId: reminder.reminder_id,
            appointmentId: reminder.appointment_id,
            doctorName: `${reminder.doctor_first_name} ${reminder.doctor_last_name}`,
            specialization: reminder.specialization,
            clinicName: reminder.clinic_name,
            appointmentDate: reminder.appointment_date,
            appointmentTime: reminder.appointment_time,
            reminderTimes: reminder.reminder_times,
            reminderMethods: reminder.reminder_methods,
            consultationFee: reminder.consultation_fee,
            status: reminder.status
          }))
        }
      });
    } catch (error) {
      console.error('❌ Error fetching upcoming reminders:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch upcoming reminders',
        error: error.message
      });
    }
  }

  /**
   * Update reminder settings for an appointment
   */
  static async updateAppointmentReminder(req, res) {
    try {
      const patientId = req.user.id;
      const { appointmentId } = req.params;
      const { reminderTimes, reminderMethods } = req.body;

      // Validate appointment exists and belongs to patient
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
          message: 'Unauthorized to update reminder for this appointment'
        });
      }

      // Validate at least one field is provided
      if (!reminderTimes && !reminderMethods) {
        return res.status(400).json({
          success: false,
          message: 'At least one field must be updated: reminderTimes or reminderMethods'
        });
      }

      // Validate reminder times if provided
      if (reminderTimes) {
        if (!Array.isArray(reminderTimes) || reminderTimes.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'reminderTimes must be a non-empty array'
          });
        }

        if (!reminderTimes.every(time => Number.isInteger(time) && time > 0)) {
          return res.status(400).json({
            success: false,
            message: 'All reminder times must be positive integers'
          });
        }
      }

      // Validate reminder methods if provided
      const validMethods = ['email', 'sms', 'push', 'in-app'];
      if (reminderMethods) {
        if (!Array.isArray(reminderMethods) || reminderMethods.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'reminderMethods must be a non-empty array'
          });
        }

        if (!reminderMethods.every(method => validMethods.includes(method))) {
          return res.status(400).json({
            success: false,
            message: `Invalid reminder method. Valid options: ${validMethods.join(', ')}`
          });
        }
      }

      // Update reminder
      const AppointmentReminder = require('../models/AppointmentReminder');
      const updatedReminder = await AppointmentReminder.updateReminder(
        appointmentId,
        reminderTimes,
        reminderMethods
      );

      if (!updatedReminder) {
        return res.status(404).json({
          success: false,
          message: 'Reminder not found'
        });
      }

      res.json({
        success: true,
        message: 'Reminder updated successfully',
        data: {
          reminderId: updatedReminder.id,
          appointmentId: updatedReminder.appointment_id,
          reminderTimes: updatedReminder.reminder_times,
          reminderMethods: updatedReminder.reminder_methods,
          updatedAt: updatedReminder.updated_at
        }
      });
    } catch (error) {
      console.error('❌ Error updating appointment reminder:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update reminder',
        error: error.message
      });
    }
  }

  /**
   * Toggle reminder on/off for an appointment
   */
  static async toggleAppointmentReminder(req, res) {
    try {
      const patientId = req.user.id;
      const { appointmentId } = req.params;
      const { isEnabled } = req.body;

      // Validate appointment exists and belongs to patient
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
          message: 'Unauthorized to toggle reminder for this appointment'
        });
      }

      // Validate isEnabled is boolean
      if (typeof isEnabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'isEnabled must be a boolean value'
        });
      }

      // Toggle reminder
      const AppointmentReminder = require('../models/AppointmentReminder');
      const updatedReminder = await AppointmentReminder.toggleReminder(appointmentId, isEnabled);

      if (!updatedReminder) {
        return res.status(404).json({
          success: false,
          message: 'Reminder not found'
        });
      }

      res.json({
        success: true,
        message: `Reminder ${isEnabled ? 'enabled' : 'disabled'} successfully`,
        data: {
          reminderId: updatedReminder.id,
          appointmentId: updatedReminder.appointment_id,
          isEnabled: updatedReminder.is_enabled
        }
      });
    } catch (error) {
      console.error('❌ Error toggling appointment reminder:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to toggle reminder',
        error: error.message
      });
    }
  }

  /**
   * Delete reminder for an appointment
   */
  static async deleteAppointmentReminder(req, res) {
    try {
      const patientId = req.user.id;
      const { appointmentId } = req.params;

      // Validate appointment exists and belongs to patient
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
          message: 'Unauthorized to delete reminder for this appointment'
        });
      }

      // Delete reminder
      const AppointmentReminder = require('../models/AppointmentReminder');
      const deletedReminder = await AppointmentReminder.deleteReminder(appointmentId);

      if (!deletedReminder) {
        return res.status(404).json({
          success: false,
          message: 'Reminder not found'
        });
      }

      res.json({
        success: true,
        message: 'Reminder deleted successfully',
        data: {
          reminderId: deletedReminder.id,
          appointmentId: deletedReminder.appointment_id
        }
      });
    } catch (error) {
      console.error('❌ Error deleting appointment reminder:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete reminder',
        error: error.message
      });
    }
  }

  /**
   * Get notification history for an appointment
   */
  static async getNotificationHistory(req, res) {
    try {
      const patientId = req.user.id;
      const { appointmentId } = req.params;

      // Validate appointment exists and belongs to patient
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
          message: 'Unauthorized to view notification history for this appointment'
        });
      }

      // Get notification history
      const AppointmentReminder = require('../models/AppointmentReminder');
      const history = await AppointmentReminder.getNotificationHistory(appointmentId);

      res.json({
        success: true,
        message: 'Notification history retrieved successfully',
        data: {
          appointmentId,
          total: history.length,
          notifications: history.map(notification => ({
            notificationId: notification.id,
            reminderMethod: notification.reminder_method,
            minutesBefore: notification.minutes_before,
            status: notification.status,
            sentAt: notification.sent_at,
            errorMessage: notification.error_message
          }))
        }
      });
    } catch (error) {
      console.error('❌ Error fetching notification history:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch notification history',
        error: error.message
      });
    }
  }

  /**
   * Shared ownership check for the patient note handlers. Sends the error
   * response and returns null when the appointment can't be used.
   */
  static async findOwnAppointment(req, res) {
    const appointment = await Appointment.findById(req.params.appointmentId);
    if (!appointment) {
      res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
      return null;
    }

    if (appointment.patient_id !== req.user.id) {
      res.status(403).json({
        success: false,
        message: 'Unauthorized to access notes for this appointment'
      });
      return null;
    }

    return appointment;
  }

  static formatNote(note) {
    return {
      noteId: note.id,
      appointmentId: note.appointment_id,
      body: note.body,
      createdAt: note.created_at
    };
  }

  /**
   * Get the patient's notes on an appointment
   */
  static async getAppointmentNotes(req, res) {
    try {
      const AppointmentNote = require('../models/AppointmentNote');
      const appointment = await AppointmentController.findOwnAppointment(req, res);
      if (!appointment) return;

      const [notes, editable] = await Promise.all([
        AppointmentNote.listForAppointment(appointment.id),
        AppointmentNote.notesEditable(appointment.id)
      ]);

      res.json({
        success: true,
        message: 'Notes retrieved successfully',
        data: {
          appointmentId: appointment.id,
          notesLocked: !editable,
          notes: notes.map(AppointmentController.formatNote)
        }
      });
    } catch (error) {
      console.error('❌ Error fetching appointment notes:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch notes',
        error: error.message
      });
    }
  }

  /**
   * Add a note to an upcoming appointment
   */
  static async addAppointmentNote(req, res) {
    try {
      const AppointmentNote = require('../models/AppointmentNote');
      const raw = req.body?.body;
      if (typeof raw !== 'string' || raw.trim() === '' || raw.trim().length > 2000) {
        return res.status(400).json({
          success: false,
          message: 'body must be a non-empty string of at most 2000 characters'
        });
      }

      const appointment = await AppointmentController.findOwnAppointment(req, res);
      if (!appointment) return;

      const note = await AppointmentNote.create(appointment.id, req.user.id, raw.trim());
      if (!note) {
        return res.status(409).json({
          success: false,
          message: 'Notes are locked once an appointment has started, finished or been cancelled'
        });
      }

      res.status(201).json({
        success: true,
        message: 'Note added successfully',
        data: AppointmentController.formatNote(note)
      });
    } catch (error) {
      console.error('❌ Error adding appointment note:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add note',
        error: error.message
      });
    }
  }

  /**
   * Delete a note from an upcoming appointment. The note is hidden, not
   * removed, so there is an audit trail if the doctor had already read it.
   */
  static async deleteAppointmentNote(req, res) {
    try {
      const AppointmentNote = require('../models/AppointmentNote');
      const appointment = await AppointmentController.findOwnAppointment(req, res);
      if (!appointment) return;

      const { noteId } = req.params;
      if (!/^\d+$/.test(noteId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid note ID'
        });
      }

      const deleted = await AppointmentNote.softDelete(noteId, appointment.id, req.user.id);
      if (!deleted) {
        const exists = await AppointmentNote.exists(noteId, appointment.id, req.user.id);
        return res.status(exists ? 409 : 404).json({
          success: false,
          message: exists
            ? 'Notes are locked once an appointment has started, finished or been cancelled'
            : 'Note not found'
        });
      }

      res.json({
        success: true,
        message: 'Note deleted successfully',
        data: {
          noteId: deleted.id,
          appointmentId: deleted.appointment_id
        }
      });
    } catch (error) {
      console.error('❌ Error deleting appointment note:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete note',
        error: error.message
      });
    }
  }
}

module.exports = AppointmentController;
