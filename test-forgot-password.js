require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('./models/Admin');
const { sendEmail } = require('./utils/emailService');
const crypto = require('crypto');

const testForgotPassword = async () => {
  console.log('🧪 TESTING FORGOT PASSWORD FUNCTIONALITY\n');
  console.log('🕒 Test Started:', new Date().toISOString());
  
  const testEmail = 'mxcoder123@gmail.com';
  console.log(`📧 Testing with email: ${testEmail}\n`);

  try {
    // Connect to database
    console.log('🔗 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Database connected successfully\n');

    // Step 1: Find or create test admin
    console.log('👤 Step 1: Finding/Creating test admin...');
    let admin = await Admin.findOne({ email: testEmail });
    
    if (!admin) {
      console.log('📝 Creating new test admin...');
      admin = await Admin.create({
        name: 'Test Admin',
        email: testEmail,
        password: 'testPassword123',
        role: 'admin',
        isPrimary: false
      });
      console.log('✅ Test admin created');
    } else {
      console.log('✅ Test admin found');
    }
    
    console.log(`👤 Admin ID: ${admin._id}`);
    console.log(`📧 Admin Email: ${admin.email}`);
    console.log(`👨‍💼 Admin Name: ${admin.name}\n`);

    // Step 2: Generate reset token (simulating forgot password request)
    console.log('🔑 Step 2: Generating reset token...');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 15 * 60 * 1000; // 15 minutes

    // Save token to admin
    admin.resetPasswordToken = resetToken;
    admin.resetPasswordExpiry = resetTokenExpiry;
    await admin.save();
    console.log('✅ Reset token generated and saved');
    console.log(`🔑 Token: ${resetToken}`);
    console.log(`⏰ Expires: ${new Date(resetTokenExpiry).toISOString()}\n`);

    // Step 3: Generate reset URL
    console.log('🔗 Step 3: Generating reset URL...');
    const adminUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000' 
      : (process.env.ADMIN_URL || 'https://adminwellness.shrawantravels.com');
    
    const resetUrl = `${adminUrl}/reset-password?token=${resetToken}`;
    console.log('✅ Reset URL generated');
    console.log(`🌐 URL: ${resetUrl}\n`);

    // Step 4: Create email HTML
    console.log('📝 Step 4: Creating email content...');
    const emailStartTime = Date.now();
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2c5e6b; margin: 0;">Password Reset Request</h1>
            <p style="color: #666; font-size: 16px;">Wellness App Admin Panel</p>
          </div>
          
          <p style="font-size: 16px; color: #333;">Hello <strong>${admin.name}</strong>,</p>
          
          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            We received a request to reset your password for your admin account. 
            If you made this request, click the button below to reset your password:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
              Reset Password
            </a>
          </div>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 0; font-size: 14px; color: #856404;">
              <strong>Security Notice:</strong> This link will expire in 15 minutes. If you didn't request this password reset, please ignore this email.
            </p>
          </div>
          
          <p style="font-size: 14px; color: #666; line-height: 1.6;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <span style="font-family: monospace; background: #f0f0f0; padding: 4px; border-radius: 4px; word-break: break-all;">${resetUrl}</span>
          </p>
          
          <p style="font-size: 14px; color: #666; text-align: center; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
            © 2025 Techizebuilder. All rights reserved.<br>
            If you have any questions, please contact the system administrator.
          </p>
        </div>
      </div>
    `;
    console.log('✅ Email content created\n');

    // Step 5: Send email with timing
    console.log('📧 Step 5: Sending password reset email...');
    console.log('⏱️  Starting email send process...');
    
    const emailResult = await sendEmail({
      email: admin.email,
      subject: `🔐 Password Reset Request - Wellness App Admin - ${new Date().toLocaleTimeString()}`,
      html
    });

    const emailEndTime = Date.now();
    const totalDuration = emailEndTime - emailStartTime;

    // Step 6: Results and analysis
    console.log('\n📊 RESULTS ANALYSIS:');
    console.log('='.repeat(50));
    
    if (emailResult.success) {
      console.log('🎉 FORGOT PASSWORD TEST: SUCCESS!');
      console.log(`✅ Email sent successfully to: ${admin.email}`);
      console.log(`📨 Message ID: ${emailResult.messageId}`);
      console.log(`⏱️  Email Delivery Time: ${emailResult.duration}ms (${(emailResult.duration/1000).toFixed(2)}s)`);
      console.log(`📊 Total Process Time: ${totalDuration}ms (${(totalDuration/1000).toFixed(2)}s)`);
      console.log(`🕒 Sent At: ${emailResult.timestamp}`);
      console.log(`🔄 Attempts: ${emailResult.attempt || 1}`);
      
      console.log('\n🎯 PERFORMANCE ANALYSIS:');
      if (emailResult.duration < 5000) {
        console.log('🚀 EXCELLENT: Email sent in under 5 seconds!');
      } else if (emailResult.duration < 30000) {
        console.log('✅ GOOD: Email sent in under 30 seconds');
      } else if (emailResult.duration < 60000) {
        console.log('⚠️  SLOW: Email took over 30 seconds');
      } else {
        console.log('❌ VERY SLOW: Email took over 1 minute');
      }
      
      console.log('\n📧 EMAIL DETAILS:');
      console.log(`📬 To: ${admin.email}`);
      console.log(`📝 Subject: Password Reset Request`);
      console.log(`🔗 Reset URL: ${resetUrl}`);
      console.log(`🔑 Token: ${resetToken}`);
      console.log(`⏰ Token Expires: ${new Date(resetTokenExpiry).toISOString()}`);
      
      console.log('\n✅ WHAT TO CHECK NOW:');
      console.log('1. Check your email inbox for the password reset email');
      console.log('2. Verify the email contains the correct admin panel URL');
      console.log('3. Click the reset link to test the full flow');
      console.log('4. Confirm the token works on the admin panel');
      
    } else {
      console.log('❌ FORGOT PASSWORD TEST: FAILED!');
      console.log(`📧 Error: ${emailResult.error}`);
      console.log(`⏱️  Failed After: ${emailResult.duration}ms`);
      console.log(`🔄 Attempts Made: ${emailResult.attempts}`);
      
      console.log('\n🔧 TROUBLESHOOTING:');
      console.log('1. Check email service configuration');
      console.log('2. Verify SMTP credentials');
      console.log('3. Check network connectivity');
      console.log('4. Review error logs above');
    }

    console.log('\n🌐 CONFIGURATION SUMMARY:');
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Email Host: ${process.env.EMAIL_HOST}`);
    console.log(`Email Port: ${process.env.EMAIL_PORT}`);
    console.log(`Admin URL: ${adminUrl}`);
    console.log(`Database: Connected ✅`);

  } catch (error) {
    console.error('\n🚨 TEST FAILED WITH ERROR:');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    // Clean up database connection
    console.log('\n🔌 Closing database connection...');
    await mongoose.disconnect();
    console.log('✅ Database disconnected');
    console.log('\n🏁 Test completed at:', new Date().toISOString());
  }
};

// Run the test
testForgotPassword();