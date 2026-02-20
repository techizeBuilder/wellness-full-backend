/**
 * Verify notifications in database
 */

import mongoose from 'mongoose';
import connectDB from '../config/database';
import UserNotification from '../models/UserNotification';

async function verifyNotifications(userId: string) {
  try {
    await connectDB();
    
    const notifs = await UserNotification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10);
    
    console.log(`\n📱 Latest ${notifs.length} Notifications for user:\n`);
    
    notifs.forEach((n, i) => {
      const status = n.read ? '📖 Read' : '✉️  Unread';
      console.log(`${i+1}. ${status} - ${n.title}`);
      console.log(`   ${n.message}`);
      console.log(`   Type: ${n.type}, Created: ${n.createdAt?.toISOString()}\n`);
    });
    
    const total = await UserNotification.countDocuments({ userId });
    const unread = await UserNotification.countDocuments({ userId, read: false });
    
    console.log(`📊 Stats: ${total} total, ${unread} unread\n`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

const userId = process.argv[2] || '69789386369d046eb79e94db';
verifyNotifications(userId);
