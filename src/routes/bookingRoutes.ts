import express from 'express';
import {
  getAvailableSlots,
  createBooking,
  getUserBookings,
  getExpertBookings,
  updateBookingStatus,
  rescheduleBooking
} from '../controllers/bookingController';
import { protect } from '../middlewares/auth';

const router = express.Router();

// Public route - Get available slots for an expert
router.get('/availability/:expertId', getAvailableSlots);

// Protected routes - User bookings
router.post('/', protect, createBooking);
router.get('/user', protect, getUserBookings);

// Protected routes - Expert bookings
router.get('/expert', protect, getExpertBookings);

// Protected route - Update booking status
router.patch('/:id/status', protect, updateBookingStatus);

// Protected route - Reschedule booking
router.patch('/:id/reschedule', protect, rescheduleBooking);

export default router;

