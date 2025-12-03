import express from 'express';
const router = express.Router();

import { getDashboardStats } from '../../controllers/admin/dashboardController';
import { adminProtect } from '../../middlewares/admin/adminAuth';

// All dashboard routes require admin authentication
router.use(adminProtect);

// GET /api/admin/dashboard - Get dashboard statistics
router.get('/', getDashboardStats);

export default router;

