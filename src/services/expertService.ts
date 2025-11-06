import expertRepository from '../repositories/expertRepository';
import { checkEmailExists, checkPhoneExists } from '../utils/emailValidation';
import emailService from './emailService';
import { MESSAGES } from '../constants/messages';
import logger from '../utils/logger';
import { IExpertService, RegisterExpertData, UpdateExpertProfileData, FilterOptions, PaginationOptions, PaginationResult } from '../types/services.interfaces';
import { IExpert } from '../types/models';

class ExpertService implements IExpertService {
  async registerExpert(expertData: RegisterExpertData): Promise<IExpert> {
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
    emailService.sendWelcomeEmail(email, firstName, 'expert').catch((err: Error) => {
      logger.error('Failed to send welcome email', err);
    });

    return expert;
  }

  async getCurrentExpert(expertId: string): Promise<IExpert> {
    const expert = await expertRepository.findById(expertId);
    if (!expert) {
      throw new Error(MESSAGES.EXPERT.EXPERT_NOT_FOUND);
    }
    return expert;
  }

  async updateProfile(expertId: string, updateData: UpdateExpertProfileData): Promise<IExpert> {
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

  async getAllExperts(filters: FilterOptions = {}, options: PaginationOptions = {}): Promise<PaginationResult<IExpert>> {
    return await expertRepository.findAll(filters, options);
  }

  async getExpertById(expertId: string): Promise<IExpert> {
    const expert = await expertRepository.findById(expertId);
    if (!expert) {
      throw new Error(MESSAGES.EXPERT.EXPERT_NOT_FOUND);
    }
    return expert;
  }

  async deleteExpert(expertId: string): Promise<IExpert> {
    const expert = await expertRepository.deleteById(expertId);
    if (!expert) {
      throw new Error(MESSAGES.EXPERT.EXPERT_NOT_FOUND);
    }
    return expert;
  }
}

export default new ExpertService();

