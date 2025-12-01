import express from 'express';
import {
  createPaymentOrder,
  verifyPayment,
  handleWebhook,
  getPaymentHistory
} from '../controllers/paymentController';
import { protect } from '../middlewares/auth';

const router = express.Router();

// Webhook route (no auth required - Razorpay calls this)
router.post('/webhook', handleWebhook);

// All other routes require authentication
router.use(protect);

// Create payment order
router.post('/create-order', createPaymentOrder);

// Verify payment
router.post('/verify', verifyPayment);

// Get payment history
router.get('/history', getPaymentHistory);

export default router;

