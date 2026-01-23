import crypto from 'crypto';
import Expert, { IExpert } from '../models/Expert';
import Appointment from '../models/Appointment';
import BankAccount from '../models/BankAccount';
import ExpertAvailability from '../models/ExpertAvailability';
import type { SortOrder } from 'mongoose';
import { asyncHandler } from '../middlewares/errorHandler';
import { generateToken, generateRefreshToken } from '../middlewares/auth';
import { sendOTPEmail, sendPasswordResetEmail, sendWelcomeEmail } from '../services/emailService';
import { deleteFile, getFileUrl, getFilePath } from '../middlewares/upload';
import { checkEmailExists, checkPhoneExists } from '../utils/emailValidation';

type RecentFeedbackEntry = {
  id: string;
  rating: number | null | undefined;
  comment?: string;
  submittedAt?: Date | null;
  sessionDate?: Date | null;
  user: {
    _id: string;
    firstName?: string;
    lastName?: string;
    name: string;
    profileImage: string | null;
  } | null;
};

type ExpertWithRecentFeedback = IExpert & {
  recentFeedback?: RecentFeedbackEntry[];
};

// @desc    Register expert
// @route   POST /api/experts/register
// @access  Public
const registerExpert = asyncHandler(async (req, res) => {
  console.log('=== EXPERT REGISTRATION DEBUG ===');
  console.log('Request body:', req.body);
  console.log('Request file:', req.file);
  
  const {
    firstName,
    lastName,
    email,
    phone,
    password,
    specialization,
    experience,
    bio,
    hourlyRate,
    qualifications,
    languages,
    consultationMethods
  } = req.body;

  // Detailed field validation logging
  console.log('Field validation check:');
  console.log('firstName:', firstName, 'type:', typeof firstName, 'valid:', !!firstName);
  console.log('lastName:', lastName, 'type:', typeof lastName, 'valid:', !!lastName);
  console.log('email:', email, 'type:', typeof email, 'valid:', !!email);
  console.log('phone:', phone, 'type:', typeof phone, 'valid:', !!phone);
  console.log('password:', password, 'type:', typeof password, 'valid:', !!password);
  console.log('specialization:', specialization, 'type:', typeof specialization, 'valid:', !!specialization);

  // Normalize and validate phone number (healthcare-grade, reject obvious fakes)
  const normalizedPhone = String(phone || '').replace(/\D/g, '');
  if (!/^\d{10}$/.test(normalizedPhone)) {
    return res.status(400).json({
      success: false,
      message: 'Phone number must be exactly 10 digits'
    });
  }
  if (/^(\d)\1{9}$/.test(normalizedPhone)) {
    return res.status(400).json({
      success: false,
      message: 'Phone number cannot have all digits the same'
    });
  }

  // Full Name validation - max 50 characters total, only letters/space/underscore
  const fullNameLength = (firstName || '').length + (lastName || '').length;
  if (fullNameLength > 50) {
    return res.status(400).json({
      success: false,
      message: 'Full Name cannot exceed 50 characters'
    });
  }
  if (firstName && !/^[a-zA-Z\s_]+$/.test(firstName.trim())) {
    return res.status(400).json({
      success: false,
      message: 'Full Name can only contain letters, spaces, and underscores'
    });
  }
  if (lastName && !/^[a-zA-Z\s_]+$/.test(lastName.trim())) {
    return res.status(400).json({
      success: false,
      message: 'Full Name can only contain letters, spaces, and underscores'
    });
  }

  // Input validation - only require essential fields
  if (!firstName || !email || !phone || !password || !specialization) {
    console.log('Validation error: Missing required fields');
    const missingFields = [];
    if (!firstName) missingFields.push('Full Name (first name)');
    if (!lastName) missingFields.push('Full Name (last name)');
    if (!email) missingFields.push('email');
    if (!phone) missingFields.push('phone');
    if (!password) missingFields.push('password');
    if (!specialization) missingFields.push('specialization');
    console.log('Missing fields:', missingFields);
    return res.status(400).json({
      success: false,
      message: `Please provide all required fields: ${missingFields.join(', ')}`
    });
  }

  // Strict email validation
  const { validateEmailStrict } = require('../utils/emailValidation');
  const emailValidation = validateEmailStrict(email);
  if (!emailValidation.isValid) {
    return res.status(400).json({
      success: false,
      message: emailValidation.error || 'Please enter a valid email address'
    });
  }

  // Password length validation
  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters long'
    });
  }
  if (password.length > 128) {
    return res.status(400).json({
      success: false,
      message: 'Password cannot exceed 128 characters'
    });
  }

  console.log('Processing expert registration for:', { 
    firstName, 
    lastName: lastName || firstName, 
    email, 
    phone: normalizedPhone, 
    specialization 
  });

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
  const phoneCheck = await checkPhoneExists(normalizedPhone);
  if (phoneCheck.exists) {
    console.log('Phone already exists:', phoneCheck.collection);
    return res.status(400).json({
      success: false,
      message: phoneCheck.message
    });
  }

  try {
    // Handle profile image and certificates from multipart form
    let profileImage = null;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    
    if (files?.profileImage && files.profileImage.length > 0) {
      profileImage = files.profileImage[0].filename;
      console.log('Profile image uploaded:', profileImage);
    }
    
    // Validate and handle certificates (MANDATORY for expert registration)
    const certificateFiles = files?.certificates || [];
    if (certificateFiles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one certification document is required for expert registration'
      });
    }
    
    // Validate certificate file types and sizes
    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
    const invalidFiles = certificateFiles.filter(file => {
      const mimeType = (file.mimetype || '').toLowerCase();
      const ext = (file.originalname || '').toLowerCase().slice(((file.originalname || '').lastIndexOf('.')) >>> 0);
      const isAllowedMime = allowedMimeTypes.includes(mimeType);
      const isAllowedExt = allowedExtensions.includes(ext as any);
      return !(isAllowedMime || isAllowedExt);
    });
    
    if (invalidFiles.length > 0) {
      // Delete invalid files
      certificateFiles.forEach(file => {
        const filePath = getFilePath(file.filename, 'documents');
        if (filePath) deleteFile(filePath);
      });
      return res.status(400).json({
        success: false,
        message: 'Only PDF, JPG, and PNG files are allowed for certificates. Maximum file size is 5 MB per file.'
      });
    }
    
    // Prepare certificate data
    const certificates = certificateFiles.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      uploadDate: new Date()
    }));
    
    console.log(`Certificates uploaded: ${certificates.length} file(s)`);

    // Parse JSON fields safely
    let parsedQualifications = [];
    let parsedLanguages = [];
    let parsedConsultationMethods = ['video']; // default

    try {
      if (qualifications && qualifications.trim()) {
        // If it's a simple string, convert it to the expected format
        if (typeof qualifications === 'string') {
          try {
            parsedQualifications = JSON.parse(qualifications);
          } catch (e) {
            // If it's not JSON, treat it as a simple qualification string
            parsedQualifications = [{
              degree: qualifications,
              institution: 'Not specified',
              year: new Date().getFullYear()
            }];
          }
        } else {
          parsedQualifications = qualifications;
        }
      }
    } catch (e) {
      console.log('Error parsing qualifications:', e.message);
      parsedQualifications = []; // Set to empty array to avoid validation errors
    }

    try {
      if (languages) {
        parsedLanguages = typeof languages === 'string' ? JSON.parse(languages) : languages;
      }
    } catch (e) {
      console.log('Error parsing languages:', e.message);
    }

    try {
      if (consultationMethods) {
        parsedConsultationMethods = typeof consultationMethods === 'string' ? JSON.parse(consultationMethods) : consultationMethods;
      }
    } catch (e) {
      console.log('Error parsing consultationMethods:', e.message);
    }

    console.log('Creating expert with data:', {
      firstName,
      lastName: lastName || firstName,
      email,
      phone,
      specialization,
      experience: experience ? parseInt(experience) : 0,
      profileImage
    });

    console.log('=== FULL EXPERT DATA BEFORE CREATE ===');
    const expertData = {
      firstName,
      lastName: lastName || firstName,
      email,
      phone: normalizedPhone,
      password,
      specialization,
      experience: experience ? parseInt(experience) : 0,
      bio: bio || '',
      hourlyRate: hourlyRate ? parseFloat(hourlyRate) : undefined,
      profileImage,
      certificates, // Add certificates to expert data
      userType: 'expert',
      verificationStatus: 'pending', // Set to pending until email verification
      isEmailVerified: false, // MUST verify email before accessing dashboard
      isPhoneVerified: true,
      // Only add these arrays if they have valid content
      ...(parsedQualifications.length > 0 && { qualifications: parsedQualifications }),
      ...(parsedLanguages.length > 0 && { languages: parsedLanguages }),
      ...(parsedConsultationMethods.length > 0 && { consultationMethods: parsedConsultationMethods })
    };
    console.log('Expert data object:', JSON.stringify(expertData, null, 2));

    // Create expert with minimal required fields first
    const expert = await Expert.create(expertData);

    console.log('Expert created successfully:', expert._id);

    // Generate and send OTP for email verification (REQUIRED - no immediate login)
    const otp = expert.generateOTP();
    await expert.save();
    
    console.log('OTP generated for expert registration:', otp);
    
    // Send OTP email
    const emailResult = await sendOTPEmail(email, otp, expert.firstName, 'verification');
    if (!emailResult.success) {
      console.error('Failed to send OTP email:', emailResult.error);
      // Delete expert if email fails
      await Expert.findByIdAndDelete(expert._id);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email. Please try again later.'
      });
    }
    
    console.log('OTP email sent successfully to:', email);

    // DO NOT generate tokens - expert must verify email first
    // Remove password from response
    expert.password = undefined;
    if (expert.profileImage) {
      expert.profileImage = getFileUrl(expert.profileImage, 'profiles');
    }

    console.log('Expert registration completed - email verification required');

    res.status(201).json({
      success: true,
      message: 'Expert registration successful. Please verify your email address using the OTP sent to your email.',
      data: {
        email: expert.email,
        requiresVerification: true,
        verificationType: 'email'
      }
    });
  } catch (error) {
    console.error('Error creating expert:', error);
    
    // Handle validation errors
    if ((error as any)?.name === 'ValidationError') {
      console.log('=== VALIDATION ERROR DETAILS ===');
      console.log('Full error:', error);
      const validationErrors = (error as { errors: Record<string, { message: string }> }).errors;
      console.log('Error fields:', Object.keys(validationErrors));
      Object.keys(validationErrors).forEach(field => {
        console.log(`${field}: ${validationErrors[field].message}`);
      });
      
      const messages = Object.values(validationErrors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }
    
    // Handle duplicate key error
    if ((error as any)?.code === 11000) {
      const field = Object.keys((error as any).keyValue)[0];
      return res.status(400).json({
        success: false,
        message: `Expert with this ${field} already exists`
      });
    }
    
    throw error;
  }
});

