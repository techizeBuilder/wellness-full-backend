import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/errorHandler';
import authService from '../services/authService';
import ApiResponse from '../utils/response';
import { MESSAGES } from '../constants/messages';
import userService from '../services/userService';
import { AuthResult } from '../types/services.interfaces';
import { getFileUrl, deleteFile } from '../middlewares/upload';
import path from 'path';

// Helper function to normalize profile image path to just filename
const normalizeProfileImagePath = (imagePath: string | null | undefined): string | null => {
  if (!imagePath) return null;
  
  // If it's already just a filename (no path separators), return as is
  if (!imagePath.includes('/') && !imagePath.includes('\\')) {
    return imagePath;
  }
  
  // Extract filename from path
  const normalized = imagePath.replace(/\\/g, '/');
  const filename = normalized.split('/').pop() || null;
  
  return filename;
};

// @desc    Register user (sends OTP)
// @route   POST /api/auth/register
// @access  Public
export const registerUser = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.registerUser(req.body);
  
  // For development: include OTP in response (remove in production)
  const responseData: any = {
    email: result.email,
    message: result.message
  };
  
  // Only include OTP in development mode for debugging
  if (process.env.NODE_ENV === 'development' && (result as any).otp) {
    responseData.debugOtp = (result as any).otp;
    console.log(`\n🔐 DEBUG OTP for ${result.email}: ${(result as any).otp}\n`);
  }
  
  return ApiResponse.success(res, responseData, result.message);
});

// @desc    Verify registration OTP and complete account creation
// @route   POST /api/auth/verify-registration-otp
// @access  Public
export const verifyRegistrationOTP = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  const result = await authService.verifyRegistrationOTP(email, otp);
  return ApiResponse.created(res, {
    user: result.user,
    userType: 'user',
    accountType: 'User',
    token: result.token,
    refreshToken: result.refreshToken
  }, MESSAGES.AUTH.REGISTER_SUCCESS);
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const loginUser = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.loginUser(req.body.email, req.body.password);
  
  // Check if email verification is required
  if ('requiresVerification' in result && result.requiresVerification) {
    return ApiResponse.success(res, {
      requiresVerification: true,
      email: result.email,
      verificationType: result.verificationType
    }, result.message);
  }
  
  // Normal login success - TypeScript now knows result is AuthResult
  const authResult = result as AuthResult;
  return ApiResponse.success(res, {
    user: authResult.user,
    userType: authResult.user.userType,
    accountType: authResult.user.userType === 'expert' ? 'Expert' : 'User',
    token: authResult.token,
    refreshToken: authResult.refreshToken
  }, MESSAGES.AUTH.LOGIN_SUCCESS);
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
export const logoutUser = asyncHandler(async (req: Request, res: Response) => {
  return ApiResponse.success(res, null, MESSAGES.AUTH.LOGOUT_SUCCESS);
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
export const getCurrentUser = asyncHandler(async (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  
  // If user is an Expert (regular expert, not Google OAuth), return it directly
  // The protect middleware already validated and loaded the user
  if (currentUser.constructor.modelName === 'Expert') {
    const expertObj = currentUser.toObject();
    // Ensure profile image URL is properly formatted
    if (expertObj.profileImage) {
      expertObj.profileImage = getFileUrl(normalizeProfileImagePath(expertObj.profileImage), 'profiles');
    }
    return ApiResponse.success(res, { user: expertObj });
  }
  
  // For User model (regular users or Google OAuth experts), use userService
  // This ensures consistent response format and any additional processing
  const user = await userService.getCurrentUser(currentUser._id);
  const userObj = user.toObject ? user.toObject() : user;
  
  // Normalize and format profile image URL
  if (userObj.profileImage) {
    userObj.profileImage = getFileUrl(normalizeProfileImagePath(userObj.profileImage), 'profiles');
  }
  
  return ApiResponse.success(res, { user: userObj });
});

// @desc    Send OTP
// @route   POST /api/auth/send-otp
// @access  Public
export const sendOTP = asyncHandler(async (req: Request, res: Response) => {
  await authService.sendOTP(req.body.email, 'user');
  return ApiResponse.success(res, null, MESSAGES.AUTH.OTP_SENT);
});

// @desc    Verify OTP (for login or general verification)
// @route   POST /api/auth/verify-otp
// @access  Public
export const verifyOTP = asyncHandler(async (req: Request, res: Response) => {
  const userType = req.body.userType === 'expert' ? 'expert' : 'user';
  const result = await authService.verifyOTP(req.body.email, req.body.otp, userType);
  
  // If result contains tokens, it's a login verification - return auth data
  if ('token' in result && 'user' in result) {
    return ApiResponse.success(res, {
      user: result.user,
      userType: result.user.userType,
      accountType: result.user.userType === 'expert' ? 'Expert' : 'User',
      token: result.token,
      refreshToken: result.refreshToken
    }, MESSAGES.AUTH.LOGIN_SUCCESS);
  }
  
  // Otherwise, it's just a verification message
  return ApiResponse.success(res, null, MESSAGES.AUTH.OTP_VERIFIED);
});

// @desc    Forgot password (OTP-based)
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.forgotPassword(req.body.email, 'user');
  
  // For development: include OTP in response (remove in production)
  const responseData: any = {
    email: result.email,
    message: result.message
  };
  
  // Only include OTP in development mode for debugging
  if (process.env.NODE_ENV === 'development' && (result as any).otp) {
    responseData.debugOtp = (result as any).otp;
    console.log(`\n🔐 DEBUG Password Reset OTP for ${result.email}: ${(result as any).otp}\n`);
  }
  
  return ApiResponse.success(res, responseData, result.message);
});

