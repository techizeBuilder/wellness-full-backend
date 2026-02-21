import { Router, Request, Response } from 'express';
import { protect } from '../middlewares/auth';
import User from '../models/User';
import UserNotification from '../models/UserNotification';
import { HTTP_STATUS } from '../constants/httpStatus';
import logger from '../utils/logger';

const router = Router();

// All routes require user authentication
router.use(protect);

/**
 * @route   POST /api/user/notifications/fcm-token
 * @desc    Register or update push token (auto-detects Expo vs FCM)
 * @access  Private
 */
router.post('/fcm-token', async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const userId = currentUser?._id;
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Token is required',
      });
    }

    // Reject placeholder tokens and clean any already stored (e.g. local-android-* when Firebase not configured)
    if (fcmToken.startsWith('local-')) {
      const user = await User.findById(userId);
      if (user) {
        const isLocal = (t: string) => t.startsWith('local-');
        if (user.fcmTokens?.length) {
          user.fcmTokens = user.fcmTokens.filter((t) => !isLocal(t));
          if (user.fcmToken && isLocal(user.fcmToken)) user.fcmToken = user.fcmTokens[0] ?? null;
        }
        if (user.expoPushTokens?.length) {
          user.expoPushTokens = user.expoPushTokens.filter((t) => !isLocal(t));
          if (user.expoPushToken && isLocal(user.expoPushToken)) user.expoPushToken = user.expoPushTokens[0] ?? null;
        }
        await user.save();
      }
      logger.info(`Skipping invalid/placeholder token for user ${userId}`);
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Token not saved (invalid or simulator token). Configure Firebase for Android push.',
        data: { tokenType: null, skipped: true },
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'User not found',
      });
    }

    // Detect token type: Expo tokens start with 'ExponentPushToken'
    const isExpoToken = fcmToken.startsWith('ExponentPushToken') || fcmToken.startsWith('ExpoPushToken');

    if (isExpoToken) {
      // Handle Expo Push Token
      if (!user.expoPushTokens) {
        user.expoPushTokens = [];
      }

      // Add to array if not exists
      if (!user.expoPushTokens.includes(fcmToken)) {
        user.expoPushTokens.push(fcmToken);
      }

      // Set as primary token
      user.expoPushToken = fcmToken;

      logger.info(`✅ Expo push token registered for user ${userId}: ${fcmToken.substring(0, 30)}...`);
    } else {
      // Handle FCM Token
      if (!user.fcmTokens) {
        user.fcmTokens = [];
      }

      // Add to array if not exists
      if (!user.fcmTokens.includes(fcmToken)) {
        user.fcmTokens.push(fcmToken);
      }

      // Set as primary token
      user.fcmToken = fcmToken;

      logger.info(`✅ FCM token registered for user ${userId}`);
    }

    // Ensure notifications are enabled by default
    if (user.notificationsEnabled === undefined) {
      user.notificationsEnabled = true;
    }

    await user.save();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: isExpoToken ? 'Expo push token registered successfully' : 'FCM token registered successfully',
      data: {
        tokenType: isExpoToken ? 'expo' : 'fcm',
      },
    });
  } catch (error) {
    logger.error('Error registering push token:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error registering push token',
    });
  }
});

/**
 * @route   DELETE /api/user/notifications/fcm-token
 * @desc    Remove push token (auto-detects Expo vs FCM)
 * @access  Private
 */
router.delete('/fcm-token', async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const userId = currentUser?._id;
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Token is required',
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'User not found',
      });
    }

    // Detect token type
    const isExpoToken = fcmToken.startsWith('ExponentPushToken') || fcmToken.startsWith('ExpoPushToken');

    if (isExpoToken) {
      // Remove Expo token
      if (user.expoPushTokens) {
        user.expoPushTokens = user.expoPushTokens.filter((token) => token !== fcmToken);
      }
      if (user.expoPushToken === fcmToken) {
        user.expoPushToken = user.expoPushTokens?.[0] || null;
      }
      logger.info(`Expo push token removed for user ${userId}`);
    } else {
      // Remove FCM token
      if (user.fcmTokens) {
        user.fcmTokens = user.fcmTokens.filter((token) => token !== fcmToken);
      }
      if (user.fcmToken === fcmToken) {
        user.fcmToken = user.fcmTokens?.[0] || null;
      }
      logger.info(`FCM token removed for user ${userId}`);
    }

    await user.save();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: isExpoToken ? 'Expo push token removed successfully' : 'FCM token removed successfully',
    });
  } catch (error) {
    logger.error('Error removing push token:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error removing push token',
    });
  }
});

/**
 * @route   PUT /api/user/notifications/settings
 * @desc    Update notification preferences
 * @access  Private
 */
router.put('/settings', async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const userId = currentUser?._id;
    const { notificationsEnabled } = req.body;

    if (notificationsEnabled === undefined) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'notificationsEnabled field is required',
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'User not found',
      });
    }

    user.notificationsEnabled = notificationsEnabled;
    await user.save();

    logger.info(`Notification settings updated for user ${userId}: ${notificationsEnabled}`);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Notification settings updated successfully',
      data: {
        notificationsEnabled: user.notificationsEnabled,
      },
    });
  } catch (error) {
    logger.error('Error updating notification settings:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error updating notification settings',
    });
  }
});

/**
 * @route   GET /api/user/notifications/settings
 * @desc    Get notification preferences
 * @access  Private
 */
router.get('/settings', async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const userId = currentUser?._id;

    const user = await User.findById(userId).select('notificationsEnabled');

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        notificationsEnabled: user.notificationsEnabled ?? true,
      },
    });
  } catch (error) {
    logger.error('Error fetching notification settings:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error fetching notification settings',
    });
  }
});

/**
 * @route   GET /api/user/notifications/history
 * @desc    Get user's notification history
 * @access  Private
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const userId = currentUser?._id;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const notifications = await UserNotification.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await UserNotification.countDocuments({ userId });
    const unreadCount = await UserNotification.countDocuments({ userId, read: false });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        notifications,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        unreadCount,
      },
    });
  } catch (error) {
    logger.error('Error fetching notification history:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error fetching notification history',
    });
  }
});

/**
 * @route   PUT /api/user/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.put('/:id/read', async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const userId = currentUser?._id;
    const { id } = req.params;

    const notification = await UserNotification.findOneAndUpdate(
      { _id: id, userId },
      { read: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Notification not found',
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error updating notification',
    });
  }
});

/**
 * @route   PUT /api/user/notifications/mark-all-read
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.put('/mark-all-read', async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const userId = currentUser?._id;

    const result = await UserNotification.updateMany(
      { userId, read: false },
      { read: true, readAt: new Date() }
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: `${result.modifiedCount} notifications marked as read`,
      data: {
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error updating notifications',
    });
  }
});

/**
 * @route   DELETE /api/user/notifications/:id
 * @desc    Delete a notification
 * @access  Private
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const userId = currentUser?._id;
    const { id } = req.params;

    const notification = await UserNotification.findOneAndDelete({ _id: id, userId });

    if (!notification) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Notification not found',
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting notification:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error deleting notification',
    });
  }
});

export default router;
