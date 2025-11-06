require('dotenv').config();
const { sendEmail } = require('./utils/emailService');

const testEmailDelivery = async () => {
  console.log('🧪 Testing Email Delivery Speed and Reliability\n');
  
  const testEmail = 'mxcoder123@gmail.com'; // Your own email for testing
  const testTime = new Date().toISOString();
  
  console.log(`📧 Sending test email to: ${testEmail}`);
  console.log(`🕒 Test started at: ${testTime}\n`);
  
  const testHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #2c5e6b;">Email Delivery Test</h2>
      <p>This is a test email to verify immediate delivery.</p>
      <p><strong>Test Time:</strong> ${testTime}</p>
      <p><strong>Purpose:</strong> Verify email configuration optimizations</p>
      <div style="background: #f0f0f0; padding: 10px; border-radius: 5px; margin: 20px 0;">
        <h3>Test URLs:</h3>
        <p><strong>Admin Panel:</strong> https://adminwellness.shrawantravels.com</p>
        <p><strong>API Backend:</strong> https://apiwellness.shrawantravels.com</p>
      </div>
      <p style="color: #666; font-size: 14px;">
        If you receive this email within 1-2 minutes, the optimization was successful!
      </p>
    </div>
  `;
  
  try {
    const result = await sendEmail({
      email: testEmail,
      subject: `Email Delivery Test - ${new Date().toLocaleTimeString()}`,
      html: testHtml
    });
    
    if (result.success) {
      console.log('✅ Test Result: SUCCESS');
      console.log(`📨 Message ID: ${result.messageId}`);
      console.log(`⏱️ Delivery Time: ${result.duration}ms`);
      console.log(`🕒 Sent At: ${result.timestamp}`);
      console.log(`🔄 Attempts: ${result.attempt || 1}`);
      console.log('\n🎉 Email optimization appears to be working!');
      console.log('📬 Check your email inbox now to verify delivery speed.');
    } else {
      console.log('❌ Test Result: FAILED');
      console.log(`📧 Error: ${result.error}`);
      console.log(`⏱️ Failed After: ${result.duration}ms`);
      console.log(`🔄 Attempts: ${result.attempts}`);
    }
  } catch (error) {
    console.error('🚨 Test failed with exception:', error.message);
  }
  
  console.log('\n📋 Email Configuration Summary:');
  console.log(`HOST: ${process.env.EMAIL_HOST}`);
  console.log(`PORT: ${process.env.EMAIL_PORT}`);
  console.log(`USER: ${process.env.EMAIL_USER}`);
  console.log(`FROM: ${process.env.EMAIL_FROM}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`ADMIN_URL: ${process.env.ADMIN_URL}`);
};

testEmailDelivery();