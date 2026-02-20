/**
 * Check user's FCM tokens
 */

import mongoose from 'mongoose';
import connectDB from '../config/database';
import User from '../models/User';

async function checkTokens(userId: string) {
  try {
    await connectDB();
    
    const user = await User.findById(userId).select('fcmToken fcmTokens notificationsEnabled');
    
    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }
    
    console.log('\n📱 User FCM Tokens:\n');
    console.log('notificationsEnabled:', user.notificationsEnabled);
    console.log('\nfcmToken (legacy):', user.fcmToken || 'null');
    console.log('\nfcmTokens array:');
    
    if (user.fcmTokens && user.fcmTokens.length > 0) {
      user.fcmTokens.forEach((token, index) => {
        const isExpo = token.startsWith('ExponentPushToken');
        const isLocal = token.startsWith('local-');
        console.log(`  ${index + 1}. ${token.substring(0, 50)}...`);
        console.log(`     Type: ${isExpo ? 'Expo Push Token ✅' : isLocal ? 'Local Token (Invalid) ❌' : 'Unknown'}`);
      });
    } else {
      console.log('  No tokens registered');
    }
    
    console.log('\n');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

const userId = process.argv[2];
if (!userId) {
  console.log('Usage: npx ts-node src/tests/check-tokens.ts <userId>');
  process.exit(1);
}

checkTokens(userId);
