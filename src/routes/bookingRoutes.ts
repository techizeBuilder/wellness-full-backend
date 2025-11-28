import express from 'express';
import {
  getAvailableSlots,
  createBooking,
  getUserBookings,
  getExpertBookings,
  updateBookingStatus,
  rescheduleBooking,
  getAgoraToken,
  submitFeedback,
  uploadPrescription,
  getUserDetailsForExpert
} from '../controllers/bookingController';
import { protect } from '../middlewares/auth';
import { uploadPrescription as uploadPrescriptionMiddleware, handleUploadError } from '../middlewares/upload';

const router = express.Router();

// Public route - Get available slots for an expert
router.get('/availability/:expertId', getAvailableSlots);

// Protected routes - User bookings
router.post('/', protect, createBooking);
router.get('/user', protect, getUserBookings);

// Protected routes - Expert bookings
router.get('/expert', protect, getExpertBookings);

// Protected route - Get user details for expert (patient information)
router.get('/user/:userId/details', protect, getUserDetailsForExpert);

// Protected route - Update booking status
router.patch('/:id/status', protect, updateBookingStatus);

// Protected route - Reschedule booking
router.patch('/:id/reschedule', protect, rescheduleBooking);

// Protected route - Generate Agora token
router.get('/:id/agora-token', protect, getAgoraToken);

// Protected route - Submit feedback
router.post('/:id/feedback', protect, submitFeedback);

// Protected route - Upload prescription
router.post(
  '/:id/prescription',
  protect,
  uploadPrescriptionMiddleware,
  handleUploadError,
  uploadPrescription
);

export default router;

