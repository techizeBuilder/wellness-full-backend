/**
 * Comprehensive test for duplicate email validation
 * Tests the registration endpoints directly
 */

require('dotenv').config();
const request = require('supertest');
const mongoose = require('mongoose');
const express = require('express');

// Import the app components
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const expertRoutes = require('./routes/expertRoutes');
const { errorHandler, notFound } = require('./middlewares/errorHandler');

// Create test app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/experts', expertRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Test data
const testUser = {
  firstName: 'Test',
  lastName: 'User',
  email: 'testuser@validation.com',
  phone: '+1234567890',
  password: 'password123'
};

const testExpert = {
  fullName: 'Test Expert',
  email: 'testuser@validation.com', // Same email as user
  phone: '+0987654321',
  password: 'password123',
  specialization: 'Mental Health',
  experience: '5 years',
  hourlyRate: 100
};

async function connectToTestDB() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables');
    }
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB for testing');
    return true;
  } catch (error) {
    console.log('❌ MongoDB connection failed:', error.message);
    return false;
  }
}

async function cleanupTestData() {
  try {
    const User = require('./models/User');
    const Expert = require('./models/Expert');
    
    // Clean up any existing test data
    await User.deleteMany({ email: { $regex: /@validation\.com$/ } });
    await Expert.deleteMany({ email: { $regex: /@validation\.com$/ } });
    
    console.log('🧹 Cleaned up existing test data');
  } catch (error) {
    console.log('⚠️  Error cleaning up test data:', error.message);
  }
}

async function testDuplicateEmailValidation() {
  console.log('🧪 Testing Duplicate Email Validation\n');
  
  const dbConnected = await connectToTestDB();
  if (!dbConnected) {
    console.log('❌ Cannot run API tests without database connection');
    return;
  }
  
  try {
    await cleanupTestData();
    
    console.log('1️⃣  Testing User Registration...');
    
    // Test 1: Register a user
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send(testUser)
      .expect(201);
    
    console.log('✅ User registered successfully');
    console.log('   User ID:', userResponse.body.data.user._id);
    console.log('   Message:', userResponse.body.message);
    
    console.log('\n2️⃣  Testing Expert Registration with Same Email...');
    
    // Test 2: Try to register expert with same email (should fail)
    const expertResponse = await request(app)
      .post('/api/experts/register')
      .send(testExpert)
      .expect(400);
    
    console.log('✅ Expert registration correctly failed');
    console.log('   Error message:', expertResponse.body.message);
    console.log('   Success status:', expertResponse.body.success);
    
    // Verify the error message indicates the email is already taken
    if (expertResponse.body.message.includes('already registered')) {
      console.log('✅ Proper error message indicating email is already registered');
    } else {
      console.log('⚠️  Error message may not be specific enough');
    }
    
    console.log('\n3️⃣  Testing Expert Registration with Different Email...');
    
    // Test 3: Register expert with different email (should succeed)
    const expertWithDifferentEmail = {
      ...testExpert,
      email: 'testexpert@validation.com',
      phone: '+1111111111'
    };
    
    const expertSuccessResponse = await request(app)
      .post('/api/experts/register')
      .send(expertWithDifferentEmail)
      .expect(201);
    
    console.log('✅ Expert registered successfully with different email');
    console.log('   Expert ID:', expertSuccessResponse.body.data.expert._id);
    console.log('   Message:', expertSuccessResponse.body.message);
    
    console.log('\n4️⃣  Testing Reverse Scenario - User with Expert Email...');
    
    // Test 4: Try to register user with expert's email (should fail)
    const userWithExpertEmail = {
      ...testUser,
      email: 'testexpert@validation.com',
      phone: '+2222222222'
    };
    
    const userFailResponse = await request(app)
      .post('/api/auth/register')
      .send(userWithExpertEmail)
      .expect(400);
    
    console.log('✅ User registration correctly failed with expert email');
    console.log('   Error message:', userFailResponse.body.message);
    
    console.log('\n5️⃣  Testing Phone Number Validation...');
    
    // Test 5: Try to register with same phone number
    const userWithSamePhone = {
      firstName: 'Another',
      lastName: 'User',
      email: 'another@validation.com',
      phone: '+1234567890', // Same phone as first user
      password: 'password123'
    };
    
    const phoneFailResponse = await request(app)
      .post('/api/auth/register')
      .send(userWithSamePhone)
      .expect(400);
    
    console.log('✅ Registration correctly failed with duplicate phone');
    console.log('   Error message:', phoneFailResponse.body.message);
    
    console.log('\n🎉 All validation tests passed!');
    
    // Summary
    console.log('\n📋 Test Summary:');
    console.log('✅ User registration works');
    console.log('✅ Duplicate email validation prevents expert registration');
    console.log('✅ Different emails allow separate registrations');
    console.log('✅ Cross-collection email validation works both ways');
    console.log('✅ Phone number validation also works');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.body);
    }
  } finally {
    await cleanupTestData();
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Additional manual testing helper
function printManualTestInstructions() {
  console.log('\n📝 Manual Testing Instructions:');
  console.log('\n1. Start the server: node server.js');
  console.log('2. Use these curl commands:\n');
  
  console.log('# Register User:');
  console.log('curl -X POST http://localhost:5000/api/auth/register \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -d \'{\n    "firstName": "Manual",\n    "lastName": "User",\n    "email": "manual@test.com",\n    "phone": "+1234567890",\n    "password": "password123"\n  }\'');
  
  console.log('\n# Try to register Expert with same email (should fail):');
  console.log('curl -X POST http://localhost:5000/api/experts/register \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -d \'{\n    "fullName": "Manual Expert",\n    "email": "manual@test.com",\n    "phone": "+0987654321",\n    "password": "password123",\n    "specialization": "Mental Health"\n  }\'');
  
  console.log('\n# Expected result: Second request should return 400 error with message about email already being registered');
}

// Run tests
if (require.main === module) {
  console.log('🚀 Starting Comprehensive Email Validation Tests...\n');
  
  testDuplicateEmailValidation()
    .then(() => {
      printManualTestInstructions();
      console.log('\n✨ Testing completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test suite failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testDuplicateEmailValidation, app };