// @desc    Login expert
// @route   POST /api/experts/login
// @access  Public
const loginExpert = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  console.log('=== EXPERT LOGIN DEBUG ===');
  console.log('Login attempt for email:', email);
  console.log('Password provided:', !!password);

  // Find expert and include password field
  const expert = await Expert.findOne({ email }).select('+password');

  if (!expert) {
    console.log('Expert not found for email:', email);
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password'
    });
  }

  console.log('Expert found:', expert.firstName, expert.lastName);
  console.log('Expert isActive:', expert.isActive);
  console.log('Expert verificationStatus:', expert.verificationStatus);

  // Check if account is locked
  if (expert.isLocked) {
    console.log('Account is locked');
    return res.status(423).json({
      success: false,
      message: 'Account is temporarily locked due to too many failed login attempts. Please try again later.'
    });
  }

  if (!expert.isActive) {
    console.log('Account is not active');
    return res.status(401).json({
      success: false,
      message: 'Your account has been deactivated. Please contact support.'
    });
  }

  // Check password
  console.log('Checking password...');
  const isPasswordValid = await expert.matchPassword(password);
  console.log('Password valid:', isPasswordValid);

  if (!isPasswordValid) {
    console.log('Invalid password for email:', email);
    // Increment login attempts
    await expert.incLoginAttempts();
    
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password'
    });
  }

  // Reset login attempts on successful login
  if (expert.loginAttempts && expert.loginAttempts > 0) {
    await expert.resetLoginAttempts();
  }

  // Update last login
  expert.lastLogin = new Date();
  await expert.save();

  // Generate tokens
  const token = generateToken(expert._id.toString(), expert.userType);
  const refreshToken = generateRefreshToken(expert._id.toString(), expert.userType);

  // Remove password from response and add profile image URL
  expert.password = undefined;
  if (expert.profileImage) {
    expert.profileImage = getFileUrl(expert.profileImage, 'profiles');
  }

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      expert,
      token,
      refreshToken
    }
  });
});

