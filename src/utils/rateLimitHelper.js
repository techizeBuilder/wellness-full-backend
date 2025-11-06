const rateLimit = require('express-rate-limit');

/**
 * Create a flexible rate limiter that respects environment variables
 * and provides better development experience
 */
const createRateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes default
    max = 5, // default max requests
    message = 'Too many requests, please try again later.',
    envMaxKey = null, // environment variable key for max requests
    envWindowKey = null, // environment variable key for window
    skipInDevelopment = false, // whether to skip in development
    developmentMax = null // override max for development
  } = options;

  // Calculate actual limits
  const actualWindowMs = envWindowKey ? 
    parseInt(process.env[envWindowKey]) || windowMs : 
    windowMs;
    
  let actualMax = max;
  if (envMaxKey) {
    actualMax = parseInt(process.env[envMaxKey]) || max;
  }
  
  // Use more lenient limits in development if specified
  if (process.env.NODE_ENV === 'development' && developmentMax) {
    actualMax = developmentMax;
  }

  return rateLimit({
    windowMs: actualWindowMs,
    max: actualMax,
    message: {
      success: false,
      message: typeof message === 'string' ? message : message.message || 'Too many requests',
      ...(typeof message === 'object' ? message : {})
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Add detailed headers for debugging
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message: typeof message === 'string' ? message : message.message || 'Too many requests',
        retryAfter: Math.round(actualWindowMs / 1000),
        limit: actualMax,
        windowMs: actualWindowMs,
        ...(process.env.NODE_ENV === 'development' && {
          debug: {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString()
          }
        })
      });
    },
    // Skip function for development
    skip: (req) => {
      if (skipInDevelopment && process.env.NODE_ENV === 'development') {
        return true;
      }
      return false;
    }
  });
};

/**
 * Pre-configured rate limiters for common use cases
 */
const rateLimiters = {
  // Authentication endpoints (login, register, forgot password)
  auth: () => createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    developmentMax: 20, // More lenient in development
    envMaxKey: 'AUTH_RATE_LIMIT_MAX_REQUESTS',
    envWindowKey: 'AUTH_RATE_LIMIT_WINDOW_MS',
    message: 'Too many authentication attempts, please try again later.'
  }),

  // OTP endpoints
  otp: () => createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 3,
    developmentMax: 10, // More lenient in development
    envMaxKey: 'OTP_RATE_LIMIT_MAX_REQUESTS',
    envWindowKey: 'OTP_RATE_LIMIT_WINDOW_MS',
    message: 'Too many OTP requests, please try again later.'
  }),

  // Global API rate limiting
  global: () => createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    developmentMax: 1000, // Much more lenient in development
    envMaxKey: 'RATE_LIMIT_MAX_REQUESTS',
    envWindowKey: 'RATE_LIMIT_WINDOW_MS',
    message: 'Too many requests from this IP, please try again later.'
  })
};

module.exports = {
  createRateLimiter,
  rateLimiters
};