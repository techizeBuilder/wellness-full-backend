const Admin = require('../models/Admin');

class AdminRepository {
  async create(adminData) {
    return await Admin.create(adminData);
  }

  async findById(id, selectPassword = false) {
    const query = Admin.findById(id);
    if (!selectPassword) {
      query.select('-password');
    }
    return await query;
  }

  async findByEmail(email, selectPassword = false) {
    const query = Admin.findOne({ email: email.toLowerCase() });
    if (!selectPassword) {
      query.select('-password');
    }
    return await query;
  }

  async updateById(id, updateData) {
    return await Admin.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
  }

  async deleteById(id) {
    return await Admin.findByIdAndDelete(id);
  }

  async findAll(filters = {}, options = {}) {
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
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async count(filters = {}) {
    return await Admin.countDocuments(filters);
  }
}

module.exports = new AdminRepository();

