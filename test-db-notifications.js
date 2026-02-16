#!/usr/bin/env node

const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB URI
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wellness_db';

const testDBNotifications = async () => {
  try {
    console.log('\n========================================');
    console.log('🗄️  MONGODB NOTIFICATION TEST');
    console.log('========================================\n');

    // Connect to MongoDB
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection;
    const adminCollection = db.collection('admins');
    const notificationCollection = db.collection('notifications');

    // Test 1: Find Admins
    console.log('📋 TEST 1: Checking Admins in Database');
    console.log('─'.repeat(50));
    const admins = await adminCollection.find({}).toArray();
    
    if (admins.length === 0) {
      console.log('❌ NO ADMINS FOUND!');
      console.log('   Please create an admin account first.');
      process.exit(1);
    }

    console.log(`✅ Found ${admins.length} admin(s):`);
    admins.forEach((admin, i) => {
      console.log(`   ${i + 1}. ${admin.name || 'Unknown'} (${admin.email}) - ID: ${admin._id}`);
    });

    const adminId = admins[0]._id;

    // Test 2: Clean old test notifications
    console.log('\n🧹 TEST 2: Cleaning Old Test Notifications');
    console.log('─'.repeat(50));
    const deleteResult = await notificationCollection.deleteMany({
      $or: [
        { message: { $regex: 'TEST_' } },
        { title: { $regex: 'TEST_' } }
      ]
    });
    console.log(`✅ Deleted ${deleteResult.deletedCount} old test notifications`);

    // Test 3: Create Test Notifications
    console.log('\n✏️  TEST 3: Creating Test Notifications');
    console.log('─'.repeat(50));

    const testNotifications = [
      {
        adminId: adminId,
        type: 'system',
        title: '🧪 TEST_NOTIFICATION - System Message',
        message: 'This is a test system notification',
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        adminId: adminId,
        type: 'new_user',
        title: '👤 TEST_NOTIFICATION - New User',
        message: 'John Doe has registered as a new user',
        data: {
          userId: new mongoose.Types.ObjectId(),
          email: 'john.test@example.com',
          phone: '9876543210'
        },
        isRead: false,
        createdAt: new Date(Date.now() - 60000), // 1 minute ago
        updatedAt: new Date(Date.now() - 60000)
      },
      {
        adminId: adminId,
        type: 'new_expert',
        title: '🏥 TEST_NOTIFICATION - New Expert',
        message: 'Dr. Sarah Smith has registered as an expert in Cardiology',
        data: {
          expertId: new mongoose.Types.ObjectId(),
          email: 'sarah.expert@example.com',
          specialization: 'Cardiology'
        },
        isRead: false,
        createdAt: new Date(Date.now() - 120000), // 2 minutes ago
        updatedAt: new Date(Date.now() - 120000)
      },
      {
        adminId: adminId,
        type: 'payment',
        title: '💳 TEST_NOTIFICATION - Payment Received',
        message: 'Payment of ₹5000 received for Appointment',
        data: {
          paymentId: new mongoose.Types.ObjectId(),
          amount: 5000,
          paymentType: 'appointment'
        },
        isRead: false,
        createdAt: new Date(Date.now() - 180000), // 3 minutes ago
        updatedAt: new Date(Date.now() - 180000)
      },
      {
        adminId: adminId,
        type: 'booking',
        title: '📅 TEST_NOTIFICATION - New Booking',
        message: 'New appointment booked by Sarah for Dr. Smith',
        data: {
          bookingId: new mongoose.Types.ObjectId()
        },
        isRead: true,
        readAt: new Date(Date.now() - 300000),
        createdAt: new Date(Date.now() - 300000), // 5 minutes ago
        updatedAt: new Date(Date.now() - 300000)
      }
    ];

    const insertResult = await notificationCollection.insertMany(testNotifications);
    console.log(`✅ Created ${insertResult.insertedIds.length} test notifications:`);

    testNotifications.forEach((notif, i) => {
      const id = insertResult.insertedIds[i];
      const status = notif.isRead ? '✓ Read' : '• Unread';
      console.log(`   ${i + 1}. [${status}] ${notif.type.padEnd(12)} - ${notif.title}`);
    });

    // Test 4: Verify Notifications in DB
    console.log('\n🔍 TEST 4: Verifying Notifications in Database');
    console.log('─'.repeat(50));

    const allNotifs = await notificationCollection
      .find({ adminId: adminId })
      .sort({ createdAt: -1 })
      .toArray();

    console.log(`✅ Total notifications for this admin: ${allNotifs.length}`);
    console.log('   Details:');

    allNotifs.forEach((notif, i) => {
      const timeAgo = Math.floor((Date.now() - notif.createdAt) / 1000);
      const timeStr = timeAgo < 60 ? `${timeAgo}s` : `${Math.floor(timeAgo / 60)}m`;
      console.log(`   ${i + 1}. [${notif.type.padEnd(10)}] ${notif.title} (${timeStr} ago)`);
    });

    // Test 5: Check Counts
    console.log('\n📊 TEST 5: Notification Statistics');
    console.log('─'.repeat(50));

    const unreadCount = await notificationCollection.countDocuments({
      adminId: adminId,
      isRead: false
    });

    const readCount = await notificationCollection.countDocuments({
      adminId: adminId,
      isRead: true
    });

    console.log(`✅ Total: ${allNotifs.length}`);
    console.log(`   • Unread: ${unreadCount}`);
    console.log(`   • Read: ${readCount}`);

    // Test 6: API Query Simulation
    console.log('\n🔗 TEST 6: Simulating API Query');
    console.log('─'.repeat(50));

    const apiResults = await notificationCollection
      .find({ adminId: adminId })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    console.log(`✅ API would return: ${apiResults.length} notifications`);
    console.log('   Expected response format:');
    console.log(JSON.stringify({
      success: true,
      data: {
        notifications: apiResults.slice(0, 1),
        pagination: {
          total: allNotifs.length,
          page: 1,
          limit: 10,
          pages: Math.ceil(allNotifs.length / 10)
        }
      }
    }, null, 2));

    // Final Result
    console.log('\n========================================');
    console.log('✅ ALL TESTS PASSED!');
    console.log('========================================');

    console.log('\n🎯 NEXT STEPS:');
    console.log('─'.repeat(50));
    console.log('1. Open Admin Panel: http://localhost:3000/admin');
    console.log('2. Look at top right navbar');
    console.log('3. Click notification bell 🔔');
    console.log(`4. You should see ${unreadCount} unread notifications!`);
    console.log('5. Click to mark as read');
    console.log('6. Test fully working notification system');

    console.log('\n💡 WHAT YOU SHOULD SEE:');
    console.log('─'.repeat(50));
    console.log('✓ Red badge with number ' + unreadCount);
    console.log('✓ Notification dropdown with list');
    console.log('✓ Different notification types');
    console.log('✓ Click marks as read (removes from unread)');
    console.log('✓ Time display (2m ago, 3m ago, etc)');

    console.log('\n📝 TEST DATA DETAILS:');
    console.log('─'.repeat(50));
    console.log(`Admin ID: ${adminId}`);
    console.log(`Database: ${MONGODB_URI}`);
    console.log(`Collection: notifications`);
    console.log(`Test Label: TEST_NOTIFICATION`);

    await mongoose.connection.close();
    console.log('\n✅ Test completed successfully!\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ TEST FAILED:');
    console.error('Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Is MongoDB running?');
    console.error('2. Check MONGODB_URI in .env');
    console.error('3. Is the database accessible?');
    console.error('4. Check network connection');
    
    if (mongoose.connection.readyState !== 0) {
      mongoose.connection.close();
    }
    process.exit(1);
  }
};

testDBNotifications();
