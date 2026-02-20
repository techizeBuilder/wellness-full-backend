/**
 * QUICK TEST SCRIPT - Send Test Notification to Specific User
 * 
 * This script sends a test notification to a specific user email.
 * Run: npx ts-node src/tests/send-test-notification.ts
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

import connectDB from '../config/database';
import User from '../models/User';
import Appointment from '../models/Appointment';
import Payment from '../models/Payment';
import Expert from '../models/Expert';
import { pushNotificationService } from '../services/pushNotificationService';
import { initializeFirebase } from '../services/fcmService';

// Configuration
const TEST_USER_EMAIL = 'vermakhushbu8384@gmail.com';

// Logger
const log = {
  info: (message: string) => console.log(`[${new Date().toISOString()}] [INFO] ${message}`),
  error: (message: string, error?: any) => {
    console.error(`[${new Date().toISOString()}] [ERROR] ${message}`);
    if (error) console.error(error);
  },
  warn: (message: string) => console.warn(`[${new Date().toISOString()}] [WARN] ${message}`),
};

// Helper function to wait
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Send multiple notification types
async function sendTestNotifications() {
  try {
    console.log('\n============================================================');
    console.log('🚀 SENDING TEST NOTIFICATIONS');
    console.log('============================================================\n');

    // Connect to database
    log.info('Connecting to MongoDB...');
    await connectDB();
    log.info('✅ Connected to MongoDB');

    // Initialize Firebase
    log.info('Initializing Firebase...');
    initializeFirebase();
    log.info('✅ Firebase initialized');

    // Find user by email
    log.info(`Finding user: ${TEST_USER_EMAIL}`);
    const user = await User.findOne({ email: TEST_USER_EMAIL });

    if (!user) {
      log.error(`❌ User not found: ${TEST_USER_EMAIL}`);
      process.exit(1);
    }

    log.info(`✅ Found user: ${user.name} (${user.email})`);
    log.info(`   User ID: ${user._id}`);
    
    if (user.fcmToken) {
      log.info(`   FCM Token: ${user.fcmToken.substring(0, 50)}...`);
    } else if (user.fcmTokens && user.fcmTokens.length > 0) {
      log.info(`   FCM Tokens: ${user.fcmTokens.length} token(s)`);
      user.fcmTokens.forEach((token, idx) => {
        log.info(`     [${idx + 1}] ${token.substring(0, 50)}...`);
      });
    } else {
      log.warn('⚠️  User has no FCM token registered!');
      log.warn('   Please open the app and grant notification permissions first.');
      process.exit(1);
    }

    log.info(`   Notifications Enabled: ${user.notificationsEnabled !== false ? 'Yes' : 'No'}`);

    // Get some sample data for realistic notifications
    const appointment = await Appointment.findOne({ user: user._id }).populate('expert') as any;
    const payment = await Payment.findOne({ user: user._id });
    const expert = await Expert.findOne().limit(1);

    console.log('\n============================================================');
    console.log('📤 SENDING NOTIFICATIONS');
    console.log('============================================================\n');

    const notifications = [];

    // 1. Welcome Notification
    notifications.push({
      name: 'Welcome',
      fn: async () => {
        await pushNotificationService.sendWelcomeNotification(user._id.toString(), user.name);
      }
    });

    // 2. General Announcement
    notifications.push({
      name: 'General Announcement',
      fn: async () => {
        await pushNotificationService.sendGeneralNotification(
          user._id.toString(),
          'New Feature Available! 🎉',
          'Check out our new meditation sessions and wellness challenges.'
        );
      }
    });

    // 3. Appointment Reminder (if appointment exists)
    if (appointment) {
      notifications.push({
        name: 'Appointment Reminder',
        fn: async () => {
          const appointmentTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
          await pushNotificationService.sendAppointmentReminder(
            user._id.toString(),
            appointment.expert?.name || 'Your Expert',
            appointmentTime,
            appointment._id.toString()
          );
        }
      });
    }

    // 4. Session Starting Soon
    if (appointment) {
      notifications.push({
        name: 'Session Starting Soon',
        fn: async () => {
          await pushNotificationService.sendSessionStartingSoon(
            user._id.toString(),
            appointment.expert?.name || 'Your Expert',
            appointment._id.toString()
          );
        }
      });
    }

    // 5. Payment Success (if payment exists)
    if (payment) {
      notifications.push({
        name: 'Payment Success',
        fn: async () => {
          await pushNotificationService.sendPaymentSuccess(
            user._id.toString(),
            payment.amount || 999,
            'Consultation Fee',
            payment._id.toString()
          );
        }
      });
    }

    // 6. Subscription Expiring Soon
    notifications.push({
      name: 'Subscription Expiring',
      fn: async () => {
        await pushNotificationService.sendSubscriptionExpiringSoon(
          user._id.toString(),
          'Premium Wellness Plan',
          3,
          'subscription-123'
        );
      }
    });

    // 7. Expert Accepted Appointment
    if (appointment && expert) {
      notifications.push({
        name: 'Expert Accepted',
        fn: async () => {
          const appointmentDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          await pushNotificationService.sendExpertAcceptedAppointment(
            user._id.toString(),
            expert.name,
            appointmentDate,
            appointment._id.toString()
          );
        }
      });
    }

    // Send all notifications with delays
    for (let i = 0; i < notifications.length; i++) {
      const notif = notifications[i];
      
      console.log(`\n📱 [${i + 1}/${notifications.length}] Sending: ${notif.name}`);
      
      try {
        await notif.fn();
        log.info(`✅ Sent: ${notif.name}`);
      } catch (error: any) {
        log.error(`❌ Failed: ${notif.name}`, error.message);
      }

      // Wait 2 seconds between notifications
      if (i < notifications.length - 1) {
        await wait(2000);
      }
    }

    console.log('\n============================================================');
    console.log('✅ TEST NOTIFICATIONS SENT SUCCESSFULLY');
    console.log('============================================================\n');

    log.info('🔍 Check your mobile device for notifications!');
    log.info('📱 Notifications will appear:');
    log.info('   - As banner at the top (when app is open)');
    log.info('   - In notification center (when app is closed/background)');
    log.info('   - With sound and vibration (based on device settings)');

    console.log('\n💡 TIPS:');
    console.log('   - Make sure notification permissions are granted');
    console.log('   - Check device volume and notification settings');
    console.log('   - Try pulling down notification center');
    console.log('   - Tap notifications to navigate to relevant screens\n');

  } catch (error: any) {
    log.error('Fatal error:', error);
  } finally {
    await mongoose.connection.close();
    log.info('Database connection closed');
    process.exit(0);
  }
}

// Run the test
sendTestNotifications();
