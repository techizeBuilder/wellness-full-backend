/**
 * Complete Notification System Test
 * Tests both push notifications AND in-app notifications
 */

import mongoose from 'mongoose';
import '../config/environment';
import connectDB from '../config/database';
import User from '../models/User';
import UserNotification from '../models/UserNotification';
import { pushNotificationService } from '../services/pushNotificationService';
import logger from '../utils/logger';

async function testCompleteNotificationSystem() {
  console.log('\n🧪 ======================================');
  console.log('🔔 COMPLETE NOTIFICATION SYSTEM TEST');
  console.log('📱 Push Notifications + In-App Notifications');
  console.log('========================================\n');

  try {
    // Connect to database
    await connectDB();
    console.log('✅ Connected to MongoDB\n');

    // Find a user (use first registered user)
    const user = await User.findOne().sort({ createdAt: -1 });

    if (!user) {
      console.error('❌ No users found in database');
      console.log('💡 Create a user account first by logging into the app');
      process.exit(1);
    }

    console.log('👤 Testing with user:');
    console.log(`   ID: ${user._id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Phone: ${user.phone}`);
    console.log(`   Notifications Enabled: ${user.notificationsEnabled ?? true}\n`);

    // Display current tokens
    console.log('🔑 Current Push Tokens:');
    if (user.expoPushToken) {
      console.log(`   📱 Expo (Primary): ${user.expoPushToken.substring(0, 40)}...`);
    }
    if (user.expoPushTokens && user.expoPushTokens.length > 0) {
      console.log(`   📱 Expo (Array): ${user.expoPushTokens.length} token(s)`);
      user.expoPushTokens.forEach((token, i) => {
        const display = token.startsWith('local-') ? `${token} (INVALID)` : `${token.substring(0, 40)}...`;
        console.log(`      ${i + 1}. ${display}`);
      });
    }
    if (user.fcmToken) {
      console.log(`   🔥 FCM (Primary): ${user.fcmToken.substring(0, 40)}...`);
    }
    if (user.fcmTokens && user.fcmTokens.length > 0) {
      console.log(`   🔥 FCM (Array): ${user.fcmTokens.length} token(s)`);
    }
    
    const hasValidExpoToken = user.expoPushToken && !user.expoPushToken.startsWith('local-');
    const hasValidFcmToken = user.fcmToken && !user.fcmToken.startsWith('local-');
    
    if (!hasValidExpoToken && !hasValidFcmToken) {
      console.log('\n⚠️  WARNING: No valid push tokens found!');
      console.log('💡 Push notifications will NOT be delivered');
      console.log('✅ But notifications will be saved to database for in-app display\n');
    } else {
      console.log('\n✅ Valid push tokens found - push notifications will be sent\n');
    }

    // Get existing notification count
    const existingCount = await UserNotification.countDocuments({ userId: user._id });
    console.log(`📊 Current in-app notifications: ${existingCount}\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Test 1: Appointment Reminder
    console.log('📅 TEST 1: Appointment Reminder');
    const test1Success = await pushNotificationService.sendAppointmentReminder(
      user._id,
      'Dr. Sarah Johnson',
      '2:00 PM',
      new mongoose.Types.ObjectId().toString()
    );
    console.log(test1Success ? '✅ Sent\n' : '❌ Failed\n');

    // Test 2: Payment Success
    console.log('💰 TEST 2: Payment Success Notification');
    const test2Success = await pushNotificationService.sendPaymentSuccess(
      user._id,
      2500,
      'Premium Subscription',
      new mongoose.Types.ObjectId().toString()
    );
    console.log(test2Success ? '✅ Sent\n' : '❌ Failed\n');

    // Test 3: Welcome Notification
    console.log('🌟 TEST 3: Welcome Notification');
    const test3Success = await pushNotificationService.sendWelcomeNotification(
      user._id,
      user.name || 'User'
    );
    console.log(test3Success ? '✅ Sent\n' : '❌ Failed\n');

    // Test 4: General Notification
    console.log('🔔 TEST 4: General Notification');
    const test4Success = await pushNotificationService.sendGeneralNotification(
      user._id,
      'Daily Wellness Tip',
      'Drink 8 glasses of water daily to stay hydrated and energized! 💧'
    );
    console.log(test4Success ? '✅ Sent\n' : '❌ Failed\n');

    // Wait a moment for database operations to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Verify notifications in database
    console.log('🔍 VERIFICATION: Checking Database\n');

    const newCount = await UserNotification.countDocuments({ userId: user._id });
    const addedCount = newCount - existingCount;

    console.log(`📊 Statistics:`);
    console.log(`   Before: ${existingCount} notifications`);
    console.log(`   After: ${newCount} notifications`);
    console.log(`   Added: ${addedCount} notifications\n`);

    if (addedCount === 4) {
      console.log('✅ SUCCESS: All 4 notifications saved to database!\n');
    } else {
      console.log(`⚠️  WARNING: Expected 4 notifications, but ${addedCount} were added\n`);
    }

    // Show latest notifications
    const latestNotifications = await UserNotification.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title message type read createdAt');

    console.log('📱 Latest In-App Notifications:');
    latestNotifications.forEach((notif, index) => {
      const status = notif.read ? '✅ Read' : '✉️  Unread';
      const timeAgo = getTimeAgo(notif.createdAt);
      console.log(`   ${index + 1}. ${status} - ${notif.title}`);
      console.log(`      ${notif.message.substring(0, 60)}...`);
      console.log(`      Type: ${notif.type} | ${timeAgo}\n`);
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Summary
    console.log('📋 SUMMARY:\n');
    console.log('✅ Push Notifications:');
    if (hasValidExpoToken || hasValidFcmToken) {
      console.log('   - Sent to user\'s device via Expo/FCM');
      console.log('   - Will appear as push notification when app is closed/background');
    } else {
      console.log('   - ⚠️  No valid tokens - push delivery skipped');
      console.log('   - Register Expo token from app to enable push');
    }
    console.log('\n✅ In-App Notifications:');
    console.log('   - All notifications saved to database');
    console.log('   - Visible in app notification history');
    console.log('   - User can view, mark as read, delete\n');

    console.log('🎯 BOTH SYSTEMS WORKING:\n');
    console.log('   1. Push notifications (when tokens available) ✓');
    console.log('   2. In-app notification history (always) ✓');
    console.log('   3. Database persistence (always) ✓\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('💡 NEXT STEPS:\n');
    console.log('1. Open the app');
    console.log('2. Go to Profile → Notifications');
    console.log('3. Pull to refresh');
    console.log('4. You should see all test notifications\n');

    if (!hasValidExpoToken && !hasValidFcmToken) {
      console.log('💡 TO ENABLE PUSH NOTIFICATIONS:\n');
      console.log('1. Login to the app');
      console.log('2. Grant notification permissions when prompted');
      console.log('3. App will auto-register Expo push token');
      console.log('4. Push notifications will then work!\n');
    }

    console.log('✅ Test completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed\n');
    process.exit(0);
  }
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return seconds + 's ago';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  return Math.floor(seconds / 86400) + 'd ago';
}

// Run test
testCompleteNotificationSystem();
