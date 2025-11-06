const expertRepository = require('../repositories/expertRepository');
const { checkEmailExists, checkPhoneExists } = require('../utils/emailValidation');
const emailService = require('./emailService');
const { MESSAGES } = require('../constants/messages');
const logger = require('../utils/logger');

class ExpertService {
  async registerExpert(expertData) {
    const { firstName, lastName, email, phone, password, ...otherData } = expertData;

    // Check if email exists
    const emailCheck = await checkEmailExists(email);
    if (emailCheck.exists) {
      throw new Error(emailCheck.message);
    }

    // Check if phone exists
    const phoneCheck = await checkPhoneExists(phone);
    if (phoneCheck.exists) {
      throw new Error(phoneCheck.message);
    }

    // Create expert
    const expert = await expertRepository.create({
      firstName,
      lastName,
      email,
      phone,
      password,
      userType: 'expert',
      verificationStatus: 'pending',
      isEmailVerified: true,
      isPhoneVerified: true,
      isActive: true,
      ...otherData
    });

    // Send welcome email (async, don't wait)
    emailService.sendWelcomeEmail(email, firstName, 'expert').catch(err => {
      logger.error('Failed to send welcome email', err);
    });

    return expert;
  }

  async getCurrentExpert(expertId) {
    const expert = await expertRepository.findById(expertId);
    if (!expert) {
      throw new Error(MESSAGES.EXPERT.EXPERT_NOT_FOUND);
    }
    return expert;
  }

  async updateProfile(expertId, updateData) {
    const { email, phone, ...otherData } = updateData;

    // Check if email is being changed and if it already exists
    if (email) {
      const emailCheck = await checkEmailExists(email, 'expert', expertId);
      if (emailCheck.exists) {
        throw new Error(emailCheck.message);
      }
      otherData.email = email;
    }

    // Check if phone is being changed and if it already exists
    if (phone) {
      const phoneCheck = await checkPhoneExists(phone, 'expert', expertId);
      if (phoneCheck.exists) {
        throw new Error(phoneCheck.message);
      }
      otherData.phone = phone;
    }

    const updatedExpert = await expertRepository.updateById(expertId, otherData);
    if (!updatedExpert) {
      throw new Error(MESSAGES.EXPERT.EXPERT_NOT_FOUND);
    }

    return updatedExpert;
  }

  async getAllExperts(filters = {}, options = {}) {
    return await expertRepository.findAll(filters, options);
  }

  async getExpertById(expertId) {
    const expert = await expertRepository.findById(expertId);
    if (!expert) {
      throw new Error(MESSAGES.EXPERT.EXPERT_NOT_FOUND);
    }
    return expert;
  }

  async deleteExpert(expertId) {
    const expert = await expertRepository.deleteById(expertId);
    if (!expert) {
      throw new Error(MESSAGES.EXPERT.EXPERT_NOT_FOUND);
    }
    return expert;
  }
}

module.exports = new ExpertService();

