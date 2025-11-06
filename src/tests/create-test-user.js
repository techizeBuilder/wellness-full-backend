const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected for creating test user');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

const createTestUser = async () => {
  try {
    await connectDB();
    
    const testUserData = {
      name: 'Test User',
      email: 'testuser@example.com',
      phone: '+1234567890',
      password: 'password123',
      isActive: true,
      isVerified: true
    };
    
    // Check if test user already exists
    const existingUser = await User.findOne({ email: testUserData.email });
    if (existingUser) {
      console.log('Test user already exists:', existingUser.email);
      console.log('User ID:', existingUser._id);
      process.exit(0);
    }
    
    // Create test user
    const testUser = await User.create(testUserData);
    console.log('✅ Test user created successfully!');
    console.log('Email:', testUser.email);
    console.log('Password:', testUserData.password);
    console.log('User ID:', testUser._id);
    console.log('Name:', testUser.name);
    console.log('Phone:', testUser.phone);
    console.log('Active:', testUser.isActive);
    console.log('Verified:', testUser.isVerified);
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating test user:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  createTestUser();
}

module.exports = { createTestUser };