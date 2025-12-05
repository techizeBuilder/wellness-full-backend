import mongoose, { Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password?: string;
  authProvider?: 'password' | 'google' | 'apple';
  googleId?: string;
  googleAvatar?: string | null;
  accountTypeConfirmed?: boolean;
  userType: 'user' | 'expert';
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  profileImage?: string | null;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other';
  bloodGroup?: string | null;
  weightKg?: number | null;
  bloodPressure?: string | null;
  healthProfileUpdatedAt?: Date;
  isActive: boolean;
  lastLogin?: Date;
  passwordResetToken?: string;
  passwordResetExpire?: Date;
  passwordResetRequested: boolean;
  passwordResetRequestTime?: Date;
  passwordResetVerified: boolean;
  otpCode?: string;
  otpExpire?: Date;
  otpAttempts: number;
  otpLockedUntil?: Date;
  loginAttempts: number;
  lockUntil?: Date;
  createdAt: Date;
  updatedAt: Date;

  // Virtuals
  isLocked: boolean;
  isOTPLocked: boolean;
  name: string;

  // Methods
  matchPassword(enteredPassword: string): Promise<boolean>;
  incLoginAttempts(): Promise<unknown>;
  resetLoginAttempts(): Promise<unknown>;
  generateOTP(): string;
  verifyOTP(enteredOTP: string): { success: boolean; message: string };
  getResetPasswordToken(): string;
}

type UserModel = Model<IUser>;

const userSchema = new mongoose.Schema<IUser, UserModel>({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please enter a valid email'
    ]
  },
  phone: {
    type: String,
    required: [
      function(this: IUser) {
        return !this.authProvider || this.authProvider === 'password';
      },
      'Phone number is required'
    ],
    trim: true,
    match: [/^[+]?[\d\s\-\(\)]{10,}$/, 'Please enter a valid phone number']
  },
  authProvider: {
    type: String,
    enum: ['password', 'google', 'apple'],
    default: 'password'
  },
  password: {
    type: String,
    required: [
      function(this: IUser) {
        return !this.authProvider || this.authProvider === 'password';
      },
      'Password is required'
    ],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  googleAvatar: {
    type: String,
    default: null
  },
  accountTypeConfirmed: {
    type: Boolean,
    default: false
  },
  userType: {
    type: String,
    enum: ['user', 'expert'],
    default: 'user'
  },
  isEmailVerified: {
    type: Boolean,
    default: true
  },
  isPhoneVerified: {
    type: Boolean,
    default: true
  },
  profileImage: {
    type: String,
    default: null
  },
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other']
  },
  bloodGroup: {
    type: String,
    uppercase: true,
    trim: true,
    default: null,
    validate: {
      validator: function(value: string | null | undefined) {
        // Allow null or undefined values
        if (value === null || value === undefined || value === '') {
          return true;
        }
        // If value is provided, it must be one of the valid blood groups
        return ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(value);
      },
      message: 'Blood group must be one of: A+, A-, B+, B-, AB+, AB-, O+, O-'
    }
  },
  weightKg: {
    type: Number,
    min: [0, 'Weight cannot be negative'],
    max: [500, 'Weight seems unrealistic'],
    default: null
  },
  bloodPressure: {
    type: String,
    trim: true,
    default: null,
    validate: {
      validator: (value: string | null) => {
        if (!value) return true;
        return /^\d{2,3}\/\d{2,3}$/.test(value);
      },
      message: 'Blood pressure must be in the format S/D (e.g., 120/80)'
    }
  },
  healthProfileUpdatedAt: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  // Password reset fields
  passwordResetToken: String,
  passwordResetExpire: Date,
  passwordResetRequested: {
    type: Boolean,
    default: false
  },
  passwordResetRequestTime: Date,
  passwordResetVerified: {
    type: Boolean,
    default: false
  },
  
  // OTP fields
  otpCode: String,
  otpExpire: Date,
  otpAttempts: {
    type: Number,
    default: 0
  },
  otpLockedUntil: Date,
  
  // Account security
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date
}, {
  timestamps: true
});

// Index for email and phone
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });

// Virtual for account lock status
userSchema.virtual('isLocked').get(function(this: IUser) {
  return !!(this.lockUntil && this.lockUntil.getTime() > Date.now());
});

// Virtual for OTP lock status
userSchema.virtual('isOTPLocked').get(function(this: IUser) {
  return !!(this.otpLockedUntil && this.otpLockedUntil.getTime() > Date.now());
});

// Virtual for full name
userSchema.virtual('name').get(function() {
  return `${this.firstName} ${this.lastName}`.trim();
});

// Make sure virtual fields are included in JSON output
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

// Pre-save middleware to hash password
userSchema.pre('save', async function(this: IUser, next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to check password
userSchema.methods.matchPassword = async function(this: IUser, enteredPassword: string) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Instance method to increment login attempts
userSchema.methods.incLoginAttempts = function(this: IUser) {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil.getTime() < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates: Record<string, unknown> = { $inc: { loginAttempts: 1 } };
  
  // If we're at max attempts and not locked, lock the account
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: new Date(Date.now() + 2 * 60 * 60 * 1000) }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Instance method to reset login attempts
userSchema.methods.resetLoginAttempts = function(this: IUser) {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Instance method to generate OTP
userSchema.methods.generateOTP = function(this: IUser) {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.otpCode = otp;
  const expireMinutes = parseInt(process.env.OTP_EXPIRE_MINUTES || '10', 10);
  this.otpExpire = new Date(Date.now() + expireMinutes * 60 * 1000);
  this.otpAttempts = 0;
  return otp;
};

// Instance method to verify OTP
userSchema.methods.verifyOTP = function(this: IUser, enteredOTP: string) {
  if (this.isOTPLocked) {
    return { success: false, message: 'OTP verification locked due to too many attempts' };
  }
  
  if (!this.otpCode || !this.otpExpire) {
    return { success: false, message: 'No OTP found. Please request a new one.' };
  }
  
  if (this.otpExpire.getTime() < Date.now()) {
    return { success: false, message: 'OTP has expired. Please request a new one.' };
  }
  
  if (this.otpCode !== enteredOTP) {
    this.otpAttempts += 1;
    
    if (this.otpAttempts >= 3) {
      this.otpLockedUntil = new Date(Date.now() + 30 * 60 * 1000); // Lock for 30 minutes
    }
    
    return { success: false, message: 'Invalid OTP' };
  }
  
  // Clear OTP fields on successful verification
  this.otpCode = undefined;
  this.otpExpire = undefined;
  this.otpAttempts = 0;
  this.otpLockedUntil = undefined;
  
  return { success: true, message: 'OTP verified successfully' };
};

// Instance method to generate reset password token
userSchema.methods.getResetPasswordToken = function(this: IUser) {
  // Generate token
  const resetToken = crypto.randomBytes(20).toString('hex');
  
  // Hash token and set to passwordResetToken field
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  // Set expire time (10 minutes)
  this.passwordResetExpire = new Date(Date.now() + 10 * 60 * 1000);
  
  return resetToken;
};

export default mongoose.model<IUser>('User', userSchema);