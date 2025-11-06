import { IUser, IExpert } from './models';

export interface AuthResult {
  user: IUser | IExpert;
  token: string;
  refreshToken: string;
}

export interface RegisterUserData {
  firstName: string;
  lastName?: string;
  email: string;
  phone: string;
  password: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other';
}

export interface RegisterExpertData extends RegisterUserData {
  specialization: string;
  experience?: number;
  bio?: string;
  hourlyRate?: number;
  qualifications?: any[];
  languages?: string[];
  consultationMethods?: string[];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  profileImage?: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other';
  [key: string]: any;
}

export interface UpdateExpertProfileData extends UpdateProfileData {
  specialization?: string;
  experience?: number;
  bio?: string;
  hourlyRate?: number;
  qualifications?: any[];
  certifications?: any[];
  languages?: string[];
  consultationMethods?: string[];
  availability?: any;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sort?: string;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface FilterOptions {
  specialization?: string;
  minRating?: number;
  maxPrice?: number;
  verificationStatus?: string;
  [key: string]: any;
}

