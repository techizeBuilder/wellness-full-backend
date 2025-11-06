const Expert = require('../models/Expert');

class ExpertRepository {
  async create(expertData) {
    return await Expert.create(expertData);
  }

  async findById(id, selectPassword = false) {
    const query = Expert.findById(id);
    if (!selectPassword) {
      query.select('-password');
    }
    return await query;
  }

  async findByEmail(email, selectPassword = false) {
    const query = Expert.findOne({ email: email.toLowerCase() });
    if (!selectPassword) {
      query.select('-password');
    }
    return await query;
  }

  async findByPhone(phone) {
    return await Expert.findOne({ phone });
  }

  async findByResetToken(resetToken) {
    const hashedToken = require('crypto')
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    
    return await Expert.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpire: { $gt: Date.now() }
    });
  }

  async updateById(id, updateData) {
    return await Expert.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
  }

  async deleteById(id) {
    return await Expert.findByIdAndDelete(id);
  }

  async findAll(filters = {}, options = {}) {
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
    return await Expert.countDocuments(filters);
  }
}

module.exports = new ExpertRepository();

