import express from 'express';
import {
  getMyPlans,
  getExpertPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan
} from '../controllers/planController';
import { protect, authorize, optionalAuth } from '../middlewares/auth';

const router = express.Router();

// Public routes
router.get('/expert/:expertId', getExpertPlans);
router.get('/:id', optionalAuth, getPlanById);

// Protected routes - Expert only
router.use(protect);
router.use(authorize('expert'));

// Get all plans for current expert
router.get('/', getMyPlans);

// Create, update, delete plans
router.post('/', createPlan);
router.put('/:id', updatePlan);
router.delete('/:id', deletePlan);

export default router;