// @desc    Get current expert
// @route   GET /api/experts/me
// @access  Private
const getCurrentExpert = asyncHandler(async (req, res) => {
  let expert: any;
  
  // Check if req.user is a User model (Google OAuth experts)
  // If so, find the Expert record by email
  if (req.user.constructor.modelName === 'User' && req.user.userType === 'expert') {
    expert = await Expert.findOne({ email: req.user.email }).select('-password');
    
    if (!expert) {
      return res.status(404).json({
        success: false,
        message: 'Expert profile not found. Please complete your expert registration.'
      });
    }
  } else {
    // Regular expert (Expert model)
    expert = { ...req.user.toObject() };
  }
  
  // Add profile image URL
  if (expert.profileImage) {
    expert.profileImage = getFileUrl(expert.profileImage, 'profiles');
  }

  res.status(200).json({
    success: true,
    data: {
      expert
    }
  });
});

// @desc    Update expert profile
// @route   PUT /api/experts/profile
// @access  Private
const updateExpertProfile = asyncHandler(async (req, res) => {
  const allowedFields = [
    'firstName', 'lastName', 'phone', 'specialization', 'experience',
    'bio', 'education', 'hourlyRate', 'qualifications', 'languages', 'consultationMethods',
    'sessionType', 'availability', 'specialties'
  ];
  
  const updateData: Record<string, unknown> = {};

  // Only include allowed fields
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      if (field === 'qualifications' || field === 'languages' || field === 'consultationMethods' || field === 'sessionType' || field === 'specialties') {
        try {
          updateData[field] = typeof req.body[field] === 'string' 
            ? JSON.parse(req.body[field]) 
            : req.body[field];
        } catch (error) {
          return res.status(400).json({
            success: false,
            message: `Invalid format for ${field}`
          });
        }
      } else {
        updateData[field] = req.body[field];
      }
    }
  });

  // Handle profile image update
  if (req.file) {
    // Delete old profile image
    if (req.user.profileImage) {
      deleteFile(`uploads/profiles/${req.user.profileImage}`);
    }
    updateData.profileImage = req.file.filename;
  }

  // Check if phone number is already taken by another expert
  const phoneValue = typeof updateData.phone === 'string' ? updateData.phone : undefined;
  if (phoneValue) {
    const existingExpert = await Expert.findOne({
      phone: phoneValue,
      _id: { $ne: req.user._id }
    });

    if (existingExpert) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is already registered with another account'
      });
    }
  }

  const expert = await Expert.findByIdAndUpdate(
    req.user._id,
    updateData,
    {
      new: true,
      runValidators: true
    }
  );

  if (!expert) {
    return res.status(404).json({
      success: false,
      message: 'Expert not found'
    });
  }

  // Add profile image URL
  if (expert.profileImage) {
    expert.profileImage = getFileUrl(expert.profileImage, 'profiles');
  }

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      expert
    }
  });
});

