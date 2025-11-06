import Expert, { IExpert } from '../models/Expert';
import { IExpertRepository, FilterOptions, PaginationOptions, PaginationResult } from '../types/repositories';
import * as crypto from 'crypto';

class ExpertRepository implements IExpertRepository {
  async create(expertData: Partial<IExpert>): Promise<IExpert> {
    return await Expert.create(expertData);
  }

  async findById(id: string, selectPassword: boolean = false): Promise<IExpert | null> {
    const query = Expert.findById(id);
    if (!selectPassword) {
      query.select('-password');
    }
    return await query;
  }

  async findByEmail(email: string, selectPassword: boolean = false): Promise<IExpert | null> {
    const query = Expert.findOne({ email: email.toLowerCase() });
    if (!selectPassword) {
      query.select('-password');
    }
    return await query;
  }

  async findByPhone(phone: string): Promise<IExpert | null> {
    return await Expert.findOne({ phone });
  }

  async findByResetToken(resetToken: string): Promise<IExpert | null> {
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    
    return await Expert.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpire: { $gt: Date.now() }
    });
  }

  async updateById(id: string, updateData: Partial<IExpert>): Promise<IExpert | null> {
    return await Expert.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
  }

  async deleteById(id: string): Promise<IExpert | null> {
    return await Expert.findByIdAndDelete(id);
  }

  async findAll(filters: FilterOptions = {}, options: PaginationOptions = {}): Promise<PaginationResult<IExpert>> {
    const { page = 1, limit = 10, sort = '-createdAt' } = options;
    const skip = (page - 1) * limit;

    let query = Expert.find(filters).select('-password');
    
    // Apply filters
    if (filters.specialization) {
      query = query.where('specialization').equals(filters.specialization);
    }
    
    if (filters.minRating) {
      query = query.where('rating').gte(filters.minRating);
    }
    
    if (filters.maxPrice) {
      query = query.where('hourlyRate').lte(filters.maxPrice);
    }
    
    if (filters.verificationStatus) {
      query = query.where('verificationStatus').equals(filters.verificationStatus);
    }
    
    if (sort) {
      query.sort(sort);
    }
    
    if (limit) {
      query.limit(limit).skip(skip);
    }

    const [data, total] = await Promise.all([
      query.exec(),
      Expert.countDocuments(filters)
    ]);

    return {
      data: data as IExpert[],
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async count(filters: FilterOptions = {}): Promise<number> {
    return await Expert.countDocuments(filters);
  }
}

export default new ExpertRepository();

