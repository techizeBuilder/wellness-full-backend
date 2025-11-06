import userRepository from '../repositories/userRepository';
import expertRepository from '../repositories/expertRepository';
import { checkEmailExists, checkPhoneExists } from '../utils/emailValidation';
import { generateToken, generateRefreshToken } from '../middlewares/auth';
import emailService from './emailService';
import { MESSAGES } from '../constants/messages';
import logger from '../utils/logger';
import { IAuthService, RegisterUserData, AuthResult } from '../types/services.interfaces';
import { IUser, IExpert } from '../types/models';

class AuthService implements IAuthService {
  async registerUser(userData: RegisterUserData): Promise<AuthResult> {
    const { firstName, lastName, email, phone, password, dateOfBirth, gender } = userData;
    
    // Check if email exists
    const emailCheck = await checkEmailExists(email);
    if (emailCheck.exists) {
      throw new Error(emailCheck.message);
    }

    // Check if phone exists
    const phoneCheck = await checkPhoneExists(phone);
    if (phoneCheck.exists) {
      throw new Error(phoneCheck.message);
    }

    // Create user
    const finalLastName = lastName || firstName;
    const user = await userRepository.create({
      firstName,
      lastName: finalLastName,
      email,
      phone,
      password,
      dateOfBirth,
      gender,
      userType: 'user',
      isEmailVerified: true,
      isPhoneVerified: true,
      isActive: true
    });

    // Generate tokens
    const token = generateToken(user._id.toString(), user.userType);
    const refreshToken = generateRefreshToken(user._id.toString(), user.userType);

    // Send welcome email (async, don't wait)
    emailService.sendWelcomeEmail(email, firstName, 'user').catch((err: Error) => {
      logger.error('Failed to send welcome email', err);
    });

    const userWithoutPassword = await userRepository.findById(user._id.toString());
    if (!userWithoutPassword) {
      throw new Error('Failed to retrieve user after creation');
    }

    return {
      user: userWithoutPassword,
      token,
      refreshToken
    };
  }

  async loginUser(email: string, password: string): Promise<AuthResult> {
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

    // Reset login attempts on successful login
    await user.resetLoginAttempts();
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const token = generateToken(user._id.toString(), user.userType);
    const refreshToken = generateRefreshToken(user._id.toString(), user.userType);

    const userWithoutPassword = await userRepository.findById(user._id.toString());
    if (!userWithoutPassword) {
      throw new Error('Failed to retrieve user after login');
    }

    return {
      user: userWithoutPassword,
      token,
      refreshToken
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

  async verifyOTP(email: string, otp: string, userType: 'user' | 'expert' = 'user'): Promise<{ message: string }> {
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
    user.passwordResetToken = undefined;
    user.passwordResetExpire = undefined;
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

