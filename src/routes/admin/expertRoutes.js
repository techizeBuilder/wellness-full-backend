const express = require('express');
const router = express.Router();

const {
  getExpertStats,
  getExperts,
  getExpertById,
  createExpert,
  updateExpert,
  deleteExpert,
  toggleExpertStatus,
  toggleExpertVerification
} = require('../../controllers/admin/expertController');

const { adminProtect, requireRole } = require('../../middlewares/admin/adminAuth');

// All routes require admin authentication and superadmin role
router.use(adminProtect);
router.use(requireRole('superadmin'));

// GET /api/admin/experts/stats - Get expert statistics
router.get('/stats', getExpertStats);

// GET /api/admin/experts/test - Test endpoint
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Expert routes working', timestamp: new Date() });
});

// GET /api/admin/experts - Get all experts
router.get('/', getExperts);

// GET /api/admin/experts/:id - Get expert by ID
router.get('/:id', getExpertById);

// POST /api/admin/experts - Create new expert
router.post('/', createExpert);

// PUT /api/admin/experts/:id - Update expert
router.put('/:id', updateExpert);

// PUT /api/admin/experts/:id/status - Toggle expert active status (alternative endpoint)
router.put('/:id/status', toggleExpertStatus);

// DELETE /api/admin/experts/:id - Delete expert
router.delete('/:id', deleteExpert);

// PATCH /api/admin/experts/:id/toggle-status - Toggle expert active status
router.patch('/:id/toggle-status', toggleExpertStatus);

// PUT /api/admin/experts/:id/toggle-status - Toggle expert active status (alternative method)
router.put('/:id/toggle-status', toggleExpertStatus);

// PATCH /api/admin/experts/:id/toggle-verification - Toggle expert verification status
router.patch('/:id/toggle-verification', toggleExpertVerification);

module.exports = router;