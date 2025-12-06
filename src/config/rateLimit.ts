import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';

// Global rate limiter
export const createGlobalLimiter = (): RateLimitRequestHandler => {
  // Allow 1000 requests per 1 minute for both development and production
  const defaultMax = '1000';
  const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || defaultMax, 10);
  
  return rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: maxRequests,
    message: {
      success: false,
      message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting in development if explicitly disabled
    skip: (req) => {
      return process.env.NODE_ENV === 'development' && process.env.DISABLE_RATE_LIMIT === 'true';
    }
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

