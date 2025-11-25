import { asyncHandler } from '../middlewares/errorHandler';
import User from '../models/User';
import Expert from '../models/Expert';
import emailService from '../services/emailService';
import logger from '../utils/logger';
import { MESSAGES } from '../constants/messages';

// @desc    Unified login for both users and experts
// @route   POST /api/auth/unified-login
// @access  Public
const unifiedLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  console.log('=== UNIFIED LOGIN DEBUG ===');
  console.log('Login attempt for email:', email);
  console.log('Password provided:', !!password);

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide email and password'
    });
  }

  let user = null;
  let userType = null;
  let accountType = null;

  // First, try to find in Expert table
  console.log('Checking Expert table...');
  try {
    user = await Expert.findOne({ email }).select('+password');
    if (user) {
      console.log('Found in Expert table:', user.firstName, user.lastName);
      console.log('Expert isActive:', user.isActive);
      console.log('Expert verificationStatus:', user.verificationStatus);
      userType = 'expert';
      accountType = 'Expert';
    }
  } catch (error) {
    console.log('Error checking Expert table:', error.message);
  }

  // If not found in Expert table, try User table
  if (!user) {
    console.log('Not found in Expert table, checking User table...');
    try {
      user = await User.findOne({ email }).select('+password');
      if (user) {
        console.log('Found in User table:', user.firstName, user.lastName);
        console.log('User isActive:', user.isActive);
        userType = 'user';
        accountType = 'User';
      }
    } catch (error) {
      console.log('Error checking User table:', error.message);
    }
  }

  if (!user) {
    console.log('Account not found in either table for email:', email);
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password'
    });
  }

  console.log(`Account found in ${accountType} table`);

  // Helper to send OTP responses
  const normalizedAccountType = userType === 'expert' ? 'Expert' : 'User';

  const sendVerificationResponse = async (verificationType: 'email' | 'login', message: string) => {
    try {
      const otp = user.generateOTP();
      await user.save();

      const emailResult = await emailService.sendOTPEmail(email, otp, user.firstName, 'verification');
      if (!emailResult.success) {
        logger.error(`Failed to send ${verificationType} OTP email to ${email}:`, emailResult.error);
        return res.status(500).json({
          success: false,
          message: 'Failed to send verification OTP. Please try again later.'
        });
      }

      logger.info(`OTP sent for ${verificationType} verification to ${email}`);
      return res.status(200).json({
        success: false,
        requiresVerification: true,
        verificationType,
        message,
        data: {
          email,
          userType,
          accountType: normalizedAccountType
        }
      });
    } catch (error: any) {
      logger.error(`Error sending ${verificationType} OTP for login:`, error);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification OTP. Please try again later.'
      });
    }
  };

  // Check if account is locked (for experts)
  if (userType === 'expert' && user.isLocked) {
    console.log('Expert account is locked');
    return res.status(423).json({
      success: false,
      message: 'Account is temporarily locked due to too many failed login attempts. Please try again later.'
    });
  }

  // Check if account is active
  if (!user.isActive) {
    console.log('Account is not active');
    return res.status(401).json({
      success: false,
      message: 'Your account has been deactivated. Please contact support.'
    });
  }

  // Check password
  console.log('Checking password...');
  console.log('Password provided length:', password.length);
  console.log('Stored password hash (first 20 chars):', user.password ? user.password.substring(0, 20) + '...' : 'NO PASSWORD HASH');
  
  let isPasswordValid = false;
  try {
    isPasswordValid = await user.matchPassword(password);
    console.log('Password valid:', isPasswordValid);
    
    // Additional debugging for failed password
    if (!isPasswordValid) {
      console.log('Password mismatch details:');
      console.log('- Account type:', accountType);
      console.log('- Email:', email);
      console.log('- User ID:', user._id);
      console.log('- Account created:', user.createdAt);
      console.log('- Account updated:', user.updatedAt);
      console.log('- Is account active:', user.isActive);
    }
  } catch (error) {
    console.log('Error checking password:', error.message);
    isPasswordValid = false;
  }

  if (!isPasswordValid) {
    console.log('Invalid password for email:', email);
    
    // Increment login attempts for experts
    if (userType === 'expert' && user.incLoginAttempts) {
      try {
        await user.incLoginAttempts();
      } catch (error) {
        console.log('Error incrementing login attempts:', error.message);
      }
    }
    
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password'
    });
  }

  // If email isn't verified, force verification before login
  if (!user.isEmailVerified) {
    console.log(`${accountType} email not verified. Triggering verification OTP.`);
    return sendVerificationResponse('email', MESSAGES.AUTH.EMAIL_NOT_VERIFIED);
  }

  // After successful password verification, always send OTP for login verification
  console.log(`Password verified for ${accountType}, sending login OTP:`, email);
  return sendVerificationResponse('login', 'Please verify your login with the OTP sent to your email.');

});

export {
  unifiedLogin
};