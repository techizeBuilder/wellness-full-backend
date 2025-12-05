import express from 'express';
import { getReports } from '../../controllers/admin/reportsController';
import { adminProtect } from '../../middlewares/admin/adminAuth';

const router = express.Router();

// All routes require admin authentication
router.use(adminProtect);

// GET /api/admin/reports - Get reports and analytics data
router.get('/', getReports);

export default router;

