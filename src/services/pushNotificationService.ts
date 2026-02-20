import { fcmService, PushNotificationPayload } from './fcmService';
import { expoNotificationService } from './expoNotificationService';
import User from '../models/User';
import UserNotification from '../models/UserNotification';
import logger from '../utils/logger';
import mongoose from 'mongoose';

export interface NotificationData {
  type: 'appointment' | 'payment' | 'subscription' | 'reminder' | 'expert' | 'general';
  id?: string;
  [key: string]: any;
}

export const pushNotificationService = {
  /**
   * Send notification to a specific user
   */
  async sendToUser(
    userId: string | mongoose.Types.ObjectId,
    title: string,
    body: string,
    data?: NotificationData
  ): Promise<boolean> {
    try {
      const user = await User.findById(userId).select('fcmToken fcmTokens expoPushToken expoPushTokens notificationsEnabled');
      
      if (!user) {
        logger.info(`User ${userId} not found`);
        return false;
      }

      // ALWAYS save to database first (so user can see in app even if push fails)
      try {
        await UserNotification.create({
          userId: user._id,
          title,
          message: body,
          type: data?.type || 'general',
          subType: data?.subType,
          data: data || {},
          read: false,
        });
        logger.info(`✅ Notification saved to database for user ${userId}`);
      } catch (dbError) {
        logger.error('Error saving notification to database:', dbError);
      }

      // If notifications disabled, just save to DB (already done above)
      if (!user.notificationsEnabled) {
        logger.info(`User ${userId} has notifications disabled (saved to DB only)`);
        return true; // Return true because we saved to DB
      }

      // Collect all tokens (both Expo and FCM)
      const allTokens: string[] = [];
      if (user.expoPushToken) allTokens.push(user.expoPushToken);
      if (user.expoPushTokens && user.expoPushTokens.length > 0) {
        allTokens.push(...user.expoPushTokens);
      }
      if (user.fcmToken) allTokens.push(user.fcmToken);
      if (user.fcmTokens && user.fcmTokens.length > 0) {
        allTokens.push(...user.fcmTokens);
      }

      if (allTokens.length === 0) {
        logger.info(`No push tokens found for user ${userId} (notification saved to DB)`);
        return true; // Return true because we saved to DB
      }

      // Separate Expo tokens from Firebase tokens
      const expoTokens: string[] = [];
      const firebaseTokens: string[] = [];
      
      for (const token of allTokens) {
        // Filter out local-android tokens (invalid)
        if (token.startsWith('local-')) {
          continue;
        }
        
        if (expoNotificationService.isExpoPushToken(token)) {
          expoTokens.push(token);
        } else {
          firebaseTokens.push(token);
        }
      }

      logger.info(`Sending notifications to user ${userId}: ${expoTokens.length} Expo tokens, ${firebaseTokens.length} Firebase tokens`);

      let expoSuccess = false;
      let firebaseSuccess = false;

      // Send to Expo tokens
      if (expoTokens.length > 0) {
        const expoPayload = {
          title,
          body,
          data: data ? this.stringifyData(data) : undefined,
          sound: 'default' as const,
          priority: 'high' as const,
          channelId: 'wellness-notifications',
        };

        if (expoTokens.length === 1) {
          expoSuccess = await expoNotificationService.sendToToken(expoTokens[0], expoPayload);
        } else {
          const result = await expoNotificationService.sendToMultipleTokens(expoTokens, expoPayload);
          expoSuccess = result.successCount > 0;
        }
      }

      // Send to Firebase tokens
      if (firebaseTokens.length > 0) {
        const fcmPayload: PushNotificationPayload = {
          title,
          body,
          data: data ? this.stringifyData(data) : undefined,
        };

        if (firebaseTokens.length === 1) {
          firebaseSuccess = await fcmService.sendToDevice(firebaseTokens[0], fcmPayload);
        } else {
          const result = await fcmService.sendToMultipleDevices(firebaseTokens, fcmPayload);
          firebaseSuccess = result.successCount > 0;
        }
      }

      // Return true if push sent OR saved to database (at least user can see in app)
      const pushSent = expoSuccess || firebaseSuccess;
      logger.info(`Notification for user ${userId}: Push=${pushSent}, SavedToDB=true`);
      return true; // Always true because we saved to DB
    } catch (error) {
      logger.error(`Error sending notification to user ${userId}:`, error);
      return false;
    }
  },

  /**
   * Send notification to multiple users
   */
  async sendToMultipleUsers(
    userIds: (string | mongoose.Types.ObjectId)[],
    title: string,
    body: string,
    data?: NotificationData
  ): Promise<{ successCount: number; failureCount: number }> {
    try {
      const users = await User.find({
        _id: { $in: userIds },
        notificationsEnabled: true,
      }).select('fcmToken fcmTokens expoPushToken expoPushTokens');

      // Save to database for all users
      const notificationsToCreate = userIds.map(userId => ({
        userId,
        title,
        message: body,
        type: data?.type || 'general',
        subType: data?.subType,
        data: data || {},
        read: false,
      }));

      try {
        await UserNotification.insertMany(notificationsToCreate);
        logger.info(`✅ ${notificationsToCreate.length} notifications saved to database`);
      } catch (dbError) {
        logger.error('Error saving notifications to database:', dbError);
      }

      // Collect all tokens
      const allTokens: string[] = [];
      
      for (const user of users) {
        if (user.expoPushToken) allTokens.push(user.expoPushToken);
        if (user.expoPushTokens && user.expoPushTokens.length > 0) {
          allTokens.push(...user.expoPushTokens);
        }
        if (user.fcmToken) allTokens.push(user.fcmToken);
        if (user.fcmTokens && user.fcmTokens.length > 0) {
          allTokens.push(...user.fcmTokens);
        }
      }

      if (allTokens.length === 0) {
        logger.info('No push tokens found for users (notifications saved to DB)');
        return { successCount: userIds.length, failureCount: 0 }; // Success because saved to DB
      }

      // Separate Expo and Firebase tokens
      const expoTokens: string[] = [];
      const firebaseTokens: string[] = [];
      
      for (const token of allTokens) {
        if (token.startsWith('local-')) continue; // Skip invalid tokens
        
        if (expoNotificationService.isExpoPushToken(token)) {
          expoTokens.push(token);
        } else {
          firebaseTokens.push(token);
        }
      }

      let totalSuccess = 0;
      let totalFailure = 0;

      // Send to Expo tokens
      if (expoTokens.length > 0) {
        const expoPayload = {
          title,
          body,
          data: data ? this.stringifyData(data) : undefined,
          sound: 'default' as const,
          priority: 'high' as const,
          channelId: 'wellness-notifications',
        };

        const expoResult = await expoNotificationService.sendToMultipleTokens(expoTokens, expoPayload);
        totalSuccess += expoResult.successCount;
        totalFailure += expoResult.failureCount;
      }

      // Send to Firebase tokens
      if (firebaseTokens.length > 0) {
        const fcmPayload: PushNotificationPayload = {
          title,
          body,
          data: data ? this.stringifyData(data) : undefined,
        };

        const fcmResult = await fcmService.sendToMultipleDevices(firebaseTokens, fcmPayload);
        totalSuccess += fcmResult.successCount;
        totalFailure += fcmResult.failureCount;
      }

      logger.info(`Bulk notification: ${totalSuccess} sent, ${totalFailure} failed, ${userIds.length} saved to DB`);
      return { successCount: totalSuccess, failureCount: totalFailure };
    } catch (error) {
      logger.error('Error sending notification to multiple users:', error);
      return { successCount: 0, failureCount: userIds.length };
    }
  },

  /**
   * Notification: Appointment reminder (30 minutes before)
   */
  async sendAppointmentReminder(
    userId: string | mongoose.Types.ObjectId,
    expertName: string,
    appointmentTime: string,
    appointmentId: string
  ): Promise<boolean> {
    return this.sendToUser(
      userId,
      'Appointment Reminder',
      `Your session with ${expertName} starts in 30 minutes at ${appointmentTime}`,
      {
        type: 'reminder',
        subType: 'appointment',
        id: appointmentId,
        expertName,
        appointmentTime,
      }
    );
  },

  /**
   * Notification: Appointment confirmed
   */
  async sendAppointmentConfirmed(
    userId: string | mongoose.Types.ObjectId,
    expertName: string,
    appointmentDate: string,
    appointmentTime: string,
    appointmentId: string
  ): Promise<boolean> {
    return this.sendToUser(
      userId,
      'Appointment Confirmed',
      `Your session with ${expertName} is confirmed for ${appointmentDate} at ${appointmentTime}`,
      {
        type: 'appointment',
        subType: 'confirmed',
        id: appointmentId,
        expertName,
        appointmentDate,
        appointmentTime,
      }
    );
  },

  /**
   * Notification: Appointment cancelled
   */
  async sendAppointmentCancelled(
    userId: string | mongoose.Types.ObjectId,
    expertName: string,
    reason?: string,
    appointmentId?: string
  ): Promise<boolean> {
    const body = reason 
      ? `Your appointment with ${expertName} has been cancelled. Reason: ${reason}`
      : `Your appointment with ${expertName} has been cancelled`;
      
    return this.sendToUser(
      userId,
      'Appointment Cancelled',
      body,
      {
        type: 'appointment',
        subType: 'cancelled',
        id: appointmentId,
        expertName,
        reason,
      }
    );
  },

  /**
   * Notification: Appointment rescheduled
   */
  async sendAppointmentRescheduled(
    userId: string | mongoose.Types.ObjectId,
    expertName: string,
    newDate: string,
    newTime: string,
    appointmentId: string
  ): Promise<boolean> {
    return this.sendToUser(
      userId,
      'Appointment Rescheduled',
      `Your appointment with ${expertName} has been rescheduled to ${newDate} at ${newTime}`,
      {
        type: 'appointment',
        subType: 'rescheduled',
        id: appointmentId,
        expertName,
        newDate,
        newTime,
      }
    );
  },

  /**
   * Notification: Payment successful
   */
  async sendPaymentSuccess(
    userId: string | mongoose.Types.ObjectId,
    amount: number,
    purpose: string,
    paymentId: string
  ): Promise<boolean> {
    return this.sendToUser(
      userId,
      'Payment Successful',
      `Your payment of ₹${amount} for ${purpose} was successful`,
      {
        type: 'payment',
        subType: 'success',
        id: paymentId,
        amount: amount.toString(),
        purpose,
      }
    );
  },

  /**
   * Notification: Payment failed
   */
  async sendPaymentFailed(
    userId: string | mongoose.Types.ObjectId,
    amount: number,
    purpose: string,
    paymentId?: string
  ): Promise<boolean> {
    return this.sendToUser(
      userId,
      'Payment Failed',
      `Your payment of ₹${amount} for ${purpose} failed. Please try again.`,
      {
        type: 'payment',
        subType: 'failed',
        id: paymentId,
        amount: amount.toString(),
        purpose,
      }
    );
  },

  /**
   * Notification: Subscription activated
   */
  async sendSubscriptionActivated(
    userId: string | mongoose.Types.ObjectId,
    planName: string,
    validUntil: string,
    subscriptionId: string
  ): Promise<boolean> {
    return this.sendToUser(
      userId,
      'Subscription Activated',
      `Your ${planName} subscription is now active! Valid until ${validUntil}`,
      {
        type: 'subscription',
        subType: 'activated',
        id: subscriptionId,
        planName,
        validUntil,
      }
    );
  },

  /**
   * Notification: Subscription expiring soon (3 days before)
   */
  async sendSubscriptionExpiringSoon(
    userId: string | mongoose.Types.ObjectId,
    planName: string,
    daysRemaining: number,
    subscriptionId: string
  ): Promise<boolean> {
    return this.sendToUser(
      userId,
      'Subscription Expiring Soon',
      `Your ${planName} subscription expires in ${daysRemaining} days. Renew now to continue enjoying benefits!`,
      {
        type: 'subscription',
        subType: 'expiring',
        id: subscriptionId,
        planName,
        daysRemaining: daysRemaining.toString(),
      }
    );
  },

  /**
   * Notification: Subscription expired
   */
  async sendSubscriptionExpired(
    userId: string | mongoose.Types.ObjectId,
    planName: string,
    subscriptionId: string
  ): Promise<boolean> {
    return this.sendToUser(
      userId,
      'Subscription Expired',
      `Your ${planName} subscription has expired. Renew now to continue accessing premium content.`,
      {
        type: 'subscription',
        subType: 'expired',
        id: subscriptionId,
        planName,
      }
    );
  },

  /**
   * Notification: New expert available
   */
  async sendNewExpertAvailable(
    userId: string | mongoose.Types.ObjectId,
    expertName: string,
    specialty: string,
    expertId: string
  ): Promise<boolean> {
    return this.sendToUser(
      userId,
      'New Expert Available',
      `${expertName}, a ${specialty} specialist, is now available for consultations!`,
      {
        type: 'expert',
        subType: 'new',
        id: expertId,
        expertName,
        specialty,
      }
    );
  },

  /**
   * Notification: Expert accepted appointment
   */
  async sendExpertAcceptedAppointment(
    userId: string | mongoose.Types.ObjectId,
    expertName: string,
    appointmentDate: string,
    appointmentId: string
  ): Promise<boolean> {
    return this.sendToUser(
      userId,
      'Appointment Accepted',
      `${expertName} has accepted your appointment request for ${appointmentDate}`,
      {
        type: 'appointment',
        subType: 'accepted',
        id: appointmentId,
        expertName,
        appointmentDate,
      }
    );
  },

  /**
   * Notification: Expert rejected appointment
   */
  async sendExpertRejectedAppointment(
    userId: string | mongoose.Types.ObjectId,
    expertName: string,
    reason?: string,
    appointmentId?: string
  ): Promise<boolean> {
    const body = reason
      ? `${expertName} has declined your appointment request. Reason: ${reason}`
      : `${expertName} has declined your appointment request`;
      
    return this.sendToUser(
      userId,
      'Appointment Declined',
      body,
      {
        type: 'appointment',
        subType: 'rejected',
        id: appointmentId,
        expertName,
        reason,
      }
    );
  },

  /**
   * Notification: Prescription uploaded
   */
  async sendPrescriptionUploaded(
    userId: string | mongoose.Types.ObjectId,
    expertName: string,
    appointmentId: string
  ): Promise<boolean> {
    return this.sendToUser(
      userId,
      'Prescription Available',
      `${expertName} has uploaded your prescription. View it now in your appointments.`,
      {
        type: 'appointment',
        subType: 'prescription',
        id: appointmentId,
        expertName,
      }
    );
  },

  /**
   * Notification: Session starting soon (5 minutes before)
   */
  async sendSessionStartingSoon(
    userId: string | mongoose.Types.ObjectId,
    expertName: string,
    appointmentId: string
  ): Promise<boolean> {
    return this.sendToUser(
      userId,
      'Session Starting Soon',
      `Your session with ${expertName} starts in 5 minutes. Join now!`,
      {
        type: 'reminder',
        subType: 'session-starting',
        id: appointmentId,
        expertName,
      }
    );
  },

  /**
   * Notification: Welcome new user
   */
  async sendWelcomeNotification(
    userId: string | mongoose.Types.ObjectId,
    userName: string
  ): Promise<boolean> {
    return this.sendToUser(
      userId,
      'Welcome to Wellness',
      `Hi ${userName}! Welcome aboard. Start your wellness journey by booking your first consultation.`,
      {
        type: 'general',
        subType: 'welcome',
      }
    );
  },

  /**
   * Notification: General message to user
   */
  async sendGeneralNotification(
    userId: string | mongoose.Types.ObjectId,
    title: string,
    message: string,
    data?: NotificationData
  ): Promise<boolean> {
    return this.sendToUser(userId, title, message, data);
  },

  /**
   * Helper: Convert data object to string values (FCM requirement)
   */
  stringifyData(data: Record<string, any>): Record<string, string> {
    const stringified: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        stringified[key] = typeof value === 'string' ? value : JSON.stringify(value);
      }
    }
    return stringified;
  },
};

export default pushNotificationService;
