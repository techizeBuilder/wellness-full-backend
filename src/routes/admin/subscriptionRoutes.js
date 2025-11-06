const express = require('express');
const router = express.Router();

const {
  getSubscriptions,
  getSubscriptionById,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  toggleSubscriptionStatus,
  getSubscriptionStats
} = require('../../controllers/admin/subscriptionController');

const { adminProtect, requireRole } = require('../../middlewares/admin/adminAuth');

// All routes require admin authentication and superadmin role
router.use(adminProtect);
router.use(requireRole('superadmin'));

// GET /api/admin/subscriptions/stats - Get subscription statistics
router.get('/stats', getSubscriptionStats);

// GET /api/admin/subscriptions/test - Test endpoint
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Subscription routes working', timestamp: new Date() });
});

// GET /api/admin/subscriptions - Get all subscriptions
router.get('/', getSubscriptions);

// GET /api/admin/subscriptions/:id - Get subscription by ID
router.get('/:id', getSubscriptionById);

// POST /api/admin/subscriptions - Create new subscription
router.post('/', createSubscription);

// PUT /api/admin/subscriptions/:id - Update subscription
router.put('/:id', updateSubscription);

// DELETE /api/admin/subscriptions/:id - Delete subscription
router.delete('/:id', deleteSubscription);

// PATCH /api/admin/subscriptions/:id/toggle-status - Toggle subscription active status
router.patch('/:id/toggle-status', toggleSubscriptionStatus);

module.exports = router;