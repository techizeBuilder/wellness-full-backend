import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/errorHandler';
import authService from '../services/authService';
import ApiResponse from '../utils/response';
import { MESSAGES } from '../constants/messages';
import userService from '../services/userService';

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.registerUser(req.body);
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
  return ApiResponse.success(res, {
    user: result.user,
    userType: result.user.userType,
    accountType: result.user.userType === 'expert' ? 'Expert' : 'User',
    token: result.token,
    refreshToken: result.refreshToken
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
  const user = await userService.getCurrentUser((req as any).user._id);
  return ApiResponse.success(res, { user });
});

// @desc    Send OTP
// @route   POST /api/auth/send-otp
// @access  Public
export const sendOTP = asyncHandler(async (req: Request, res: Response) => {
  await authService.sendOTP(req.body.email, 'user');
  return ApiResponse.success(res, null, MESSAGES.AUTH.OTP_SENT);
});

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
export const verifyOTP = asyncHandler(async (req: Request, res: Response) => {
  await authService.verifyOTP(req.body.email, req.body.otp, 'user');
  return ApiResponse.success(res, null, MESSAGES.AUTH.OTP_VERIFIED);
});

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.forgotPassword(req.body.email, 'user');
  return ApiResponse.success(res, null, MESSAGES.AUTH.PASSWORD_RESET_SENT);
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
  if ((req as any).file) {
    updateData.profileImage = (req as any).file.path;
  }
  const user = await userService.updateProfile((req as any).user._id, updateData);
  return ApiResponse.success(res, { user }, MESSAGES.USER.PROFILE_UPDATED);
});
