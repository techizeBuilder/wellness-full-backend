import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';

interface RateLimiterOptions {
  windowMs?: number;
  max?: number;
  message?: string | { message: string; [key: string]: any };
  envMaxKey?: string | null;
  envWindowKey?: string | null;
  skipInDevelopment?: boolean;
  developmentMax?: number | null;
}

export const createRateLimiter = (options: RateLimiterOptions = {}): RateLimitRequestHandler => {
  const {
    windowMs = 15 * 60 * 1000,
    max = 5,
    message = 'Too many requests, please try again later.',
    envMaxKey = null,
    envWindowKey = null,
    skipInDevelopment = false,
    developmentMax = null
  } = options;

  const actualWindowMs = envWindowKey ? parseInt(process.env[envWindowKey] || `${windowMs}`, 10) || windowMs : windowMs;
  let actualMax = max;
  if (envMaxKey) {
    actualMax = parseInt(process.env[envMaxKey] || `${max}`, 10) || max;
  }

  if (process.env.NODE_ENV === 'development' && developmentMax) {
    actualMax = developmentMax;
  }

  return rateLimit({
    windowMs: actualWindowMs,
    max: actualMax,
    message: typeof message === 'string' ? { success: false, message } : { success: false, ...message },
    standardHeaders: true,
    legacyHeaders: false,
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
    skip: () => skipInDevelopment && process.env.NODE_ENV === 'development'
  });
};

export const rateLimiters = {
  auth: () => createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    developmentMax: 20,
    envMaxKey: 'AUTH_RATE_LIMIT_MAX_REQUESTS',
    envWindowKey: 'AUTH_RATE_LIMIT_WINDOW_MS',
    message: 'Too many authentication attempts, please try again later.'
  }),
  otp: () => createRateLimiter({
    windowMs: 60 * 1000,
    max: 3,
    developmentMax: 10,
    envMaxKey: 'OTP_RATE_LIMIT_MAX_REQUESTS',
    envWindowKey: 'OTP_RATE_LIMIT_WINDOW_MS',
    message: 'Too many OTP requests, please try again later.'
  }),
  global: () => createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 100,
    developmentMax: 1000,
    envMaxKey: 'RATE_LIMIT_MAX_REQUESTS',
    envWindowKey: 'RATE_LIMIT_WINDOW_MS',
    message: 'Too many requests from this IP, please try again later.'
  })
};

export default {
  createRateLimiter,
  rateLimiters
};
