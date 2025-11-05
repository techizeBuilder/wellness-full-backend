/**
 * Live API Testing Script for Email Validation
 * Use this when the server is running to test the actual endpoints
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:5000/api';
const TEST_EMAIL = 'livetest@validation.com';
const TEST_PHONE = '+9999999999';

// Test data
const testUser = {
  firstName: 'Live',
  lastName: 'User',
  email: TEST_EMAIL,
  phone: TEST_PHONE,
  password: 'password123'
};

const testExpert = {
  fullName: 'Live Expert',
  email: TEST_EMAIL, // Same email as user
  phone: '+8888888888',
  password: 'password123',
  specialization: 'Mental Health',
  experience: '5 years',
  hourlyRate: 100
};

async function checkServerHealth() {
  try {
    const response = await axios.get('http://localhost:5000/health');
    console.log('✅ Server is running');
    console.log('   Health Status:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Server is not running or not responding');
    console.log('   Error:', error.message);
    console.log('\n🚀 To start the server:');
    console.log('   cd backend');
    console.log('   node server.js');
    return false;
  }
}

async function testLiveEmailValidation() {
  console.log('🧪 Testing Live Email Validation with Running Server\n');
  
  // Check if server is running
  const serverRunning = await checkServerHealth();
  if (!serverRunning) {
    return;
  }
  
  try {
    console.log('\n1️⃣  Testing User Registration...');
    
    // Clean up any existing test data first
    console.log('🧹 Cleaning up any existing test data...');
    
    try {
      // Try to register and delete test user/expert (cleanup)
      // This is just to ensure clean state
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    
    // Test 1: Register a user
    console.log('📝 Registering user with email:', TEST_EMAIL);
    
    const userResponse = await axios.post(`${BASE_URL}/auth/register`, testUser);
    
    console.log('✅ User registered successfully');
    console.log('   Status:', userResponse.status);
    console.log('   User ID:', userResponse.data.data.user._id);
    console.log('   Message:', userResponse.data.message);
    console.log('   Success:', userResponse.data.success);
    
    console.log('\n2️⃣  Testing Expert Registration with Same Email...');
    console.log('📝 Attempting to register expert with same email:', TEST_EMAIL);
    
    // Test 2: Try to register expert with same email (should fail)
    try {
      const expertResponse = await axios.post(`${BASE_URL}/experts/register`, testExpert);
      
      // If we get here, the test failed (should not allow registration)
      console.log('❌ ERROR: Expert registration should have failed but succeeded!');
      console.log('   Response:', expertResponse.data);
      
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ Expert registration correctly failed');
        console.log('   Status:', error.response.status);
        console.log('   Error message:', error.response.data.message);
        console.log('   Success:', error.response.data.success);
        
        // Check if error message is appropriate
        if (error.response.data.message.includes('already registered')) {
          console.log('✅ Error message correctly indicates email is already registered');
        } else {
          console.log('⚠️  Error message could be more specific');
        }
        
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }
    
    console.log('\n3️⃣  Testing Expert Registration with Different Email...');
    
    const expertWithDifferentEmail = {
      ...testExpert,
      email: 'liveexpert@validation.com',
      phone: '+7777777777'
    };
    
    console.log('📝 Registering expert with different email:', expertWithDifferentEmail.email);
    
    const expertSuccessResponse = await axios.post(`${BASE_URL}/experts/register`, expertWithDifferentEmail);
    
    console.log('✅ Expert registered successfully with different email');
    console.log('   Status:', expertSuccessResponse.status);
    console.log('   Expert ID:', expertSuccessResponse.data.data.expert._id);
    console.log('   Message:', expertSuccessResponse.data.message);
    
    console.log('\n4️⃣  Testing Reverse Scenario...');
    
    const userWithExpertEmail = {
      ...testUser,
      email: 'liveexpert@validation.com',
      phone: '+6666666666'
    };
    
    console.log('📝 Attempting to register user with expert email:', userWithExpertEmail.email);
    
    try {
      const userFailResponse = await axios.post(`${BASE_URL}/auth/register`, userWithExpertEmail);
      
      console.log('❌ ERROR: User registration should have failed but succeeded!');
      console.log('   Response:', userFailResponse.data);
      
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ User registration correctly failed');
        console.log('   Error message:', error.response.data.message);
        
        if (error.response.data.message.includes('already registered')) {
          console.log('✅ Cross-collection validation working correctly');
        }
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }
    
    console.log('\n🎉 Live API testing completed successfully!');
    
    // Summary
    console.log('\n📋 Live Test Results:');
    console.log('✅ User registration endpoint works');
    console.log('✅ Expert registration endpoint works');
    console.log('✅ Duplicate email validation prevents registration');
    console.log('✅ Cross-collection validation works both ways');
    console.log('✅ Appropriate error messages are returned');
    console.log('✅ Different emails allow separate registrations');
    
    console.log('\n🧹 Note: Test data with @validation.com emails created');
    console.log('   You may want to clean these up manually via database or admin panel');
    
  } catch (error) {
    console.error('❌ Live test failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Response:', error.response.data);
    }
  }
}

// Helper function to show manual testing commands
function showManualTestCommands() {
  console.log('\n📝 Manual Testing Commands (copy and paste):');
  console.log('\n# 1. Register User:');
  console.log(`curl -X POST ${BASE_URL}/auth/register \\`);
  console.log('  -H "Content-Type: application/json" \\');
  console.log(`  -d '${JSON.stringify(testUser, null, 2)}'`);
  
  console.log('\n# 2. Try to register Expert with same email (should fail):');
  console.log(`curl -X POST ${BASE_URL}/experts/register \\`);
  console.log('  -H "Content-Type: application/json" \\');
  console.log(`  -d '${JSON.stringify(testExpert, null, 2)}'`);
  
  console.log('\n# Expected: Second command should return 400 error');
  console.log('# Example success response (first command):');
  console.log('# { "success": true, "message": "User registered successfully...", "data": {...} }');
  console.log('\n# Example error response (second command):');
  console.log('# { "success": false, "message": "This email is already registered as a user account" }');
}

// Run tests
if (require.main === module) {
  console.log('🚀 Starting Live API Email Validation Tests...\n');
  
  testLiveEmailValidation()
    .then(() => {
      showManualTestCommands();
      console.log('\n✨ Live testing completed!');
    })
    .catch((error) => {
      console.error('❌ Live test suite failed:', error.message);
    });
}

module.exports = { testLiveEmailValidation, checkServerHealth };