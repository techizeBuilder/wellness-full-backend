import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { asyncHandler } from '../middlewares/errorHandler';
import { generateRefreshToken, generateToken } from '../middlewares/auth';
import User from '../models/User';
import Expert from '../models/Expert';
import { getFileUrl } from '../middlewares/upload';
import logger from '../utils/logger';

const googleClient = new OAuth2Client(process.env.GOOGLE_OAUTH_CLIENT_ID);

const ensureGoogleConfig = () => {
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID) {
    throw new Error('Google OAuth client ID is not configured');
  }
};

// @desc    Google mobile login - verify ID token and create/link account
// @route   POST /api/auth/google/mobile
// @access  Public
const googleMobileLogin = asyncHandler(async (req, res) => {
  ensureGoogleConfig();

  const { idToken } = req.body as { idToken?: string };

  if (!idToken) {
    return res.status(400).json({
      success: false,
      message: 'Google ID token is required'
    });
  }

  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_OAUTH_CLIENT_ID
    });
  } catch (error) {
    logger.error('Google token verification failed:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid Google credentials'
    });
  }

  const payload = ticket.getPayload();

  if (!payload) {
    return res.status(401).json({
      success: false,
      message: 'Unable to verify Google account'
    });
  }

  const googleId = payload.sub;
  const email = payload.email;
  const emailVerified = payload.email_verified;
  const picture = payload.picture ?? null;
  const givenName = payload.given_name || payload.name?.split(' ')?.[0] || 'Google';
  const familyName =
    payload.family_name ||
    (payload.name ? payload.name.split(' ').slice(1).join(' ') : '') ||
    'User';

  if (!googleId) {
    return res.status(400).json({
      success: false,
      message: 'Google account information is incomplete'
    });
  }

  if (!email || emailVerified === false) {
    return res.status(400).json({
      success: false,
      message: 'Your Google account email is not verified'
    });
  }

  // Check if user exists by googleId
  let user = await User.findOne({ googleId });

  // If not found by googleId, check by email (for account linking)
  if (!user && email) {
    user = await User.findOne({ email: email.toLowerCase() });
  }

  const isNewUser = !user;

  if (!user) {
    // Create new user with Google auth
    const randomPassword = crypto.randomBytes(32).toString('hex');

    user = new User({
      firstName: givenName,
      lastName: familyName,
      email: email.toLowerCase(),
      phone: '', // Phone not required for Google auth
      authProvider: 'google',
      googleId,
      googleAvatar: picture,
      isEmailVerified: true,
      isPhoneVerified: false,
      isActive: true,
      userType: 'user', // Default to user, will be confirmed during onboarding
      accountTypeConfirmed: false, // New users need to select role
      password: randomPassword // Required field, but won't be used
    });

    await user.save({ validateBeforeSave: false });
    logger.info(`New Google user created: ${email}`);
  } else {
    // Existing user - link Google account if not already linked
    if (!user.googleId) {
      user.googleId = googleId;
      user.googleAvatar = picture || user.googleAvatar || null;
    }
    if (!user.authProvider || user.authProvider === 'password') {
      user.authProvider = 'google';
    }
    user.isEmailVerified = true;
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });
    logger.info(`Google login for existing user: ${email}`);
  }

  // Check if account type needs to be confirmed (new user or existing user without confirmation)
  if (isNewUser || !user.accountTypeConfirmed) {
    const userResponse = user.toObject();
    delete (userResponse as any).password;

    return res.status(200).json({
      success: true,
      requiresAccountSelection: true,
      message: 'Please select your account type',
      data: {
        user: {
          id: user._id.toString(),
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isEmailVerified: user.isEmailVerified
        }
      }
    });
  }

  // Check if onboarding is incomplete for Google users
  // For Google users, phone is required (should not be empty or dummy value)
  const isGoogleUser = user.authProvider === 'google';
  const hasValidPhone = user.phone && 
    user.phone.trim() !== '' && 
    user.phone !== '0000000000' && 
    /^[+]?[\d\s\-\(\)]{10,}$/.test(user.phone);

  if (isGoogleUser && !hasValidPhone) {
    // Incomplete onboarding - missing phone (account type already confirmed)
    const userResponse = user.toObject();
    delete (userResponse as any).password;

    return res.status(200).json({
      success: true,
      requiresAccountSelection: true,
      message: 'Please complete your profile',
      data: {
        user: {
          id: user._id.toString(),
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isEmailVerified: user.isEmailVerified,
          userType: user.userType // Include userType so frontend knows which form to show
        }
      }
    });
  }

  // For experts, check if Expert record exists with specialization
  if (user.userType === 'expert') {
    const expert = await Expert.findOne({ email: user.email });
    if (!expert || !expert.specialization || expert.specialization.trim() === '') {
      // Incomplete expert onboarding - missing specialization (account type already confirmed)
      const userResponse = user.toObject();
      delete (userResponse as any).password;

      return res.status(200).json({
        success: true,
        requiresAccountSelection: true,
        message: 'Please complete your expert profile',
        data: {
          user: {
            id: user._id.toString(),
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            isEmailVerified: user.isEmailVerified,
            userType: user.userType // Include userType so frontend knows which form to show
          }
        }
      });
    }
  }

  // Existing user with confirmed account type and complete onboarding - proceed with login
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  const token = generateToken(user._id.toString(), user.userType || 'user');
  const refreshToken = generateRefreshToken(user._id.toString(), user.userType || 'user');

  const userResponse = user.toObject();
  delete (userResponse as any).password;

  if (userResponse.profileImage) {
    userResponse.profileImage = getFileUrl(userResponse.profileImage, 'profiles');
  }

  const accountType = user.userType === 'expert' ? 'Expert' : 'User';

  return res.status(200).json({
    success: true,
    requiresAccountSelection: false,
    message: 'User login successful',
    data: {
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        userType: user.userType,
        isEmailVerified: user.isEmailVerified,
        profileImage: userResponse.profileImage ?? null,
        googleAvatar: user.googleAvatar ?? null
      },
      userType: user.userType || 'user',
      accountType,
      token,
      refreshToken
    }
  });
});

