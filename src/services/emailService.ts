import nodemailer from 'nodemailer';
import ENV from '../config/environment';
import logger from '../utils/logger';

interface SendEmailOptions {
  email: string;
  subject: string;
  html?: string;
  text?: string;
}

// Create reusable transporter object using SMTP with connection pooling
const createTransporter = () => {
  const transporter = nodemailer.createTransport({
    host: ENV.EMAIL_HOST,
    port: (ENV as any).EMAIL_PORT as any,
    secure: false, // true for 465, false for other ports
    auth: {
      user: ENV.EMAIL_USER,
      pass: ENV.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    },
    // Performance optimizations for immediate delivery
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateLimit: 14,
    connectionTimeout: 60000,
    greetingTimeout: 30000,
    socketTimeout: 75000,
    logger: false,
    debug: false
  } as any);

  // Verify connection configuration
  transporter.verify((error) => {
    if (error) {
      logger.error('Email transporter verification failed', error);
    } else {
      logger.info('Email server is ready to take our messages');
    }
  });

  return transporter;
};

// Create a single transporter instance to reuse
const emailTransporter = createTransporter();

// Send email function with retry mechanism for guaranteed delivery
export const sendEmail = async (options: SendEmailOptions, retryCount: number = 0) => {
  const maxRetries = 3;
  const startTime = Date.now();
  
  try {
    logger.info(`Sending email to: ${options.email}, Subject: ${options.subject} (Attempt ${retryCount + 1})`);

    const mailOptions = {
      from: `"Wellness App" <${ENV.EMAIL_FROM}>`,
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
    } as any;

    const info = await emailTransporter.sendMail(mailOptions);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    logger.info(`Email sent successfully in ${duration}ms`, { messageId: info.messageId, accepted: info.accepted });
    
    return { 
      success: true, 
      messageId: info.messageId, 
      duration: duration,
      timestamp: new Date().toISOString(),
      attempt: retryCount + 1
    };
  } catch (error: any) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    logger.error(`Email sending failed after ${duration}ms (Attempt ${retryCount + 1})`, error);
    
    // Retry logic for transient errors
    if (retryCount < maxRetries && (
      error.code === 'ECONNRESET' || 
      error.code === 'ETIMEDOUT' || 
      error.code === 'ENOTFOUND' ||
      error.responseCode >= 400
    )) {
      logger.debug(`Retrying email in ${(retryCount + 1) * 2} seconds...`);
      await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 2000));
      return sendEmail(options, retryCount + 1);
    }
    
    logger.error('Email sending failed', {
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
export const sendOTPEmail = async (email: string, otp: string, firstName: string, type: 'verification' | 'password_reset' = 'verification', resetUrl: string | null = null) => {
  let subject: string, purposeText: string, headerTitle: string;
  
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
                        <li>This OTP is valid for ${ENV.OTP_EXPIRE_MINUTES || 10} minutes only</li>
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
  
  const text = `Hello ${firstName}! Your ${type === 'password_reset' ? 'password reset ' : ''}OTP code is: ${otp}. This code is valid for ${ENV.OTP_EXPIRE_MINUTES || 10} minutes only. Do not share this code with anyone.`;

  // Quick console visibility for OTPs during manual testing
  console.log(`\n🔐 OTP for ${email}: ${otp}\n`);

  return await sendEmail({ email, subject, html, text });
};

// Send password reset email
export const sendPasswordResetEmail = async (email: string, resetToken: string, firstName: string) => {
  const resetUrl = `${ENV.FRONTEND_URL}/reset-password?token=${resetToken}`;
  
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

  return await sendEmail({ email, subject, html, text });
};

// Send welcome email
export const sendWelcomeEmail = async (email: string, firstName: string, userType: 'user' | 'expert') => {
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
                    <a href="${ENV.FRONTEND_URL}/dashboard" class="button">Get Started</a>
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

  return await sendEmail({ email, subject, html });
};

// Send expert approval email
export const sendExpertApprovalEmail = async (email: string, firstName: string, approved: boolean = true) => {
  const subject = approved ? 'Congratulations! Your Expert Profile has been Approved' : 'Expert Profile Review Update';
  
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
                    <a href="${ENV.FRONTEND_URL}/expert/dashboard" class="button">Access Your Dashboard</a>
                </div>
                ` : `
                <p>We've reviewed your expert profile and need some additional information before we can approve it.</p>
                <p>Please log in to your account and update your profile with the required information.</p>
                <div style="text-align: center;">
                    <a href="${ENV.FRONTEND_URL}/expert/profile" class="button">Update Profile</a>
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

  return await sendEmail({ email, subject, html });
};

interface SessionReminderEmailOptions {
  email: string;
  firstName: string;
  counterpartyName: string;
  startDateTime: Date;
  consultationMethod: string;
  leadMinutes: number;
  joinWindowMinutes: number;
}

const formatSessionDateTime = (date: Date) => {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
};

const getConsultationMethodLabel = (method: string) => {
  switch (method) {
    case 'video':
      return 'Video Call';
    case 'audio':
      return 'Audio Call';
    case 'chat':
      return 'Chat Session';
    case 'in-person':
      return 'In-person Session';
    default:
      return 'Session';
  }
};

export const sendSessionReminderEmail = async ({
  email,
  firstName,
  counterpartyName,
  startDateTime,
  consultationMethod,
  leadMinutes,
  joinWindowMinutes
}: SessionReminderEmailOptions) => {
  const formattedDate = formatSessionDateTime(startDateTime);
  const methodLabel = getConsultationMethodLabel(consultationMethod);
  const subject = `${methodLabel} starting in ${leadMinutes} minutes`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Session Reminder</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
        .details { background-color: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Upcoming Session Reminder</h1>
        </div>
        <div class="content">
          <p>Hi ${firstName},</p>
          <p>This is a friendly reminder that your ${methodLabel.toLowerCase()} with ${counterpartyName} will begin in ${leadMinutes} minutes.</p>
          <div class="details">
            <p><strong>Session with:</strong> ${counterpartyName}</p>
            <p><strong>Session type:</strong> ${methodLabel}</p>
            <p><strong>Start time:</strong> ${formattedDate}</p>
            <p><strong>Join window:</strong> You can join the session up to ${joinWindowMinutes} minutes before the start time.</p>
          </div>
          <p>Please ensure you're ready and have a stable connection if this is a virtual session.</p>
          <p>If you can no longer attend, please update the session status inside the app.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Wellness App. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `Hi ${firstName}, your ${methodLabel.toLowerCase()} with ${counterpartyName} starts in ${leadMinutes} minutes on ${formattedDate}. Please be ready to join within ${joinWindowMinutes} minutes of the start time.`;

  return await sendEmail({ email, subject, html, text });
};

export default {
  sendEmail,
  sendOTPEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendExpertApprovalEmail,
  sendSessionReminderEmail
};
