export type UserType = 'user' | 'expert' | 'admin';
export type Gender = 'male' | 'female' | 'other';
export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type AdminRole = 'superadmin' | 'admin';
export type { IUser } from '../models/User';
export type { IExpert } from '../models/Expert';
export type { IAdmin } from '../models/Admin';

