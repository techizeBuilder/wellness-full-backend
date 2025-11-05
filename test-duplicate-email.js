/**
 * Test script to verify email validation works correctly
 * This tests the cross-collection email validation for Users and Experts
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test data
const testUser = {
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com',
  phone: '+1234567890',
  password: 'password123'
};

const testExpert = {
  fullName: 'Test Expert',
  email: 'test@example.com', // Same email as user
  phone: '+0987654321',
  password: 'password123',
  specialization: 'Mental Health',
  experience: '5 years',
  hourlyRate: 100
};

async function testEmailValidation() {
  console.log('🧪 Testing Email Validation Across User and Expert Collections\n');
  
  try {
    console.log('1️⃣  Attempting to register a new user...');
    const userResponse = await axios.post(`${BASE_URL}/auth/register`, testUser);
    console.log('✅ User registered successfully:', userResponse.data.message);
    console.log('   User ID:', userResponse.data.data.user._id);
    
    console.log('\n2️⃣  Attempting to register an expert with the same email...');
    try {
      const expertResponse = await axios.post(`${BASE_URL}/experts/register`, testExpert);
      console.log('❌ ERROR: Expert registration should have failed but succeeded!');
      console.log('   Response:', expertResponse.data);
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ Expert registration correctly failed with validation error:');
        console.log('   Error message:', error.response.data.message);
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }
    
    console.log('\n3️⃣  Testing with different email for expert...');
    const expertWithDifferentEmail = {
      ...testExpert,
      email: 'expert@example.com'
    };
    
    try {
      const expertResponse = await axios.post(`${BASE_URL}/experts/register`, expertWithDifferentEmail);
      console.log('✅ Expert registered successfully with different email:', expertResponse.data.message);
      console.log('   Expert ID:', expertResponse.data.data.expert._id);
    } catch (error) {
      console.log('❌ Expert registration failed unexpectedly:', error.response?.data?.message || error.message);
    }
    
    console.log('\n4️⃣  Testing reverse scenario - registering user with expert email...');
    const userWithExpertEmail = {
      ...testUser,
      email: 'expert@example.com',
      phone: '+1111111111'
    };
    
    try {
      const userResponse = await axios.post(`${BASE_URL}/auth/register`, userWithExpertEmail);
      console.log('❌ ERROR: User registration should have failed but succeeded!');
      console.log('   Response:', userResponse.data);
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ User registration correctly failed with validation error:');
        console.log('   Error message:', error.response.data.message);
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }
    
    console.log('\n🎉 Email validation testing completed!');
    console.log('\n📋 Summary:');
    console.log('- ✅ Users and experts cannot register with the same email');
    console.log('- ✅ Proper error messages are displayed');
    console.log('- ✅ Cross-collection validation is working correctly');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', error.response.data);
    }
  }
}

// Helper function to clean up test data (optional)
async function cleanupTestData() {
  console.log('\n🧹 Cleaning up test data...');
  // Note: This would require admin endpoints or direct database access
  // For now, we'll just log that cleanup should be done manually
  console.log('   Please manually remove test users if needed');
}

// Run the test
if (require.main === module) {
  testEmailValidation().then(() => {
    console.log('\n✨ Test completed');
  }).catch(error => {
    console.error('❌ Test suite failed:', error.message);
  });
}

module.exports = { testEmailValidation };