// @desc    Send OTP for email verification
// @route   POST /api/experts/send-otp
// @access  Public
const sendOTP = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const expert = await Expert.findOne({ email });

  if (!expert) {
    return res.status(404).json({
      success: false,
      message: 'Expert not found with this email address'
    });
  }

  if (expert.isEmailVerified) {
    return res.status(400).json({
      success: false,
      message: 'Email is already verified'
    });
  }

  // Check if OTP is locked
  if (expert.isOTPLocked) {
    return res.status(429).json({
      success: false,
      message: 'OTP verification is temporarily locked. Please try again later.'
    });
  }

  // Generate and save OTP
  const otp = expert.generateOTP();
  await expert.save();

  // Send OTP email (signature: email, otp, firstName, type, resetUrl)
  const emailResult = await sendOTPEmail(email, otp, expert.firstName);

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
// @route   POST /api/experts/verify-otp
// @access  Public
const verifyOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  const expert = await Expert.findOne({ email });

  if (!expert) {
    return res.status(404).json({
      success: false,
      message: 'Expert not found with this email address'
    });
  }

  // Verify OTP
  const otpResult = expert.verifyOTP(otp);

  if (!otpResult.success) {
    await expert.save(); // Save updated OTP attempts
    return res.status(400).json({
      success: false,
      message: otpResult.message
    });
  }

  // Mark email as verified
  expert.isEmailVerified = true;
  expert.verificationStatus = 'approved'; // Approve after email verification
  await expert.save();

  // Generate tokens for login after email verification
  const token = generateToken(expert._id.toString(), expert.userType);
  const refreshToken = generateRefreshToken(expert._id.toString(), expert.userType);

  // Send welcome email
  await sendWelcomeEmail(expert.email, expert.firstName, expert.userType as 'user' | 'expert');

  // Remove password from response
  expert.password = undefined;
  if (expert.profileImage) {
    expert.profileImage = getFileUrl(expert.profileImage, 'profiles');
  }

  res.status(200).json({
    success: true,
    message: 'Email verified successfully',
    data: {
      user: expert,
      userType: 'expert',
      accountType: 'Expert',
      token,
      refreshToken
    }
  });
});

// @desc    Forgot password (Updated to use OTP)
// @route   POST /api/experts/forgot-password
// @access  Public
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const expert = await Expert.findOne({ email });

  if (!expert) {
    return res.status(404).json({
      success: false,
      message: 'Expert not found with this email address'
    });
  }

  if (!expert.isActive) {
    return res.status(400).json({
      success: false,
      message: 'Account is deactivated. Please contact support.'
    });
  }

  // Generate OTP for password reset
  const otp = expert.generateOTP();
  
  // Generate reset token for the password reset link
  const resetToken = expert.getResetPasswordToken();
  
  await expert.save();

  // Send OTP email for password reset with reset link
  const resetUrl = `${req.protocol}://${req.get('host')}/api/experts/reset-password-otp?token=${resetToken}`;
  const emailResult = await sendOTPEmail(email, otp, expert.firstName, 'password_reset', resetUrl);

  if (!emailResult.success) {
    // Clear OTP and reset token fields if email fails
    expert.otpCode = undefined;
    expert.otpExpire = undefined;
    expert.resetPasswordToken = undefined;
    expert.resetPasswordExpire = undefined;
    await expert.save();

    return res.status(500).json({
      success: false,
      message: 'Failed to send password reset OTP. Please try again.'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Password reset OTP sent to your email address'
  });
});

// @desc    Reset password with OTP (New OTP-based flow)
// @route   POST /api/experts/reset-password-otp
// @access  Public
const resetPasswordWithOTP = asyncHandler(async (req, res) => {
  const { password } = req.body;
  const { token } = req.query; // Get reset token from query parameter

  if (!token) {
    return res.status(400).json({
      success: false,
      message: 'Reset token is required'
    });
  }

  // Find expert with valid reset token and OTP
  const expert = await Expert.findOne({
    resetPasswordToken: token,
    resetPasswordExpire: { $gt: Date.now() },
    otpCode: { $exists: true },
    otpExpire: { $gt: Date.now() }
  });

  if (!expert) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired reset token'
    });
  }

  // Set new password
  expert.password = password;
  
  // Clear OTP and reset token fields
  expert.otpCode = undefined;
  expert.otpExpire = undefined;
  expert.otpAttempts = 0;
  expert.otpLockedUntil = undefined;
  expert.resetPasswordToken = undefined;
  expert.resetPasswordExpire = undefined;
  
  // Mark email as verified if not already
  expert.isEmailVerified = true;

  await expert.save();

  res.status(200).json({
    success: true,
    message: 'Password has been reset successfully'
  });
});

