const rateLimit = require('express-rate-limit');

// Global rate limiter
const createGlobalLimiter = () => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: {
      success: false,
      message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
  });
};

// Authentication rate limiter
const createAuthLimiter = () => {
  return rateLimit({
    windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || (process.env.NODE_ENV === 'development' ? 20 : 5),
    message: {
      success: false,
      message: 'Too many authentication attempts, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      return process.env.NODE_ENV === 'development' && process.env.DISABLE_AUTH_RATE_LIMIT === 'true';
    }
  });
};

// OTP rate limiter
const createOTPLimiter = () => {
  return rateLimit({
    windowMs: parseInt(process.env.OTP_RATE_LIMIT_WINDOW_MS) || 60 * 1000, // 1 minute
    max: parseInt(process.env.OTP_RATE_LIMIT_MAX_REQUESTS) || (process.env.NODE_ENV === 'development' ? 10 : 3),
    message: {
      success: false,
      message: 'Too many OTP requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      return process.env.NODE_ENV === 'development' && process.env.DISABLE_OTP_RATE_LIMIT === 'true';
    }
  });
};

module.exports = {
  createGlobalLimiter,
  createAuthLimiter,
  createOTPLimiter
};

