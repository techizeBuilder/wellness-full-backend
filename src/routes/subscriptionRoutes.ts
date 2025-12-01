import express from 'express';
import {
  getMySubscriptions,
  cancelSubscription,
  getSubscriptionById,
  getExpertSubscriptionStats
} from '../controllers/subscriptionController';
import { protect } from '../middlewares/auth';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get user's active subscriptions
router.get('/my-subscriptions', getMySubscriptions);

// Get expert's subscription statistics
router.get('/expert/stats', getExpertSubscriptionStats);

// Get subscription by ID
router.get('/:id', getSubscriptionById);

// Cancel a subscription
router.post('/:id/cancel', cancelSubscription);

export default router;

