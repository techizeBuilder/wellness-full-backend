const Subscription = require('../../models/Subscription');
const { asyncHandler } = require('../../middlewares/errorHandler');

// Get all subscriptions
const getSubscriptions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, status, type } = req.query;
  
  let query = {};
  
  // Add search functionality
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }
  
  // Add status filter
  if (status && ['active', 'inactive'].includes(status)) {
    query.isActive = status === 'active';
  }
  
  // Add type filter
  if (type) {
    query.type = type;
  }
  
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const subscriptions = await Subscription.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip);
    
  const total = await Subscription.countDocuments(query);
  
  res.status(200).json({
    success: true,
    data: subscriptions,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      total
    }
  });
});

// Get subscription by ID
const getSubscriptionById = asyncHandler(async (req, res) => {
  const subscription = await Subscription.findById(req.params.id);
  
  if (!subscription) {
    return res.status(404).json({
      success: false,
      message: 'Subscription not found'
    });
  }
  
  res.status(200).json({
    success: true,
    data: subscription
  });
});

// Create new subscription
const createSubscription = asyncHandler(async (req, res) => {
  console.log('📝 Creating subscription with data:', JSON.stringify(req.body, null, 2));
  
  let { 
    name, 
    description, 
    price, 
    duration, 
    durationType = 'months',
    type, 
    features,
    maxExperts = 1,
    maxSessions = 10,
    hasVideoCall = false,
    hasChat = true,
    hasGroupSessions = false,
    isActive = true,
    isPopular = false
  } = req.body;
  
  // Convert string values to proper types
  if (typeof price === 'string') {
    price = parseFloat(price);
  }
  
  if (typeof duration === 'string') {
    duration = parseInt(duration);
  }
  
  if (typeof maxExperts === 'string') {
    maxExperts = parseInt(maxExperts);
  }
  
  if (typeof maxSessions === 'string') {
    maxSessions = parseInt(maxSessions);
  }
  
  // Detailed validation
  if (!name || name.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Subscription name is required'
    });
  }
  
  if (!description || description.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Description is required'
    });
  }
  
  if (isNaN(price) || price < 0) {
    return res.status(400).json({
      success: false,
      message: 'Valid price is required (must be 0 or greater)'
    });
  }
  
  if (isNaN(duration) || duration < 1) {
    return res.status(400).json({
      success: false,
      message: 'Valid duration is required (must be 1 or greater)'
    });
  }

  // Set default type if not provided or invalid
  const validTypes = ['basic', 'premium', 'enterprise', 'trial'];
  if (!type || type.trim() === '' || !validTypes.includes(type.toLowerCase())) {
    type = 'basic'; // Default to basic type
    console.log('Setting default type to basic, received type:', req.body.type);
  } else {
    type = type.toLowerCase();
  }  // Check if subscription with same name exists
  const existingSubscription = await Subscription.findOne({ name: name.trim() });
  if (existingSubscription) {
    return res.status(400).json({
      success: false,
      message: 'Subscription with this name already exists'
    });
  }
  
  try {
    const subscription = await Subscription.create({
      name: name.trim(),
      description: description.trim(),
      price,
      duration,
      durationType,
      type,
      features: features || [],
      maxExperts,
      maxSessions,
      hasVideoCall,
      hasChat,
      hasGroupSessions,
      isActive,
      isPopular
    });
    
    res.status(201).json({
      success: true,
      data: subscription
    });
  } catch (error) {
    console.error('Subscription creation error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create subscription'
    });
  }
});

// Update subscription
const updateSubscription = asyncHandler(async (req, res) => {
  let { 
    name, 
    description, 
    price, 
    duration, 
    type, 
    features,
    isActive
  } = req.body;
  
  // Convert string values to proper types
  if (typeof price === 'string' && price !== '') {
    price = parseFloat(price);
  }
  
  if (typeof duration === 'string' && duration !== '') {
    duration = parseInt(duration);
  }
  
  const subscription = await Subscription.findById(req.params.id);
  
  if (!subscription) {
    return res.status(404).json({
      success: false,
      message: 'Subscription not found'
    });
  }
  
  // Check if name is already taken by another subscription
  if (name && name !== subscription.name) {
    const existingSubscription = await Subscription.findOne({ name, _id: { $ne: req.params.id } });
    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        message: 'Subscription name is already taken'
      });
    }
  }
  
  // Update fields
  if (name) subscription.name = name;
  if (description) subscription.description = description;
  if (typeof price === 'number') subscription.price = price;
  if (duration) subscription.duration = duration;
  
  // Handle type with validation
  if (type) {
    const validTypes = ['basic', 'premium', 'enterprise', 'trial'];
    if (validTypes.includes(type.toLowerCase())) {
      subscription.type = type.toLowerCase();
    }
  }
  
  if (features) subscription.features = features;
  if (typeof isActive === 'boolean') subscription.isActive = isActive;
  
  await subscription.save();
  
  res.status(200).json({
    success: true,
    data: subscription
  });
});

// Delete subscription
const deleteSubscription = asyncHandler(async (req, res) => {
  const subscription = await Subscription.findById(req.params.id);
  
  if (!subscription) {
    return res.status(404).json({
      success: false,
      message: 'Subscription not found'
    });
  }
  
  await Subscription.findByIdAndDelete(req.params.id);
  
  res.status(200).json({
    success: true,
    message: 'Subscription deleted successfully'
  });
});

// Toggle subscription status
const toggleSubscriptionStatus = asyncHandler(async (req, res) => {
  const subscription = await Subscription.findById(req.params.id);
  
  if (!subscription) {
    return res.status(404).json({
      success: false,
      message: 'Subscription not found'
    });
  }
  
  subscription.isActive = !subscription.isActive;
  await subscription.save();
  
  res.status(200).json({
    success: true,
    data: subscription
  });
});

// Get subscription stats
const getSubscriptionStats = asyncHandler(async (req, res) => {
  try {
    const totalSubscriptions = await Subscription.countDocuments();
    const activeSubscriptions = await Subscription.countDocuments({ isActive: true });
    const inactiveSubscriptions = await Subscription.countDocuments({ isActive: false });
    const popularSubscriptions = await Subscription.countDocuments({ isPopular: true });
    
    res.status(200).json({
      success: true,
      data: {
        total: totalSubscriptions,
        active: activeSubscriptions,
        inactive: inactiveSubscriptions,
        popular: popularSubscriptions
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription statistics'
    });
  }
});

module.exports = {
  getSubscriptions,
  getSubscriptionById,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  toggleSubscriptionStatus,
  getSubscriptionStats
};