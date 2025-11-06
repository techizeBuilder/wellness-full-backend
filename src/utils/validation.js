const Joi = require('joi');

// User registration validation
const userRegisterSchema = Joi.object({
  firstName: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.empty': 'First name is required',
      'string.min': 'First name must be at least 2 characters long',
      'string.max': 'First name cannot exceed 50 characters'
    }),
  
  lastName: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.empty': 'Last name is required',
      'string.min': 'Last name must be at least 2 characters long',
      'string.max': 'Last name cannot exceed 50 characters'
    }),
  
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.email': 'Please enter a valid email address',
      'string.empty': 'Email is required'
    }),
  
  phone: Joi.string()
    .pattern(/^\d{10}$/)
    .required()
    .messages({
      'string.pattern.base': 'Phone number must be exactly 10 digits',
      'string.empty': 'Phone number is required'
    }),
  
  password: Joi.string()
    .min(6)
    .required()
    .messages({
      'string.min': 'Password must be at least 6 characters long',
      'string.empty': 'Password is required'
    }),
  
  dateOfBirth: Joi.date()
    .max('now')
    .optional(),
  
  gender: Joi.string()
    .valid('male', 'female', 'other')
    .optional()
});

// Expert registration validation
const expertRegisterSchema = Joi.object({
  firstName: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.empty': 'First name is required',
      'string.min': 'First name must be at least 2 characters long'
    }),
  
  lastName: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.empty': 'Last name is required',
      'string.min': 'Last name must be at least 2 characters long'
    }),
  
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.email': 'Please enter a valid email address',
      'string.empty': 'Email is required'
    }),
  
  phone: Joi.string()
    .pattern(/^\d{10}$/)
    .required()
    .messages({
      'string.pattern.base': 'Phone number must be exactly 10 digits',
      'string.empty': 'Phone number is required'
    }),
  
  password: Joi.string()
    .min(6)
    .required()
    .messages({
      'string.min': 'Password must be at least 6 characters long',
      'string.empty': 'Password is required'
    }),
  
  specialization: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.empty': 'Specialization is required',
      'string.min': 'Specialization must be at least 2 characters long'
    }),
  
  experience: Joi.number()
    .integer()
    .min(0)
    .max(50)
    .optional()
    .messages({
      'number.base': 'Experience must be a number',
      'number.min': 'Experience cannot be negative',
      'number.max': 'Experience cannot exceed 50 years'
    }),
  
  bio: Joi.string()
    .trim()
    .max(1000)
    .optional()
    .messages({
      'string.max': 'Bio cannot exceed 1000 characters'
    }),
  
  hourlyRate: Joi.number()
    .min(0)
    .optional()
    .messages({
      'number.min': 'Hourly rate cannot be negative'
    }),
  
  qualifications: Joi.array()
    .items(
      Joi.object({
        degree: Joi.string().required(),
        institution: Joi.string().required(),
        year: Joi.number().integer().min(1950).max(new Date().getFullYear()).required()
      })
    )
    .optional()
    .messages({
      'array.min': 'At least one qualification is required'
    }),
  
  languages: Joi.array()
    .items(Joi.string().trim())
    .optional(),
  
  consultationMethods: Joi.array()
    .items(Joi.string().valid('video', 'audio', 'chat', 'in-person'))
    .optional()
}).messages({
  'object.base': 'Please provide valid registration data'
});

// Login validation
const loginSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.email': 'Please enter a valid email address',
      'string.empty': 'Email is required'
    }),
  
  password: Joi.string()
    .required()
    .messages({
      'string.empty': 'Password is required'
    }),
  
  userType: Joi.string()
    .valid('user', 'expert')
    .optional()
});

// Forgot password validation
const forgotPasswordSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.email': 'Please enter a valid email address',
      'string.empty': 'Email is required'
    }),
  
  userType: Joi.string()
    .valid('user', 'expert')
    .optional()
});

// Reset password with token validation (New 3-step flow)
const resetPasswordWithTokenSchema = Joi.object({
  resetToken: Joi.string()
    .required()
    .messages({
      'string.empty': 'Reset token is required'
    }),
  
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.max': 'Password cannot exceed 128 characters',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      'string.empty': 'Password is required'
    }),

  confirmPassword: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .messages({
      'any.only': 'Passwords do not match',
      'string.empty': 'Confirm password is required'
    })
});