// @desc    Reset password
// @route   POST /api/experts/reset-password
// @access  Public
const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  // Hash the token to match stored token
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  const expert = await Expert.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() }
  });

  if (!expert) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired reset token'
    });
  }

  // Set new password
  console.log('Setting new password for expert:', expert.email);
  console.log('New password length:', password.length);
  expert.password = password;
  expert.resetPasswordToken = undefined;
  expert.resetPasswordExpire = undefined;
  
  // Reset login attempts
  expert.loginAttempts = undefined;
  expert.lockUntil = undefined;

  await expert.save();
  console.log('Expert password reset completed and saved');
  console.log('Expert updated at:', expert.updatedAt);

  // Generate new tokens
  const jwtToken = generateToken(expert._id.toString(), expert.userType);
  const refreshToken = generateRefreshToken(expert._id.toString(), expert.userType);

  res.status(200).json({
    success: true,
    message: 'Password reset successful',
    data: {
      token: jwtToken,
      refreshToken
    }
  });
});

// @desc    Change password
// @route   PUT /api/experts/change-password
// @access  Private
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // Get expert with password
  const expert = await Expert.findById(req.user._id).select('+password');

  // Check current password
  const isCurrentPasswordValid = await expert.matchPassword(currentPassword);

  if (!isCurrentPasswordValid) {
    return res.status(400).json({
      success: false,
      message: 'Current password is incorrect'
    });
  }

  // Update password
  expert.password = newPassword;
  await expert.save();

  res.status(200).json({
    success: true,
    message: 'Password changed successfully'
  });
});

// @desc    Get all experts (for users to browse)
// @route   GET /api/experts
// @access  Public
const getExperts = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Build filter object
  const filter: Record<string, unknown> = {
    isActive: true,
    verificationStatus: 'approved',
    isEmailVerified: true
  };

  // Add specialization filter if provided
  const specialization = req.query.specialization as string | undefined;
  if (specialization) {
    filter.specialization = { $regex: specialization, $options: 'i' };
  }

  // Add rating filter if provided
  const minRating = req.query.minRating ? Number(req.query.minRating) : undefined;
  if (typeof minRating === 'number' && !Number.isNaN(minRating)) {
    filter['rating.average'] = { $gte: minRating };
  }

  // Add hourly rate filter if provided
  const maxRate = req.query.maxRate ? Number(req.query.maxRate) : undefined;
  if (typeof maxRate === 'number' && !Number.isNaN(maxRate)) {
    filter.hourlyRate = { $lte: maxRate };
  }

  // Add language filter if provided
  const language = req.query.language as string | undefined;
  if (language) {
    filter.languages = { $in: [language] };
  }

  // Sort options
  let sort: Record<string, SortOrder> = {};
  const sortBy = req.query.sortBy as string | undefined;
  if (sortBy) {
    switch (sortBy) {
      case 'rating':
        sort = { 'rating.average': -1 };
        break;
      case 'experience':
        sort = { experience: -1 };
        break;
      case 'price':
        sort = { hourlyRate: 1 };
        break;
      case 'createdAt':
        sort = { createdAt: -1 };
        break;
      default:
        sort = { createdAt: -1 };
    }
  } else {
    sort = { 'rating.average': -1, totalSessions: -1 };
  }

  const experts = await Expert.find(filter)
    .select('-password -resetPasswordToken -resetPasswordExpire -otpCode -otpExpire -loginAttempts -lockUntil')
    .sort(sort)
    .skip(skip)
    .limit(limit);

  // Add profile image URLs
  const expertsWithImages = experts.map(expert => {
    const expertObj = expert.toObject();
    if (expertObj.profileImage) {
      expertObj.profileImage = getFileUrl(expertObj.profileImage, 'profiles');
    }
    return expertObj;
  });

  const total = await Expert.countDocuments(filter);
  const totalPages = Math.ceil(total / limit);

  res.status(200).json({
    success: true,
    data: {
      experts: expertsWithImages,
      pagination: {
        currentPage: page,
        totalPages,
        totalExperts: total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }
  });
});

