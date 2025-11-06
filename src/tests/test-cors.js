const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Test CORS configuration
const testCors = () => {
  console.log('🧪 Testing CORS Configuration\n');
  
  // Test environment variables
  console.log('📋 Environment Variables:');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
  console.log('PORT:', process.env.PORT);
  console.log('\n');
  
  // Parse FRONTEND_URL
  const frontendUrls = process.env.FRONTEND_URL ? 
    process.env.FRONTEND_URL.split(',').map(url => url.trim()) : [];
  
  console.log('🌐 Parsed Frontend URLs:');
  frontendUrls.forEach((url, index) => {
    console.log(`${index + 1}. ${url}`);
  });
  console.log('\n');
  
  // Test origins
  const testOrigins = [
    'https://adminwellness.shrawantravels.com',
    'https://apiwellness.shrawantravels.com',
    'http://localhost:3000',
    'http://localhost:3001',
    'https://someothersite.com'
  ];
  
  console.log('🔍 Testing Origins:');
  testOrigins.forEach(origin => {
    const allowedOrigins = [
      ...frontendUrls,
      'http://localhost:3000',
      'http://localhost:3001',
      'https://apiwellness.shrawantravels.com',
      'http://apiwellness.shrawantravels.com',
      'https://adminwellness.shrawantravels.com',
      'http://adminwellness.shrawantravels.com'
    ];
    
    const normalizedOrigin = origin.replace(/\/$/, '');
    const isAllowed = allowedOrigins.some(allowedOrigin => 
      allowedOrigin.replace(/\/$/, '') === normalizedOrigin
    );
    
    console.log(`${isAllowed ? '✅' : '❌'} ${origin} - ${isAllowed ? 'ALLOWED' : 'BLOCKED'}`);
  });
  console.log('\n');
  
  // Test different scenarios
  console.log('🚀 Common CORS Issues & Solutions:');
  console.log('1. Make sure frontend is using HTTPS in production');
  console.log('2. Check browser dev tools for exact error message');
  console.log('3. Verify API requests include credentials if needed');
  console.log('4. Check if using correct Content-Type headers');
  console.log('5. Ensure preflight requests are handled correctly');
  console.log('\n');
  
  console.log('🛠️ Quick Test URLs:');
  console.log(`Health Check: https://apiwellness.shrawantravels.com/health`);
  console.log(`API Docs: https://apiwellness.shrawantravels.com/`);
  console.log(`Auth API: https://apiwellness.shrawantravels.com/api/auth`);
};

testCors();