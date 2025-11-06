const crypto = require('crypto');
const User = require('../models/User');
const { asyncHandler } = require('../middlewares/errorHandler');
const { generateToken, generateRefreshToken } = require('../middlewares/auth');
const { sendOTPEmail, sendPasswordResetEmail, sendWelcomeEmail } = require('../utils/emailService');
const { checkEmailExists, checkPhoneExists } = require('../utils/emailValidation');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
  console.log('=== USER REGISTRATION DEBUG ===');
  console.log('Request body:', req.body);
  
  const {
    firstName,
    lastName,
    email,
    phone,
    password,
    dateOfBirth,
    gender
  } = req.body;

  // Input validation
  if (!firstName || !email || !phone || !password) {
    console.log('Validation error: Missing required fields');
    return res.status(400).json({
      success: false,
      message: 'Please provide all required fields: firstName, email, phone, password'
    });
  }

  // If lastName is not provided, use firstName as lastName
  const finalLastName = lastName || firstName;

  console.log('Processing registration for:', { firstName, lastName: finalLastName, email, phone });

  // Check if email already exists in either User or Expert collection
  const emailCheck = await checkEmailExists(email);
  if (emailCheck.exists) {
    console.log('Email already exists:', emailCheck.collection);
    return res.status(400).json({
      success: false,
      message: emailCheck.message
    });
  }

  // Check if phone already exists in either User or Expert collection
  const phoneCheck = await checkPhoneExists(phone);
  if (phoneCheck.exists) {
    console.log('Phone already exists:', phoneCheck.collection);
    return res.status(400).json({
      success: false,
      message: phoneCheck.message
    });
  }

  try {
    // Create user
    console.log('Creating user with data:', {
      firstName,
      lastName: finalLastName,
      email,
      phone,
      userType: 'user'
    });

    const user = await User.create({
      firstName,
      lastName: finalLastName,
      email,
      phone,
      password,
      dateOfBirth,
      gender,
      userType: 'user'
    });

    console.log('User created successfully:', user._id);

    // Mark user as verified immediately (no OTP/email verification required)
    user.isEmailVerified = true;
    user.isPhoneVerified = true;
    user.isActive = true;
    user.passwordResetRequested = false;
    // Save user without triggering OTP flows
    await user.save();
    console.log('User created and marked as verified (no OTP required)');

    // Generate tokens
    const token = generateToken(user._id, user.userType);
    const refreshToken = generateRefreshToken(user._id, user.userType);

    console.log('Tokens generated successfully');

    // Remove password from response
    user.password = undefined;

    console.log('Registration completed successfully');

    res.status(201).json({
      success: true,
      message: 'User registered successfully. You are now logged in.',
      data: {
        user,
        userType: 'user',
        accountType: 'User',
        token,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      console.log('Validation errors:', messages);
      return res.status(400).json({
        success: false,
        message: messages.join(', '),
        errors: messages,
        type: 'validation_error'
      });
    }
    
    // Handle duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      const message = `User with this ${field} already exists`;
      console.log('Duplicate key error:', message);
      return res.status(400).json({
        success: false,
        message: message,
        type: 'duplicate_error'
      });
    }
    
    // Handle other known errors
    if (error.message) {
      console.log('Known error:', error.message);
      return res.status(400).json({
        success: false,
        message: error.message,
        type: 'general_error'
      });
    }
    
    // Unknown error - let it be handled by global error handler
    throw error;
  }
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user and include password field
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password'
    });
  }

  // Check if account is locked
  if (user.isLocked) {
    return res.status(423).json({
      success: false,
      message: 'Account is temporarily locked due to too many failed login attempts. Please try again later.'
    });
  }

  if (!user.isActive) {
    return res.status(401).json({
      success: false,
      message: 'Your account has been deactivated. Please contact support.'
    });
  }

  // Check password
  const isPasswordValid = await user.matchPassword(password);

  if (!isPasswordValid) {
    // Increment login attempts
    await user.incLoginAttempts();
    
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password'
    });
  }

  // Reset login attempts on successful login
  if (user.loginAttempts && user.loginAttempts > 0) {
    await user.resetLoginAttempts();
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  // Generate tokens
  const token = generateToken(user._id, user.userType);
  const refreshToken = generateRefreshToken(user._id, user.userType);

  // Remove password from response
  user.password = undefined;

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      user,
      token,
      refreshToken
    }
  });
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logoutUser = asyncHandler(async (req, res) => {
  // In a real-world application, you might want to blacklist the token
  // For now, we'll just send a success response
  res.status(200).json({
    success: true,
    message: 'Logout successful'
  });
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getCurrentUser = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      user: req.user
    }
  });
});

