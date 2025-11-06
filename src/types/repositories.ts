import { IUser, IExpert, IAdmin } from './models';
import { PaginationOptions, PaginationResult, FilterOptions } from './services';

export type { PaginationOptions, PaginationResult, FilterOptions };

export interface IUserRepository {
  create(userData: Partial<IUser>): Promise<IUser>;
  findById(id: string, selectPassword?: boolean): Promise<IUser | null>;
  findByEmail(email: string, selectPassword?: boolean): Promise<IUser | null>;
  findByPhone(phone: string): Promise<IUser | null>;
  findByResetToken(resetToken: string): Promise<IUser | null>;
  updateById(id: string, updateData: Partial<IUser>): Promise<IUser | null>;
  deleteById(id: string): Promise<IUser | null>;
  findAll(filters?: FilterOptions, options?: PaginationOptions): Promise<PaginationResult<IUser>>;
  count(filters?: FilterOptions): Promise<number>;
}

export interface IExpertRepository {
  create(expertData: Partial<IExpert>): Promise<IExpert>;
  findById(id: string, selectPassword?: boolean): Promise<IExpert | null>;
  findByEmail(email: string, selectPassword?: boolean): Promise<IExpert | null>;
  findByPhone(phone: string): Promise<IExpert | null>;
  findByResetToken(resetToken: string): Promise<IExpert | null>;
  updateById(id: string, updateData: Partial<IExpert>): Promise<IExpert | null>;
  deleteById(id: string): Promise<IExpert | null>;
  findAll(filters?: FilterOptions, options?: PaginationOptions): Promise<PaginationResult<IExpert>>;
  count(filters?: FilterOptions): Promise<number>;
}

export interface IAdminRepository {
  create(adminData: Partial<IAdmin>): Promise<IAdmin>;
  findById(id: string, selectPassword?: boolean): Promise<IAdmin | null>;
  findByEmail(email: string, selectPassword?: boolean): Promise<IAdmin | null>;
  updateById(id: string, updateData: Partial<IAdmin>): Promise<IAdmin | null>;
  deleteById(id: string): Promise<IAdmin | null>;
  findAll(filters?: FilterOptions, options?: PaginationOptions): Promise<PaginationResult<IAdmin>>;
  count(filters?: FilterOptions): Promise<number>;
}

