const User = require('../models/User');

class UserRepository {
  async create(userData) {
    return await User.create(userData);
  }

  async findById(id, selectPassword = false) {
    const query = User.findById(id);
    if (!selectPassword) {
      query.select('-password');
    }
    return await query;
  }

  async findByEmail(email, selectPassword = false) {
    const query = User.findOne({ email: email.toLowerCase() });
    if (!selectPassword) {
      query.select('-password');
    }
    return await query;
  }

  async findByPhone(phone) {
    return await User.findOne({ phone });
  }

  async findByResetToken(resetToken) {
    const hashedToken = require('crypto')
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    
    return await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpire: { $gt: Date.now() }
    });
  }

  async updateById(id, updateData) {
    return await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
  }

  async deleteById(id) {
    return await User.findByIdAndDelete(id);
  }

  async findAll(filters = {}, options = {}) {
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
    return await User.countDocuments(filters);
  }
}

module.exports = new UserRepository();

