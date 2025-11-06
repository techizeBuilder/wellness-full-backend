const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testExpertRegistrationAutoLogin() {
  try {
    console.log('🧪 Testing Expert Registration with Auto-Login...');
    
    const formData = new FormData();
    formData.append('fullName', 'Test Expert AutoLogin');
    formData.append('email', 'testexpertautologin2@example.com');
    formData.append('phone', '9876543214');
    formData.append('password', 'Test@123');
    formData.append('specialization', 'Ayurveda');
    formData.append('experience', '4');
    formData.append('bio', 'Experienced Ayurveda practitioner');
    
    const response = await fetch('https://apiwellness.shrawantravels.com/api/experts/register', {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    
    console.log('\n📊 Registration Response:');
    console.log('Success:', data.success);
    console.log('Message:', data.message);
    
    if (data.success && data.data) {
      console.log('\n✅ Registration successful!');
      console.log('Has token:', !!data.data.token);
      console.log('Has user data:', !!data.data.user);
      console.log('Account type:', data.data.accountType);
      console.log('User type:', data.data.userType);
      
      if (data.data.user) {
        console.log('User name:', data.data.user.firstName, data.data.user.lastName);
        console.log('User ID:', data.data.user._id);
      }
      
      console.log('\n🎯 Auto-login data available - frontend should redirect to expert dashboard');
    } else {
      console.log('\n❌ Registration failed:', data.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testExpertRegistrationAutoLogin();