// @desc    Send OTP for email verification
// @route   POST /api/auth/send-otp
// @access  Public
const sendOTP = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found with this email address'
    });
  }

  if (user.isEmailVerified) {
    return res.status(400).json({
      success: false,
      message: 'Email is already verified'
    });
  }

  // Check if OTP is locked
  if (user.isOTPLocked) {
    return res.status(429).json({
      success: false,
      message: 'OTP verification is temporarily locked. Please try again later.'
    });
  }

  // Generate and save OTP
  const otp = user.generateOTP();
  await user.save();

  // Send OTP email
  const emailResult = await sendOTPEmail(email, otp, user.firstName);

  if (!emailResult.success) {
    return res.status(500).json({
      success: false,
      message: 'Failed to send OTP email. Please try again.'
    });
  }

  res.status(200).json({
    success: true,
    message: 'OTP sent successfully to your email address'
  });
});

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOTP = asyncHandler(async (req, res) => {
  const { email, otp, type = 'email_verification' } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found with this email address'
    });
  }

  // Verify OTP
  const otpResult = user.verifyOTP(otp);

  if (!otpResult.success) {
    await user.save(); // Save updated OTP attempts
    return res.status(400).json({
      success: false,
      message: otpResult.message
    });
  }

  if (type === 'password_reset') {
    // For password reset, check if reset was requested
    if (!user.passwordResetRequested) {
      return res.status(400).json({
        success: false,
        message: 'Password reset was not requested for this account'
      });
    }

    // Generate a temporary reset token valid for 10 minutes
    const resetToken = user.getResetPasswordToken();
    user.passwordResetVerified = true;
    
    // Save with validation disabled to ensure it saves
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully. You can now reset your password.',
      data: {
        resetToken: resetToken,
        expiresIn: '10 minutes'
      }
    });
  } else {
    // For email verification
    user.isEmailVerified = true;
    await user.save();

    // Send welcome email
    await sendWelcomeEmail(user.email, user.firstName, user.userType);

    res.status(200).json({
      success: true,
      message: 'Email verified successfully'
    });
  }
});

// @desc    Forgot password - Step 1: Send OTP
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found with this email address'
    });
  }

  if (!user.isActive) {
    return res.status(400).json({
      success: false,
      message: 'Account is deactivated. Please contact support.'
    });
  }

  // Check if OTP is locked
  if (user.isOTPLocked) {
    return res.status(429).json({
      success: false,
      message: 'OTP verification is temporarily locked. Please try again later.'
    });
  }

  // Generate OTP for password reset
  const otp = user.generateOTP();
  
  // Set password reset flag
  user.passwordResetRequested = true;
  user.passwordResetRequestTime = Date.now();
  
  await user.save();

  // Send OTP email for password reset
  const emailResult = await sendOTPEmail(email, otp, user.firstName, 'password_reset');

  if (!emailResult.success) {
    // Clear OTP fields if email fails
    user.otpCode = undefined;
    user.otpExpire = undefined;
    user.passwordResetRequested = false;
    user.passwordResetRequestTime = undefined;
    await user.save();

    return res.status(500).json({
      success: false,
      message: 'Failed to send password reset OTP. Please try again.'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Password reset OTP sent to your email address. Please verify the OTP to proceed.'
  });
});

