const userRepository = require('../repositories/userRepository');
const expertRepository = require('../repositories/expertRepository');
const { checkEmailExists, checkPhoneExists } = require('../utils/emailValidation');
const { generateToken, generateRefreshToken } = require('../middlewares/auth');
const emailService = require('./emailService');
const { MESSAGES } = require('../constants/messages');
const logger = require('../utils/logger');

class AuthService {
  async registerUser(userData) {
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
    const token = generateToken(user._id, user.userType);
    const refreshToken = generateRefreshToken(user._id, user.userType);

    // Send welcome email (async, don't wait)
    emailService.sendWelcomeEmail(email, firstName, 'user').catch(err => {
      logger.error('Failed to send welcome email', err);
    });

    return {
      user: await userRepository.findById(user._id),
      token,
      refreshToken
    };
  }

  async loginUser(email, password) {
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
    const token = generateToken(user._id, user.userType);
    const refreshToken = generateRefreshToken(user._id, user.userType);

    return {
      user: await userRepository.findById(user._id),
      token,
      refreshToken
    };
  }

  async loginExpert(email, password) {
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
    const token = generateToken(expert._id, expert.userType);
    const refreshToken = generateRefreshToken(expert._id, expert.userType);

    return {
      user: await expertRepository.findById(expert._id),
      token,
      refreshToken
    };
  }

  async sendOTP(email, userType = 'user') {
    let user;
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

  async verifyOTP(email, otp, userType = 'user') {
    let user;
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

  async forgotPassword(email, userType = 'user') {
    let user;
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

  async resetPassword(resetToken, newPassword, userType = 'user') {
    let user;
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

  async changePassword(userId, currentPassword, newPassword, userType = 'user') {
    let user;
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

module.exports = new AuthService();

