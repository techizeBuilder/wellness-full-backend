const nodemailer = require('nodemailer');

// Create reusable transporter object using SMTP with connection pooling
const createTransporter = () => {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    },
    // Performance optimizations for immediate delivery
    pool: true,           // Use connection pool
    maxConnections: 5,    // Max concurrent connections
    maxMessages: 100,     // Max messages per connection
    rateLimit: 14,        // Max emails per second
    connectionTimeout: 60000,  // 60 seconds
    greetingTimeout: 30000,    // 30 seconds
    socketTimeout: 75000,      // 75 seconds
    logger: false,        // Disable logging for better performance
    debug: false          // Disable debug mode
  });

  // Verify connection configuration
  transporter.verify((error, success) => {
    if (error) {
      console.error('❌ Email transporter verification failed:', error);
    } else {
      console.log('✅ Email server is ready to take our messages');
    }
  });

  return transporter;
};

// Create a single transporter instance to reuse
const emailTransporter = createTransporter();

// Send email function with retry mechanism for guaranteed delivery
const sendEmail = async (options, retryCount = 0) => {
  const maxRetries = 3;
  const startTime = Date.now();
  
  try {
    console.log(`📧 Sending email to: ${options.email} at ${new Date().toISOString()} (Attempt ${retryCount + 1})`);

    const mailOptions = {
      from: `"Wellness App" <${process.env.EMAIL_FROM}>`,
      to: options.email,
      subject: options.subject,
      html: options.html,
      text: options.text,
      // Priority settings for immediate delivery
      priority: 'high',
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high'
      }
    };

    const info = await emailTransporter.sendMail(mailOptions);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`✅ Email sent successfully in ${duration}ms:`, info.messageId);
    console.log(`📬 Email accepted by: ${info.accepted}`);
    
    return { 
      success: true, 
      messageId: info.messageId, 
      duration: duration,
      timestamp: new Date().toISOString(),
      attempt: retryCount + 1
    };
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.error(`❌ Email sending failed after ${duration}ms (Attempt ${retryCount + 1}):`, error.message);
    
    // Retry logic for transient errors
    if (retryCount < maxRetries && (
      error.code === 'ECONNRESET' || 
      error.code === 'ETIMEDOUT' || 
      error.code === 'ENOTFOUND' ||
      error.responseCode >= 400
    )) {
      console.log(`🔄 Retrying email in ${(retryCount + 1) * 2} seconds...`);
      await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 2000));
      return sendEmail(options, retryCount + 1);
    }
    
    console.error('📧 Email details:', {
      to: options.email,
      subject: options.subject,
      error: error.message,
      finalAttempt: retryCount + 1
    });
    
    return { 
      success: false, 
      error: error.message,
      duration: duration,
      timestamp: new Date().toISOString(),
      attempts: retryCount + 1
    };
  }
};

