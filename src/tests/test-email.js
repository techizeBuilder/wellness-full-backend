require('dotenv').config();
const { sendEmail } = require('./utils/emailService');

async function testEmail() {
  console.log('Testing email service...');
  console.log('EMAIL_HOST:', process.env.EMAIL_HOST);
  console.log('EMAIL_PORT:', process.env.EMAIL_PORT);
  console.log('EMAIL_USER:', process.env.EMAIL_USER);
  console.log('EMAIL_FROM:', process.env.EMAIL_FROM);
  
  try {
    const result = await sendEmail({
      email: 'pehna01@gmail.com',
      subject: 'Test Email - Wellness App',
      html: `
        <h1>Test Email</h1>
        <p>This is a test email to verify the email service configuration.</p>
        <p>Sent at: ${new Date().toISOString()}</p>
      `
    });
    
    console.log('Email test result:', result);
  } catch (error) {
    console.error('Email test failed:', error);
  }
}

testEmail();