// @desc    Complete Google onboarding - set account type (Expert or User)
// @route   POST /api/auth/google/complete-onboarding
// @access  Public
const completeGoogleOnboarding = asyncHandler(async (req, res) => {
  const { googleUserId, accountType } = req.body as {
    googleUserId?: string;
    accountType?: 'Expert' | 'User';
  };

  if (!googleUserId) {
    return res.status(400).json({
      success: false,
      message: 'User ID is required'
    });
  }

  if (!accountType || !['Expert', 'User'].includes(accountType)) {
    return res.status(400).json({
      success: false,
      message: 'Account type must be either "Expert" or "User"'
    });
  }

  const user = await User.findById(googleUserId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  if (user.authProvider !== 'google') {
    return res.status(400).json({
      success: false,
      message: 'This endpoint is only for Google authentication users'
    });
  }

  // Update user type
  user.userType = accountType === 'Expert' ? 'expert' : 'user';
  user.accountTypeConfirmed = true;
  user.lastLogin = new Date();

  // If user selected Expert, we might want to create an Expert record
  // For now, we'll just update the User model
  await user.save({ validateBeforeSave: false });

  logger.info(`Google onboarding completed for ${user.email} as ${accountType}`);

  const token = generateToken(user._id.toString(), user.userType);
  const refreshToken = generateRefreshToken(user._id.toString(), user.userType);

  const userResponse = user.toObject();
  delete (userResponse as any).password;

  if (userResponse.profileImage) {
    userResponse.profileImage = getFileUrl(userResponse.profileImage, 'profiles');
  }

  return res.status(200).json({
    success: true,
    message: 'Onboarding completed successfully',
    data: {
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        userType: user.userType,
        isEmailVerified: user.isEmailVerified,
        profileImage: userResponse.profileImage ?? null,
        googleAvatar: user.googleAvatar ?? null
      },
      userType: user.userType,
      accountType,
      token,
      refreshToken
    }
  });
});

