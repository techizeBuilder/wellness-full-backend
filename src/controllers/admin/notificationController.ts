import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { asyncHandler } from '../../middlewares/errorHandler';
import Notification from '../../models/Notification';
import ApiResponse from '../../utils/response';

// Get all notifications for admin
export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const adminId = new mongoose.Types.ObjectId((req as any).admin.id);
  const { page = 1, limit = 10, isRead } = req.query;

  const pageNum = Math.max(1, parseInt(page as string) || 1);
  const limitNum = Math.max(1, Math.min(50, parseInt(limit as string) || 10));
  const skip = (pageNum - 1) * limitNum;

  let query: any = { adminId };

  if (isRead !== undefined) {
    query.isRead = isRead === 'true';
  }

  console.log(`[Notifications] Fetching for admin: ${adminId}, Query:`, query);

  const [notifications, total] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Notification.countDocuments(query)
  ]);

  console.log(`[Notifications] Found ${total} total, returning ${notifications.length} on page ${pageNum}`);

  return ApiResponse.success(res, {
    notifications,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum)
    }
  }, 'Notifications fetched successfully');
});

// Get unread notification count
export const getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
  const adminId = new mongoose.Types.ObjectId((req as any).admin.id);

  const unreadCount = await Notification.countDocuments({
    adminId,
    isRead: false
  });

  console.log(`[Notifications] Unread count for admin ${adminId}: ${unreadCount}`);

  return ApiResponse.success(res, {
    unreadCount
  }, 'Unread count fetched successfully');
});

// Mark notification as read
export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const adminId = new mongoose.Types.ObjectId((req as any).admin.id);
  const { notificationId } = req.params;

  const notification = await Notification.findOne({
    _id: notificationId,
    adminId
  });

  if (!notification) {
    return ApiResponse.notFound(res, 'Notification not found');
  }

  notification.isRead = true;
  notification.readAt = new Date();
  await notification.save();

  return ApiResponse.success(res, { notification }, 'Notification marked as read');
});

// Mark all notifications as read
export const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
  const adminId = new mongoose.Types.ObjectId((req as any).admin.id);

  await Notification.updateMany(
    { adminId, isRead: false },
    { 
      isRead: true,
      readAt: new Date()
    }
  );

  return ApiResponse.success(res, {}, 'All notifications marked as read');
});

// Delete notification
export const deleteNotification = asyncHandler(async (req: Request, res: Response) => {
  const adminId = new mongoose.Types.ObjectId((req as any).admin.id);
  const { notificationId } = req.params;

  const notification = await Notification.findOneAndDelete({
    _id: notificationId,
    adminId
  });

  if (!notification) {
    return ApiResponse.notFound(res, 'Notification not found');
  }

  return ApiResponse.success(res, {}, 'Notification deleted successfully');
});

// Delete all notifications
export const deleteAllNotifications = asyncHandler(async (req: Request, res: Response) => {
  const adminId = new mongoose.Types.ObjectId((req as any).admin.id);

  await Notification.deleteMany({ adminId });

  return ApiResponse.success(res, {}, 'All notifications deleted successfully');
});

// Create notification (for internal use)
export const createNotification = async (
  adminId: string,
  type: 'payment' | 'new_user' | 'new_expert' | 'booking' | 'subscription' | 'system' | 'report',
  title: string,
  message: string,
  data?: any
) => {
  try {
    const notification = await Notification.create({
      adminId,
      type,
      title,
      message,
      data
    });
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};
