import mongoose from 'mongoose';
import Notification from '../models/Notification';

type NotificationType = 'payment' | 'new_user' | 'new_expert' | 'booking' | 'subscription' | 'system' | 'report';

export const notificationService = {
  // Create notification for a single admin
  async createNotification(
    adminId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: any
  ) {
    try {
      const notification = await Notification.create({
        adminId: new mongoose.Types.ObjectId(adminId),
        type,
        title,
        message,
        data: data || {}
      });
      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      return null;
    }
  },

  // Create notification for all admins
  async createSystemNotification(
    type: NotificationType,
    title: string,
    message: string,
    data?: any
  ) {
    try {
      // Get all admin IDs from database
      const Admin = require('../models/Admin').default;
      const admins = await Admin.find().select('_id');
      
      if (admins.length === 0) return [];

      const adminIds = admins.map((admin: any) => admin._id);

      const notifications = await Notification.insertMany(
        adminIds.map(adminId => ({
          adminId,
          type,
          title,
          message,
          data: data || {}
        }))
      );
      return notifications;
    } catch (error) {
      console.error('Error creating system notification:', error);
      return [];
    }
  },

  // Create payment notification
  async notifyPaymentReceived(adminId: string, paymentData: any) {
    return this.createNotification(
      adminId,
      'payment',
      'Payment Received',
      `Payment of ₹${paymentData.amount} received from ${paymentData.userName || 'User'}`,
      { paymentId: paymentData.paymentId, amount: paymentData.amount }
    );
  },

  // Create new user notification
  async notifyNewUserCreated(adminId: string, userData: any) {
    return this.createNotification(
      adminId,
      'new_user',
      'New User Registration',
      `New user ${userData.name || userData.email} has registered`,
      { userId: userData.userId, email: userData.email }
    );
  },

  // Create new expert notification
  async notifyNewExpertCreated(adminId: string, expertData: any) {
    return this.createNotification(
      adminId,
      'new_expert',
      'New Expert Registration',
      `New expert ${expertData.name} has registered`,
      { expertId: expertData.expertId, specialty: expertData.specialty }
    );
  },

  // Create booking notification
  async notifyBookingCreated(adminId: string, bookingData: any) {
    return this.createNotification(
      adminId,
      'booking',
      'New Booking',
      `New booking from ${bookingData.userName}`,
      { bookingId: bookingData.bookingId }
    );
  },

  // Create subscription notification
  async notifySubscriptionCreated(adminId: string, subscriptionData: any) {
    return this.createNotification(
      adminId,
      'subscription',
      'New Subscription',
      `${subscriptionData.userName} subscribed to ${subscriptionData.planName}`,
      { subscriptionId: subscriptionData.subscriptionId }
    );
  },

  // Create system notification
  async notifySystemEvent(adminId: string, title: string, message: string) {
    return this.createNotification(
      adminId,
      'system',
      title,
      message
    );
  },

  // Dispatch event to refresh notifications
  dispatchNotificationUpdate() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('notificationUpdated'));
    }
  }
};

export default notificationService;
