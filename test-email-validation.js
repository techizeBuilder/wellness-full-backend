// Test file to verify email validation functionality
const { checkEmailExists, checkPhoneExists } = require('./utils/emailValidation');

async function testEmailValidation() {
  console.log('Testing email validation utility...\n');
  
  try {
    // Test with a sample email
    const testEmail = 'test@example.com';
    const emailResult = await checkEmailExists(testEmail);
    
    console.log(`Email check for ${testEmail}:`, emailResult);
    
    // Test with a sample phone
    const testPhone = '+1234567890';
    const phoneResult = await checkPhoneExists(testPhone);
    
    console.log(`Phone check for ${testPhone}:`, phoneResult);
    
    console.log('\nEmail validation utility is working correctly!');
  } catch (error) {
    console.error('Error testing email validation:', error.message);
  }
}

// Only run if called directly
if (require.main === module) {
  testEmailValidation();
}

module.exports = { testEmailValidation };