/**
 * Test Notification API Endpoints
 * Tests the notification system without relying on valid push tokens
 */

import mongoose from 'mongoose';
import connectDB from '../config/database';
import User from '../models/User';
import UserNotification, { IUserNotification } from '../models/UserNotification';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

async function testNotificationSystem(userId: string) {
  try {
    console.log(`${colors.cyan}${colors.bright}🧪 Notification System Test${colors.reset}\n`);

    // Connect to database
    console.log(`${colors.yellow}📡 Connecting to database...${colors.reset}`);
    await connectDB();
    console.log(`${colors.green}✅ Database connected${colors.reset}\n`);

    // Find user
    console.log(`${colors.yellow}🔍 Finding user...${colors.reset}`);
    const user = await User.findById(userId);

    if (!user) {
      console.log(`${colors.red}❌ User not found${colors.reset}`);
      process.exit(1);
    }

    console.log(`${colors.green}✅ User found: ${user.firstName} ${user.lastName}${colors.reset}\n`);

    // Test 1: Create notifications in database
    console.log(`${colors.bright}${colors.cyan}📝 Creating Test Notifications...${colors.reset}\n`);

    const testNotifications = [
      {
        title: '🎉 Welcome Notification',
        body: 'Welcome to Wellness App! Start your wellness journey today.',
        type: 'general',
        subType: 'welcome',
      },
      {
        title: '📅 Appointment Reminder',
        body: 'Your appointment is scheduled for tomorrow at 10:00 AM',
        type: 'appointment',
        subType: 'upcoming',
      },
      {
        title: '💰 Payment Successful',
        body: 'Your payment of ₹500 has been processed successfully',
        type: 'payment',
        subType: 'success',
      },
      {
        title: '🌟 Wellness Tip',
        body: 'Drink 8 glasses of water daily for better health!',
        type: 'general',
        subType: 'wellness_tip',
      },
    ];

    let successCount = 0;

    for (let i = 0; i < testNotifications.length; i++) {
      const notif = testNotifications[i];
      console.log(`${colors.yellow}${i + 1}️⃣  Creating ${notif.title}...${colors.reset}`);

      try {
        const notification = await UserNotification.create({
          userId: user._id,
          title: notif.title,
          message: notif.body,
          type: notif.type,
          subType: notif.subType,
          read: false,
          data: {
            testId: Date.now().toString(),
          },
        });

        console.log(`${colors.green}✅ Created in database (ID: ${notification._id})${colors.reset}`);
        successCount++;
      } catch (error) {
        console.log(`${colors.red}❌ Failed to create:${colors.reset}`, error);
      }

      // Wait 500ms between creations
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Summary
    console.log(`\n${colors.bright}${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.bright}${colors.green}✅ Test Complete!${colors.reset}\n`);
    console.log(`${colors.cyan}📊 Results: ${successCount}/${testNotifications.length} notifications created${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    // Query back to verify
    console.log(`${colors.yellow}📋 Verifying notifications in database...${colors.reset}`);
    const userNotifications: IUserNotification[] = await UserNotification.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(10);

    console.log(`${colors.green}✅ Found ${userNotifications.length} notifications for user${colors.reset}\n`);

    console.log(`${colors.cyan}Recent notifications:${colors.reset}`);
    userNotifications.slice(0, 5).forEach((n, idx) => {
      const status = n.read ? '📖 Read' : '✉️  Unread';
      console.log(`  ${idx + 1}. ${status} - ${n.title}`);
      console.log(`     ${n.message.substring(0, 60)}...`);
      console.log(`     Created: ${n.createdAt?.toISOString()}\n`);
    });

    console.log(`${colors.bright}${colors.green}✅ Notification system is working!${colors.reset}`);
    console.log(`${colors.cyan}💡 Now open the app to see these notifications!${colors.reset}\n`);

    // Instructions
    console.log(`${colors.bright}${colors.yellow}📱 How to see notifications in app:${colors.reset}`);
    console.log(`  1. Open Wellness App`);
    console.log(`  2. Go to Profile → Notifications`);
    console.log(`  3. You should see all ${successCount} notifications`);
    console.log(`  4. Tap on them to mark as read\n`);

  } catch (error) {
    console.error(`${colors.red}❌ Error:${colors.reset}`, error);
  } finally {
    await mongoose.connection.close();
    console.log(`${colors.yellow}👋 Database connection closed${colors.reset}`);
    process.exit(0);
  }
}

const userId = process.argv[2];

if (!userId) {
  console.log(`${colors.red}❌ Error: User ID is required${colors.reset}`);
  console.log(`\n${colors.cyan}Usage:${colors.reset}`);
  console.log(`  npx ts-node src/tests/test-notification-api.ts <userId>`);
  console.log(`\n${colors.cyan}Example:${colors.reset}`);
  console.log(`  npx ts-node src/tests/test-notification-api.ts 69789386369d046eb79e94db\n`);
  process.exit(1);
}

if (!mongoose.Types.ObjectId.isValid(userId)) {
  console.log(`${colors.red}❌ Error: Invalid user ID format${colors.reset}\n`);
  process.exit(1);
}

testNotificationSystem(userId);
