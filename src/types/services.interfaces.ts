import { IUser, IExpert } from './models';
import type {
  AuthResult,
  RegisterUserData,
  RegisterExpertData,
  LoginCredentials,
  UpdateProfileData,
  UpdateExpertProfileData,
  PaginationOptions,
  PaginationResult,
  FilterOptions
} from './services';

export interface IAuthService {
  registerUser(userData: RegisterUserData): Promise<{ message: string; email: string }>;
  verifyRegistrationOTP(email: string, otp: string): Promise<AuthResult>;
  loginUser(email: string, password: string): Promise<
    AuthResult | { requiresVerification: true; email: string; message: string; verificationType: 'email' | 'login' }
  >;
  loginExpert(email: string, password: string): Promise<AuthResult>;
  sendOTP(email: string, userType?: 'user' | 'expert'): Promise<{ message: string }>;
  verifyOTP(email: string, otp: string, userType?: 'user' | 'expert'): Promise<{ message: string } | AuthResult>;
  forgotPassword(email: string, userType?: 'user' | 'expert'): Promise<{ message: string }>;
  resetPassword(resetToken: string, newPassword: string, userType?: 'user' | 'expert'): Promise<{ message: string }>;
  changePassword(userId: string, currentPassword: string, newPassword: string, userType?: 'user' | 'expert'): Promise<{ message: string }>;
}

export interface IUserService {
  getCurrentUser(userId: string): Promise<IUser>;
  updateProfile(userId: string, updateData: UpdateProfileData): Promise<IUser>;
  getAllUsers(filters?: FilterOptions, options?: PaginationOptions): Promise<PaginationResult<IUser>>;
  getUserById(userId: string): Promise<IUser>;
  deleteUser(userId: string): Promise<IUser>;
}

export interface IExpertService {
  registerExpert(expertData: RegisterExpertData): Promise<IExpert>;
  getCurrentExpert(expertId: string): Promise<IExpert>;
  updateProfile(expertId: string, updateData: UpdateExpertProfileData): Promise<IExpert>;
  getAllExperts(filters?: FilterOptions, options?: PaginationOptions): Promise<PaginationResult<IExpert>>;
  getExpertById(expertId: string): Promise<IExpert>;
  deleteExpert(expertId: string): Promise<IExpert>;
}

export type {
  AuthResult,
  RegisterUserData,
  RegisterExpertData,
  LoginCredentials,
  UpdateProfileData,
  UpdateExpertProfileData,
  PaginationOptions,
  PaginationResult,
  FilterOptions
} from './services';

