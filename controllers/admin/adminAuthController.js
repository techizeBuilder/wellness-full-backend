const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Admin = require('../../models/Admin');
const { asyncHandler } = require('../../middlewares/errorHandler');
const { sendEmail } = require('../../utils/emailService');

// POST /api/admin/auth/login
const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  const admin = await Admin.findOne({ email }).select('+password');
  if (!admin) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  if (!admin.isActive) {
    return res.status(403).json({ success: false, message: 'Account is deactivated' });
  }

  const isMatch = await admin.matchPassword(password);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  admin.lastLogin = new Date();
  await admin.save();

  const secret = process.env.JWT_SECRET_ADMIN || process.env.JWT_SECRET;
  const token = jwt.sign({ id: admin._id.toString(), role: admin.role }, secret, { expiresIn: process.env.JWT_ADMIN_EXPIRE || '8h' });

  res.status(200).json({
    success: true,
    data: {
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions || []
      }
    }
  });
});

// GET /api/admin/profile
const getProfile = asyncHandler(async (req, res) => {
  const admin = req.adminDoc;
  if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

  res.status(200).json({ success: true, data: { admin } });
});

// PUT /api/admin/change-password
const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const admin = await Admin.findById(req.admin.id).select('+password');

  if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

  if (!oldPassword || !newPassword) return res.status(400).json({ success: false, message: 'Old and new passwords are required' });

  const matched = await admin.matchPassword(oldPassword);
  if (!matched) return res.status(401).json({ success: false, message: 'Old password is incorrect' });

  admin.password = newPassword;
  await admin.save();

  res.status(200).json({ success: true, message: 'Password updated successfully' });
});

// POST /api/admin/auth/forgot-password
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  const admin = await Admin.findOne({ email });
  if (!admin) {
    // Don't reveal if email exists or not for security
    return res.status(200).json({ 
      success: true, 
      message: 'If an account with this email exists, a password reset link has been sent.' 
    });
  }

  if (!admin.isActive) {
    return res.status(403).json({ success: false, message: 'Account is deactivated' });
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  admin.resetPasswordToken = resetToken;
  admin.resetPasswordExpiry = resetTokenExpiry;
  await admin.save();

  // Send reset email
  const adminUrl = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3000' 
    : (process.env.ADMIN_URL || 'https://adminwellness.shrawantravels.com');
  
  const resetUrl = `${adminUrl}/reset-password?token=${resetToken}`;
  
  console.log('🔗 Generated reset URL for admin:', resetUrl);
  
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

  try {
    console.log(`🚀 Attempting to send reset email to: ${admin.email}`);
    console.log(`📧 Reset URL generated: ${resetUrl}`);
    
    const emailResult = await sendEmail({
      email: admin.email,
      subject: 'Password Reset Request - Wellness App Admin',
      html
    });
    
    if (emailResult.success) {
      console.log(`✅ Password reset email sent successfully to ${admin.email}`);
      console.log(`📨 Message ID: ${emailResult.messageId}`);
      console.log(`⏱️ Email sent in: ${emailResult.duration}ms`);
      console.log(`🕒 Sent at: ${emailResult.timestamp}`);
      
      res.status(200).json({
        success: true,
        message: 'Password reset email sent successfully',
        emailDetails: {
          sentAt: emailResult.timestamp,
          duration: emailResult.duration,
          messageId: emailResult.messageId
        }
      });
    } else {
      console.error(`❌ Failed to send password reset email to ${admin.email}:`);
      console.error(`📧 Error: ${emailResult.error}`);
      console.error(`⏱️ Failed after: ${emailResult.duration}ms`);
      console.error(`🔄 Attempts made: ${emailResult.attempts}`);
      
      // Clear the reset token if email fails after all retries
      admin.resetPasswordToken = undefined;
      admin.resetPasswordExpiry = undefined;
      await admin.save();
      
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to send reset email after multiple attempts. Please try again later.',
        error: emailResult.error
      });
    }
  } catch (err) {
    console.error('❌ Unexpected error sending password reset email:', err.message);
    admin.resetPasswordToken = undefined;
    admin.resetPasswordExpiry = undefined;
    await admin.save();
    return res.status(500).json({ success: false, message: 'Failed to send reset email. Please try again.' });
  }

  res.status(200).json({ 
    success: true, 
    message: 'If an account with this email exists, a password reset link has been sent.' 
  });
});

// POST /api/admin/auth/reset-password
const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ success: false, message: 'Token and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
  }

  const admin = await Admin.findOne({
    resetPasswordToken: token,
    resetPasswordExpiry: { $gt: new Date() }
  });

  if (!admin) {
    return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
  }

  if (!admin.isActive) {
    return res.status(403).json({ success: false, message: 'Account is deactivated' });
  }

  // Update password and clear reset token
  admin.password = newPassword;
  admin.resetPasswordToken = undefined;
  admin.resetPasswordExpiry = undefined;
  await admin.save();

  res.status(200).json({ success: true, message: 'Password reset successfully' });
});

module.exports = {
  adminLogin,
  getProfile,
  changePassword,
  forgotPassword,
  resetPassword
};
