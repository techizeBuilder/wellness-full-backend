const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected for updating Ronal user');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

const updateRonalUser = async () => {
  try {
    await connectDB();
    
    // Find and update the user
    const user = await User.findOne({ email: 'ronal@gmail.com' });
    if (!user) {
      console.log('User ronal@gmail.com not found. Creating new user...');
      
      const newUser = await User.create({
        firstName: 'Ronal',
        lastName: 'User',
        email: 'ronal@gmail.com',
        phone: '+1234567890',
        password: 'Jeetu@123',
        isActive: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        userType: 'user'
      });
      
      console.log('✅ New Ronal user created successfully!');
      console.log('User ID:', newUser._id);
      console.log('First Name:', newUser.firstName);
      console.log('Last Name:', newUser.lastName);
      console.log('Email:', newUser.email);
      
      process.exit(0);
    }
    
    console.log('Existing user found:', user.email);
    console.log('Current First Name:', user.firstName);
    console.log('Current Last Name:', user.lastName);
    
    // Update user data
    user.firstName = 'Ronal';
    user.lastName = 'User';
    user.isActive = true;
    user.isEmailVerified = true;
    user.isPhoneVerified = true;
    
    // Hash new password properly
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash('Jeetu@123', salt);
    
    await user.save();
    
    console.log('✅ Ronal user updated successfully!');
    console.log('User ID:', user._id);
    console.log('Updated First Name:', user.firstName);
    console.log('Updated Last Name:', user.lastName);
    console.log('Full Name:', user.firstName + ' ' + user.lastName);
    console.log('Email:', user.email);
    console.log('Password updated to: Jeetu@123');
    console.log('Is Active:', user.isActive);
    console.log('Email Verified:', user.isEmailVerified);
    
    process.exit(0);
  } catch (error) {
    console.error('Error updating Ronal user:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  updateRonalUser();
}

module.exports = { updateRonalUser };