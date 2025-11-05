const axios = require('axios');

const API_BASE = 'https://apiwellness.shrawantravels.com';

async function testLogin(email, password, userType = 'user') {
    try {
        console.log(`\n=== Testing Login: ${email} (${userType}) ===`);
        
        const response = await axios.post(`${API_BASE}/api/auth/login`, {
            email,
            password
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Login successful!');
        console.log('Status:', response.status);
        console.log('Response structure:');
        console.log('- response.data keys:', Object.keys(response.data));
        
        if (response.data.data) {
            console.log('- response.data.data keys:', Object.keys(response.data.data));
            
            if (response.data.data.user) {
                console.log('- response.data.data.user keys:', Object.keys(response.data.data.user));
                console.log('- User data:', {
                    firstName: response.data.data.user.firstName,
                    lastName: response.data.data.user.lastName,
                    name: response.data.data.user.name,
                    fullName: response.data.data.user.fullName,
                    email: response.data.data.user.email,
                    userType: response.data.data.user.userType
                });
            }
            
            if (response.data.data.expert) {
                console.log('- response.data.data.expert keys:', Object.keys(response.data.data.expert));
                console.log('- Expert data:', {
                    firstName: response.data.data.expert.firstName,
                    lastName: response.data.data.expert.lastName,
                    name: response.data.data.expert.name,
                    fullName: response.data.data.expert.fullName,
                    email: response.data.data.expert.email,
                    userType: response.data.data.expert.userType
                });
            }
        }
        
        console.log('\nFull response.data:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.log('❌ Login failed for', email);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Error:', error.response.data);
        } else {
            console.log('Network error:', error.message);
        }
    }
}

async function main() {
    console.log('Testing API login endpoints...\n');
    
    // Test user login
    await testLogin('ronak@gmail.com', 'Jeetu@2001', 'user');
    
    // Test expert login  
    await testLogin('jeet@gmail.com', 'Ronak@123', 'expert');
    
    console.log('\n=== Test Complete ===');
}

main().catch(console.error);