// @desc    Get expert by ID
// @route   GET /api/experts/:id
// @access  Public
const getExpertById = asyncHandler(async (req, res) => {
  const expert = await Expert.findOne({
    _id: req.params.id,
    isActive: true,
    verificationStatus: 'approved'
  }).select('-password -resetPasswordToken -resetPasswordExpire -otpCode -otpExpire -loginAttempts -lockUntil');

  if (!expert) {
    return res.status(404).json({
      success: false,
      message: 'Expert not found'
    });
  }

  // Add profile image URL
  const expertObj = expert.toObject() as ExpertWithRecentFeedback;
  if (expertObj.profileImage) {
    expertObj.profileImage = getFileUrl(expertObj.profileImage, 'profiles');
  }

  // Attach structured availability from ExpertAvailability collection
  const availabilityDoc = await ExpertAvailability.findOne({ expert: expert._id }).lean();
  if (availabilityDoc?.availability) {
    // Convert array format to object format expected by Expert model
    // Note: Expert model's availability field uses a different structure,
    // but we'll store the array format in a compatible way
    expertObj.availability = availabilityDoc.availability as any;
  }

  const feedbackDocs = await Appointment.find({
    expert: expert._id,
    feedbackRating: { $exists: true, $ne: null }
  })
    .sort({ feedbackSubmittedAt: -1, updatedAt: -1 })
    .limit(10)
    .populate('user', 'firstName lastName profileImage');

  expertObj.recentFeedback = feedbackDocs.map(doc => {
    const user = doc.user as any;
    const reviewerName = user
      ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Client'
      : 'Client';
    const reviewerImage = user?.profileImage
      ? getFileUrl(user.profileImage, 'profiles')
      : null;

    return {
      id: doc._id.toString(),
      rating: doc.feedbackRating,
      comment: doc.feedbackComment,
      submittedAt: doc.feedbackSubmittedAt,
      sessionDate: doc.sessionDate,
      user: user
        ? {
            _id: user._id?.toString() ?? '',
            firstName: user.firstName,
            lastName: user.lastName,
            name: reviewerName,
            profileImage: reviewerImage
          }
        : null
    };
  });

  res.status(200).json({
    success: true,
    data: {
      expert: expertObj
    }
  });
});

// @desc    Get expert bank account
// @route   GET /api/experts/bank-account
// @access  Private (Expert only)
const getBankAccount = asyncHandler(async (req, res) => {
  let expertId: string;
  const currentUser = req.user;
  
  if (!currentUser || !currentUser._id) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }
  
  const userId = currentUser._id.toString();
  const userEmail = currentUser.email || (currentUser as any).email;
  const userModelName = currentUser.constructor?.modelName || 'Unknown';
  
  console.log(`[getBankAccount] User ID: ${userId}, Email: ${userEmail}, Model: ${userModelName}`);
  
  // Try to find Expert record - first by ID (for regular experts), then by email (for Google OAuth experts)
  let expert = null;
  try {
    expert = await Expert.findById(userId).select('_id');
    console.log(`[getBankAccount] Expert lookup by ID: ${expert ? 'found' : 'not found'}`);
  } catch (error) {
    console.log(`[getBankAccount] Error looking up Expert by ID:`, error);
  }
  
  if (!expert && userEmail) {
    // If not found by ID, try by email (for Google OAuth experts stored in User model)
    try {
      expert = await Expert.findOne({ email: userEmail.toLowerCase() }).select('_id');
      console.log(`[getBankAccount] Expert lookup by email: ${expert ? 'found' : 'not found'}`);
    } catch (error) {
      console.log(`[getBankAccount] Error looking up Expert by email:`, error);
    }
  }
  
  if (!expert) {
    // Expert record doesn't exist - return empty bank account instead of error
    // This can happen if the expert profile isn't fully set up yet
    console.log(`[getBankAccount] No Expert record found, returning empty bank account`);
    return res.status(200).json({
      success: true,
      data: { bankAccount: null },
      message: 'No bank account found. Please complete your expert profile first.'
    });
  }
  
  expertId = expert._id.toString();
  console.log(`[getBankAccount] Using Expert ID: ${expertId}`);

  const bankAccount = await BankAccount.findOne({ expert: expertId });

  if (!bankAccount) {
    return res.status(200).json({
      success: true,
      data: { bankAccount: null },
      message: 'No bank account found'
    });
  }

  res.status(200).json({
    success: true,
    data: { bankAccount }
  });
});

// @desc    Create or update expert bank account
// @route   POST /api/experts/bank-account
// @access  Private (Expert only)
const createOrUpdateBankAccount = asyncHandler(async (req, res) => {
  let expertId: string;
  const currentUser = req.user;
  
  if (!currentUser || !currentUser._id) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }
  
  const userId = currentUser._id.toString();
  const userEmail = currentUser.email || (currentUser as any).email;
  
  // Try to find Expert record - first by ID (for regular experts), then by email (for Google OAuth experts)
  let expert = await Expert.findById(userId).select('_id');
  
  if (!expert && userEmail) {
    // If not found by ID, try by email (for Google OAuth experts stored in User model)
    expert = await Expert.findOne({ email: userEmail.toLowerCase() }).select('_id');
  }
  
  if (!expert) {
    return res.status(404).json({
      success: false,
      message: 'Expert profile not found. Please complete your expert profile first.'
    });
  }
  
  expertId = expert._id.toString();
  
  const {
    accountHolderName,
    accountNumber,
    bankName,
    ifscCode,
    branchName,
    accountType
  } = req.body;

  // Check if bank account already exists
  let bankAccount = await BankAccount.findOne({ expert: expertId });

  if (bankAccount) {
    // Update existing bank account
    bankAccount.accountHolderName = accountHolderName;
    bankAccount.accountNumber = accountNumber;
    bankAccount.bankName = bankName;
    bankAccount.ifscCode = ifscCode.toUpperCase();
    bankAccount.branchName = branchName;
    bankAccount.accountType = accountType;
    bankAccount.isActive = true;

    await bankAccount.save();

    return res.status(200).json({
      success: true,
      message: 'Bank account updated successfully',
      data: { bankAccount }
    });
  } else {
    // Create new bank account
    bankAccount = await BankAccount.create({
      expert: expertId,
      accountHolderName,
      accountNumber,
      bankName,
      ifscCode: ifscCode.toUpperCase(),
      branchName,
      accountType,
      isActive: true
    });

    return res.status(201).json({
      success: true,
      message: 'Bank account created successfully',
      data: { bankAccount }
    });
  }
});

