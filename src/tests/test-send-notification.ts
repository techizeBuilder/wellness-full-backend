/**
 * Manual Notification Testing Script
 * 
 * Usage:
 * npx ts-node src/tests/test-send-notification.ts <userId>
 * 
 * Example:
 * npx ts-node src/tests/test-send-notification.ts 69789386369d046eb79e94db
 */

import mongoose from 'mongoose';
import connectDB from '../config/database';
import { pushNotificationService } from '../services/pushNotificationService';
import { initializeFirebase } from '../services/fcmService';
import User from '../models/User';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

async function sendTestNotification(userId: string) {
  try {
    console.log(`${colors.cyan}${colors.bright}🧪 Notification Test Script${colors.reset}\n`);

    // Connect to database
    console.log(`${colors.yellow}📡 Connecting to database...${colors.reset}`);
    await connectDB();
    console.log(`${colors.green}✅ Database connected${colors.reset}\n`);

    // Initialize Firebase
    console.log(`${colors.yellow}🔥 Initializing Firebase...${colors.reset}`);
    initializeFirebase();
    console.log(`${colors.green}✅ Firebase initialized${colors.reset}\n`);

    // Find user
    console.log(`${colors.yellow}🔍 Finding user: ${userId}${colors.reset}`);
    const user = await User.findById(userId);

    if (!user) {
      console.log(`${colors.red}❌ User not found with ID: ${userId}${colors.reset}`);
      process.exit(1);
    }

    console.log(`${colors.green}✅ User found: ${user.firstName} ${user.lastName}${colors.reset}`);
    console.log(`${colors.cyan}📧 Email: ${user.email}${colors.reset}`);
    console.log(`${colors.cyan}📱 FCM Tokens: ${user.fcmTokens?.length || 0} registered${colors.reset}`);
    console.log(`${colors.cyan}🔔 Notifications Enabled: ${user.notificationsEnabled}${colors.reset}\n`);

    if (!user.fcmTokens || user.fcmTokens.length === 0) {
      console.log(`${colors.yellow}⚠️  No FCM tokens registered for this user${colors.reset}`);
      console.log(`${colors.yellow}💡 User needs to open the app to register for notifications${colors.reset}`);
      process.exit(1);
    }

    if (!user.notificationsEnabled) {
      console.log(`${colors.yellow}⚠️  Notifications are disabled for this user${colors.reset}`);
      console.log(`${colors.yellow}💡 User can enable notifications in Profile → Notifications${colors.reset}\n`);
    }

    console.log(`${colors.bright}${colors.cyan}📤 Sending Test Notifications...${colors.reset}\n`);

    let result1 = false, result2 = false, result3 = false, result4 = false;

    // Test 1: General Notification
    console.log(`${colors.yellow}1️⃣  Sending general notification...${colors.reset}`);
    try {
      result1 = await pushNotificationService.sendToUser(
        userId,
        '🎉 Test Notification',
        'This is a test notification from your Wellness App!',
        {
          type: 'general',
          testId: Date.now().toString(),
        }
      );
      console.log(result1 
        ? `${colors.green}✅ General notification sent successfully${colors.reset}` 
        : `${colors.red}❌ Failed to send (returned false)${colors.reset}`
      );
    } catch (error) {
      console.error(`${colors.red}❌ Error sending notification:${colors.reset}`, error);
    }

    // Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: Appointment Reminder
    console.log(`\n${colors.yellow}2️⃣  Sending appointment reminder...${colors.reset}`);
    try {
      result2 = await pushNotificationService.sendToUser(
        userId,
        '📅 Appointment Reminder',
        'Your appointment is scheduled for tomorrow at 10:00 AM',
        {
          type: 'appointment',
          subType: 'upcoming',
          appointmentId: 'test-' + Date.now(),
        }
      );
      console.log(result2 
        ? `${colors.green}✅ Appointment notification sent successfully${colors.reset}` 
        : `${colors.red}❌ Failed to send (returned false)${colors.reset}`
      );
    } catch (error) {
      console.error(`${colors.red}❌ Error sending notification:${colors.reset}`, error);
    }

    // Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 3: Payment Notification
    console.log(`\n${colors.yellow}3️⃣  Sending payment notification...${colors.reset}`);
    try {
      result3 = await pushNotificationService.sendToUser(
        userId,
        '💰 Payment Successful',
        'Your payment of ₹500 has been processed successfully',
        {
          type: 'payment',
          subType: 'success',
          amount: '500',
        }
      );
      console.log(result3 
        ? `${colors.green}✅ Payment notification sent successfully${colors.reset}` 
        : `${colors.red}❌ Failed to send (returned false)${colors.reset}`
      );
    } catch (error) {
      console.error(`${colors.red}❌ Error sending notification:${colors.reset}`, error);
    }

    // Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 4: Wellness Tip
    console.log(`\n${colors.yellow}4️⃣  Sending wellness tip...${colors.reset}`);
    try {
      result4 = await pushNotificationService.sendToUser(
        userId,
        '🌟 Daily Wellness Tip',
        'Drink 8 glasses of water daily for better health!',
        {
          type: 'general',
          subType: 'wellness_tip',
        }
      );
      console.log(result4 
        ? `${colors.green}✅ Wellness tip sent successfully${colors.reset}` 
        : `${colors.red}❌ Failed to send (returned false)${colors.reset}`
      );
    } catch (error) {
      console.error(`${colors.red}❌ Error sending notification:${colors.reset}`, error);
    }

    // Summary
    console.log(`\n${colors.bright}${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.bright}${colors.green}✅ Test Complete!${colors.reset}\n`);

    const successCount = [result1, result2, result3, result4].filter(r => r).length;
    console.log(`${colors.cyan}📊 Results: ${successCount}/4 notifications sent successfully${colors.reset}`);
    console.log(`${colors.cyan}📱 Check your app to see the notifications!${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  } catch (error) {
    console.error(`${colors.red}❌ Error:${colors.reset}`, error);
  } finally {
    await mongoose.connection.close();
    console.log(`${colors.yellow}👋 Database connection closed${colors.reset}`);
    process.exit(0);
  }
}

// Get userId from command line
const userId = process.argv[2];

if (!userId) {
  console.log(`${colors.red}❌ Error: User ID is required${colors.reset}`);
  console.log(`\n${colors.cyan}Usage:${colors.reset}`);
  console.log(`  npx ts-node src/tests/test-send-notification.ts <userId>`);
  console.log(`\n${colors.cyan}Example:${colors.reset}`);
  console.log(`  npx ts-node src/tests/test-send-notification.ts 69789386369d046eb79e94db`);
  console.log();
  process.exit(1);
}

// Validate ObjectId format
if (!mongoose.Types.ObjectId.isValid(userId)) {
  console.log(`${colors.red}❌ Error: Invalid user ID format${colors.reset}`);
  console.log(`${colors.yellow}💡 User ID should be a valid MongoDB ObjectId${colors.reset}\n`);
  process.exit(1);
}

// Run the test
sendTestNotification(userId);
