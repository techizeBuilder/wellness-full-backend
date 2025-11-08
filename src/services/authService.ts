import userRepository from '../repositories/userRepository';
import expertRepository from '../repositories/expertRepository';
import { checkEmailExists, checkPhoneExists } from '../utils/emailValidation';
import { generateToken, generateRefreshToken } from '../middlewares/auth';
import emailService from './emailService';
import { MESSAGES } from '../constants/messages';
import logger from '../utils/logger';
import { IAuthService, RegisterUserData, AuthResult } from '../types/services.interfaces';
import { IUser, IExpert } from '../types/models';
import PendingRegistration from '../models/PendingRegistration';
import ENV from '../config/environment';

class AuthService implements IAuthService {
  async registerUser(userData: RegisterUserData): Promise<{ message: string; email: string }> {
    const { firstName, lastName, email, phone, password, dateOfBirth, gender } = userData;
    
    // Validate email configuration
    if (!ENV.EMAIL_HOST || !ENV.EMAIL_USER || !ENV.EMAIL_PASS || !ENV.EMAIL_FROM) {
      logger.error('Email configuration is missing. Please check your environment variables.');
      throw new Error('Email service is not configured. Please contact support.');
    }
    
    // Check if email already exists as a verified user or expert
    const emailCheck = await checkEmailExists(email);
    if (emailCheck.exists) {
      throw new Error(emailCheck.message);
    }

    // Check if phone exists
    const phoneCheck = await checkPhoneExists(phone);
    if (phoneCheck.exists) {
      throw new Error(phoneCheck.message);
    }

    // Check if there's a pending registration for this email
    let pendingRegistration = await PendingRegistration.findOne({ email });
    
    if (pendingRegistration) {
      // If pending registration exists, check if it's locked
      if (pendingRegistration.isOTPLocked) {
        throw new Error('OTP verification is temporarily locked. Please try again later.');
      }
      
      // Update the pending registration with new data and generate new OTP
      pendingRegistration.firstName = firstName;
      pendingRegistration.lastName = lastName || firstName;
      pendingRegistration.phone = phone;
      pendingRegistration.password = password;
      pendingRegistration.dateOfBirth = dateOfBirth;
      pendingRegistration.gender = gender;
      const otp = pendingRegistration.generateOTP();
      await pendingRegistration.save();
      
      // Send OTP email
      logger.info(`Attempting to send OTP email to ${email} with OTP: ${otp}`);
      const emailResult = await emailService.sendOTPEmail(email, otp, firstName, 'verification');
      logger.info(`OTP email result for ${email}:`, { success: emailResult.success, error: emailResult.error });
      
      if (!emailResult.success) {
        logger.error(`Failed to send OTP email to ${email}:`, emailResult.error);
        throw new Error('Failed to send OTP email. Please check your email configuration or try again later.');
      }
      
      logger.info(`OTP email sent successfully to ${email}. OTP: ${otp}`);
      const result: any = { 
        message: 'OTP sent to your email. Please verify to complete registration.',
        email 
      };
      // Include OTP in development mode for debugging
      if (process.env.NODE_ENV === 'development') {
        result.otp = otp;
      }
      return result;
    }

    // Create new pending registration
    const finalLastName = lastName || firstName;
    pendingRegistration = new PendingRegistration({
      firstName,
      lastName: finalLastName,
      email,
      phone,
      password,
      dateOfBirth,
      gender,
      userType: 'user'
    });

    // Generate OTP
    const otp = pendingRegistration.generateOTP();
    await pendingRegistration.save();

    // Send OTP email
    logger.info(`Attempting to send OTP email to ${email} with OTP: ${otp}`);
    const emailResult = await emailService.sendOTPEmail(email, otp, firstName, 'verification');
    logger.info(`OTP email result for ${email}:`, { success: emailResult.success, error: emailResult.error });
    
    if (!emailResult.success) {
      logger.error(`Failed to send OTP email to ${email}:`, emailResult.error);
      // Clean up pending registration if email fails
      await PendingRegistration.deleteOne({ email });
      throw new Error('Failed to send OTP email. Please check your email configuration or try again later.');
    }

    logger.info(`OTP email sent successfully to ${email}. OTP: ${otp}`);
    const result: any = { 
      message: 'OTP sent to your email. Please verify to complete registration.',
      email 
    };
    // Include OTP in development mode for debugging
    if (process.env.NODE_ENV === 'development') {
      result.otp = otp;
    }
    return result;
  }

