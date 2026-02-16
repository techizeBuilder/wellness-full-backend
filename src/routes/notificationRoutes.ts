import { Router } from 'express';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications
} from '../controllers/admin/notificationController';
import { adminProtect } from '../middlewares/admin/adminAuth';

const router = Router();

// All routes require admin authentication
router.use(adminProtect);

// Get all notifications with pagination and filters
router.get('/', getNotifications);

// Get unread notification count
router.get('/count', getUnreadCount);

// Mark notification as read
router.put('/:notificationId/read', markAsRead);

// Mark all notifications as read
router.put('/read-all', markAllAsRead);

// Delete notification
router.delete('/:notificationId', deleteNotification);

// Delete all notifications
router.delete('/', deleteAllNotifications);

export default router;
