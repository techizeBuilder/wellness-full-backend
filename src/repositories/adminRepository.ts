import Admin, { IAdmin } from '../models/Admin';
import { IAdminRepository, FilterOptions, PaginationOptions, PaginationResult } from '../types/repositories';

class AdminRepository implements IAdminRepository {
  async create(adminData: Partial<IAdmin>): Promise<IAdmin> {
    return await Admin.create(adminData);
  }

  async findById(id: string, selectPassword: boolean = false): Promise<IAdmin | null> {
    const query = Admin.findById(id);
    if (!selectPassword) {
      query.select('-password');
    }
    return await query;
  }

  async findByEmail(email: string, selectPassword: boolean = false): Promise<IAdmin | null> {
    const query = Admin.findOne({ email: email.toLowerCase() });
    if (!selectPassword) {
      query.select('-password');
    }
    return await query;
  }

  async updateById(id: string, updateData: Partial<IAdmin>): Promise<IAdmin | null> {
    return await Admin.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
  }

  async deleteById(id: string): Promise<IAdmin | null> {
    return await Admin.findByIdAndDelete(id);
  }

  async findAll(filters: FilterOptions = {}, options: PaginationOptions = {}): Promise<PaginationResult<IAdmin>> {
    const { page = 1, limit = 10, sort = '-createdAt' } = options;
    const skip = (page - 1) * limit;

    const query = Admin.find(filters).select('-password');
    
    if (sort) {
      query.sort(sort);
    }
    
    if (limit) {
      query.limit(limit).skip(skip);
    }

    const [data, total] = await Promise.all([
      query.exec(),
      Admin.countDocuments(filters)
    ]);

    return {
      data: data as IAdmin[],
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async count(filters: FilterOptions = {}): Promise<number> {
    return await Admin.countDocuments(filters);
  }
}

export default new AdminRepository();

