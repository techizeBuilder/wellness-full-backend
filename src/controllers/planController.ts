import { asyncHandler } from '../middlewares/errorHandler';
import Plan, { IPlan } from '../models/Plan';
import Expert from '../models/Expert';
import { getFileUrl } from '../middlewares/upload';

// @desc    Get all plans for current expert
// @route   GET /api/plans
// @access  Private (Expert)
export const getMyPlans = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  
  if (!currentUser || !currentUser._id) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  const expertId = currentUser._id.toString();
  const plans = await Plan.find({ expert: expertId }).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: { plans }
  });
});

// @desc    Get all active plans for an expert (public)
// @route   GET /api/plans/expert/:expertId
// @access  Public
export const getExpertPlans = asyncHandler(async (req, res) => {
  const { expertId } = req.params;

  if (!expertId) {
    return res.status(400).json({
      success: false,
      message: 'Expert ID is required'
    });
  }

  const expert = await Expert.findById(expertId);
  if (!expert) {
    return res.status(404).json({
      success: false,
      message: 'Expert not found'
    });
  }

  const plans = await Plan.find({ 
    expert: expertId,
    isActive: true 
  }).sort({ type: 1, createdAt: -1 });

  res.status(200).json({
    success: true,
    data: { plans }
  });
});

// @desc    Get plan by ID
// @route   GET /api/plans/:id
// @access  Private (Expert) or Public (if expert's plan)
export const getPlanById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const currentUser = req.user;

  const plan = await Plan.findById(id);
  if (!plan) {
    return res.status(404).json({
      success: false,
      message: 'Plan not found'
    });
  }

  // If user is authenticated and is the expert, allow access
  // Otherwise, only allow if plan is active
  if (currentUser && currentUser._id && currentUser._id.toString() === plan.expert.toString()) {
    return res.status(200).json({
      success: true,
      data: { plan }
    });
  }

  if (!plan.isActive) {
    return res.status(404).json({
      success: false,
      message: 'Plan not found'
    });
  }

  res.status(200).json({
    success: true,
    data: { plan }
  });
});

// @desc    Create a new plan
// @route   POST /api/plans
// @access  Private (Expert)
export const createPlan = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  
  if (!currentUser || !currentUser._id) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  const expertId = currentUser._id.toString();
  const {
    name,
    type,
    description,
    sessionClassType,
    sessionFormat,
    price,
    duration,
    classesPerMonth,
    monthlyPrice
  } = req.body;

  // Validation
  if (!name || !type || price === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Name, type, and price are required'
    });
  }

  if (type === 'single') {
    if (!sessionFormat) {
      return res.status(400).json({
        success: false,
        message: 'Session format is required for single class plans'
      });
    }
  }

  if (type === 'monthly') {
    if (!classesPerMonth || classesPerMonth < 1) {
      return res.status(400).json({
        success: false,
        message: 'Classes per month is required for monthly plans (minimum 1)'
      });
    }
    if (monthlyPrice === undefined || monthlyPrice < 0) {
      return res.status(400).json({
        success: false,
        message: 'Monthly price is required for monthly plans'
      });
    }
  }

  const planData: any = {
    expert: expertId,
    name,
    type,
    price,
    isActive: true
  };

  if (description) planData.description = description;
  if (duration) planData.duration = duration;

  if (type === 'single') {
    if (sessionClassType) planData.sessionClassType = sessionClassType;
    planData.sessionFormat = sessionFormat;
  }

  if (type === 'monthly') {
    planData.classesPerMonth = classesPerMonth;
    planData.monthlyPrice = monthlyPrice;
    planData.sessionFormat = sessionFormat; // Optional for monthly
    if (sessionClassType) planData.sessionClassType = sessionClassType;
  }

  const plan = await Plan.create(planData);

  res.status(201).json({
    success: true,
    message: 'Plan created successfully',
    data: { plan }
  });
});

// @desc    Update a plan
// @route   PUT /api/plans/:id
// @access  Private (Expert)
export const updatePlan = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  const { id } = req.params;
  
  if (!currentUser || !currentUser._id) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  const expertId = currentUser._id.toString();
  const plan = await Plan.findById(id);

  if (!plan) {
    return res.status(404).json({
      success: false,
      message: 'Plan not found'
    });
  }

  if (plan.expert.toString() !== expertId) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to update this plan'
    });
  }

  const {
    name,
    description,
    sessionClassType,
    sessionFormat,
    price,
    duration,
    classesPerMonth,
    monthlyPrice,
    isActive
  } = req.body;

  if (name) plan.name = name;
  if (description !== undefined) plan.description = description;
  if (sessionClassType !== undefined) plan.sessionClassType = sessionClassType;
  if (sessionFormat !== undefined) plan.sessionFormat = sessionFormat;
  if (price !== undefined) plan.price = price;
  if (duration !== undefined) plan.duration = duration;
  if (isActive !== undefined) plan.isActive = isActive;

  if (plan.type === 'monthly') {
    if (classesPerMonth !== undefined) plan.classesPerMonth = classesPerMonth;
    if (monthlyPrice !== undefined) plan.monthlyPrice = monthlyPrice;
  }

  await plan.save();

  res.status(200).json({
    success: true,
    message: 'Plan updated successfully',
    data: { plan }
  });
});

// @desc    Delete a plan
// @route   DELETE /api/plans/:id
// @access  Private (Expert)
export const deletePlan = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  const { id } = req.params;
  
  if (!currentUser || !currentUser._id) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  const expertId = currentUser._id.toString();
  const plan = await Plan.findById(id);

  if (!plan) {
    return res.status(404).json({
      success: false,
      message: 'Plan not found'
    });
  }

  if (plan.expert.toString() !== expertId) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to delete this plan'
    });
  }

  await Plan.findByIdAndDelete(id);

  res.status(200).json({
    success: true,
    message: 'Plan deleted successfully'
  });
});

