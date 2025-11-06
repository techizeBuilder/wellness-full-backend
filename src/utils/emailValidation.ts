import User from '../models/User';
import Expert from '../models/Expert';

export const checkEmailExists = async (email: string, excludeCollection: 'user' | 'expert' | null = null, excludeId: string | null = null) => {
  try {
    let userExists = false;
    let expertExists = false;

    if (excludeCollection !== 'user') {
      const existingUser = await (User as any).findOne({ email });
      if (existingUser && (!excludeId || existingUser._id.toString() !== excludeId)) {
        userExists = true;
      }
    }

    if (excludeCollection !== 'expert') {
      const existingExpert = await (Expert as any).findOne({ email });
      if (existingExpert && (!excludeId || existingExpert._id.toString() !== excludeId)) {
        expertExists = true;
      }
    }

    if (userExists && expertExists) {
      return { exists: true, collection: 'both', message: 'This email is already registered in the system' };
    } else if (userExists) {
      return { exists: true, collection: 'user', message: 'This email is already registered as a user account' };
    } else if (expertExists) {
      return { exists: true, collection: 'expert', message: 'This email is already registered as an expert account' };
    }

    return { exists: false, collection: null, message: null };
  } catch (error) {
    console.error('Error checking email existence:', error);
    throw new Error('Error validating email');
  }
};

export const checkPhoneExists = async (phone: string, excludeCollection: 'user' | 'expert' | null = null, excludeId: string | null = null) => {
  try {
    let userExists = false;
    let expertExists = false;

    if (excludeCollection !== 'user') {
      const existingUser = await (User as any).findOne({ phone });
      if (existingUser && (!excludeId || existingUser._id.toString() !== excludeId)) {
        userExists = true;
      }
    }

    if (excludeCollection !== 'expert') {
      const existingExpert = await (Expert as any).findOne({ phone });
      if (existingExpert && (!excludeId || existingExpert._id.toString() !== excludeId)) {
        expertExists = true;
      }
    }

    if (userExists && expertExists) {
      return { exists: true, collection: 'both', message: 'This phone number is already registered in the system' };
    } else if (userExists) {
      return { exists: true, collection: 'user', message: 'This phone number is already registered as a user account' };
    } else if (expertExists) {
      return { exists: true, collection: 'expert', message: 'This phone number is already registered as an expert account' };
    }

    return { exists: false, collection: null, message: null };
  } catch (error) {
    console.error('Error checking phone existence:', error);
    throw new Error('Error validating phone number');
  }
};

export default {
  checkEmailExists,
  checkPhoneExists
};
