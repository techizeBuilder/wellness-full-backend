const axios = require('axios');
const FormData = require('form-data');

const API_BASE_URL = 'http://localhost:3000/api';

async function testExpertRegistration() {
  console.log('=== Testing Expert Registration with firstName/lastName ===');
  
  try {
    const formData = new FormData();
    formData.append('firstName', 'Test');
    formData.append('lastName', 'Expert');
    formData.append('email', 'testexpert@example.com');
    formData.append('phone', '+1234567890');
    formData.append('password', 'TestPassword123!');
    formData.append('specialization', 'Psychology');
    formData.append('experience', '5');
    formData.append('bio', 'Test expert bio');
    formData.append('hourlyRate', '75');
    formData.append('qualifications', JSON.stringify([{
      degree: 'PhD Psychology',
      institution: 'Test University',
      year: 2020
    }]));
    formData.append('languages', JSON.stringify(['English', 'Spanish']));
    formData.append('consultationMethods', JSON.stringify(['video', 'chat']));

    console.log('Sending registration request...');
    
    const response = await axios.post(`${API_BASE_URL}/experts/register`, formData, {
      headers: {
        ...formData.getHeaders()
      },
      timeout: 10000
    });

    console.log('Registration Response Status:', response.status);
    console.log('Registration Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success && response.data.data && response.data.data.user) {
      const expert = response.data.data.user;
      console.log('\n✅ Expert Registration Successful!');
      console.log('Expert ID:', expert._id);
      console.log('First Name:', expert.firstName);
      console.log('Last Name:', expert.lastName);
      console.log('Email:', expert.email);
      console.log('Specialization:', expert.specialization);
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
    console.error('❌ Expert Registration Failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Run the test
testExpertRegistration().catch(console.error);