  async verifyRegistrationOTP(email: string, otp: string): Promise<AuthResult> {
    // Find pending registration
    const pendingRegistration = await PendingRegistration.findOne({ email });
    
    if (!pendingRegistration) {
      throw new Error('No pending registration found. Please start the registration process again.');
    }

    // Verify OTP
    const result = pendingRegistration.verifyOTP(otp);
    if (!result.success) {
      await pendingRegistration.save();
      throw new Error(result.message);
    }

    // Check if email still doesn't exist (double-check before creating account)
    const emailCheck = await checkEmailExists(email);
    if (emailCheck.exists) {
      // Delete pending registration and throw error
      await PendingRegistration.deleteOne({ email });
      throw new Error(emailCheck.message);
    }

    // Check if phone still doesn't exist
    const phoneCheck = await checkPhoneExists(pendingRegistration.phone);
    if (phoneCheck.exists) {
      await PendingRegistration.deleteOne({ email });
      throw new Error(phoneCheck.message);
    }

    // Create the actual user account
    const user = await userRepository.create({
      firstName: pendingRegistration.firstName,
      lastName: pendingRegistration.lastName,
      email: pendingRegistration.email,
      phone: pendingRegistration.phone,
      password: pendingRegistration.password,
      dateOfBirth: pendingRegistration.dateOfBirth,
      gender: pendingRegistration.gender,
      userType: 'user',
      isEmailVerified: true, // Verified via OTP
      isPhoneVerified: true,
      isActive: true
    });

    // Delete pending registration after successful account creation
    await PendingRegistration.deleteOne({ email });

    // Generate tokens
    const token = generateToken(user._id.toString(), user.userType);
    const refreshToken = generateRefreshToken(user._id.toString(), user.userType);

    // Send welcome email (async, don't wait)
    emailService.sendWelcomeEmail(email, user.firstName, 'user').catch((err: Error) => {
      logger.error('Failed to send welcome email', err);
    });

    const userWithoutPassword = await userRepository.findById(user._id.toString());
    if (!userWithoutPassword) {
      throw new Error('Failed to retrieve user after creation');
    }

    logger.info(`User account created successfully after OTP verification: ${email}`);
    return {
      user: userWithoutPassword,
      token,
      refreshToken
    };
  }

  async loginUser(email: string, password: string): Promise<AuthResult | { requiresVerification: true; email: string; message: string }> {
    const user = await userRepository.findByEmail(email, true);
    
    if (!user) {
      throw new Error(MESSAGES.AUTH.INVALID_CREDENTIALS);
    }

    // Check if account is locked
    if (user.isLocked) {
      throw new Error(MESSAGES.AUTH.ACCOUNT_LOCKED);
    }

    if (!user.isActive) {
      throw new Error(MESSAGES.AUTH.ACCOUNT_DEACTIVATED);
    }

    // Check password
    const isPasswordValid = await user.matchPassword(password);
    if (!isPasswordValid) {
      await user.incLoginAttempts();
      throw new Error(MESSAGES.AUTH.INVALID_CREDENTIALS);
    }

    // After successful password verification, always send OTP for login verification
    // Generate and send OTP for login verification
    const otp = user.generateOTP();
    await user.save();
    
    // Send OTP email
    const emailResult = await emailService.sendOTPEmail(email, otp, user.firstName, 'verification');
    if (!emailResult.success) {
      logger.error(`Failed to send OTP email to ${email}:`, emailResult.error);
      throw new Error('Failed to send login OTP. Please try again later.');
    }
    
    logger.info(`OTP sent for login verification to ${email}`);
    return {
      requiresVerification: true,
      email: email,
      message: 'Please verify your login with the OTP sent to your email.'
    };
  }

  async loginExpert(email: string, password: string): Promise<AuthResult> {
    const expert = await expertRepository.findByEmail(email, true);
    
    if (!expert) {
      throw new Error(MESSAGES.AUTH.INVALID_CREDENTIALS);
    }

    // Check if account is locked
    if (expert.isLocked) {
      throw new Error(MESSAGES.AUTH.ACCOUNT_LOCKED);
    }

    if (!expert.isActive) {
      throw new Error(MESSAGES.AUTH.ACCOUNT_DEACTIVATED);
    }

    // Check password
    const isPasswordValid = await expert.matchPassword(password);
    if (!isPasswordValid) {
      await expert.incLoginAttempts();
      throw new Error(MESSAGES.AUTH.INVALID_CREDENTIALS);
    }

    // Reset login attempts on successful login
    await expert.resetLoginAttempts();
    expert.lastLogin = new Date();
    await expert.save();

    // Generate tokens
    const token = generateToken(expert._id.toString(), expert.userType);
    const refreshToken = generateRefreshToken(expert._id.toString(), expert.userType);

    const expertWithoutPassword = await expertRepository.findById(expert._id.toString());
    if (!expertWithoutPassword) {
      throw new Error('Failed to retrieve expert after login');
    }

    return {
      user: expertWithoutPassword,
      token,
      refreshToken
    };
  }

