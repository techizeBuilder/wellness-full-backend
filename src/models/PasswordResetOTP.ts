import mongoose, { Document, Model } from 'mongoose';

export interface IPasswordResetOTP extends Document {
  email: string;
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

type PasswordResetOTPModel = Model<IPasswordResetOTP>;

const passwordResetOTPSchema = new mongoose.Schema<IPasswordResetOTP, PasswordResetOTPModel>({
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please enter a valid email'
    ]
  },
  userType: {
    type: String,
    required: [true, 'User type is required'],
    enum: ['user', 'expert']
  },
  otpCode: {
    type: String,
    select: false // Don't include in queries by default
  },
  otpExpire: {
    type: Date,
    select: false
  },
  otpAttempts: {
    type: Number,
    default: 0,
    select: false
  },
  otpLockedUntil: {
    type: Date,
    select: false
  }
}, {
  timestamps: true
});

// Index for email and userType combination
passwordResetOTPSchema.index({ email: 1, userType: 1 }, { unique: true });
// TTL index to auto-delete documents after 1 hour (for security)
passwordResetOTPSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 }); // Auto-delete after 1 hour

// Virtual for OTP lock status
passwordResetOTPSchema.virtual('isOTPLocked').get(function(this: IPasswordResetOTP) {
  return !!(this.otpLockedUntil && this.otpLockedUntil.getTime() > Date.now());
});

// Make sure virtual fields are included in JSON output
passwordResetOTPSchema.set('toJSON', { virtuals: true });
passwordResetOTPSchema.set('toObject', { virtuals: true });

// Instance method to generate OTP
passwordResetOTPSchema.methods.generateOTP = function(this: IPasswordResetOTP) {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.otpCode = otp;
  const expireMinutes = parseInt(process.env.OTP_EXPIRE_MINUTES || '10', 10);
  this.otpExpire = new Date(Date.now() + expireMinutes * 60 * 1000);
  this.otpAttempts = 0;
  this.otpLockedUntil = undefined;
  return otp;
};

// Instance method to verify OTP
passwordResetOTPSchema.methods.verifyOTP = function(this: IPasswordResetOTP, enteredOTP: string) {
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
  
  return { success: true, message: 'OTP verified successfully' };
};

export default mongoose.model<IPasswordResetOTP>('PasswordResetOTP', passwordResetOTPSchema);