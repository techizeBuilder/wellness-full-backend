import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';

// Global rate limiter
export const createGlobalLimiter = (): RateLimitRequestHandler => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    message: {
      success: false,
      message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
  });
};

// Authentication rate limiter
export const createAuthLimiter = (): RateLimitRequestHandler => {
  return rateLimit({
    windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || (process.env.NODE_ENV === 'development' ? '20' : '5'), 10),
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
export const createOTPLimiter = (): RateLimitRequestHandler => {
  return rateLimit({
    windowMs: parseInt(process.env.OTP_RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
    max: parseInt(process.env.OTP_RATE_LIMIT_MAX_REQUESTS || (process.env.NODE_ENV === 'development' ? '10' : '3'), 10),
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

