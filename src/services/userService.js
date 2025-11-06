const userRepository = require('../repositories/userRepository');
const { checkEmailExists, checkPhoneExists } = require('../utils/emailValidation');
const { MESSAGES } = require('../constants/messages');
const logger = require('../utils/logger');

class UserService {
  async getCurrentUser(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error(MESSAGES.USER.PROFILE_NOT_FOUND);
    }
    return user;
  }

  async updateProfile(userId, updateData) {
    const { email, phone, ...otherData } = updateData;

    // Check if email is being changed and if it already exists
    if (email) {
      const emailCheck = await checkEmailExists(email, 'user', userId);
      if (emailCheck.exists) {
        throw new Error(emailCheck.message);
      }
      otherData.email = email;
    }

    // Check if phone is being changed and if it already exists
    if (phone) {
      const phoneCheck = await checkPhoneExists(phone, 'user', userId);
      if (phoneCheck.exists) {
        throw new Error(phoneCheck.message);
      }
      otherData.phone = phone;
    }

    const updatedUser = await userRepository.updateById(userId, otherData);
    if (!updatedUser) {
      throw new Error(MESSAGES.USER.PROFILE_NOT_FOUND);
    }

    return updatedUser;
  }

  async getAllUsers(filters = {}, options = {}) {
    return await userRepository.findAll(filters, options);
  }

  async getUserById(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error(MESSAGES.USER.PROFILE_NOT_FOUND);
    }
    return user;
  }

  async deleteUser(userId) {
    const user = await userRepository.deleteById(userId);
    if (!user) {
      throw new Error(MESSAGES.USER.PROFILE_NOT_FOUND);
    }
    return user;
  }
}

module.exports = new UserService();