// Send OTP email
const sendOTPEmail = async (email, otp, firstName, type = 'verification', resetUrl = null) => {
  let subject, purposeText, headerTitle;
  
  if (type === 'password_reset') {
    subject = 'Password Reset OTP - Wellness App';
    purposeText = 'You have requested to reset your password. Please use the OTP code below to verify your identity, then click the reset button to set your new password:';
    headerTitle = 'Password Reset Request';
  } else {
    subject = 'Your OTP Code - Wellness App';
    purposeText = 'You have requested a One-Time Password (OTP) for verification. Please use the code below:';
    headerTitle = 'OTP Verification';
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${headerTitle}</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: ${type === 'password_reset' ? '#f44336' : '#4CAF50'}; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .otp-box { background-color: #fff; border: 2px solid ${type === 'password_reset' ? '#f44336' : '#4CAF50'}; padding: 20px; margin: 20px 0; text-align: center; border-radius: 10px; }
            .otp-code { font-size: 32px; font-weight: bold; color: ${type === 'password_reset' ? '#f44336' : '#4CAF50'}; letter-spacing: 5px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
            .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 15px 0; border-radius: 5px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>${headerTitle}</h1>
            </div>
            <div class="content">
                <h2>Hello ${firstName}!</h2>
                <p>${purposeText}</p>
                
                <div class="otp-box">
                    <div class="otp-code">${otp}</div>
                </div>
                
                ${resetUrl ? `
                <div style="text-align: center; margin: 20px 0;">
                    <p>After verifying the OTP code above, click the button below to reset your password:</p>
                    <a href="${resetUrl}" style="display: inline-block; background-color: #f44336; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 0;">Reset Password</a>
                    <p style="margin-top: 15px; font-size: 14px; color: #666;">Or copy and paste this link in your browser:<br><a href="${resetUrl}" style="color: #f44336; word-break: break-all;">${resetUrl}</a></p>
                </div>
                ` : ''}
                
                <div class="warning">
                    <strong>Important:</strong>
                    <ul>
                        <li>This OTP is valid for ${process.env.OTP_EXPIRE_MINUTES || 10} minutes only</li>
                        <li>Do not share this code with anyone</li>
                        <li>If you didn't request this, please ignore this email</li>
                        ${type === 'password_reset' ? '<li>Your password will not be changed until you create a new one</li>' : ''}
                    </ul>
                </div>
                
                <p>If you're having trouble, please contact our support team.</p>
            </div>
            <div class="footer">
                <p>&copy; 2024 Wellness App. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
  `;
  
  const text = `Hello ${firstName}! Your ${type === 'password_reset' ? 'password reset ' : ''}OTP code is: ${otp}. This code is valid for ${process.env.OTP_EXPIRE_MINUTES || 10} minutes only. Do not share this code with anyone.`;

  return await sendEmail({
    email,
    subject,
    html,
    text
  });
};

// Send password reset email
const sendPasswordResetEmail = async (email, resetToken, firstName) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  
  const subject = 'Password Reset Request - Wellness App';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f44336; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background-color: #f44336; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
            .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 15px 0; border-radius: 5px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Password Reset Request</h1>
            </div>
            <div class="content">
                <h2>Hello ${firstName}!</h2>
                <p>You have requested to reset your password. Click the button below to reset your password:</p>
                
                <div style="text-align: center;">
                    <a href="${resetUrl}" class="button">Reset Password</a>
                </div>
                
                <p>Or copy and paste this link in your browser:</p>
                <p style="word-break: break-all; background-color: #e9ecef; padding: 10px; border-radius: 5px;">${resetUrl}</p>
                
                <div class="warning">
                    <strong>Important:</strong>
                    <ul>
                        <li>This link will expire in 1 hour</li>
                        <li>If you didn't request this, please ignore this email</li>
                        <li>Your password will not be changed until you create a new one</li>
                    </ul>
                </div>
            </div>
            <div class="footer">
                <p>&copy; 2024 Wellness App. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
  `;
  
  const text = `Hello ${firstName}! You have requested to reset your password. Please visit the following link to reset your password: ${resetUrl}. This link will expire in 1 hour.`;

  return await sendEmail({
    email,
    subject,
    html,
    text
  });
};

// Send welcome email
const sendWelcomeEmail = async (email, firstName, userType) => {
  const subject = `Welcome to Wellness App, ${firstName}!`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Wellness App</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
            .button { display: inline-block; background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Welcome to Wellness App!</h1>
            </div>
            <div class="content">
                <h2>Hello ${firstName}!</h2>
                <p>Welcome to Wellness App! We're excited to have you join our community.</p>
                
                ${userType === 'expert' ? `
                <p>As a wellness expert, you can now:</p>
                <ul>
                    <li>Complete your profile with qualifications and experience</li>
                    <li>Set your availability and consultation preferences</li>
                    <li>Start helping clients achieve their wellness goals</li>
                </ul>
                <p><strong>Note:</strong> Your profile will be reviewed by our team before you can start accepting consultations.</p>
                ` : `
                <p>As a wellness seeker, you can now:</p>
                <ul>
                    <li>Browse and connect with verified wellness experts</li>
                    <li>Book consultations that fit your schedule</li>
                    <li>Track your wellness journey</li>
                </ul>
                `}
                
                <div style="text-align: center;">
                    <a href="${process.env.FRONTEND_URL}/dashboard" class="button">Get Started</a>
                </div>
                
                <p>If you have any questions, feel free to reach out to our support team.</p>
            </div>
            <div class="footer">
                <p>&copy; 2024 Wellness App. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
  `;

  return await sendEmail({
    email,
    subject,
    html
  });
};

// Send expert approval email
const sendExpertApprovalEmail = async (email, firstName, approved = true) => {
  const subject = approved 
    ? 'Congratulations! Your Expert Profile has been Approved' 
    : 'Expert Profile Review Update';
    
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Expert Profile ${approved ? 'Approved' : 'Review Update'}</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: ${approved ? '#4CAF50' : '#ff9800'}; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
            .button { display: inline-block; background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Expert Profile ${approved ? 'Approved!' : 'Review Update'}</h1>
            </div>
            <div class="content">
                <h2>Hello ${firstName}!</h2>
                
                ${approved ? `
                <p>🎉 Congratulations! Your expert profile has been approved and you can now start accepting consultations.</p>
                <p>You can now:</p>
                <ul>
                    <li>Receive booking requests from clients</li>
                    <li>Manage your consultation schedule</li>
                    <li>Start helping people on their wellness journey</li>
                </ul>
                <div style="text-align: center;">
                    <a href="${process.env.FRONTEND_URL}/expert/dashboard" class="button">Access Your Dashboard</a>
                </div>
                ` : `
                <p>We've reviewed your expert profile and need some additional information before we can approve it.</p>
                <p>Please log in to your account and update your profile with the required information.</p>
                <div style="text-align: center;">
                    <a href="${process.env.FRONTEND_URL}/expert/profile" class="button">Update Profile</a>
                </div>
                `}
                
                <p>If you have any questions, please don't hesitate to contact our support team.</p>
            </div>
            <div class="footer">
                <p>&copy; 2024 Wellness App. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
  `;

  return await sendEmail({
    email,
    subject,
    html
  });
};

module.exports = {
  sendEmail,
  sendOTPEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendExpertApprovalEmail
};