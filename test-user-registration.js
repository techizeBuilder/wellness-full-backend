const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000/api';

async function testUserRegistration() {
  console.log('=== Testing User Registration with firstName/lastName ===');
  
  try {
    const userData = {
      firstName: 'Test',
      lastName: 'User',
      email: 'testuser@example.com',
      phone: '+1234567891',
      password: 'TestPassword123!',
      dateOfBirth: '1990-01-01',
      gender: 'male'
    };

    console.log('Sending user registration request...');
    console.log('User data:', JSON.stringify(userData, null, 2));
    
    const response = await axios.post(`${API_BASE_URL}/auth/register`, userData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('Registration Response Status:', response.status);
    console.log('Registration Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success && response.data.data && response.data.data.user) {
      const user = response.data.data.user;
      console.log('\n✅ User Registration Successful!');
      console.log('User ID:', user._id);
      console.log('First Name:', user.firstName);
      console.log('Last Name:', user.lastName);
      console.log('Email:', user.email);
      console.log('Token provided:', !!response.data.data.token);
      
      // Test auto-login by using the provided token
      if (response.data.data.token) {
        console.log('\n=== Testing Auto-Login Token ===');
        const profileResponse = await axios.get(`${API_BASE_URL}/auth/profile`, {
          headers: {
            'Authorization': `Bearer ${response.data.data.token}`
          }
        });
        
        console.log('Profile fetch successful:', profileResponse.data.success);
        console.log('Profile data firstName:', profileResponse.data.data?.firstName);
        console.log('Profile data lastName:', profileResponse.data.data?.lastName);
      }
    } else {
      console.log('❌ Registration failed or unexpected response structure');
    }

  } catch (error) {
    console.error('❌ User Registration Failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Run the test
testUserRegistration().catch(console.error);