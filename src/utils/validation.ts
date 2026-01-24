import Joi, { ObjectSchema } from 'joi';
import { Request, Response, NextFunction } from 'express';
import { validateEmailStrict } from './emailValidation';

export const userRegisterSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50).pattern(/^[a-zA-Z0-9\s_]+$/).required().messages({
    'string.empty': 'Full Name is required.',
    'string.min': 'Full Name must be at least 2 characters long.',
    'string.max': 'Full Name cannot exceed 50 characters.',
    'string.pattern.base': 'Full Name can only contain letters, numbers, spaces, and underscores.'
  }),
  lastName: Joi.string().trim().min(2).max(50).pattern(/^[a-zA-Z0-9\s_]+$/).required().messages({
    'string.empty': 'Full Name is required.',
    'string.min': 'Full Name must be at least 2 characters long.',
    'string.max': 'Full Name cannot exceed 50 characters.',
    'string.pattern.base': 'Full Name can only contain letters, numbers, spaces, and underscores.'
  }),
  email: Joi.string().email({ tlds: { allow: false } }).required().messages({
    'string.email': 'Please enter a valid email address.',
    'string.empty': 'Email is required.'
  }),
  phone: Joi.string().pattern(/^\d{10}$/).custom((value, helpers) => {
    // Check for repetitive patterns (all digits the same)
    if (/^(\d)\1{9}$/.test(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  }).required().messages({
    'string.pattern.base': 'Phone Number must be exactly 10 digits.',
    'string.empty': 'Phone Number is required.',
    'any.invalid': 'Phone Number cannot have all digits the same.'
  }),
  password: Joi.string().min(6).max(128).required().messages({
    'string.min': 'Password must be at least 6 characters long.',
    'string.max': 'Password cannot exceed 128 characters.',
    'string.empty': 'Password is required.'
  }),
  dateOfBirth: Joi.date().max('now').optional(),
  gender: Joi.string().valid('male', 'female', 'other').optional()
});

export const expertRegisterSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50).pattern(/^[a-zA-Z\s_]+$/).required().messages({
    'string.empty': 'Full Name is required.',
    'string.min': 'Full Name must be at least 2 characters long.',
    'string.max': 'Full Name cannot exceed 50 characters.',
    'string.pattern.base': 'Full Name can only contain letters, spaces, and underscores.'
  }),
  lastName: Joi.string().trim().min(2).max(50).pattern(/^[a-zA-Z\s_]+$/).required().messages({
    'string.empty': 'Full Name is required.',
    'string.min': 'Full Name must be at least 2 characters long.',
    'string.max': 'Full Name cannot exceed 50 characters.',
    'string.pattern.base': 'Full Name can only contain letters, spaces, and underscores.'
  }),
  email: Joi.string().email({ tlds: { allow: false } }).required().messages({
    'string.email': 'Please enter a valid email address.',
    'string.empty': 'Email is required.'
  }),
  phone: Joi.string().pattern(/^\d{10}$/).custom((value, helpers) => {
    // Check for repetitive patterns (all digits the same)
    if (/^(\d)\1{9}$/.test(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  }).required().messages({
    'string.pattern.base': 'Phone Number must be exactly 10 digits.',
    'string.empty': 'Phone Number is required.',
    'any.invalid': 'Phone Number cannot have all digits the same.'
  }),
  password: Joi.string().min(6).max(128).required().messages({
    'string.min': 'Password must be at least 6 characters long.',
    'string.max': 'Password cannot exceed 128 characters.',
    'string.empty': 'Password is required.'
  }),
  specialization: Joi.string().trim().min(2).max(100).required().messages({
    'string.empty': 'Please select your specialization.',
    'string.min': 'Specialization must be at least 2 characters long.'
  }),
  experience: Joi.number().integer().min(0).max(50).optional().messages({
    'number.base': 'Please enter a valid non-negative whole number for years of experience.',
    'number.min': 'Experience cannot be negative.',
    'number.max': 'Experience cannot exceed 50 years.'
  }),
  bio: Joi.string().trim().max(1000).optional().messages({ 'string.max': 'Bio cannot exceed 1000 characters.' }),
  hourlyRate: Joi.number().min(0).optional().messages({ 'number.min': 'Please enter a valid non-negative consultation fee.' }),
  qualifications: Joi.array().items(Joi.object({
    degree: Joi.string().required(),
    institution: Joi.string().required(),
    year: Joi.number().integer().min(1950).max(new Date().getFullYear()).required()
  })).optional().messages({ 'array.min': 'At least one qualification is required.' }),
  languages: Joi.array().items(Joi.string().trim()).optional(),
  consultationMethods: Joi.array().items(Joi.string().valid('video', 'audio', 'chat', 'in-person')).optional()
}).messages({ 'object.base': 'Please provide valid registration data.' });

