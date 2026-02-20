/**
 * Expo Push Notification Service
 * Handles sending notifications to Expo Push Tokens
 */

import { Expo, ExpoPushMessage, ExpoPushTicket, ExpoPushReceipt } from 'expo-server-sdk';
import logger from '../utils/logger';

// Create a new Expo SDK client
const expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN, // Optional, for higher rate limits
});

export interface ExpoPushPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
}

export const expoNotificationService = {
  /**
   * Check if a token is a valid Expo Push Token
   */
  isExpoPushToken(token: string): boolean {
    return Expo.isExpoPushToken(token);
  },

  /**
   * Send notification to a single Expo Push Token
   */
  async sendToToken(
    token: string,
    payload: ExpoPushPayload
  ): Promise<boolean> {
    try {
      // Check that the token is valid
      if (!Expo.isExpoPushToken(token)) {
        logger.warn(`Invalid Expo push token: ${token}`);
        return false;
      }

      const message: ExpoPushMessage = {
        to: token,
        sound: payload.sound || 'default',
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
        badge: payload.badge,
        channelId: payload.channelId || 'default',
        priority: payload.priority || 'high',
      };

      const chunks = expo.chunkPushNotifications([message]);
      const tickets: ExpoPushTicket[] = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          logger.error('Error sending push notification chunk:', error);
        }
      }

      // Check if the notification was sent successfully
      for (const ticket of tickets) {
        if (ticket.status === 'error') {
          logger.error(`Expo push error: ${ticket.message}`, {
            details: ticket.details,
          });
          return false;
        }
      }

      logger.info(`Expo push notification sent successfully to ${token.substring(0, 30)}...`);
      return true;
    } catch (error) {
      logger.error('Error sending Expo push notification:', error);
      return false;
    }
  },

  /**
   * Send notifications to multiple Expo Push Tokens
   */
  async sendToMultipleTokens(
    tokens: string[],
    payload: ExpoPushPayload
  ): Promise<{ successCount: number; failureCount: number }> {
    try {
      // Filter only valid Expo push tokens
      const validTokens = tokens.filter(token => Expo.isExpoPushToken(token));

      if (validTokens.length === 0) {
        logger.warn('No valid Expo push tokens provided');
        return { successCount: 0, failureCount: tokens.length };
      }

      const messages: ExpoPushMessage[] = validTokens.map(token => ({
        to: token,
        sound: payload.sound || 'default',
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
        badge: payload.badge,
        channelId: payload.channelId || 'default',
        priority: payload.priority || 'high',
      }));

      const chunks = expo.chunkPushNotifications(messages);
      const tickets: ExpoPushTicket[] = [];

      // Send notifications in chunks
      for (const chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          logger.error('Error sending push notification chunk:', error);
        }
      }

      // Count successes and failures
      let successCount = 0;
      let failureCount = 0;

      for (const ticket of tickets) {
        if (ticket.status === 'ok') {
          successCount++;
        } else {
          failureCount++;
          logger.error(`Expo push error: ${ticket.message}`, {
            details: ticket.details,
          });
        }
      }

      // Add invalid tokens to failure count
      failureCount += tokens.length - validTokens.length;

      logger.info(`Expo push notifications sent: ${successCount} success, ${failureCount} failed`);
      return { successCount, failureCount };
    } catch (error) {
      logger.error('Error sending Expo push notifications:', error);
      return { successCount: 0, failureCount: tokens.length };
    }
  },

  /**
   * Retrieve push notification receipts
   * (Used to check if notifications were delivered)
   */
  async getReceipts(receiptIds: string[]): Promise<Record<string, ExpoPushReceipt>> {
    try {
      const receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
      const receipts: Record<string, ExpoPushReceipt> = {};

      for (const chunk of receiptIdChunks) {
        try {
          const receiptChunk = await expo.getPushNotificationReceiptsAsync(chunk);
          Object.assign(receipts, receiptChunk);
        } catch (error) {
          logger.error('Error retrieving push notification receipts:', error);
        }
      }

      return receipts;
    } catch (error) {
      logger.error('Error getting Expo push receipts:', error);
      return {};
    }
  },
};