// @desc    Verify password reset OTP
// @route   POST /api/auth/verify-password-reset-otp-unauthenticated
// @access  Public
export const verifyPasswordResetOTPUnauthenticated = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  const result = await authService.verifyPasswordResetOTPUnauthenticated(email, otp, 'user');
  return ApiResponse.success(res, { verified: result.verified }, result.message);
});

// @desc    Reset password with OTP (unauthenticated)
// @route   POST /api/auth/reset-password-with-otp-unauthenticated
// @access  Public
export const resetPasswordWithOTPUnauthenticated = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp, password } = req.body;
  const result = await authService.resetPasswordWithOTPUnauthenticated(email, otp, password, 'user');
  return ApiResponse.success(res, null, result.message);
});

// @desc    Reset password with token
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPasswordWithToken = asyncHandler(async (req: Request, res: Response) => {
  await authService.resetPassword(req.body.token, req.body.password, 'user');
  return ApiResponse.success(res, null, MESSAGES.AUTH.PASSWORD_RESET_SUCCESS);
});

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  await authService.changePassword((req as any).user._id, currentPassword, newPassword, (req as any).user.userType);
  return ApiResponse.success(res, null, MESSAGES.AUTH.PASSWORD_CHANGED);
});

// @desc    Update profile
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const updateData: any = { ...req.body };
  const currentUser = (req as any).user;
  
  if ((req as any).file) {
    // Delete old profile image if it exists
    if (currentUser.profileImage) {
      const oldImagePath = normalizeProfileImagePath(currentUser.profileImage);
      if (oldImagePath) {
        deleteFile(path.join(__dirname, '..', 'uploads', 'profiles', oldImagePath));
      }
    }
    // Store just the filename, not the full path
    updateData.profileImage = (req as any).file.filename;
  }
  
  const user = await userService.updateProfile(currentUser._id, updateData);
  const userObj = user.toObject ? user.toObject() : user;
  
  // Format profile image URL for response
  if (userObj.profileImage) {
    userObj.profileImage = getFileUrl(normalizeProfileImagePath(userObj.profileImage), 'profiles');
  }
  
  return ApiResponse.success(res, { user: userObj }, MESSAGES.USER.PROFILE_UPDATED);
});

// @desc    Request password reset OTP (for logged-in users)
// @route   POST /api/auth/request-password-reset-otp
// @access  Private
export const requestPasswordResetOTP = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const userType = user.userType === 'expert' ? 'expert' : 'user';
  await authService.requestPasswordResetOTP(user._id.toString(), userType);
  return ApiResponse.success(res, null, MESSAGES.AUTH.OTP_SENT);
});

// @desc    Verify password reset OTP (for logged-in users)
// @route   POST /api/auth/verify-password-reset-otp
// @access  Private
export const verifyPasswordResetOTP = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const userType = user.userType === 'expert' ? 'expert' : 'user';
  await authService.verifyPasswordResetOTP(user._id.toString(), req.body.otp, userType);
  return ApiResponse.success(res, null, MESSAGES.AUTH.OTP_VERIFIED);
});

// @desc    Reset password with OTP (for logged-in users)
// @route   POST /api/auth/reset-password-with-otp
// @access  Private
export const resetPasswordWithOTP = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const userType = user.userType === 'expert' ? 'expert' : 'user';
  await authService.resetPasswordWithOTP(user._id.toString(), req.body.otp, req.body.password, userType);
  return ApiResponse.success(res, null, MESSAGES.AUTH.PASSWORD_RESET_SUCCESS);
});