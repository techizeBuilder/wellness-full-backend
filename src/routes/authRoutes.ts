import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  registerUser,
  verifyRegistrationOTP,
  loginUser,
  logoutUser,
  getCurrentUser,
  sendOTP,
  verifyOTP,
  forgotPassword,
  resetPasswordWithToken,
  changePassword,
  updateProfile
} from '../controllers/authController';
import { unifiedLogin } from '../controllers/unifiedAuthController';
import { protect } from '../middlewares/auth';
import { uploadProfileImage, handleUploadError } from '../middlewares/upload';
import {
  userRegisterSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordWithTokenSchema,
  otpVerificationSchema,
  changePasswordSchema,
  updateProfileSchema,
  validate,
  validateUserRegistration
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
router.post('/register', authLimiter, validate(userRegisterSchema), registerUser);

router.post('/verify-registration-otp', authLimiter, validate(otpVerificationSchema), verifyRegistrationOTP);

router.post('/login', authLimiter, validate(loginSchema), unifiedLogin);

// Keep original login as backup
router.post('/user-login', authLimiter, validate(loginSchema), loginUser);

router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), forgotPassword);

router.post('/reset-password', authLimiter, validate(resetPasswordWithTokenSchema), resetPasswordWithToken);

router.post('/send-otp', otpLimiter, validate(forgotPasswordSchema), sendOTP);

router.post('/verify-otp', authLimiter, validate(otpVerificationSchema), verifyOTP);

// Protected routes
router.use(protect); // All routes below this middleware are protected

router.post('/logout', logoutUser);

router.get('/me', getCurrentUser);

router.put('/change-password', validate(changePasswordSchema), changePassword);

router.put('/profile', uploadProfileImage, handleUploadError, validate(updateProfileSchema), updateProfile);

export default router;
