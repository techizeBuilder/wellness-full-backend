const Expert = require('../../models/Expert');
const { asyncHandler } = require('../../middlewares/errorHandler');
const { checkEmailExists, checkPhoneExists } = require('../../utils/emailValidation');

// Get expert statistics
const getExpertStats = asyncHandler(async (req, res) => {
  try {
    const totalExperts = await Expert.countDocuments();
    const activeExperts = await Expert.countDocuments({ isActive: true });
    const inactiveExperts = await Expert.countDocuments({ isActive: false });
    const verifiedExperts = await Expert.countDocuments({ isVerified: true });
    
    res.status(200).json({
      success: true,
      data: {
        stats: {
          total: totalExperts,
          active: activeExperts,
          inactive: inactiveExperts,
          verified: verifiedExperts
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
  
  let query = {};
  
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
  
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const experts = await Expert.find(query)
    .select('-password')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
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
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
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
  
  res.status(200).json({
    success: true,
    data: { expert }
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

module.exports = {
  getExpertStats,
  getExperts,
  getExpertById,
  createExpert,
  updateExpert,
  deleteExpert,
  toggleExpertStatus,
  toggleExpertVerification
};