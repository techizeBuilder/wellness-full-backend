const User = require('../models/User');
const Expert = require('../models/Expert');

/**
 * Check if an email already exists in either User or Expert collection
 * @param {string} email - Email to check
 * @param {string} excludeCollection - Collection to exclude from check (optional)
 * @param {string} excludeId - ID to exclude from check (optional)
 * @returns {Object} - { exists: boolean, collection: string|null, message: string|null }
 */
const checkEmailExists = async (email, excludeCollection = null, excludeId = null) => {
  try {
    let userExists = false;
    let expertExists = false;

    // Check User collection if not excluded
    if (excludeCollection !== 'user') {
      const userQuery = { email };
      if (excludeId && excludeCollection === 'expert') {
        // Only exclude if we're checking for expert registration and want to exclude this specific user
        // This shouldn't happen in practice since we're checking cross-collection
      }
      
      const existingUser = await User.findOne(userQuery);
      if (existingUser && (!excludeId || existingUser._id.toString() !== excludeId)) {
        userExists = true;
      }
    }

    // Check Expert collection if not excluded
    if (excludeCollection !== 'expert') {
      const expertQuery = { email };
      if (excludeId && excludeCollection === 'user') {
        // Only exclude if we're checking for user registration and want to exclude this specific expert
        // This shouldn't happen in practice since we're checking cross-collection
      }
      
      const existingExpert = await Expert.findOne(expertQuery);
      if (existingExpert && (!excludeId || existingExpert._id.toString() !== excludeId)) {
        expertExists = true;
      }
    }

    // Determine result
    if (userExists && expertExists) {
      return {
        exists: true,
        collection: 'both',
        message: 'This email is already registered in the system'
      };
    } else if (userExists) {
      return {
        exists: true,
        collection: 'user',
        message: 'This email is already registered as a user account'
      };
    } else if (expertExists) {
      return {
        exists: true,
        collection: 'expert',
        message: 'This email is already registered as an expert account'
      };
    }

    return {
      exists: false,
      collection: null,
      message: null
    };
  } catch (error) {
    console.error('Error checking email existence:', error);
    throw new Error('Error validating email');
  }
};

/**
 * Check if a phone number already exists in either User or Expert collection
 * @param {string} phone - Phone number to check
 * @param {string} excludeCollection - Collection to exclude from check (optional)
 * @param {string} excludeId - ID to exclude from check (optional)
 * @returns {Object} - { exists: boolean, collection: string|null, message: string|null }
 */
const checkPhoneExists = async (phone, excludeCollection = null, excludeId = null) => {
  try {
    let userExists = false;
    let expertExists = false;

    // Check User collection if not excluded
    if (excludeCollection !== 'user') {
      const userQuery = { phone };
      const existingUser = await User.findOne(userQuery);
      if (existingUser && (!excludeId || existingUser._id.toString() !== excludeId)) {
        userExists = true;
      }
    }

    // Check Expert collection if not excluded
    if (excludeCollection !== 'expert') {
      const expertQuery = { phone };
      const existingExpert = await Expert.findOne(expertQuery);
      if (existingExpert && (!excludeId || existingExpert._id.toString() !== excludeId)) {
        expertExists = true;
      }
    }

    // Determine result
    if (userExists && expertExists) {
      return {
        exists: true,
        collection: 'both',
        message: 'This phone number is already registered in the system'
      };
    } else if (userExists) {
      return {
        exists: true,
        collection: 'user',
        message: 'This phone number is already registered as a user account'
      };
    } else if (expertExists) {
      return {
        exists: true,
        collection: 'expert',
        message: 'This phone number is already registered as an expert account'
      };
    }

    return {
      exists: false,
      collection: null,
      message: null
    };
  } catch (error) {
    console.error('Error checking phone existence:', error);
    throw new Error('Error validating phone number');
  }
};

module.exports = {
  checkEmailExists,
  checkPhoneExists
};