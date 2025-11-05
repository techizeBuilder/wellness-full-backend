const express = require('express');
const router = express.Router();

const {
  getUserStats,
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus
} = require('../../controllers/admin/userController');

const { adminProtect, requireRole } = require('../../middlewares/admin/adminAuth');

// All routes require admin authentication and superadmin role
router.use(adminProtect);
router.use(requireRole('superadmin'));

// GET /api/admin/users/stats - Get user statistics
router.get('/stats', getUserStats);

// GET /api/admin/users/test - Test endpoint
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'User routes working', timestamp: new Date() });
});

// GET /api/admin/users - Get all users
router.get('/', getUsers);

// GET /api/admin/users/:id - Get user by ID
router.get('/:id', getUserById);

// POST /api/admin/users - Create new user
router.post('/', createUser);

// PUT /api/admin/users/:id - Update user
router.put('/:id', updateUser);

// PUT /api/admin/users/:id/status - Toggle user active status (alternative endpoint)
router.put('/:id/status', toggleUserStatus);

// DELETE /api/admin/users/:id - Delete user
router.delete('/:id', deleteUser);

// PATCH /api/admin/users/:id/toggle-status - Toggle user active status
router.patch('/:id/toggle-status', toggleUserStatus);

// PUT /api/admin/users/:id/toggle-status - Toggle user active status (alternative method)
router.put('/:id/toggle-status', toggleUserStatus);

module.exports = router;