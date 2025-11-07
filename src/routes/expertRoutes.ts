import express from 'express';
import rateLimit from 'express-rate-limit';
import {
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
} from '../controllers/expertController';
import { protect, authorize } from '../middlewares/auth';
import { uploadProfileImage, handleUploadError } from '../middlewares/upload';
import {
  expertRegisterSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resetPasswordWithOTPSchema,
  otpVerificationSchema,
  changePasswordSchema,
  updateExpertProfileSchema,
  validate
} from '../utils/validation';

const router = express.Router();

// Rate limiting
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || String(15 * 60 * 1000), 10),
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || (process.env.NODE_ENV === 'development' ? '20' : '5'), 10),
  message: { success: false, message: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development' && process.env.DISABLE_AUTH_RATE_LIMIT === 'true'
});

const otpLimiter = rateLimit({
  windowMs: parseInt(process.env.OTP_RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.OTP_RATE_LIMIT_MAX_REQUESTS || (process.env.NODE_ENV === 'development' ? '10' : '3'), 10),
  message: { success: false, message: 'Too many OTP requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development' && process.env.DISABLE_OTP_RATE_LIMIT === 'true'
});

// Public routes
// Get all experts (for browsing)
router.get('/', getExperts);

// Expert registration with image upload
router.post('/register', authLimiter, uploadProfileImage, handleUploadError, validate(expertRegisterSchema), registerExpert);

router.post('/login', authLimiter, validate(loginSchema), loginExpert);

router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), forgotPassword);

router.post('/reset-password', authLimiter, validate(resetPasswordSchema), resetPassword);

router.post('/reset-password-otp', authLimiter, validate(resetPasswordWithOTPSchema), resetPasswordWithOTP);

router.post('/send-otp', otpLimiter, validate(forgotPasswordSchema), sendOTP);

router.post('/verify-otp', authLimiter, validate(otpVerificationSchema), verifyOTP);

// Protected routes
router.get('/me', protect, authorize('expert'), getCurrentExpert);

// Public routes that must come after specific routes
// Get expert by ID
router.get('/:id', getExpertById);

// Protected routes
router.use(protect); // All routes below this middleware are protected
router.use(authorize('expert')); // Only experts can access these routes

router.put('/profile', uploadProfileImage, handleUploadError, validate(updateExpertProfileSchema), updateExpertProfile);

router.put('/change-password', validate(changePasswordSchema), changePassword);

export default router;