  async sendOTP(email: string, userType: 'user' | 'expert' = 'user'): Promise<{ message: string }> {
    let user: IUser | IExpert | null;
    if (userType === 'expert') {
      user = await expertRepository.findByEmail(email);
    } else {
      user = await userRepository.findByEmail(email);
    }

    if (!user) {
      throw new Error(MESSAGES.AUTH.USER_NOT_FOUND);
    }

    // Generate OTP
    const otp = user.generateOTP();
    await user.save();

    // Send OTP email
    await emailService.sendOTPEmail(email, otp, user.firstName);

    return { message: MESSAGES.AUTH.OTP_SENT };
  }

  async verifyOTP(email: string, otp: string, userType: 'user' | 'expert' = 'user'): Promise<{ message: string } | AuthResult> {
    let user: IUser | IExpert | null;
    if (userType === 'expert') {
      user = await expertRepository.findByEmail(email);
    } else {
      user = await userRepository.findByEmail(email);
    }

    if (!user) {
      throw new Error(MESSAGES.AUTH.USER_NOT_FOUND);
    }

    // Verify OTP
    const result = user.verifyOTP(otp);
    if (!result.success) {
      await user.save();
      throw new Error(result.message);
    }

    // Mark email as verified
    user.isEmailVerified = true;
    await user.save();

    // If this is a login verification (user exists and was trying to login), return auth tokens
    // Check if user is active (meaning they have an account and were trying to login)
    if (user.isActive && userType === 'user') {
      // Generate tokens for login
      const token = generateToken(user._id.toString(), user.userType);
      const refreshToken = generateRefreshToken(user._id.toString(), user.userType);
      
      const userWithoutPassword = await userRepository.findById(user._id.toString());
      if (!userWithoutPassword) {
        throw new Error('Failed to retrieve user after verification');
      }

      // Update last login
      userWithoutPassword.lastLogin = new Date();
      await userWithoutPassword.save();

      return {
        user: userWithoutPassword,
        token,
        refreshToken
      };
    }

    return { message: MESSAGES.AUTH.OTP_VERIFIED };
  }

  async forgotPassword(email: string, userType: 'user' | 'expert' = 'user'): Promise<{ message: string }> {
    let user: IUser | IExpert | null;
    if (userType === 'expert') {
      user = await expertRepository.findByEmail(email);
    } else {
      user = await userRepository.findByEmail(email);
    }

    if (!user) {
      // Don't reveal if user exists for security
      return { message: MESSAGES.AUTH.PASSWORD_RESET_SENT };
    }

    // Generate reset token
    const resetToken = user.getResetPasswordToken();
    await user.save();

    // Send reset email
    await emailService.sendPasswordResetEmail(email, resetToken, user.firstName);

    return { message: MESSAGES.AUTH.PASSWORD_RESET_SENT };
  }

  async resetPassword(resetToken: string, newPassword: string, userType: 'user' | 'expert' = 'user'): Promise<{ message: string }> {
    let user: IUser | IExpert | null;
    if (userType === 'expert') {
      user = await expertRepository.findByResetToken(resetToken);
    } else {
      user = await userRepository.findByResetToken(resetToken);
    }

    if (!user) {
      throw new Error('Invalid or expired reset token');
    }

    // Set new password
    user.password = newPassword;
    if ('passwordResetToken' in user) {
      user.passwordResetToken = undefined;
      user.passwordResetExpire = undefined;
    } else {
      (user as IExpert).resetPasswordToken = undefined;
      (user as IExpert).resetPasswordExpire = undefined;
    }
    await user.save();

    return { message: MESSAGES.AUTH.PASSWORD_RESET_SUCCESS };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string, userType: 'user' | 'expert' = 'user'): Promise<{ message: string }> {
    let user: IUser | IExpert | null;
    if (userType === 'expert') {
      user = await expertRepository.findById(userId, true);
    } else {
      user = await userRepository.findById(userId, true);
    }

    if (!user) {
      throw new Error(MESSAGES.AUTH.USER_NOT_FOUND);
    }

    // Verify current password
    const isPasswordValid = await user.matchPassword(currentPassword);
    if (!isPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Set new password
    user.password = newPassword;
    await user.save();

    return { message: MESSAGES.AUTH.PASSWORD_CHANGED };
  }
}

export default new AuthService();

