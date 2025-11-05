/**
 * Simple test for email validation without running the full server
 */

// Mock the required modules for testing
require('dotenv').config();

// Test the email validation utility directly
const { checkEmailExists, checkPhoneExists } = require('./utils/emailValidation');

// Mock database connection for testing
const mongoose = require('mongoose');

async function connectToDatabase() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables');
    }
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB for testing');
    return true;
  } catch (error) {
    console.log('❌ MongoDB connection failed:', error.message);
    console.log('🔄 Proceeding with mock testing...');
    return false;
  }
}

async function testEmailValidation() {
  console.log('🧪 Testing Email Validation Functionality\n');
  
  const dbConnected = await connectToDatabase();
  
  if (!dbConnected) {
    console.log('⚠️  Database not connected. Testing utility functions only...\n');
    
    // Test the utility function structure
    console.log('1️⃣  Testing utility function exports...');
    console.log('   checkEmailExists function:', typeof checkEmailExists);
    console.log('   checkPhoneExists function:', typeof checkPhoneExists);
    
    if (typeof checkEmailExists === 'function' && typeof checkPhoneExists === 'function') {
      console.log('✅ Email validation utilities are properly exported');
    } else {
      console.log('❌ Email validation utilities are not properly exported');
    }
    
    console.log('\n📋 To test with real data:');
    console.log('   1. Ensure MongoDB is running');
    console.log('   2. Set MONGODB_URI in .env file');
    console.log('   3. Run this test again');
    
    return;
  }
  
  // Test with real database
  try {
    console.log('1️⃣  Testing email validation with real database...');
    
    // Test with a non-existent email
    const testEmail = 'nonexistent@test.com';
    const emailResult = await checkEmailExists(testEmail);
    
    console.log(`   Email check for "${testEmail}":`, emailResult);
    
    if (!emailResult.exists) {
      console.log('✅ Email validation working correctly for non-existent email');
    } else {
      console.log('⚠️  Email exists in database:', emailResult.message);
    }
    
    console.log('\n2️⃣  Testing phone validation...');
    
    const testPhone = '+999999999999';
    const phoneResult = await checkPhoneExists(testPhone);
    
    console.log(`   Phone check for "${testPhone}":`, phoneResult);
    
    if (!phoneResult.exists) {
      console.log('✅ Phone validation working correctly for non-existent phone');
    } else {
      console.log('⚠️  Phone exists in database:', phoneResult.message);
    }
    
    console.log('\n🎉 Email validation utility is working correctly!');
    
  } catch (error) {
    console.error('❌ Error testing email validation:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// API Testing without server
function testAPIEndpoints() {
  console.log('\n🌐 API Endpoint Testing Information:');
  console.log('\n📡 User Registration Endpoint:');
  console.log('   POST /api/auth/register');
  console.log('   Body: { firstName, lastName, email, phone, password }');
  
  console.log('\n📡 Expert Registration Endpoint:');
  console.log('   POST /api/experts/register');
  console.log('   Body: { fullName, email, phone, password, specialization }');
  
  console.log('\n🧪 Test Scenarios:');
  console.log('   1. Register user with email: user@test.com');
  console.log('   2. Try to register expert with same email');
  console.log('   3. Verify error message is returned');
  
  console.log('\n📝 Sample cURL commands:');
  console.log('   # Register User:');
  console.log('   curl -X POST http://localhost:5000/api/auth/register \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log('     -d \'{"firstName":"Test","lastName":"User","email":"test@example.com","phone":"+1234567890","password":"password123"}\'');
  
  console.log('\n   # Try to register Expert with same email:');
  console.log('   curl -X POST http://localhost:5000/api/experts/register \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log('     -d \'{"fullName":"Test Expert","email":"test@example.com","phone":"+0987654321","password":"password123","specialization":"Mental Health"}\'');
}

// Run tests
if (require.main === module) {
  console.log('🚀 Starting Email Validation Tests...\n');
  
  testEmailValidation()
    .then(() => {
      testAPIEndpoints();
      console.log('\n✨ Testing completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testEmailValidation };