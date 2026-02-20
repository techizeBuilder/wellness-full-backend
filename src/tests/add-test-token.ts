/**
 * ADD TEST FCM TOKEN TO USER
 * 
 * This script adds a test Expo Push Token to a user for testing notifications.
 * Run: npx ts-node src/tests/add-test-token.ts
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

import connectDB from '../config/database';
import User from '../models/User';

const TEST_USER_EMAIL = 'vermakhushbu8384@gmail.com';
// This is a valid format Expo push token (but won't actually receive notifications without the real app token)
const TEST_FCM_TOKEN = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';

async function addTestToken() {
  try {
    console.log('\n============================================================');
    console.log('🔧 ADDING TEST FCM TOKEN TO USER');
    console.log('============================================================\n');

    await connectDB();
    console.log('✅ Connected to MongoDB\n');

    const user = await User.findOne({ email: TEST_USER_EMAIL });

    if (!user) {
      console.error(`❌ User not found: ${TEST_USER_EMAIL}`);
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.name} (${user.email})`);
    console.log(`   User ID: ${user._id}\n`);

    // Add test token
    user.fcmToken = TEST_FCM_TOKEN;
    if (!user.fcmTokens) {
      user.fcmTokens = [];
    }
    if (!user.fcmTokens.includes(TEST_FCM_TOKEN)) {
      user.fcmTokens.push(TEST_FCM_TOKEN);
    }
    user.notificationsEnabled = true;

    await user.save();

    console.log('✅ Test FCM token added successfully!');
    console.log(`   Token: ${TEST_FCM_TOKEN}\n`);

    console.log('============================================================');
    console.log('⚠️  NOTE: This is a placeholder token for testing the flow.');
    console.log('   For real notifications, the user must:');
    console.log('   1. Open the mobile app');
    console.log('   2. Grant notification permissions');
    console.log('   3. Let the app register the real Expo push token');
    console.log('============================================================\n');

  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

addTestToken();
