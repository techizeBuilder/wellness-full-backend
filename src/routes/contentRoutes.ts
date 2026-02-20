import express from 'express';
import {
  getContents,
  getFeaturedContents,
  getContentById,
  getContentsByCategory,
  getContentsByType
} from '../controllers/contentController';

const router = express.Router();

// Public routes - No authentication required
// GET /api/contents - Get all contents with filters
router.get('/', getContents);

// GET /api/contents/featured - Get featured contents
router.get('/featured', getFeaturedContents);

// GET /api/contents/category/:category - Get contents by category
router.get('/category/:category', getContentsByCategory);

// GET /api/contents/type/:type - Get contents by type
router.get('/type/:type', getContentsByType);

// GET /api/contents/:id - Get content by ID
router.get('/:id', getContentById);

export default router;
