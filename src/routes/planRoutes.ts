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

// Public route - Get plans for an expert
router.get('/expert/:expertId', getExpertPlans);

// Protected routes - Expert only
router.use(protect);
router.use(authorize('expert'));

// Get all plans for current expert
router.get('/', getMyPlans);

// Get plan by ID (expert can see their own, public can see active ones)
router.get('/:id', optionalAuth, getPlanById);

// Create, update, delete plans
router.post('/', createPlan);
router.put('/:id', updatePlan);
router.delete('/:id', deletePlan);

export default router;

