const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected for creating Ronal test user');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

const createRonalUser = async () => {
  try {
    await connectDB();
    
    const ronalUserData = {
      firstName: 'Ronal',
      lastName: 'User',
      email: 'ronal@gmail.com',
      phone: '+1234567890',
      password: 'Jeetu@123',
      isActive: true,
      isEmailVerified: true,
      isPhoneVerified: true,
      userType: 'user'
    };
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: ronalUserData.email });
    if (existingUser) {
      console.log('Ronal user already exists:', existingUser.email);
      console.log('User ID:', existingUser._id);
      console.log('First Name:', existingUser.firstName);
      console.log('Last Name:', existingUser.lastName);
      console.log('Full Name:', existingUser.firstName + ' ' + existingUser.lastName);
      console.log('Is Active:', existingUser.isActive);
      console.log('Email Verified:', existingUser.isEmailVerified);
      
      // Update password if different
      const isPasswordCorrect = await existingUser.matchPassword('Jeetu@123');
      if (!isPasswordCorrect) {
        console.log('Updating password for existing user...');
        existingUser.password = 'Jeetu@123';
        await existingUser.save();
        console.log('Password updated successfully');
      }
      
      process.exit(0);
    }
    
    // Create Ronal user
    const ronalUser = await User.create(ronalUserData);
    console.log('✅ Ronal user created successfully!');
    console.log('Email:', ronalUser.email);
    console.log('Password:', ronalUserData.password);
    console.log('User ID:', ronalUser._id);
    console.log('First Name:', ronalUser.firstName);
    console.log('Last Name:', ronalUser.lastName);
    console.log('Full Name:', ronalUser.firstName + ' ' + ronalUser.lastName);
    console.log('Phone:', ronalUser.phone);
    console.log('Active:', ronalUser.isActive);
    console.log('Email Verified:', ronalUser.isEmailVerified);
    console.log('User Type:', ronalUser.userType);
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating Ronal user:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  createRonalUser();
}

module.exports = { createRonalUser };