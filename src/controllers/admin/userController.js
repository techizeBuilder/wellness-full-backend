const User = require('../../models/User');
const { asyncHandler } = require('../../middlewares/errorHandler');
const { checkEmailExists, checkPhoneExists } = require('../../utils/emailValidation');

// Get user statistics
const getUserStats = asyncHandler(async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const inactiveUsers = await User.countDocuments({ isActive: false });
    const verifiedUsers = await User.countDocuments({ isVerified: true });
    
    res.status(200).json({
      success: true,
      data: {
        stats: {
          total: totalUsers,
          active: activeUsers,
          inactive: inactiveUsers,
          verified: verifiedUsers
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user statistics'
    });
  }
});

// Get all users
const getUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, status } = req.query;
  
  let query = {};
  
  // Add search functionality
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } }
    ];
  }
  
  // Add status filter
  if (status && ['active', 'inactive'].includes(status)) {
    query.isActive = status === 'active';
  }
  
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const users = await User.find(query)
    .select('-password')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip);
    
  // Transform users to include status field
  const transformedUsers = users.map(user => ({
    ...user.toObject(),
    id: user._id.toString(),
    status: user.isActive ? 'active' : 'inactive'
  }));
    
  const total = await User.countDocuments(query);
  
  res.status(200).json({
    success: true,
    data: {
      users: transformedUsers,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    }
  });
});

// Get user by ID
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }
  
  res.status(200).json({
    success: true,
    data: { user }
  });
});

// Create new user
const createUser = asyncHandler(async (req, res) => {
  const { name, firstName, lastName, email, phone, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required'
    });
  }
  
  // Handle name vs firstName/lastName
  let userFirstName = firstName;
  let userLastName = lastName;
  
  if (name && !firstName && !lastName) {
    const nameParts = name.trim().split(' ');
    userFirstName = nameParts[0];
    userLastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
  }
  
  if (!userFirstName) {
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
  
  const user = await User.create({
    firstName: userFirstName,
    lastName: userLastName || '',
    email,
    phone,
    password,
    isActive: true
  });
  
  res.status(201).json({
    success: true,
    data: { user: { ...user.toObject(), password: undefined } }
  });
});

// Update user
const updateUser = asyncHandler(async (req, res) => {
  const { name, firstName, lastName, email, phone, isActive } = req.body;
  
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }
  
  // Check if email is already taken by another user or expert
  if (email && email !== user.email) {
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
    user.firstName = nameParts[0];
    user.lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
  } else {
    if (firstName) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
  }
  
  // Update other fields
  if (email) user.email = email;
  if (phone !== undefined) user.phone = phone;
  if (typeof isActive === 'boolean') user.isActive = isActive;
  
  await user.save();
  
  res.status(200).json({
    success: true,
    data: { user: { ...user.toObject(), password: undefined } }
  });
});

// Delete user
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }
  
  await User.findByIdAndDelete(req.params.id);
  
  res.status(200).json({
    success: true,
    message: 'User deleted successfully'
  });
});

// Toggle user status
const toggleUserStatus = asyncHandler(async (req, res) => {
  try {
    console.log('Toggle user status called with ID:', req.params.id);
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      console.log('User not found with ID:', req.params.id);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const previousStatus = user.isActive;
    user.isActive = !user.isActive;
    await user.save();
    
    console.log(`User ${user.email} status changed from ${previousStatus} to ${user.isActive}`);
    
    // Return user with proper format
    const transformedUser = {
      ...user.toObject(),
      id: user._id.toString(),
      status: user.isActive ? 'active' : 'inactive',
      password: undefined
    };
    
    res.status(200).json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      data: { user: transformedUser }
    });
  } catch (error) {
    console.error('Error toggling user status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle user status'
    });
  }
});

module.exports = {
  getUserStats,
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus
};