// @desc    Get expert availability
// @route   GET /api/experts/availability
// @access  Private (Expert only)
const getAvailability = asyncHandler(async (req, res) => {
  let expertId: string;
  const currentUser = req.user;
  
  if (!currentUser || !currentUser._id) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }
  
  const userId = currentUser._id.toString();
  const userEmail = currentUser.email || (currentUser as any).email;
  
  // Try to find Expert record - first by ID (for regular experts), then by email (for Google OAuth experts)
  let expert = await Expert.findById(userId).select('_id');
  
  if (!expert && userEmail) {
    expert = await Expert.findOne({ email: userEmail.toLowerCase() }).select('_id');
  }
  
  if (!expert) {
    return res.status(404).json({
      success: false,
      message: 'Expert profile not found. Please complete your expert profile first.'
    });
  }
  
  expertId = expert._id.toString();
  
  const availability = await ExpertAvailability.findOne({ expert: expertId });
  
  if (!availability) {
    // Return default empty availability structure
    const defaultAvailability = [
      { day: "Sunday", dayName: "S", isOpen: false, timeRanges: [] },
      { day: "Monday", dayName: "M", isOpen: false, timeRanges: [] },
      { day: "Tuesday", dayName: "T", isOpen: false, timeRanges: [] },
      { day: "Wednesday", dayName: "W", isOpen: false, timeRanges: [] },
      { day: "Thursday", dayName: "T", isOpen: false, timeRanges: [] },
      { day: "Friday", dayName: "F", isOpen: false, timeRanges: [] },
      { day: "Saturday", dayName: "S", isOpen: false, timeRanges: [] },
    ];
    
    return res.status(200).json({
      success: true,
      data: { availability: defaultAvailability },
      message: 'No availability found. Using default structure.'
    });
  }
  
  res.status(200).json({
    success: true,
    data: { availability: availability.availability }
  });
});

// @desc    Create or update expert availability
// @route   POST /api/experts/availability
// @access  Private (Expert only)
const createOrUpdateAvailability = asyncHandler(async (req, res) => {
  let expertId: string;
  const currentUser = req.user;
  
  if (!currentUser || !currentUser._id) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }
  
  const userId = currentUser._id.toString();
  const userEmail = currentUser.email || (currentUser as any).email;
  
  // Try to find Expert record - first by ID (for regular experts), then by email (for Google OAuth experts)
  let expert = await Expert.findById(userId).select('_id');
  
  if (!expert && userEmail) {
    expert = await Expert.findOne({ email: userEmail.toLowerCase() }).select('_id');
  }
  
  if (!expert) {
    return res.status(404).json({
      success: false,
      message: 'Expert profile not found. Please complete your expert profile first.'
    });
  }
  
  expertId = expert._id.toString();
  
  const { availability } = req.body;
  
  if (!availability || !Array.isArray(availability) || availability.length !== 7) {
    return res.status(400).json({
      success: false,
      message: 'Invalid availability data. Must contain exactly 7 days (Sunday through Saturday).'
    });
  }
  
  // Validate each day
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  for (let i = 0; i < availability.length; i++) {
    const day = availability[i];
    if (day.day !== days[i]) {
      return res.status(400).json({
        success: false,
        message: `Invalid day order. Expected ${days[i]}, got ${day.day}.`
      });
    }
    
    if (day.isOpen && (!day.timeRanges || day.timeRanges.length === 0)) {
      return res.status(400).json({
        success: false,
        message: `${day.day} is marked as open but has no time ranges.`
      });
    }
    
    // Validate time ranges
    for (const range of day.timeRanges || []) {
      if (!range.startTime || !range.endTime) {
        return res.status(400).json({
          success: false,
          message: `Invalid time range for ${day.day}: both startTime and endTime are required.`
        });
      }
      
      const [startHour, startMin] = range.startTime.split(':').map(Number);
      const [endHour, endMin] = range.endTime.split(':').map(Number);
      
      if (isNaN(startHour) || isNaN(startMin) || isNaN(endHour) || isNaN(endMin)) {
        return res.status(400).json({
          success: false,
          message: `Invalid time format for ${day.day}. Use HH:MM format.`
        });
      }
      
      const startTotal = startHour * 60 + startMin;
      const endTotal = endHour * 60 + endMin;
      
      if (endTotal <= startTotal) {
        return res.status(400).json({
          success: false,
          message: `Invalid time range for ${day.day}: end time must be after start time.`
        });
      }
    }
  }
  
  // Create or update availability
  const availabilityData = await ExpertAvailability.findOneAndUpdate(
    { expert: expertId },
    { 
      expert: expertId,
      availability: availability
    },
    { 
      new: true, 
      upsert: true,
      runValidators: true
    }
  );
  
  res.status(200).json({
    success: true,
    message: 'Availability updated successfully',
    data: { availability: availabilityData.availability }
  });
});

