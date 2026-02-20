import express from 'express';
const router = express.Router();

import {
  getContentStats,
  getContents,
  getContentById,
  createContent,
  updateContent,
  deleteContent,
  permanentlyDeleteContent
} from '../../controllers/admin/contentController';

import { adminProtect } from '../../middlewares/admin/adminAuth';
import { uploadContentImage, handleUploadError } from '../../middlewares/upload';

// All routes require admin authentication
router.use(adminProtect);

// GET /api/admin/contents/stats - Get content statistics
router.get('/stats', getContentStats);

// GET /api/admin/contents - Get all contents
router.get('/', getContents);

// GET /api/admin/contents/:id - Get content by ID
router.get('/:id', getContentById);

// POST /api/admin/contents - Create new content (with optional image upload)
router.post('/', uploadContentImage, handleUploadError, createContent);

// PUT /api/admin/contents/:id - Update content (with optional image upload)
router.put('/:id', uploadContentImage, handleUploadError, updateContent);

// DELETE /api/admin/contents/:id - Delete content (soft delete)
router.delete('/:id', deleteContent);

// DELETE /api/admin/contents/:id/permanent - Permanently delete content
router.delete('/:id/permanent', permanentlyDeleteContent);

export default router;
