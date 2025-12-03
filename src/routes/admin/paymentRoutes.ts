import express from 'express';
import {
  getAllPayments,
  getPaymentById,
  updatePaymentStatus
} from '../../controllers/admin/paymentController';
import { adminProtect } from '../../middlewares/admin/adminAuth';

const router = express.Router();

// All routes require admin authentication
router.use(adminProtect);

// Get all payments
router.get('/', getAllPayments);

// Get payment by ID
router.get('/:id', getPaymentById);

// Update payment status
router.patch('/:id/status', updatePaymentStatus);

export default router;

