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
  getExpertById,
  getBankAccount,
  createOrUpdateBankAccount,
  getAvailability,
  createOrUpdateAvailability
} from '../controllers/expertController';
import { protect, authorize, optionalAuth } from '../middlewares/auth';
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
  bankAccountSchema,
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

// Protected routes - must be defined before parameterized routes
// Create a middleware that protects routes but allows public access to /:id
const protectExpertRoutes = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Check if this is a GET request to /:id (public route)
  // Reserved paths that should be protected
  const reservedPaths = ['bank-account', 'availability', 'profile', 'change-password', 'me'];
  const pathParts = req.path.split('/').filter(p => p); // Remove empty strings
  const lastPath = pathParts[pathParts.length - 1];
  
  // If it's a GET request and the last path segment is not a reserved path, it's likely the public /:id route
  if (req.method === 'GET' && lastPath && !reservedPaths.includes(lastPath) && pathParts.length === 1) {
    // This is the public /:id route, use optionalAuth
    return optionalAuth(req, res, next);
  }
  // For other routes, apply protection
  return protect(req, res, () => {
    authorize('expert')(req, res, next);
  });
};

router.use(protectExpertRoutes); // All routes below this middleware are protected (except public /:id)

// Bank account routes - MUST come before /:id route to avoid route conflicts
router.get('/bank-account', getBankAccount);
router.post('/bank-account', validate(bankAccountSchema), createOrUpdateBankAccount);

// Availability routes - MUST come before /:id route to avoid route conflicts
router.get('/availability', getAvailability);
router.post('/availability', createOrUpdateAvailability);

router.put('/profile', uploadProfileImage, handleUploadError, validate(updateExpertProfileSchema), updateExpertProfile);

router.put('/change-password', validate(changePasswordSchema), changePassword);

// Public route - Get expert by ID (must come last to avoid matching other routes)
// This route is public and accessible to all users (including regular users browsing experts)
// The protectExpertRoutes middleware above will handle making this route public
router.get('/:id', getExpertById);

export default router;