export const loginSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required().messages({
    'string.email': 'Please enter a valid email address.',
    'string.empty': 'Email is required.'
  }),
  password: Joi.string().required().messages({ 'string.empty': 'Password is required.' }),
  userType: Joi.string().valid('user', 'expert').optional()
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required().messages({
    'string.email': 'Please enter a valid email address.',
    'string.empty': 'Email is required.'
  }),
  userType: Joi.string().valid('user', 'expert').optional()
});

export const googleLoginSchema = Joi.object({
  idToken: Joi.string().required().messages({
    'string.empty': 'Google ID token is required'
  })
});

export const completeOnboardingSchema = Joi.object({
  googleUserId: Joi.string().required().messages({
    'string.empty': 'User ID is required'
  }),
  accountType: Joi.string().valid('Expert', 'User').required().messages({
    'any.only': 'Account type must be either "Expert" or "User"',
    'string.empty': 'Account type is required'
  })
});

export const updateGoogleUserProfileSchema = Joi.object({
  userId: Joi.string().required().messages({
    'string.empty': 'User ID is required.'
  }),
  firstName: Joi.string().trim().min(2).max(50).optional(),
  lastName: Joi.string().trim().min(2).max(50).optional(),
  phone: Joi.string().pattern(/^\d{10}$/).custom((value, helpers) => {
    // Check for repetitive patterns (all digits the same)
    if (/^(\d)\1{9}$/.test(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  }).required().messages({
    'string.pattern.base': 'Phone Number must be exactly 10 digits.',
    'string.empty': 'Phone Number is required.',
    'any.invalid': 'Phone Number cannot have all digits the same.'
  })
});

export const updateGoogleExpertProfileSchema = Joi.object({
  userId: Joi.string().required().messages({
    'string.empty': 'User ID is required.'
  }),
  firstName: Joi.string().trim().min(2).max(50).optional(),
  lastName: Joi.string().trim().min(2).max(50).optional(),
  phone: Joi.string().pattern(/^\d{10}$/).custom((value, helpers) => {
    // Check for repetitive patterns (all digits the same)
    if (/^(\d)\1{9}$/.test(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  }).required().messages({
    'string.pattern.base': 'Phone Number must be exactly 10 digits.',
    'string.empty': 'Phone Number is required.',
    'any.invalid': 'Phone Number cannot have all digits the same.'
  }),
  specialization: Joi.string().trim().min(2).max(100).required().messages({
    'string.empty': 'Please select your specialization.',
    'string.min': 'Specialization must be at least 2 characters long.'
  }),
  experience: Joi.number().integer().min(0).max(50).optional().messages({
    'number.base': 'Please enter a valid non-negative whole number for years of experience.',
    'number.min': 'Experience cannot be negative.',
    'number.max': 'Experience cannot exceed 50 years.'
  }),
  bio: Joi.string().trim().max(1000).optional().messages({
    'string.max': 'Bio cannot exceed 1000 characters.'
  }),
  hourlyRate: Joi.number().min(0).optional().messages({
    'number.min': 'Please enter a valid non-negative consultation fee.'
  })
});

const passwordMessage = 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character';

export const resetPasswordSchema = Joi.object({
  token: Joi.string().required().messages({ 'string.empty': 'Reset token is required' }),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.max': 'Password cannot exceed 128 characters',
      'string.pattern.base': passwordMessage,
      'string.empty': 'Password is required'
    })
});

export const resetPasswordWithTokenSchema = Joi.object({
  resetToken: Joi.string().required().messages({ 'string.empty': 'Reset token is required' }),
  password: Joi.string().min(8).max(128).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required().messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.max': 'Password cannot exceed 128 characters',
    'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    'string.empty': 'Password is required'
  }),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
    'any.only': 'Passwords do not match',
    'string.empty': 'Confirm password is required'
  })
});

export const resetPasswordWithOTPSchema = Joi.object({
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.max': 'Password cannot exceed 128 characters',
      'string.pattern.base': passwordMessage,
      'string.empty': 'Password is required'
    })
});

export const otpVerificationSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required().messages({
    'string.email': 'Please enter a valid email address',
    'string.empty': 'Email is required'
  }),
  otp: Joi.string().length(6).pattern(/^\d+$/).required().messages({
    'string.length': 'OTP must be 6 digits',
    'string.pattern.base': 'OTP must contain only numbers',
    'string.empty': 'OTP is required'
  }),
  type: Joi.string().valid('email_verification', 'password_reset').optional().default('email_verification'),
  userType: Joi.string().valid('user', 'expert').optional()
});

export const passwordResetOTPVerificationSchema = Joi.object({
  otp: Joi.string().length(6).pattern(/^\d+$/).required().messages({
    'string.length': 'OTP must be 6 digits',
    'string.pattern.base': 'OTP must contain only numbers',
    'string.empty': 'OTP is required'
  })
});

