const express = require('express');
const rateLimit = require('express-rate-limit');
const {
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
} = require('../controllers/authController');
const { unifiedLogin } = require('../controllers/unifiedAuthController');
const { protect } = require('../middlewares/auth');
const { uploadProfileImage, handleUploadError } = require('../middlewares/upload');
const {
  userRegisterSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordWithTokenSchema,
  otpVerificationSchema,
  changePasswordSchema,
  updateProfileSchema,
  validate,
  validateUserRegistration
} = require('../utils/validation');

const router = express.Router();

// Rate limiting
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes default
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || (process.env.NODE_ENV === 'development' ? 20 : 5), // More lenient in development
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for development if needed (optional)
    return process.env.NODE_ENV === 'development' && process.env.DISABLE_AUTH_RATE_LIMIT === 'true';
  }
});

const otpLimiter = rateLimit({
  windowMs: parseInt(process.env.OTP_RATE_LIMIT_WINDOW_MS) || 60 * 1000, // 1 minute default
  max: parseInt(process.env.OTP_RATE_LIMIT_MAX_REQUESTS) || (process.env.NODE_ENV === 'development' ? 10 : 3), // More lenient in development
  message: {
    success: false,
    message: 'Too many OTP requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for development if needed (optional)
    return process.env.NODE_ENV === 'development' && process.env.DISABLE_OTP_RATE_LIMIT === 'true';
  }
});

// Public routes
router.post('/register', 
  authLimiter,
  validate(userRegisterSchema),
  registerUser
);

router.post('/login', 
  authLimiter,
  validate(loginSchema),
  unifiedLogin
);

// Keep original login as backup
router.post('/user-login', 
  authLimiter,
  validate(loginSchema),
  loginUser
);

router.post('/forgot-password',
  authLimiter,
  validate(forgotPasswordSchema),
  forgotPassword
);

router.post('/reset-password',
  authLimiter,
  validate(resetPasswordWithTokenSchema),
  resetPasswordWithToken
);

router.post('/send-otp',
  otpLimiter,
  validate(forgotPasswordSchema), // Reuse forgot password schema (just email)
  sendOTP
);

router.post('/verify-otp',
  authLimiter,
  validate(otpVerificationSchema),
  verifyOTP
);

// Protected routes
router.use(protect); // All routes below this middleware are protected

router.post('/logout', logoutUser);

router.get('/me', getCurrentUser);

router.put('/change-password',
  validate(changePasswordSchema),
  changePassword
);

router.put('/profile',
  uploadProfileImage,
  handleUploadError,
  validate(updateProfileSchema),
  updateProfile
);

module.exports = router;