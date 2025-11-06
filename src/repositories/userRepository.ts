import User, { IUser } from '../models/User';
import { IUserRepository, FilterOptions, PaginationOptions, PaginationResult } from '../types/repositories';
import * as crypto from 'crypto';

class UserRepository implements IUserRepository {
  async create(userData: Partial<IUser>): Promise<IUser> {
    return await User.create(userData);
  }

  async findById(id: string, selectPassword: boolean = false): Promise<IUser | null> {
    const query = User.findById(id);
    if (!selectPassword) {
      query.select('-password');
    }
    return await query;
  }

  async findByEmail(email: string, selectPassword: boolean = false): Promise<IUser | null> {
    const query = User.findOne({ email: email.toLowerCase() });
    if (!selectPassword) {
      query.select('-password');
    }
    return await query;
  }

  async findByPhone(phone: string): Promise<IUser | null> {
    return await User.findOne({ phone });
  }

  async findByResetToken(resetToken: string): Promise<IUser | null> {
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    
    return await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpire: { $gt: Date.now() }
    });
  }

  async updateById(id: string, updateData: Partial<IUser>): Promise<IUser | null> {
    return await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
  }

  async deleteById(id: string): Promise<IUser | null> {
    return await User.findByIdAndDelete(id);
  }

  async findAll(filters: FilterOptions = {}, options: PaginationOptions = {}): Promise<PaginationResult<IUser>> {
    const { page = 1, limit = 10, sort = '-createdAt' } = options;
    const skip = (page - 1) * limit;

    const query = User.find(filters).select('-password');
    
    if (sort) {
      query.sort(sort);
    }
    
    if (limit) {
      query.limit(limit).skip(skip);
    }

    const [data, total] = await Promise.all([
      query.exec(),
      User.countDocuments(filters)
    ]);

    return {
      data: data as IUser[],
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async count(filters: FilterOptions = {}): Promise<number> {
    return await User.countDocuments(filters);
  }
}

export default new UserRepository();

