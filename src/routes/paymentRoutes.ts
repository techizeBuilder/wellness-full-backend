import express from 'express';
import {
  createPaymentOrder,
  verifyPayment,
  handleWebhook,
  getPaymentHistory,
  getExpertEarnings,
  getExpertPayouts
} from '../controllers/paymentController';
import { protect } from '../middlewares/auth';
import { authorize } from '../middlewares/auth';

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

// Expert-specific routes
router.get('/expert/earnings', authorize('expert'), getExpertEarnings);
router.get('/expert/payouts', authorize('expert'), getExpertPayouts);

export default router;