export const resetPasswordWithOTPSchemaProtected = Joi.object({
  otp: Joi.string().length(6).pattern(/^\d+$/).required().messages({
    'string.length': 'OTP must be 6 digits',
    'string.pattern.base': 'OTP must contain only numbers',
    'string.empty': 'OTP is required'
  }),
  password: Joi.string()
    .min(6)
    .max(128)
    .required()
    .messages({
      'string.min': 'Password must be at least 6 characters long',
      'string.max': 'Password cannot exceed 128 characters',
      'string.empty': 'Password is required'
    })
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({ 'string.empty': 'Current password is required' }),
  newPassword: Joi.string().min(6).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required().messages({
    'string.min': 'Password must be at least 6 characters long',
    'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
  }),
  confirmNewPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({ 'any.only': 'Passwords do not match' })
});

export const updateProfileSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50).optional(),
  lastName: Joi.string().trim().min(2).max(50).optional(),
  phone: Joi.string().pattern(/^[+]?[\d\s\-\(\)]{10,}$/).optional().messages({ 'string.pattern.base': 'Please enter a valid phone number' }),
  dateOfBirth: Joi.date().max('now').optional(),
  gender: Joi.string().valid('male', 'female', 'other').optional(),
  bloodGroup: Joi.string().valid('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-').uppercase().trim().allow(null).optional(),
  weightKg: Joi.number().min(0).max(500).allow(null).optional().messages({ 
    'number.min': 'Weight cannot be negative',
    'number.max': 'Weight seems unrealistic'
  }),
  bloodPressure: Joi.string().pattern(/^\d{2,3}\/\d{2,3}$/).trim().allow(null).optional().messages({
    'string.pattern.base': 'Blood pressure must be in the format S/D (e.g., 120/80)'
  })
});

export const updateExpertProfileSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50).optional(),
  lastName: Joi.string().trim().min(2).max(50).optional(),
  phone: Joi.string().pattern(/^[+]?[\d\s\-\(\)]{10,}$/).optional(),
  specialization: Joi.string().trim().min(2).max(100).optional(),
  experience: Joi.number().integer().min(0).max(50).optional(),
  bio: Joi.string().trim().max(1000).optional(),
  education: Joi.string().trim().max(1000).optional(),
  hourlyRate: Joi.number().min(0).max(100000).optional(),
  qualifications: Joi.array().items(Joi.object({
    degree: Joi.string().required(),
    institution: Joi.string().required(),
    year: Joi.number().integer().min(1950).max(new Date().getFullYear()).required()
  })).optional(),
  languages: Joi.array().items(Joi.string().trim()).optional(),
  consultationMethods: Joi.array().items(Joi.string().trim()).optional(),
  sessionType: Joi.array().items(Joi.string().valid('one-on-one', 'one-to-many')).optional(),
  specialties: Joi.array().items(Joi.string().trim()).optional(),
  availability: Joi.object().optional()
});

export const bankAccountSchema = Joi.object({
  accountHolderName: Joi.string().trim().min(2).max(100).required().messages({
    'string.empty': 'Account holder name is required',
    'string.min': 'Account holder name must be at least 2 characters long',
    'string.max': 'Account holder name cannot exceed 100 characters'
  }),
  accountNumber: Joi.string().pattern(/^\d{9,18}$/).required().messages({
    'string.empty': 'Account number is required',
    'string.pattern.base': 'Account number must be between 9 and 18 digits'
  }),
  bankName: Joi.string().trim().min(2).max(100).required().messages({
    'string.empty': 'Bank name is required',
    'string.min': 'Bank name must be at least 2 characters long',
    'string.max': 'Bank name cannot exceed 100 characters'
  }),
  ifscCode: Joi.string().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/).required().messages({
    'string.empty': 'IFSC code is required',
    'string.pattern.base': 'Please enter a valid IFSC code (e.g., ABCD0123456)'
  }),
  branchName: Joi.string().trim().max(100).optional().messages({
    'string.max': 'Branch name cannot exceed 100 characters'
  }),
  accountType: Joi.string().valid('savings', 'current').required().messages({
    'any.only': 'Account type must be either "savings" or "current"',
    'string.empty': 'Account type is required'
  })
});

export const validate = (schema: ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      const errors = error.details.map(detail => detail.message);
      const message = errors.join(', ');
      return res.status(400).json({ success: false, message, errors, type: 'validation_error' });
    }
    next();
  };
};

export const validateUserRegistration = (req: Request, res: Response, next: NextFunction) => {
  const userData = req.body || {};
  const { error } = userRegisterSchema.validate(userData, { abortEarly: false });
  if (error) {
    const errors = error.details.map(detail => detail.message);
    return res.status(400).json({ success: false, message: 'Validation error', errors });
  }
  next();
};

export default {
  userRegisterSchema,
  expertRegisterSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resetPasswordWithTokenSchema,
  resetPasswordWithOTPSchema,
  otpVerificationSchema,
  changePasswordSchema,
  updateProfileSchema,
  updateExpertProfileSchema,
  bankAccountSchema,
  validate,
  validateUserRegistration
};
