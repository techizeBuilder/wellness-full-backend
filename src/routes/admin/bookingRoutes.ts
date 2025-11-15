import express from 'express';
import {
  getAllBookings,
  getBookingById,
  updateBookingStatus
} from '../../controllers/admin/bookingController';
import { adminProtect } from '../../middlewares/admin/adminAuth';

const router = express.Router();

// All routes require admin authentication
router.use(adminProtect);

// Get all bookings
router.get('/', getAllBookings);

// Get booking by ID
router.get('/:id', getBookingById);

// Update booking status
router.patch('/:id/status', updateBookingStatus);

export default router;

