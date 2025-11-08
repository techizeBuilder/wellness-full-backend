import mongoose, { Document, Model } from 'mongoose';

export interface IPendingRegistration extends Document {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other';
  userType: 'user' | 'expert';
  otpCode: string;
  otpExpire: Date;
  otpAttempts: number;
  otpLockedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;

  // Virtuals
  isOTPLocked: boolean;

  // Methods
  generateOTP(): string;
  verifyOTP(enteredOTP: string): { success: boolean; message: string };
}

type PendingRegistrationModel = Model<IPendingRegistration>;

const pendingRegistrationSchema = new mongoose.Schema<IPendingRegistration, PendingRegistrationModel>({
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
    minlength: [6, 'Password must be at least 6 characters']
  },
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other']
  },
  userType: {
    type: String,
    enum: ['user', 'expert'],
    default: 'user'
  },
  // OTP fields
  otpCode: {
    type: String,
    required: true
  },
  otpExpire: {
    type: Date,
    required: true
  },
  otpAttempts: {
    type: Number,
    default: 0
  },
  otpLockedUntil: Date
}, {
  timestamps: true
});

// Index for email
pendingRegistrationSchema.index({ email: 1 });
// TTL index to auto-delete documents after 24 hours
pendingRegistrationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 }); // Auto-delete after 24 hours

// Virtual for OTP lock status
pendingRegistrationSchema.virtual('isOTPLocked').get(function(this: IPendingRegistration) {
  return !!(this.otpLockedUntil && this.otpLockedUntil.getTime() > Date.now());
});

// Make sure virtual fields are included in JSON output
pendingRegistrationSchema.set('toJSON', { virtuals: true });
pendingRegistrationSchema.set('toObject', { virtuals: true });

// Instance method to generate OTP
pendingRegistrationSchema.methods.generateOTP = function(this: IPendingRegistration) {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.otpCode = otp;
  const expireMinutes = parseInt(process.env.OTP_EXPIRE_MINUTES || '10', 10);
  this.otpExpire = new Date(Date.now() + expireMinutes * 60 * 1000);
  this.otpAttempts = 0;
  this.otpLockedUntil = undefined;
  return otp;
};

// Instance method to verify OTP
pendingRegistrationSchema.methods.verifyOTP = function(this: IPendingRegistration, enteredOTP: string) {
  if (this.isOTPLocked) {
    return { success: false, message: 'OTP verification locked due to too many attempts. Please request a new OTP.' };
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
  this.otpCode = undefined as any;
  this.otpExpire = undefined as any;
  this.otpAttempts = 0;
  this.otpLockedUntil = undefined;
  
  return { success: true, message: 'OTP verified successfully' };
};

export default mongoose.model<IPendingRegistration>('PendingRegistration', pendingRegistrationSchema);