// @desc    Update Google user profile after onboarding
// @route   POST /api/auth/google/update-user-profile
// @access  Public (but requires valid user ID from onboarding)
const updateGoogleUserProfile = asyncHandler(async (req, res) => {
  const { userId, firstName, lastName, phone } = req.body as {
    userId?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  };

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'User ID is required'
    });
  }

  if (!phone) {
    return res.status(400).json({
      success: false,
      message: 'Phone number is required'
    });
  }

  // Phone validation
  const phoneRegex = /^\d{10}$/;
  if (!phoneRegex.test(phone.replace(/\D/g, ''))) {
    return res.status(400).json({
      success: false,
      message: 'Phone number must be exactly 10 digits'
    });
  }

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  if (user.authProvider !== 'google') {
    return res.status(400).json({
      success: false,
      message: 'This endpoint is only for Google authentication users'
    });
  }

  // Update fields
  if (firstName) user.firstName = firstName.trim();
  if (lastName) user.lastName = lastName.trim();
  user.phone = phone.replace(/\D/g, '');
  user.isPhoneVerified = false; // Phone needs verification

  await user.save({ validateBeforeSave: false });

  logger.info(`Google user profile updated: ${user.email}`);

  const userResponse = user.toObject();
  delete (userResponse as any).password;

  if (userResponse.profileImage) {
    userResponse.profileImage = getFileUrl(userResponse.profileImage, 'profiles');
  }

  return res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        userType: user.userType,
        isEmailVerified: user.isEmailVerified,
        profileImage: userResponse.profileImage ?? null,
        googleAvatar: user.googleAvatar ?? null
      },
      accountType: user.userType === 'expert' ? 'Expert' : 'User'
    }
  });
});

// @desc    Update Google expert profile after onboarding
// @route   POST /api/auth/google/update-expert-profile
// @access  Public (but requires valid user ID from onboarding)
const updateGoogleExpertProfile = asyncHandler(async (req, res) => {
  const { userId, firstName, lastName, phone, specialization, experience, bio, hourlyRate } = req.body as {
    userId?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    specialization?: string;
    experience?: number;
    bio?: string;
    hourlyRate?: number;
  };

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'User ID is required'
    });
  }

  if (!phone) {
    return res.status(400).json({
      success: false,
      message: 'Phone number is required'
    });
  }

  if (!specialization) {
    return res.status(400).json({
      success: false,
      message: 'Specialization is required'
    });
  }

  // Phone validation
  const phoneRegex = /^\d{10}$/;
  if (!phoneRegex.test(phone.replace(/\D/g, ''))) {
    return res.status(400).json({
      success: false,
      message: 'Phone number must be exactly 10 digits'
    });
  }

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  if (user.authProvider !== 'google' || user.userType !== 'expert') {
    return res.status(400).json({
      success: false,
      message: 'This endpoint is only for Google expert users'
    });
  }

  // Update basic fields
  if (firstName) user.firstName = firstName.trim();
  if (lastName) user.lastName = lastName.trim();
  user.phone = phone.replace(/\D/g, '');
  user.isPhoneVerified = false;

  await user.save({ validateBeforeSave: false });

  // Check if Expert record exists, if not create one
  let expert = await Expert.findOne({ email: user.email });

  if (!expert) {
    // Create Expert record
    expert = new Expert({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      password: user.password || crypto.randomBytes(32).toString('hex'), // Use existing or generate
      specialization: specialization.trim(),
      experience: experience || 0,
      bio: bio?.trim() || '',
      hourlyRate: hourlyRate || 0,
      userType: 'expert',
      isEmailVerified: true,
      isPhoneVerified: false,
      isActive: true,
      verificationStatus: 'pending'
    });
  } else {
    // Update existing Expert record
    if (firstName) expert.firstName = firstName.trim();
    if (lastName) expert.lastName = lastName.trim();
    expert.phone = phone.replace(/\D/g, '');
    expert.specialization = specialization.trim();
    if (experience !== undefined) expert.experience = experience;
    if (bio !== undefined) expert.bio = bio.trim();
    if (hourlyRate !== undefined) expert.hourlyRate = hourlyRate;
  }

  await expert.save({ validateBeforeSave: false });

  logger.info(`Google expert profile updated: ${user.email}`);

  const userResponse = user.toObject();
  delete (userResponse as any).password;

  if (userResponse.profileImage) {
    userResponse.profileImage = getFileUrl(userResponse.profileImage, 'profiles');
  }

  return res.status(200).json({
    success: true,
    message: 'Expert profile updated successfully',
    data: {
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        userType: user.userType,
        isEmailVerified: user.isEmailVerified,
        profileImage: userResponse.profileImage ?? null,
        googleAvatar: user.googleAvatar ?? null
      },
      accountType: 'Expert'
    }
  });
});

export { googleMobileLogin, completeGoogleOnboarding, updateGoogleUserProfile, updateGoogleExpertProfile };

