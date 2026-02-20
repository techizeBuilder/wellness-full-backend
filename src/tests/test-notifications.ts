/**
 * Comprehensive Notification Testing Script
 * 
 * This script tests all notification types implemented in the wellness app.
 * Run this after starting the server to verify notifications are working.
 * 
 * Usage: ts-node src/tests/test-notifications.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import User from '../models/User';
import Expert from '../models/Expert';
import Appointment from '../models/Appointment';
import UserSubscription from '../models/UserSubscription';
import Plan from '../models/Plan';
import pushNotificationService from '../services/pushNotificationService';
import { initializeFirebase } from '../services/fcmService';
import logger from '../utils/logger';

const MONGODB_URI = process.env.MONGODB_URI || '';

// Test user ID - Replace with actual user ID from your database
let testUserId: string;
let testExpertId: string;
let testAppointmentId: string;
let testSubscriptionId: string;

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info('✅ Connected to MongoDB');
  } catch (error) {
    logger.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function findTestUser() {
  try {
    // Find a user with FCM token
    let user = await User.findOne({ 
      fcmToken: { $exists: true, $ne: null },
      notificationsEnabled: true 
    });

    if (!user) {
      logger.warn('⚠️  No user found with FCM token. Creating test FCM token...');
      // Get any user and add a test token
      user = await User.findOne({ userType: 'user' });
      if (user) {
        user.fcmToken = 'ExponentPushToken[test-token-for-testing]';
        user.notificationsEnabled = true;
        await user.save();
        logger.info('ℹ️  Added test FCM token to user');
      }
    }

    if (!user) {
      logger.error('❌ No users found in database. Please create a user first.');
      return false;
    }

    testUserId = user._id.toString();
    logger.info(`✅ Found test user: ${user.firstName} ${user.lastName} (${user.email})`);
    logger.info(`   FCM Token: ${user.fcmToken?.substring(0, 30)}...`);
    
    return true;
  } catch (error) {
    logger.error('❌ Error finding test user:', error);
    return false;
  }
}

async function findTestData() {
  try {
    // Find an expert
    const expert = await Expert.findOne();
    if (expert) {
      testExpertId = expert._id.toString();
      logger.info(`✅ Found test expert: ${expert.firstName} ${expert.lastName}`);
    }

    // Find an appointment
    const appointment = await Appointment.findOne({ user: testUserId }).sort({ createdAt: -1 });
    if (appointment) {
      testAppointmentId = appointment._id.toString();
      logger.info(`✅ Found test appointment: ${testAppointmentId}`);
    }

    // Find a subscription
    const subscription = await UserSubscription.findOne({ user: testUserId }).sort({ createdAt: -1 });
    if (subscription) {
      testSubscriptionId = subscription._id.toString();
      logger.info(`✅ Found test subscription: ${testSubscriptionId}`);
    }

    return true;
  } catch (error) {
    logger.error('❌ Error finding test data:', error);
    return false;
  }
}

async function testFirebaseInitialization() {
  console.log('\n' + '='.repeat(60));
  logger.info('🔥 TEST 1: Firebase Initialization');
  console.log('='.repeat(60));
  
  try {
    initializeFirebase();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for initialization
    logger.info('✅ Firebase initialized successfully');
    return true;
  } catch (error) {
    logger.error('❌ Firebase initialization failed:', error);
    return false;
  }
}

async function testAppointmentReminder() {
  console.log('\n' + '='.repeat(60));
  logger.info('📅 TEST 2: Appointment Reminder (30 min before)');
  console.log('='.repeat(60));
  
  try {
    const result = await pushNotificationService.sendAppointmentReminder(
      testUserId,
      'Dr. Sharma',
      '3:30 PM',
      testAppointmentId || 'test-appointment-id'
    );
    
    if (result) {
      logger.info('✅ Appointment reminder sent successfully');
    } else {
      logger.warn('⚠️  Appointment reminder failed or user has notifications disabled');
    }
    return result;
  } catch (error) {
    logger.error('❌ Error sending appointment reminder:', error);
    return false;
  }
}

async function testAppointmentConfirmed() {
  console.log('\n' + '='.repeat(60));
  logger.info('✔️  TEST 3: Appointment Confirmed');
  console.log('='.repeat(60));
  
  try {
    const result = await pushNotificationService.sendAppointmentConfirmed(
      testUserId,
      'Dr. Sharma',
      'Feb 20, 2026',
      '3:30 PM',
      testAppointmentId || 'test-appointment-id'
    );
    
    if (result) {
      logger.info('✅ Appointment confirmed notification sent');
    } else {
      logger.warn('⚠️  Appointment confirmed notification failed');
    }
    return result;
  } catch (error) {
    logger.error('❌ Error sending appointment confirmed:', error);
    return false;
  }
}

async function testSessionStartingSoon() {
  console.log('\n' + '='.repeat(60));
  logger.info('⏰ TEST 4: Session Starting Soon (5 min before)');
  console.log('='.repeat(60));
  
  try {
    const result = await pushNotificationService.sendSessionStartingSoon(
      testUserId,
      'Dr. Sharma',
      testAppointmentId || 'test-appointment-id'
    );
    
    if (result) {
      logger.info('✅ Session starting notification sent');
    } else {
      logger.warn('⚠️  Session starting notification failed');
    }
    return result;
  } catch (error) {
    logger.error('❌ Error sending session starting:', error);
    return false;
  }
}

async function testPaymentSuccess() {
  console.log('\n' + '='.repeat(60));
  logger.info('💰 TEST 5: Payment Success');
  console.log('='.repeat(60));
  
  try {
    const result = await pushNotificationService.sendPaymentSuccess(
      testUserId,
      1500,
      'Consultation Booking',
      'test-payment-id'
    );
    
    if (result) {
      logger.info('✅ Payment success notification sent');
    } else {
      logger.warn('⚠️  Payment success notification failed');
    }
    return result;
  } catch (error) {
    logger.error('❌ Error sending payment success:', error);
    return false;
  }
}

async function testPaymentFailed() {
  console.log('\n' + '='.repeat(60));
  logger.info('❌ TEST 6: Payment Failed');
  console.log('='.repeat(60));
  
  try {
    const result = await pushNotificationService.sendPaymentFailed(
      testUserId,
      1500,
      'Consultation Booking',
      'test-payment-id'
    );
    
    if (result) {
      logger.info('✅ Payment failed notification sent');
    } else {
      logger.warn('⚠️  Payment failed notification failed');
    }
    return result;
  } catch (error) {
    logger.error('❌ Error sending payment failed:', error);
    return false;
  }
}

async function testSubscriptionActivated() {
  console.log('\n' + '='.repeat(60));
  logger.info('🎉 TEST 7: Subscription Activated');
  console.log('='.repeat(60));
  
  try {
    const result = await pushNotificationService.sendSubscriptionActivated(
      testUserId,
      'Monthly Wellness Plan',
      'March 20, 2026',
      testSubscriptionId || 'test-subscription-id'
    );
    
    if (result) {
      logger.info('✅ Subscription activated notification sent');
    } else {
      logger.warn('⚠️  Subscription activated notification failed');
    }
    return result;
  } catch (error) {
    logger.error('❌ Error sending subscription activated:', error);
    return false;
  }
}

async function testSubscriptionExpiring() {
  console.log('\n' + '='.repeat(60));
  logger.info('⏳ TEST 8: Subscription Expiring Soon (3 days)');
  console.log('='.repeat(60));
  
  try {
    const result = await pushNotificationService.sendSubscriptionExpiringSoon(
      testUserId,
      'Monthly Wellness Plan',
      3,
      testSubscriptionId || 'test-subscription-id'
    );
    
    if (result) {
      logger.info('✅ Subscription expiring notification sent');
    } else {
      logger.warn('⚠️  Subscription expiring notification failed');
    }
    return result;
  } catch (error) {
    logger.error('❌ Error sending subscription expiring:', error);
    return false;
  }
}

async function testSubscriptionExpired() {
  console.log('\n' + '='.repeat(60));
  logger.info('⛔ TEST 9: Subscription Expired');
  console.log('='.repeat(60));
  
  try {
    const result = await pushNotificationService.sendSubscriptionExpired(
      testUserId,
      'Monthly Wellness Plan',
      testSubscriptionId || 'test-subscription-id'
    );
    
    if (result) {
      logger.info('✅ Subscription expired notification sent');
    } else {
      logger.warn('⚠️  Subscription expired notification failed');
    }
    return result;
  } catch (error) {
    logger.error('❌ Error sending subscription expired:', error);
    return false;
  }
}

async function testAppointmentCancelled() {
  console.log('\n' + '='.repeat(60));
  logger.info('🚫 TEST 10: Appointment Cancelled');
  console.log('='.repeat(60));
  
  try {
    const result = await pushNotificationService.sendAppointmentCancelled(
      testUserId,
      'Dr. Sharma',
      'Expert is unavailable',
      testAppointmentId || 'test-appointment-id'
    );
    
    if (result) {
      logger.info('✅ Appointment cancelled notification sent');
    } else {
      logger.warn('⚠️  Appointment cancelled notification failed');
    }
    return result;
  } catch (error) {
    logger.error('❌ Error sending appointment cancelled:', error);
    return false;
  }
}

async function testExpertAcceptedAppointment() {
  console.log('\n' + '='.repeat(60));
  logger.info('👨‍⚕️ TEST 11: Expert Accepted Appointment');
  console.log('='.repeat(60));
  
  try {
    const result = await pushNotificationService.sendExpertAcceptedAppointment(
      testUserId,
      'Dr. Sharma',
      'Feb 20, 2026',
      testAppointmentId || 'test-appointment-id'
    );
    
    if (result) {
      logger.info('✅ Expert accepted notification sent');
    } else {
      logger.warn('⚠️  Expert accepted notification failed');
    }
    return result;
  } catch (error) {
    logger.error('❌ Error sending expert accepted:', error);
    return false;
  }
}

async function testPrescriptionUploaded() {
  console.log('\n' + '='.repeat(60));
  logger.info('📝 TEST 12: Prescription Uploaded');
  console.log('='.repeat(60));
  
  try {
    const result = await pushNotificationService.sendPrescriptionUploaded(
      testUserId,
      'Dr. Sharma',
      testAppointmentId || 'test-appointment-id'
    );
    
    if (result) {
      logger.info('✅ Prescription uploaded notification sent');
    } else {
      logger.warn('⚠️  Prescription uploaded notification failed');
    }
    return result;
  } catch (error) {
    logger.error('❌ Error sending prescription uploaded:', error);
    return false;
  }
}

async function testWelcomeNotification() {
  console.log('\n' + '='.repeat(60));
  logger.info('👋 TEST 13: Welcome Notification');
  console.log('='.repeat(60));
  
  try {
    const user = await User.findById(testUserId);
    const result = await pushNotificationService.sendWelcomeNotification(
      testUserId,
      user?.firstName || 'User'
    );
    
    if (result) {
      logger.info('✅ Welcome notification sent');
    } else {
      logger.warn('⚠️  Welcome notification failed');
    }
    return result;
  } catch (error) {
    logger.error('❌ Error sending welcome notification:', error);
    return false;
  }
}

async function testGeneralNotification() {
  console.log('\n' + '='.repeat(60));
  logger.info('📢 TEST 14: General Notification');
  console.log('='.repeat(60));
  
  try {
    const result = await pushNotificationService.sendGeneralNotification(
      testUserId,
      'System Update',
      'New features have been added to the app. Check them out!',
      { type: 'general', subType: 'update' }
    );
    
    if (result) {
      logger.info('✅ General notification sent');
    } else {
      logger.warn('⚠️  General notification failed');
    }
    return result;
  } catch (error) {
    logger.error('❌ Error sending general notification:', error);
    return false;
  }
}

async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 WELLNESS APP - NOTIFICATION TESTING SUITE');
  console.log('='.repeat(60));
  console.log('Testing all notification types...\n');

  const results: { test: string; passed: boolean }[] = [];

  // Connect to database
  await connectDB();

  // Find test user
  const userFound = await findTestUser();
  if (!userFound) {
    logger.error('❌ Cannot proceed without a test user');
    process.exit(1);
  }

  // Find test data
  await findTestData();

  // Add delay between tests
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Run all tests with delays
  results.push({ test: 'Firebase Initialization', passed: await testFirebaseInitialization() });
  await delay(2000);

  results.push({ test: 'Appointment Reminder', passed: await testAppointmentReminder() });
  await delay(2000);

  results.push({ test: 'Appointment Confirmed', passed: await testAppointmentConfirmed() });
  await delay(2000);

  results.push({ test: 'Session Starting Soon', passed: await testSessionStartingSoon() });
  await delay(2000);

  results.push({ test: 'Payment Success', passed: await testPaymentSuccess() });
  await delay(2000);

  results.push({ test: 'Payment Failed', passed: await testPaymentFailed() });
  await delay(2000);

  results.push({ test: 'Subscription Activated', passed: await testSubscriptionActivated() });
  await delay(2000);

  results.push({ test: 'Subscription Expiring', passed: await testSubscriptionExpiring() });
  await delay(2000);

  results.push({ test: 'Subscription Expired', passed: await testSubscriptionExpired() });
  await delay(2000);

  results.push({ test: 'Appointment Cancelled', passed: await testAppointmentCancelled() });
  await delay(2000);

  results.push({ test: 'Expert Accepted', passed: await testExpertAcceptedAppointment() });
  await delay(2000);

  results.push({ test: 'Prescription Uploaded', passed: await testPrescriptionUploaded() });
  await delay(2000);

  results.push({ test: 'Welcome Notification', passed: await testWelcomeNotification() });
  await delay(2000);

  results.push({ test: 'General Notification', passed: await testGeneralNotification() });

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  
  let passedCount = 0;
  let failedCount = 0;

  results.forEach(result => {
    const status = result.passed ? '✅ PASSED' : '❌ FAILED';
    console.log(`${status} - ${result.test}`);
    if (result.passed) passedCount++;
    else failedCount++;
  });

  console.log('\n' + '='.repeat(60));
  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${failedCount}`);
  console.log('='.repeat(60));

  if (failedCount === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Notifications are working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Check logs above for details.');
    console.log('\nCommon issues:');
    console.log('- User has notificationsEnabled = false');
    console.log('- User has no FCM token registered');
    console.log('- Firebase credentials not configured');
    console.log('- Invalid FCM token');
  }

  console.log('\n💡 TIP: Check your mobile app to verify notifications were received!');
  console.log('='.repeat(60) + '\n');

  // Cleanup
  await mongoose.disconnect();
  process.exit(failedCount === 0 ? 0 : 1);
}

// Run tests
runAllTests().catch(error => {
  logger.error('❌ Test suite failed:', error);
  process.exit(1);
});
