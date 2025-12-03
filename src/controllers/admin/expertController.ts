import Expert from '../../models/Expert';
import BankAccount from '../../models/BankAccount';
import { asyncHandler } from '../../middlewares/errorHandler';
import { checkEmailExists, checkPhoneExists } from '../../utils/emailValidation';

// Get expert statistics
const getExpertStats = asyncHandler(async (req, res) => {
  try {
    const totalExperts = await Expert.countDocuments();
    const activeExperts = await Expert.countDocuments({ isActive: true });
    const inactiveExperts = await Expert.countDocuments({ isActive: false });
    const verifiedExperts = await Expert.countDocuments({ isVerified: true });
    
    // Calculate average rating across all experts
    const ratingStats = await Expert.aggregate([
      {
        $match: {
          'rating.count': { $gt: 0 } // Only experts with ratings
        }
      },
      {
        $group: {
          _id: null,
          totalRating: { $sum: { $multiply: ['$rating.average', '$rating.count'] } },
          totalCount: { $sum: '$rating.count' },
          expertCount: { $sum: 1 }
        }
      }
    ]);

    let averageRating = 0;
    if (ratingStats.length > 0 && ratingStats[0].totalCount > 0) {
      averageRating = ratingStats[0].totalRating / ratingStats[0].totalCount;
    }
    
    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalExperts: totalExperts,
          activeExperts: activeExperts,
          inactiveExperts: inactiveExperts,
          verifiedExperts: verifiedExperts,
          averageRating: Math.round(averageRating * 10) / 10 // Round to 1 decimal place
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expert statistics'
    });
  }
});

// Get all experts
const getExperts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, status, specialty } = req.query;
  
  const query: Record<string, unknown> = {};
  
  // Add search functionality
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { specialization: { $regex: search, $options: 'i' } }
    ];
  }
  
  // Add status filter
  if (status && ['active', 'inactive'].includes(status)) {
    query.isActive = status === 'active';
  }
  
  // Add specialty filter
  if (specialty) {
    query.specialization = { $regex: specialty, $options: 'i' };
  }
  
  const pageNumber = Number(page) || 1;
  const limitNumber = Number(limit) || 10;
  const skip = (pageNumber - 1) * limitNumber;
  
  const experts = await Expert.find(query)
    .select('-password')
    .sort({ createdAt: -1 })
    .limit(limitNumber)
    .skip(skip);
    
  // Transform experts to include status field
  const transformedExperts = experts.map(expert => ({
    ...expert.toObject(),
    id: expert._id.toString(),
    status: expert.isActive ? 'active' : 'inactive'
  }));
    
  const total = await Expert.countDocuments(query);
  
  res.status(200).json({
    success: true,
    data: {
      experts: transformedExperts,
      pagination: {
        current: pageNumber,
        pages: Math.ceil(total / limitNumber),
        total
      }
    }
  });
});

// Get expert by ID
const getExpertById = asyncHandler(async (req, res) => {
  const expert = await Expert.findById(req.params.id).select('-password');
  
  if (!expert) {
    return res.status(404).json({
      success: false,
      message: 'Expert not found'
    });
  }
  
  // Fetch bank account details for the expert
  const bankAccount = await BankAccount.findOne({ expert: expert._id });
  
  const expertData: any = expert.toObject();
  if (bankAccount) {
    expertData.bankAccount = bankAccount;
  }
  
  res.status(200).json({
    success: true,
    data: { expert: expertData }
  });
});

// Create new expert
const createExpert = asyncHandler(async (req, res) => {
  const { 
    name,
    firstName, 
    lastName,
    email, 
    phone, 
    password, 
    specialization, 
    experience, 
    bio, 
    hourlyRate,
    availability 
  } = req.body;
  
  if (!email || !password || !specialization) {
    return res.status(400).json({
      success: false,
      message: 'Email, password, and specialization are required'
    });
  }
  
  // Handle name vs firstName/lastName
  let expertFirstName = firstName;
  let expertLastName = lastName;
  
  if (name && !firstName && !lastName) {
    const nameParts = name.trim().split(' ');
    expertFirstName = nameParts[0];
    expertLastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
  }
  
  if (!expertFirstName) {
    return res.status(400).json({
      success: false,
      message: 'First name is required'
    });
  }
  
  // Check if email already exists in either User or Expert collection
  const emailCheck = await checkEmailExists(email);
  if (emailCheck.exists) {
    return res.status(400).json({
      success: false,
      message: emailCheck.message
    });
  }
  
  const expert = await Expert.create({
    firstName: expertFirstName,
    lastName: expertLastName || '',
    email,
    phone,
    password,
    specialization,
    experience: experience || 0,
    bio: bio || '',
    hourlyRate: hourlyRate || 0,
    availability: availability || [],
    isActive: true,
    isVerified: false
  });
  
  res.status(201).json({
    success: true,
    data: { expert: { ...expert.toObject(), password: undefined } }
  });
});

