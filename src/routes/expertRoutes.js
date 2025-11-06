const express = require('express');
const rateLimit = require('express-rate-limit');
const {
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
  getExpertById
} = require('../controllers/expertController');
const { protect, authorize } = require('../middlewares/auth');
const { uploadProfileImage, handleUploadError } = require('../middlewares/upload');
const {
  expertRegisterSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resetPasswordWithOTPSchema,
  otpVerificationSchema,
  changePasswordSchema,
  updateExpertProfileSchema,
  validate
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

// Get all experts (for browsing)
router.get('/', getExperts);

// Get expert by ID
router.get('/:id', getExpertById);

// Expert registration with image upload
router.post('/register',
  authLimiter,
  uploadProfileImage,
  handleUploadError,
  validate(expertRegisterSchema),
  registerExpert
);

router.post('/login',
  authLimiter,
  validate(loginSchema),
  loginExpert
);

router.post('/forgot-password',
  authLimiter,
  validate(forgotPasswordSchema),
  forgotPassword
);

router.post('/reset-password',
  authLimiter,
  validate(resetPasswordSchema),
  resetPassword
);

router.post('/reset-password-otp',
  authLimiter,
  validate(resetPasswordWithOTPSchema),
  resetPasswordWithOTP
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
router.use(authorize('expert')); // Only experts can access these routes

router.get('/me', getCurrentExpert);

router.put('/profile',
  uploadProfileImage,
  handleUploadError,
  validate(updateExpertProfileSchema),
  updateExpertProfile
);

router.put('/change-password',
  validate(changePasswordSchema),
  changePassword
);

module.exports = router;