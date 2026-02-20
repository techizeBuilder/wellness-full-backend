import admin from 'firebase-admin';
import ENV from '../config/environment';
import logger from '../utils/logger';

// Initialize Firebase Admin SDK
let firebaseInitialized = false;

export const initializeFirebase = () => {
  if (firebaseInitialized) {
    return;
  }

  try {
    // Check if Firebase credentials are available
    if (!ENV.FIREBASE_PROJECT_ID || !ENV.FIREBASE_PRIVATE_KEY || !ENV.FIREBASE_CLIENT_EMAIL) {
      logger.warn('Firebase credentials not configured. Push notifications will be disabled.');
      return;
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: ENV.FIREBASE_PROJECT_ID,
        privateKey: ENV.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: ENV.FIREBASE_CLIENT_EMAIL,
      }),
    });

    firebaseInitialized = true;
    logger.info('Firebase Admin SDK initialized successfully');
  } catch (error) {
    logger.error('Error initializing Firebase Admin SDK:', error);
  }
};

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

export const fcmService = {
  /**
   * Send push notification to a single device
   */
  async sendToDevice(
    fcmToken: string,
    payload: PushNotificationPayload
  ): Promise<boolean> {
    if (!firebaseInitialized) {
      logger.warn('Firebase not initialized. Cannot send push notification.');
      return false;
    }

    try {
      const message: admin.messaging.Message = {
        token: fcmToken,
        notification: {
          title: payload.title,
          body: payload.body,
          ...(payload.imageUrl && { imageUrl: payload.imageUrl }),
        },
        data: payload.data || {},
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            priority: 'high',
            channelId: 'wellness-notifications',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      logger.info(`Successfully sent push notification: ${response}`);
      return true;
    } catch (error: any) {
      logger.error('Error sending push notification:', error);
      
      // Handle invalid token
      if (error.code === 'messaging/invalid-registration-token' || 
          error.code === 'messaging/registration-token-not-registered') {
        logger.warn(`Invalid FCM token: ${fcmToken}. Token should be removed from database.`);
      }
      
      return false;
    }
  },

  /**
   * Send push notification to multiple devices
   */
  async sendToMultipleDevices(
    fcmTokens: string[],
    payload: PushNotificationPayload
  ): Promise<{ successCount: number; failureCount: number }> {
    if (!firebaseInitialized || fcmTokens.length === 0) {
      return { successCount: 0, failureCount: fcmTokens.length };
    }

    try {
      const message: admin.messaging.MulticastMessage = {
        tokens: fcmTokens,
        notification: {
          title: payload.title,
          body: payload.body,
          ...(payload.imageUrl && { imageUrl: payload.imageUrl }),
        },
        data: payload.data || {},
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            priority: 'high',
            channelId: 'wellness-notifications',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      
      logger.info(
        `Push notification sent to ${response.successCount}/${fcmTokens.length} devices`
      );

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error) {
      logger.error('Error sending multicast push notification:', error);
      return { successCount: 0, failureCount: fcmTokens.length };
    }
  },

  /**
   * Send topic-based notification
   */
  async sendToTopic(
    topic: string,
    payload: PushNotificationPayload
  ): Promise<boolean> {
    if (!firebaseInitialized) {
      return false;
    }

    try {
      const message: admin.messaging.Message = {
        topic,
        notification: {
          title: payload.title,
          body: payload.body,
          ...(payload.imageUrl && { imageUrl: payload.imageUrl }),
        },
        data: payload.data || {},
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            priority: 'high',
            channelId: 'wellness-notifications',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      logger.info(`Successfully sent topic notification to ${topic}: ${response}`);
      return true;
    } catch (error) {
      logger.error(`Error sending topic notification to ${topic}:`, error);
      return false;
    }
  },

  /**
   * Subscribe devices to a topic
   */
  async subscribeToTopic(fcmTokens: string[], topic: string): Promise<boolean> {
    if (!firebaseInitialized) {
      return false;
    }

    try {
      const response = await admin.messaging().subscribeToTopic(fcmTokens, topic);
      logger.info(`Subscribed ${response.successCount} devices to topic: ${topic}`);
      return true;
    } catch (error) {
      logger.error(`Error subscribing to topic ${topic}:`, error);
      return false;
    }
  },

  /**
   * Unsubscribe devices from a topic
   */
  async unsubscribeFromTopic(fcmTokens: string[], topic: string): Promise<boolean> {
    if (!firebaseInitialized) {
      return false;
    }

    try {
      const response = await admin.messaging().unsubscribeFromTopic(fcmTokens, topic);
      logger.info(`Unsubscribed ${response.successCount} devices from topic: ${topic}`);
      return true;
    } catch (error) {
      logger.error(`Error unsubscribing from topic ${topic}:`, error);
      return false;
    }
  },
};

export default fcmService;
