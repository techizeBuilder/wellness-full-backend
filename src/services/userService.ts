import userRepository from '../repositories/userRepository';
import { checkEmailExists, checkPhoneExists } from '../utils/emailValidation';
import { MESSAGES } from '../constants/messages';
import logger from '../utils/logger';
import { IUserService, UpdateProfileData, FilterOptions, PaginationOptions, PaginationResult } from '../types/services.interfaces';
import { IUser } from '../types/models';

class UserService implements IUserService {
  async getCurrentUser(userId: string): Promise<IUser> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error(MESSAGES.USER.PROFILE_NOT_FOUND);
    }
    return user;
  }

  async updateProfile(userId: string, updateData: UpdateProfileData): Promise<IUser> {
    const { email, phone, ...otherData } = updateData;
    const healthFields = ['bloodGroup', 'weightKg', 'bloodPressure'];
    const didUpdateHealthField = healthFields.some((field) => field in otherData);

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

    if (didUpdateHealthField) {
      otherData.healthProfileUpdatedAt = new Date();
    }

    const updatedUser = await userRepository.updateById(userId, otherData);
    if (!updatedUser) {
      throw new Error(MESSAGES.USER.PROFILE_NOT_FOUND);
    }

    return updatedUser;
  }

  async getAllUsers(filters: FilterOptions = {}, options: PaginationOptions = {}): Promise<PaginationResult<IUser>> {
    return await userRepository.findAll(filters, options);
  }

  async getUserById(userId: string): Promise<IUser> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error(MESSAGES.USER.PROFILE_NOT_FOUND);
    }
    return user;
  }

  async deleteUser(userId: string): Promise<IUser> {
    const user = await userRepository.deleteById(userId);
    if (!user) {
      throw new Error(MESSAGES.USER.PROFILE_NOT_FOUND);
    }
    return user;
  }
}

export default new UserService();

