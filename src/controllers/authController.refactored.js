const { asyncHandler } = require('../middlewares/errorHandler');
const authService = require('../services/authService');
const ApiResponse = require('../utils/response');
const { MESSAGES } = require('../constants/messages');
const logger = require('../utils/logger');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
  logger.debug('User registration request', { email: req.body.email });
  
  const result = await authService.registerUser(req.body);
  
  ApiResponse.created(res, {
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
const loginUser = asyncHandler(async (req, res) => {
  logger.debug('User login request', { email: req.body.email });
  
  const result = await authService.loginUser(req.body.email, req.body.password);
  
  ApiResponse.success(res, {
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
const logoutUser = asyncHandler(async (req, res) => {
  // In a stateless JWT system, logout is handled client-side
  // But we can log the logout event
  logger.info('User logged out', { userId: req.user._id });
  
  ApiResponse.success(res, null, MESSAGES.AUTH.LOGOUT_SUCCESS);
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getCurrentUser = asyncHandler(async (req, res) => {
  const userService = require('../services/userService');
  const user = await userService.getCurrentUser(req.user._id);
  
  ApiResponse.success(res, { user });
});

// @desc    Send OTP
// @route   POST /api/auth/send-otp
// @access  Public
const sendOTP = asyncHandler(async (req, res) => {
  const { email } = req.body;
  logger.debug('OTP request', { email });
  
  await authService.sendOTP(email, 'user');
  
  ApiResponse.success(res, null, MESSAGES.AUTH.OTP_SENT);
});

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  logger.debug('OTP verification request', { email });
  
  await authService.verifyOTP(email, otp, 'user');
  
  ApiResponse.success(res, null, MESSAGES.AUTH.OTP_VERIFIED);
});

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  logger.debug('Forgot password request', { email });
  
  await authService.forgotPassword(email, 'user');
  
  ApiResponse.success(res, null, MESSAGES.AUTH.PASSWORD_RESET_SENT);
});

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
const resetPasswordWithToken = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  logger.debug('Reset password request');
  
  await authService.resetPassword(token, password, 'user');
  
  ApiResponse.success(res, null, MESSAGES.AUTH.PASSWORD_RESET_SUCCESS);
});

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  logger.debug('Change password request', { userId: req.user._id });
  
  await authService.changePassword(
    req.user._id,
    currentPassword,
    newPassword,
    req.user.userType
  );
  
  ApiResponse.success(res, null, MESSAGES.AUTH.PASSWORD_CHANGED);
});

// @desc    Update profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = asyncHandler(async (req, res) => {
  logger.debug('Update profile request', { userId: req.user._id });
  
  const userService = require('../services/userService');
  const updateData = { ...req.body };
  
  // Handle profile image if uploaded
  if (req.file) {
    updateData.profileImage = req.file.path;
  }
  
  const user = await userService.updateProfile(req.user._id, updateData);
  
  ApiResponse.success(res, { user }, MESSAGES.USER.PROFILE_UPDATED);
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

