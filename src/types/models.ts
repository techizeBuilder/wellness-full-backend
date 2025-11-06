import { Document } from 'mongoose';

export type UserType = 'user' | 'expert' | 'admin';
export type Gender = 'male' | 'female' | 'other';
export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type AdminRole = 'superadmin' | 'admin';

export interface IUser extends Document {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  userType: UserType;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  profileImage?: string | null;
  dateOfBirth?: Date;
  gender?: Gender;
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
  incLoginAttempts(): Promise<void>;
  resetLoginAttempts(): Promise<void>;
  generateOTP(): string;
  verifyOTP(enteredOTP: string): { success: boolean; message: string };
  getResetPasswordToken(): string;
}

export interface IQualification {
  degree: string;
  institution: string;
  year: number;
}

export interface ICertification {
  name: string;
  issuingOrganization: string;
  issueDate: Date;
  expiryDate?: Date;
}

export interface IDocument {
  filename: string;
  originalName: string;
  type: 'certificate' | 'license' | 'degree' | 'other';
  uploadedAt: Date;
}

export interface IAvailability {
  [key: string]: {
    start: string;
    end: string;
    available: boolean;
  };
}

export interface IExpert extends IUser {
  specialization: string;
  experience: number;
  qualifications: IQualification[];
  certifications: ICertification[];
  bio?: string;
  documents: IDocument[];
  hourlyRate: number;
  languages: string[];
  consultationMethods: string[];
  availability: IAvailability;
  rating: number;
  totalReviews: number;
  verificationStatus: VerificationStatus;
  verifiedAt?: Date;
  rejectionReason?: string;
}

export interface IAdmin extends Document {
  _id: string;
  name: string;
  email: string;
  password: string;
  role: AdminRole;
  permissions: string[];
  isActive: boolean;
  isPrimary: boolean;
  lastLogin?: Date;
  resetPasswordToken?: string;
  resetPasswordExpiry?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  matchPassword(enteredPassword: string): Promise<boolean>;
}

export interface IPermission extends Document {
  _id: string;
  key: string;
  label: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISubscription extends Document {
  _id: string;
  name: string;
  description: string;
  price: number;
  duration: number; // in days
  features: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

