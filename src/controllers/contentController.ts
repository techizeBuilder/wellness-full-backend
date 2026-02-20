import Content from '../models/Content';
import { asyncHandler } from '../middlewares/errorHandler';

// @desc    Get all active contents
// @route   GET /api/contents
// @access  Public
export const getContents = asyncHandler(async (req, res) => {
  const { category, type, featured, search, contentType, page = 1, limit = 50 } = req.query;
  
  const query: Record<string, unknown> = { isActive: true };
  
  // Add category filter
  if (category && category !== 'All') {
    query.category = category;
  }
  
  // Add type filter
  if (type && type !== 'All') {
    query.type = type;
  }
  
  // Add featured filter
  if (featured !== undefined && featured !== 'All') {
    query.featured = featured === 'true' || featured === true;
  }
  
  // Add contentType filter
  if (contentType && contentType !== 'All') {
    query.contentType = contentType;
  }
  
  // Add search functionality
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }
  
  const pageNumber = Number(page) || 1;
  const limitNumber = Number(limit) || 50;
  const skip = (pageNumber - 1) * limitNumber;
  
  const contents = await Content.find(query)
    .sort({ createdAt: -1 })
    .limit(limitNumber)
    .skip(skip);
    
  const total = await Content.countDocuments(query);
  
  res.status(200).json({
    success: true,
    data: {
      contents,
      pagination: {
        current: pageNumber,
        pages: Math.ceil(total / limitNumber),
        total
      }
    }
  });
});

// @desc    Get featured contents
// @route   GET /api/contents/featured
// @access  Public
export const getFeaturedContents = asyncHandler(async (req, res) => {
  const { category, type, limit = 10 } = req.query;
  
  const query: Record<string, unknown> = { 
    isActive: true,
    featured: true 
  };
  
  // Add category filter
  if (category && category !== 'All') {
    query.category = category;
  }
  
  // Add type filter
  if (type && type !== 'All') {
    query.type = type;
  }
  
  const limitNumber = Number(limit) || 10;
  
  const contents = await Content.find(query)
    .sort({ createdAt: -1 })
    .limit(limitNumber);
  
  res.status(200).json({
    success: true,
    data: { contents }
  });
});

// @desc    Get content by ID
// @route   GET /api/contents/:id
// @access  Public
export const getContentById = asyncHandler(async (req, res) => {
  console.log('🔍 Fetching content by ID:', req.params.id);
  
  const content = await Content.findOne({ 
    _id: req.params.id,
    isActive: true 
  });
  
  if (!content) {
    console.log('❌ Content not found for ID:', req.params.id);
    return res.status(404).json({
      success: false,
      message: 'Content not found'
    });
  }
  
  console.log('✅ Content found:');
  console.log('  - Title:', content.title);
  console.log('  - Image:', content.image);
  console.log('  - FullContent length:', content.fullContent?.length || 0);
  console.log('  - VideoUrl:', content.videoUrl || 'N/A');
  console.log('  - AudioUrl:', content.audioUrl || 'N/A');
  
  res.status(200).json({
    success: true,
    data: { content }
  });
});

// @desc    Get contents by category
// @route   GET /api/contents/category/:category
// @access  Public
export const getContentsByCategory = asyncHandler(async (req, res) => {
  const { category } = req.params;
  const { type, featured, page = 1, limit = 20 } = req.query;
  
  const validCategories = ['Yoga', 'Ayurveda', 'Diet', 'Meditation'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid category'
    });
  }
  
  const query: Record<string, unknown> = { 
    isActive: true,
    category 
  };
  
  // Add type filter
  if (type && type !== 'All') {
    query.type = type;
  }
  
  // Add featured filter
  if (featured !== undefined && featured !== 'All') {
    query.featured = featured === 'true' || featured === true;
  }
  
  const pageNumber = Number(page) || 1;
  const limitNumber = Number(limit) || 20;
  const skip = (pageNumber - 1) * limitNumber;
  
  const contents = await Content.find(query)
    .sort({ createdAt: -1 })
    .limit(limitNumber)
    .skip(skip);
    
  const total = await Content.countDocuments(query);
  
  res.status(200).json({
    success: true,
    data: {
      contents,
      pagination: {
        current: pageNumber,
        pages: Math.ceil(total / limitNumber),
        total
      }
    }
  });
});

// @desc    Get contents by type
// @route   GET /api/contents/type/:type
// @access  Public
export const getContentsByType = asyncHandler(async (req, res) => {
  const { type } = req.params;
  const { category, featured, page = 1, limit = 20 } = req.query;
  
  const validTypes = ['article', 'video', 'audio'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid type'
    });
  }
  
  const query: Record<string, unknown> = { 
    isActive: true,
    type 
  };
  
  // Add category filter
  if (category && category !== 'All') {
    query.category = category;
  }
  
  // Add featured filter
  if (featured !== undefined && featured !== 'All') {
    query.featured = featured === 'true' || featured === true;
  }
  
  const pageNumber = Number(page) || 1;
  const limitNumber = Number(limit) || 20;
  const skip = (pageNumber - 1) * limitNumber;
  
  const contents = await Content.find(query)
    .sort({ createdAt: -1 })
    .limit(limitNumber)
    .skip(skip);
    
  const total = await Content.countDocuments(query);
  
  res.status(200).json({
    success: true,
    data: {
      contents,
      pagination: {
        current: pageNumber,
        pages: Math.ceil(total / limitNumber),
        total
      }
    }
  });
});
