const DoctorReview = require('../models/DoctorReview');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const AuditLog = require('../models/AuditLog');

class ReviewController {
  /**
   * Submit or update a review for a doctor
   */
  static async submitReview(req, res) {
    try {
      const { doctorId, rating, reviewText } = req.body;
      const patientId = req.user.id;

      // Validate rating
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: 'Rating must be between 1 and 5'
        });
      }

      // Validate doctor exists
      const doctor = await Doctor.getById(doctorId);
      if (!doctor) {
        return res.status(404).json({
          success: false,
          message: 'Doctor not found'
        });
      }

      // Check if patient has appointment history with this doctor (optional but recommended)
      // This is optional - you can remove this check if you want to allow reviews without appointments
      const hasAppointment = await Appointment.hasPatientVisitedDoctor(doctorId, patientId);

      // Submit or update review
      const review = await DoctorReview.create(doctorId, patientId, rating, reviewText);

      // Log security event
      await AuditLog.logSecurityEvent(
        req,
        patientId,
        'patient',
        req.user.email,
        'review_submitted',
        'success',
        `Patient reviewed doctor ${doctorId} with rating ${rating}`
      );

      return res.status(201).json({
        success: true,
        message: hasAppointment ? 'Review submitted successfully' : 'Review submitted successfully (unverified)',
        data: {
          reviewId: review.id,
          doctorId: review.doctor_id,
          rating: review.rating,
          reviewText: review.review_text,
          isVerified: review.is_verified,
          createdAt: review.created_at
        }
      });
    } catch (error) {
      console.error('Error submitting review:', error);
      await AuditLog.logSecurityEvent(
        req,
        req.user.id,
        'patient',
        req.user.email,
        'review_submitted',
        'failed',
        `Error: ${error.message}`
      );

      return res.status(500).json({
        success: false,
        message: 'Error submitting review',
        error: error.message
      });
    }
  }

  /**
   * Get all reviews for a doctor
   */
  static async getDoctorReviews(req, res) {
    try {
      const { doctorId } = req.params;
      const limit = parseInt(req.query.limit) || 10;
      const offset = parseInt(req.query.offset) || 0;

      // Validate doctor exists
      const doctor = await Doctor.getById(doctorId);
      if (!doctor) {
        return res.status(404).json({
          success: false,
          message: 'Doctor not found'
        });
      }

      const reviews = await DoctorReview.getByDoctorId(doctorId, limit, offset);
      const ratingStats = await DoctorReview.getAverageRating(doctorId);
      const totalCount = ratingStats.total_reviews;

      return res.status(200).json({
        success: true,
        message: 'Doctor reviews retrieved successfully',
        data: {
          doctorId,
          ratingStats: {
            averageRating: parseFloat(ratingStats.average_rating) || 0,
            totalReviews: parseInt(totalCount),
            highestRating: ratingStats.highest_rating,
            lowestRating: ratingStats.lowest_rating,
            fiveStarPercentage: parseFloat(ratingStats.five_star_percentage) || 0,
            fourStarPercentage: parseFloat(ratingStats.four_star_percentage) || 0,
            threeStarPercentage: parseFloat(ratingStats.three_star_percentage) || 0,
            twoStarPercentage: parseFloat(ratingStats.two_star_percentage) || 0,
            oneStarPercentage: parseFloat(ratingStats.one_star_percentage) || 0
          },
          reviews: reviews.map(review => ({
            reviewId: review.id,
            rating: review.rating,
            reviewText: review.review_text,
            patientName: `${review.first_name} ${review.last_name}`,
            isVerified: review.is_verified,
            createdAt: review.created_at
          })),
          pagination: {
            limit,
            offset,
            total: totalCount,
            hasMore: offset + limit < totalCount
          }
        }
      });
    } catch (error) {
      console.error('Error fetching doctor reviews:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching reviews',
        error: error.message
      });
    }
  }

  /**
   * Get rating summary for a doctor
   */
  static async getRatingSummary(req, res) {
    try {
      const { doctorId } = req.params;

      // Validate doctor exists
      const doctor = await Doctor.getById(doctorId);
      if (!doctor) {
        return res.status(404).json({
          success: false,
          message: 'Doctor not found'
        });
      }

      const ratingStats = await DoctorReview.getAverageRating(doctorId);
      const distribution = await DoctorReview.getRatingDistribution(doctorId);

      return res.status(200).json({
        success: true,
        message: 'Rating summary retrieved successfully',
        data: {
          doctorId,
          averageRating: parseFloat(ratingStats.average_rating) || 0,
          totalReviews: parseInt(ratingStats.total_reviews),
          ratingDistribution: distribution.map(d => ({
            stars: d.rating,
            count: d.count
          }))
        }
      });
    } catch (error) {
      console.error('Error fetching rating summary:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching rating summary',
        error: error.message
      });
    }
  }

  /**
   * Get patient's reviews
   */
  static async getPatientReviews(req, res) {
    try {
      const patientId = req.user.id;
      const limit = parseInt(req.query.limit) || 10;
      const offset = parseInt(req.query.offset) || 0;

      const reviews = await DoctorReview.getByPatientId(patientId, limit, offset);
      const totalCount = reviews.length > 0 ? reviews.length : 0; // This needs a count query

      return res.status(200).json({
        success: true,
        message: 'Patient reviews retrieved successfully',
        data: {
          reviews: reviews.map(review => ({
            reviewId: review.id,
            doctorId: review.doctor_id,
            doctorName: `${review.doctor_first_name} ${review.doctor_last_name}`,
            specialization: review.specialization,
            clinicName: review.clinic_name,
            city: review.city,
            rating: review.rating,
            reviewText: review.review_text,
            isVerified: review.is_verified,
            createdAt: review.created_at
          })),
          pagination: {
            limit,
            offset,
            total: totalCount
          }
        }
      });
    } catch (error) {
      console.error('Error fetching patient reviews:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching your reviews',
        error: error.message
      });
    }
  }

  /**
   * Update a review
   */
  static async updateReview(req, res) {
    try {
      const { reviewId } = req.params;
      const { rating, reviewText } = req.body;
      const patientId = req.user.id;

      // Validate rating
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: 'Rating must be between 1 and 5'
        });
      }

      // Get existing review
      const review = await DoctorReview.getById(reviewId);
      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Review not found'
        });
      }

      // Check ownership
      if (review.patient_id !== patientId) {
        await AuditLog.logSecurityEvent(
          req,
          patientId,
          'patient',
          req.user.email,
          'review_update',
          'failed',
          `Unauthorized attempt to update review ${reviewId}`
        );

        return res.status(403).json({
          success: false,
          message: 'You can only update your own reviews'
        });
      }

      // Update review
      const updatedReview = await DoctorReview.update(reviewId, rating, reviewText);

      await AuditLog.logSecurityEvent(
        req,
        patientId,
        'patient',
        req.user.email,
        'review_update',
        'success',
        `Review ${reviewId} updated`
      );

      return res.status(200).json({
        success: true,
        message: 'Review updated successfully',
        data: {
          reviewId: updatedReview.id,
          rating: updatedReview.rating,
          reviewText: updatedReview.review_text,
          updatedAt: updatedReview.updated_at
        }
      });
    } catch (error) {
      console.error('Error updating review:', error);
      return res.status(500).json({
        success: false,
        message: 'Error updating review',
        error: error.message
      });
    }
  }

  /**
   * Delete a review
   */
  static async deleteReview(req, res) {
    try {
      const { reviewId } = req.params;
      const patientId = req.user.id;

      // Get existing review
      const review = await DoctorReview.getById(reviewId);
      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Review not found'
        });
      }

      // Check ownership
      if (review.patient_id !== patientId) {
        await AuditLog.logSecurityEvent(
          req,
          patientId,
          'patient',
          req.user.email,
          'review_delete',
          'failed',
          `Unauthorized attempt to delete review ${reviewId}`
        );

        return res.status(403).json({
          success: false,
          message: 'You can only delete your own reviews'
        });
      }

      // Delete review
      await DoctorReview.delete(reviewId);

      await AuditLog.logSecurityEvent(
        req,
        patientId,
        'patient',
        req.user.email,
        'review_delete',
        'success',
        `Review ${reviewId} deleted`
      );

      return res.status(200).json({
        success: true,
        message: 'Review deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting review:', error);
      return res.status(500).json({
        success: false,
        message: 'Error deleting review',
        error: error.message
      });
    }
  }

  /**
   * Check if patient has already reviewed a doctor
   */
  static async checkExistingReview(req, res) {
    try {
      const { doctorId } = req.params;
      const patientId = req.user.id;

      const existingReview = await DoctorReview.getByDoctorAndPatient(doctorId, patientId);

      return res.status(200).json({
        success: true,
        data: {
          hasReview: !!existingReview,
          review: existingReview ? {
            reviewId: existingReview.id,
            rating: existingReview.rating,
            reviewText: existingReview.review_text,
            createdAt: existingReview.created_at
          } : null
        }
      });
    } catch (error) {
      console.error('Error checking existing review:', error);
      return res.status(500).json({
        success: false,
        message: 'Error checking review status',
        error: error.message
      });
    }
  }
}

module.exports = ReviewController;
