import mongoose, { Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

interface IQualification {
  degree?: string;
  institution?: string;
  year?: number;
}

interface ICertification {
  name?: string;
  issuingOrganization?: string;
  issueDate?: Date;
  expiryDate?: Date;
}

interface IRating {
  average: number;
  count: number;
}

interface IAvailabilityDay {
  start?: string;
  end?: string;
  available?: boolean;
}

type Availability = {
  [key: string]: IAvailabilityDay;
};

export interface IExpert extends Document {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password?: string;
  userType: string;
  specialization: string;
  experience: number;
  qualifications: IQualification[];
  certifications: ICertification[];
  bio?: string;
  education?: string;
  profileImage?: string | null;
  documents: {
    filename?: string;
    originalName?: string;
    type?: string;
    uploadDate?: Date;
  }[];
  hourlyRate?: number;
  availability?: Availability;
  languages: string[];
  consultationMethods: string[];
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  isProfileComplete: boolean;
  verificationStatus: string;
  verificationNotes?: string;
  rating: IRating;
  totalSessions: number;
  isActive: boolean;
  isAvailable: boolean;
  isVerified: boolean;
  lastLogin?: Date;
  resetPasswordToken?: string;
  resetPasswordExpire?: Date;
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
  fullName: string;
  name: string;

  // Methods
  matchPassword(enteredPassword: string): Promise<boolean>;
  incLoginAttempts(): Promise<unknown>;
  resetLoginAttempts(): Promise<unknown>;
  generateOTP(): string;
  verifyOTP(enteredOTP: string): { success: boolean; message: string };
  getResetPasswordToken(): string;
}

type ExpertModel = Model<IExpert>;

const expertSchema = new mongoose.Schema<IExpert, ExpertModel>({
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
    required: [true, 'Phone number is required'],
    trim: true,
    match: [/^[+]?[\d\s\-\(\)]{10,}$/, 'Please enter a valid phone number']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  userType: {
    type: String,
    default: 'expert'
  },
  
  // Expert specific fields
  specialization: {
    type: String,
    required: [true, 'Specialization is required'],
    trim: true
  },
  experience: {
    type: Number,
    default: 0,
    min: [0, 'Experience cannot be negative']
  },
  qualifications: [{
    degree: {
      type: String
    },
    institution: {
      type: String,
      default: 'Not specified'
    },
    year: {
      type: Number,
      default: new Date().getFullYear()
    }
  }],
  certifications: [{
    name: {
      type: String
    },
    issuingOrganization: {
      type: String
    },
    issueDate: {
      type: Date
    },
    expiryDate: {
      type: Date
    }
  }],
  bio: {
    type: String,
    maxlength: [1000, 'Bio cannot exceed 1000 characters']
  },
  education: {
    type: String,
    maxlength: [1000, 'Education cannot exceed 1000 characters']
  },
  profileImage: {
    type: String,
    default: null
  },
  documents: [{
    filename: {
      type: String
    },
    originalName: {
      type: String
    },
    type: {
      type: String,
      enum: ['certificate', 'license', 'degree', 'other'],
      default: 'certificate'
    },
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }],
  hourlyRate: {
    type: Number,
    min: [0, 'Hourly rate cannot be negative']
  },
  availability: {
    monday: { start: String, end: String, available: Boolean },
    tuesday: { start: String, end: String, available: Boolean },
    wednesday: { start: String, end: String, available: Boolean },
    thursday: { start: String, end: String, available: Boolean },
    friday: { start: String, end: String, available: Boolean },
    saturday: { start: String, end: String, available: Boolean },
    sunday: { start: String, end: String, available: Boolean }
  },
  languages: [{
    type: String,
    trim: true
  }],
  consultationMethods: [{
    type: String,
    trim: true
  }],
  
  // Verification and approval
  isEmailVerified: {
    type: Boolean,
    default: true
  },
  isPhoneVerified: {
    type: Boolean,
    default: true
  },
  isProfileComplete: {
    type: Boolean,
    default: false
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'under_review', 'approved', 'rejected'],
    default: 'approved'
  },
  verificationNotes: {
    type: String
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  
  // Ratings and reviews
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  totalSessions: {
    type: Number,
    default: 0
  },
  
  // Account status
  isActive: {
    type: Boolean,
    default: true
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  
  // Password reset fields
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  
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

// Index for email, phone, and specialization
expertSchema.index({ email: 1 });
expertSchema.index({ phone: 1 });
expertSchema.index({ specialization: 1 });
expertSchema.index({ verificationStatus: 1 });
expertSchema.index({ 'rating.average': -1 });

// Virtual for account lock status
expertSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil.getTime() > Date.now());
});

// Virtual for OTP lock status
expertSchema.virtual('isOTPLocked').get(function() {
  return !!(this.otpLockedUntil && this.otpLockedUntil.getTime() > Date.now());
});

// Virtual for full name
expertSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for name (to match frontend expectations)
expertSchema.virtual('name').get(function() {
  return `${this.firstName} ${this.lastName}`.trim();
});

// Make sure virtual fields are included in JSON output
expertSchema.set('toJSON', { virtuals: true });
expertSchema.set('toObject', { virtuals: true });

// Pre-save middleware to hash password
expertSchema.pre('save', async function(this: IExpert, next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to check profile completion
expertSchema.pre('save', function(this: IExpert, next) {
  const requiredFields = [
    'firstName', 'lastName', 'email', 'phone', 'specialization', 
    'experience', 'bio', 'hourlyRate'
  ];
  
  const hasQualifications = this.qualifications && this.qualifications.length > 0;
  const allFieldsComplete = requiredFields.every(field => this[field]);
  
  this.isProfileComplete = allFieldsComplete && hasQualifications;
  next();
});

// Instance method to check password
expertSchema.methods.matchPassword = async function(this: IExpert, enteredPassword: string) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Instance method to increment login attempts
expertSchema.methods.incLoginAttempts = function(this: IExpert) {
  if (this.lockUntil && this.lockUntil.getTime() < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates: Record<string, unknown> = { $inc: { loginAttempts: 1 } };
  
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: new Date(Date.now() + 2 * 60 * 60 * 1000) };
  }
  
  return this.updateOne(updates);
};

// Instance method to reset login attempts
expertSchema.methods.resetLoginAttempts = function(this: IExpert) {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Instance method to generate OTP
expertSchema.methods.generateOTP = function(this: IExpert) {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.otpCode = otp;
  const expireMinutes = parseInt(process.env.OTP_EXPIRE_MINUTES || '10', 10);
  this.otpExpire = new Date(Date.now() + expireMinutes * 60 * 1000);
  this.otpAttempts = 0;
  return otp;
};

// Instance method to verify OTP
expertSchema.methods.verifyOTP = function(this: IExpert, enteredOTP: string) {
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
      this.otpLockedUntil = new Date(Date.now() + 30 * 60 * 1000);
    }
    
    return { success: false, message: 'Invalid OTP' };
  }
  
  this.otpCode = undefined;
  this.otpExpire = undefined;
  this.otpAttempts = 0;
  this.otpLockedUntil = undefined;
  
  return { success: true, message: 'OTP verified successfully' };
};

// Instance method to update rating
expertSchema.methods.updateRating = function(newRating) {
  const totalRating = (this.rating.average * this.rating.count) + newRating;
  this.rating.count += 1;
  this.rating.average = totalRating / this.rating.count;
};

// Instance method to generate reset password token
expertSchema.methods.getResetPasswordToken = function(this: IExpert) {
  // Generate token
  const resetToken = crypto.randomBytes(20).toString('hex');
  
  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  // Set expire time (15 minutes)
  this.resetPasswordExpire = new Date(Date.now() + 15 * 60 * 1000);
  
  return resetToken;
};

export default mongoose.model<IExpert>('Expert', expertSchema);