// @desc    Upload certificates (max 3 PDFs)
// @route   POST /api/experts/certificates
// @access  Private (Expert)
const uploadCertificates = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  
  if (!currentUser || !currentUser._id) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  const expertId = currentUser._id.toString();
  const expert = await Expert.findById(expertId);

  if (!expert) {
    return res.status(404).json({
      success: false,
      message: 'Expert not found'
    });
  }

  const files = req.files as Express.Multer.File[];
  
  if (!files || files.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No files uploaded'
    });
  }

  // Check if adding these files would exceed the limit of 3
  const currentCertCount = expert.certificates?.length || 0;
  if (currentCertCount + files.length > 3) {
    // Delete uploaded files
    files.forEach(file => {
      const filePath = getFilePath(file.filename, 'documents');
      if (filePath) deleteFile(filePath);
    });
    return res.status(400).json({
      success: false,
      message: `Maximum 3 certificates allowed. You currently have ${currentCertCount} certificate(s).`
    });
  }

  // Validate all files are allowed types (PDF, JPG, PNG)
  const allowedMimeTypes = ['application/pdf', 'image/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
  const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
  const invalidFiles = files.filter(file => {
    const mimeType = (file.mimetype || '').toLowerCase();
    const ext = (file.originalname || '').toLowerCase().slice(((file.originalname || '').lastIndexOf('.')) >>> 0);
    const isAllowedMime = allowedMimeTypes.includes(mimeType);
    const isAllowedExt = allowedExtensions.includes(ext as any);
    return !(isAllowedMime || isAllowedExt);
  });
  if (invalidFiles.length > 0) {
    // Delete invalid files
    files.forEach(file => {
      const filePath = getFilePath(file.filename, 'documents');
      if (filePath) deleteFile(filePath);
    });
      return res.status(400).json({
        success: false,
        message: 'Only PDF, JPG, and PNG files are allowed for certificates. Maximum file size is 5 MB per file.'
      });
  }

  // Add certificates to expert
  const newCertificates = files.map(file => ({
    filename: file.filename,
    originalName: file.originalname,
    uploadDate: new Date()
  }));

  if (!expert.certificates) {
    expert.certificates = [];
  }
  expert.certificates.push(...newCertificates);
  await expert.save();

  // Return certificates with URLs
  const certificatesWithUrls = expert.certificates.map((cert: any) => ({
    ...cert.toObject ? cert.toObject() : cert,
    url: getFileUrl(cert.filename, 'documents')
  }));

  res.status(200).json({
    success: true,
    message: 'Certificates uploaded successfully',
    data: { certificates: certificatesWithUrls }
  });
});

// @desc    Delete a certificate
// @route   DELETE /api/experts/certificates/:certificateId
// @access  Private (Expert)
const deleteCertificate = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  const { certificateId } = req.params;
  
  if (!currentUser || !currentUser._id) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  const expertId = currentUser._id.toString();
  const expert = await Expert.findById(expertId);

  if (!expert) {
    return res.status(404).json({
      success: false,
      message: 'Expert not found'
    });
  }

  if (!expert.certificates || expert.certificates.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'No certificates found'
    });
  }

  // Find the certificate index
  const certIndex = expert.certificates.findIndex(
    (cert: any) => cert._id?.toString() === certificateId || 
                   (cert.filename && cert.filename === certificateId)
  );

  if (certIndex === -1) {
    return res.status(404).json({
      success: false,
      message: 'Certificate not found'
    });
  }

  // Delete the file
  const certificate = expert.certificates[certIndex];
  if (certificate.filename) {
    const filePath = getFilePath(certificate.filename, 'documents');
    if (filePath) deleteFile(filePath);
  }

  // Remove from array
  expert.certificates.splice(certIndex, 1);
  await expert.save();

  res.status(200).json({
    success: true,
    message: 'Certificate deleted successfully'
  });
});

export {
  registerExpert,
  loginExpert,
  getCurrentExpert,
  updateExpertProfile,
  sendOTP,
  verifyOTP,
  forgotPassword,
  resetPassword,
  resetPasswordWithOTP,
  changePassword,
  getExperts,
  getExpertById,
  getBankAccount,
  createOrUpdateBankAccount,
  getAvailability,
  createOrUpdateAvailability,
  uploadCertificates,
  deleteCertificate
};