// Update expert
const updateExpert = asyncHandler(async (req, res) => {
  const { 
    name,
    firstName,
    lastName,
    email, 
    phone, 
    specialization, 
    experience, 
    bio, 
    hourlyRate,
    availability,
    isActive,
    isVerified
  } = req.body;
  
  const expert = await Expert.findById(req.params.id);
  
  if (!expert) {
    return res.status(404).json({
      success: false,
      message: 'Expert not found'
    });
  }
  
  // Check if email is already taken by another expert or user
  if (email && email !== expert.email) {
    const emailCheck = await checkEmailExists(email);
    if (emailCheck.exists) {
      return res.status(400).json({
        success: false,
        message: emailCheck.message
      });
    }
  }
  
  // Handle name vs firstName/lastName
  if (name && !firstName && !lastName) {
    const nameParts = name.trim().split(' ');
    expert.firstName = nameParts[0];
    expert.lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
  } else {
    if (firstName) expert.firstName = firstName;
    if (lastName !== undefined) expert.lastName = lastName;
  }
  
  // Update other fields
  if (email) expert.email = email;
  if (phone !== undefined) expert.phone = phone;
  if (specialization) expert.specialization = specialization;
  if (typeof experience === 'number') expert.experience = experience;
  if (bio !== undefined) expert.bio = bio;
  if (typeof hourlyRate === 'number') expert.hourlyRate = hourlyRate;
  if (availability) expert.availability = availability;
  if (typeof isActive === 'boolean') expert.isActive = isActive;
  if (typeof isVerified === 'boolean') expert.isVerified = isVerified;
  
  await expert.save();
  
  res.status(200).json({
    success: true,
    data: { expert: { ...expert.toObject(), password: undefined } }
  });
});

// Delete expert
const deleteExpert = asyncHandler(async (req, res) => {
  const expert = await Expert.findById(req.params.id);
  
  if (!expert) {
    return res.status(404).json({
      success: false,
      message: 'Expert not found'
    });
  }
  
  await Expert.findByIdAndDelete(req.params.id);
  
  res.status(200).json({
    success: true,
    message: 'Expert deleted successfully'
  });
});

// Toggle expert status
const toggleExpertStatus = asyncHandler(async (req, res) => {
  try {
    console.log('Toggle expert status called with ID:', req.params.id);
    
    const expert = await Expert.findById(req.params.id);
    
    if (!expert) {
      console.log('Expert not found with ID:', req.params.id);
      return res.status(404).json({
        success: false,
        message: 'Expert not found'
      });
    }
    
    const previousStatus = expert.isActive;
    expert.isActive = !expert.isActive;
    await expert.save();
    
    console.log(`Expert ${expert.email} status changed from ${previousStatus} to ${expert.isActive}`);
    
    // Return expert with proper format
    const transformedExpert = {
      ...expert.toObject(),
      id: expert._id.toString(),
      status: expert.isActive ? 'active' : 'inactive',
      password: undefined
    };
    
    res.status(200).json({
      success: true,
      message: `Expert ${expert.isActive ? 'activated' : 'deactivated'} successfully`,
      data: { expert: transformedExpert }
    });
  } catch (error) {
    console.error('Error toggling expert status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle expert status'
    });
  }
});

// Toggle expert verification
const toggleExpertVerification = asyncHandler(async (req, res) => {
  try {
    console.log('Toggle expert verification called with ID:', req.params.id);
    
    const expert = await Expert.findById(req.params.id);
    
    if (!expert) {
      console.log('Expert not found with ID:', req.params.id);
      return res.status(404).json({
        success: false,
        message: 'Expert not found'
      });
    }
    
    const previousVerification = expert.isVerified;
    expert.isVerified = !expert.isVerified;
    await expert.save();
    
    console.log(`Expert ${expert.email} verification changed from ${previousVerification} to ${expert.isVerified}`);
    
    res.status(200).json({
      success: true,
      message: `Expert ${expert.isVerified ? 'verified' : 'unverified'} successfully`,
      data: { expert: { ...expert.toObject(), password: undefined } }
    });
  } catch (error) {
    console.error('Error toggling expert verification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle expert verification'
    });
  }
});

export {
  getExpertStats,
  getExperts,
  getExpertById,
  createExpert,
  updateExpert,
  deleteExpert,
  toggleExpertStatus,
  toggleExpertVerification
};