// OTP verification validation
const otpVerificationSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.email': 'Please enter a valid email address',
      'string.empty': 'Email is required'
    }),
  
  otp: Joi.string()
    .length(6)
    .pattern(/^\d+$/)
    .required()
    .messages({
      'string.length': 'OTP must be 6 digits',
      'string.pattern.base': 'OTP must contain only numbers',
      'string.empty': 'OTP is required'
    }),
  
  type: Joi.string()
    .valid('email_verification', 'password_reset')
    .optional()
    .default('email_verification'),
  
  userType: Joi.string()
    .valid('user', 'expert')
    .optional()
});

// Change password validation
const changePasswordSchema = Joi.object({
  currentPassword: Joi.string()
    .required()
    .messages({
      'string.empty': 'Current password is required'
    }),
  
  newPassword: Joi.string()
    .min(6)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.min': 'Password must be at least 6 characters long',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    }),
  
  confirmNewPassword: Joi.string()
    .valid(Joi.ref('newPassword'))
    .required()
    .messages({
      'any.only': 'Passwords do not match'
    })
});

// Update profile validation
const updateProfileSchema = Joi.object({
  firstName: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .optional(),
  
  lastName: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .optional(),
  
  phone: Joi.string()
    .pattern(/^[+]?[\d\s\-\(\)]{10,}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Please enter a valid phone number'
    }),
  
  dateOfBirth: Joi.date()
    .max('now')
    .optional(),
  
  gender: Joi.string()
    .valid('male', 'female', 'other')
    .optional()
});

// Update expert profile validation
const updateExpertProfileSchema = Joi.object({
  firstName: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .optional(),
  
  lastName: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .optional(),
  
  phone: Joi.string()
    .pattern(/^[+]?[\d\s\-\(\)]{10,}$/)
    .optional(),
  
  specialization: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .optional(),
  
  experience: Joi.number()
    .integer()
    .min(0)
    .max(50)
    .optional(),
  
  bio: Joi.string()
    .trim()
    .max(1000)
    .optional(),
  
  hourlyRate: Joi.number()
    .min(0)
    .optional(),
  
  qualifications: Joi.array()
    .items(
      Joi.object({
        degree: Joi.string().required(),
        institution: Joi.string().required(),
        year: Joi.number().integer().min(1950).max(new Date().getFullYear()).required()
      })
    )
    .optional(),
  
  languages: Joi.array()
    .items(Joi.string().trim())
    .optional(),
  
  consultationMethods: Joi.array()
    .items(Joi.string().valid('video', 'audio', 'chat', 'in-person'))
    .optional(),
  
  availability: Joi.object({
    monday: Joi.object({
      start: Joi.string().optional(),
      end: Joi.string().optional(),
      available: Joi.boolean().optional()
    }).optional(),
    tuesday: Joi.object({
      start: Joi.string().optional(),
      end: Joi.string().optional(),
      available: Joi.boolean().optional()
    }).optional(),
    wednesday: Joi.object({
      start: Joi.string().optional(),
      end: Joi.string().optional(),
      available: Joi.boolean().optional()
    }).optional(),
    thursday: Joi.object({
      start: Joi.string().optional(),
      end: Joi.string().optional(),
      available: Joi.boolean().optional()
    }).optional(),
    friday: Joi.object({
      start: Joi.string().optional(),
      end: Joi.string().optional(),
      available: Joi.boolean().optional()
    }).optional(),
    saturday: Joi.object({
      start: Joi.string().optional(),
      end: Joi.string().optional(),
      available: Joi.boolean().optional()
    }).optional(),
    sunday: Joi.object({
      start: Joi.string().optional(),
      end: Joi.string().optional(),
      available: Joi.boolean().optional()
    }).optional()
  }).optional()
});

// Validation middleware with FormData support
const validate = (schema) => {
  return (req, res, next) => {
    // Use req.body for validation, which should work for both JSON and parsed FormData
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      const errors = error.details.map(detail => detail.message);
      const message = errors.join(', ');
      return res.status(400).json({
        success: false,
        message: message,
        errors: errors,
        type: 'validation_error'
      });
    }
    next();
  };
};

// Flexible validation for registration that can handle both JSON and FormData
const validateUserRegistration = (req, res, next) => {
  // Parse data from either JSON body or FormData
  let userData = {};
  
  if (req.body) {
    userData = req.body;
  }
  
  const { error } = userRegisterSchema.validate(userData, { abortEarly: false });
  if (error) {
    const errors = error.details.map(detail => detail.message);
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors
    });
  }
  next();
};

module.exports = {
  userRegisterSchema,
  expertRegisterSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordWithTokenSchema,
  otpVerificationSchema,
  changePasswordSchema,
  updateProfileSchema,
  updateExpertProfileSchema,
  validate,
  validateUserRegistration
};