// @desc    Reset password - Step 3: Reset password with verified token
// @route   POST /api/auth/reset-password
// @access  Public
const resetPasswordWithToken = asyncHandler(async (req, res) => {
  const { password, confirmPassword, resetToken } = req.body;

  console.log('=== PASSWORD RESET DEBUG ===');
  console.log('1. Received resetToken:', resetToken);

  // Validate password confirmation
  if (password !== confirmPassword) {
    console.log('3. Password mismatch error');
    return res.status(400).json({
      success: false,
      message: 'Passwords do not match'
    });
  }

  if (!resetToken) {
    console.log('4. Missing reset token');
    return res.status(400).json({
      success: false,
      message: 'Reset token is required'
    });
  }

  // Hash the token to match stored token
  const hashedToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  console.log('5. Hashed token:', hashedToken);

  // Find user with reset token (more lenient search first)
  const user = await User.findOne({
    passwordResetToken: hashedToken
  });

  console.log('6. User found:', !!user);

  if (!user) {
    console.log('7. No user found with this token');
    return res.status(400).json({
      success: false,
      message: 'Invalid reset token. Please restart the password reset process.'
    });
  }

  console.log('8. User details:');
  console.log('   - Email:', user.email);
  console.log('   - Token expires:', new Date(user.passwordResetExpire));
  console.log('   - Current time:', new Date());
  console.log('   - Token expired?:', user.passwordResetExpire <= Date.now());
  console.log('   - Verified?:', user.passwordResetVerified);

  // Check if token is expired
  if (user.passwordResetExpire <= Date.now()) {
    console.log('9. Token expired');
    return res.status(400).json({
      success: false,
      message: 'Reset token has expired. Please restart the password reset process.'
    });
  }

  // Check if token is verified
  if (!user.passwordResetVerified) {
    console.log('10. Token not verified');
    return res.status(400).json({
      success: false,
      message: 'Reset token not verified. Please verify OTP first.'
    });
  }

  console.log('11. All validations passed, proceeding with password reset');

  // Set new password
  user.password = password;
  
  // Clear all OTP and reset-related fields
  user.otpCode = undefined;
  user.otpExpire = undefined;
  user.otpAttempts = 0;
  user.otpLockedUntil = undefined;
  user.passwordResetToken = undefined;
  user.passwordResetExpire = undefined;
  user.passwordResetRequested = false;
  user.passwordResetRequestTime = undefined;
  user.passwordResetVerified = false;
  
  // Mark email as verified if not already
  user.isEmailVerified = true;
  
  // Reset login attempts
  user.loginAttempts = undefined;
  user.lockUntil = undefined;

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password has been reset successfully. You can now login with your new password.'
  });
});

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // Get user with password
  const user = await User.findById(req.user._id).select('+password');

  // Check current password
  const isCurrentPasswordValid = await user.matchPassword(currentPassword);

  if (!isCurrentPasswordValid) {
    return res.status(400).json({
      success: false,
      message: 'Current password is incorrect'
    });
  }

  // Update password
  user.password = newPassword;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password changed successfully'
  });
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = asyncHandler(async (req, res) => {
  const allowedFields = ['firstName', 'lastName', 'phone', 'dateOfBirth', 'gender'];
  const updateData = {};

  // Only include allowed fields
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      updateData[field] = req.body[field];
    }
  });

  // Check if phone number is already taken by another user
  if (updateData.phone) {
    const existingUser = await User.findOne({
      phone: updateData.phone,
      _id: { $ne: req.user._id }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is already registered with another account'
      });
    }
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    updateData,
    {
      new: true,
      runValidators: true
    }
  );

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user
    }
  });
});

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
  sendOTP,
  verifyOTP,
  forgotPassword,
  resetPasswordWithToken,
  changePassword,
  updateProfile
};