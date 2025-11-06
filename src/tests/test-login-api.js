const axios = require('axios');

const testLogin = async () => {
  try {
    console.log('🧪 Testing login API for ronal@gmail.com...');
    
    const response = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'ronal@gmail.com',
      password: 'Jeetu@123'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Login successful!');
    console.log('Status:', response.status);
    console.log('Success:', response.data.success);
    console.log('Message:', response.data.message);
    
    if (response.data.data && response.data.data.user) {
      const user = response.data.data.user;
      console.log('\n📋 User Data Received:');
      console.log('- ID:', user.id);
      console.log('- Email:', user.email);
      console.log('- First Name:', user.firstName);
      console.log('- Last Name:', user.lastName);
      console.log('- Phone:', user.phone);
      console.log('- User Type:', user.userType);
      console.log('- Account Type:', response.data.data.accountType);
      console.log('- Email Verified:', user.isEmailVerified);
      console.log('- Profile Image:', user.profileImage);
      
      console.log('\n🔑 Token Info:');
      console.log('- Token provided:', !!response.data.data.token);
      console.log('- Refresh token provided:', !!response.data.data.refreshToken);
      
      console.log('\n📝 Full Response:');
      console.log(JSON.stringify(response.data, null, 2));
    } else {
      console.log('⚠️ No user data in response');
      console.log('Full response:', JSON.stringify(response.data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Login failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error:', error.response.data);
    } else if (error.request) {
      console.error('No response received. Is the server running on http://localhost:5000?');
    } else {
      console.error('Error:', error.message);
    }
  }
};

// Run the test
testLogin();