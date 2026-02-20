import Content from '../../models/Content';
import { asyncHandler } from '../../middlewares/errorHandler';
import { getFileUrl } from '../../middlewares/upload';
import ENV from '../../config/environment';

// Get content statistics
const getContentStats = asyncHandler(async (req, res) => {
  try {
    const totalContent = await Content.countDocuments({ isActive: true });
    const articles = await Content.countDocuments({ type: 'article', isActive: true });
    const videos = await Content.countDocuments({ type: 'video', isActive: true });
    const audios = await Content.countDocuments({ type: 'audio', isActive: true });
    const featured = await Content.countDocuments({ featured: true, isActive: true });
    
    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalContent,
          articles,
          videos,
          audios,
          featured
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch content statistics'
    });
  }
});

// Get all contents with filters and pagination
const getContents = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, category, type, featured, contentType } = req.query;
  
  const query: Record<string, unknown> = { isActive: true };
  
  // Add search functionality
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }
  
  // Add category filter
  if (category && category !== 'All') {
    query.category = category;
  }
  
  // Add type filter
  if (type && type !== 'All') {
    query.type = type;
  }
  
  // Add featured filter
  if (featured && featured !== 'All') {
    query.featured = featured === 'true' || featured === 'Featured';
  }
  
  // Add contentType filter
  if (contentType && contentType !== 'All') {
    query.contentType = contentType;
  }
  
  const pageNumber = Number(page) || 1;
  const limitNumber = Number(limit) || 10;
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

// Get content by ID
const getContentById = asyncHandler(async (req, res) => {
  const content = await Content.findById(req.params.id);
  
  if (!content) {
    return res.status(404).json({
      success: false,
      message: 'Content not found'
    });
  }
  
  res.status(200).json({
    success: true,
    data: { content }
  });
});

// Create new content
const createContent = asyncHandler(async (req, res) => {
  const { title, description, category, type, duration, image: imageUrl, fullContent, videoUrl, audioUrl, featured, contentType } = req.body;
  
  console.log('📦 Received content creation request:');
  console.log('  - Title:', title);
  console.log('  - Category:', category);
  console.log('  - Type:', type);
  console.log('  - FullContent length:', fullContent?.length || 0);
  console.log('  - VideoUrl:', videoUrl || 'N/A');
  console.log('  - AudioUrl:', audioUrl || 'N/A');
  console.log('  - File uploaded:', !!req.file);
  console.log('  - Image URL provided:', imageUrl || 'N/A');
  
  // Check if file was uploaded or URL was provided
  let imageToSave = imageUrl;
  
  if (req.file) {
    // File was uploaded, use the uploaded file
    const uploadedFileName = req.file.filename;
    imageToSave = getFileUrl(uploadedFileName, 'content');
    
    // Convert relative URL to full URL if needed
    if (imageToSave && !imageToSave.startsWith('http')) {
      const baseUrl = ENV.BASE_URL || `http://localhost:${ENV.PORT || 5000}`;
      imageToSave = `${baseUrl}${imageToSave}`;
    }
  } else if (!imageUrl) {
    // Neither file nor URL provided
    return res.status(400).json({
      success: false,
      message: 'Either upload an image file or provide an image URL'
    });
  }
  
  // Validation
  if (!title || !description || !category || !type || !duration) {
    return res.status(400).json({
      success: false,
      message: 'All required fields must be provided'
    });
  }
  
  // Validate category
  const validCategories = ['Yoga', 'Ayurveda', 'Diet', 'Meditation'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid category. Must be one of: Yoga, Ayurveda, Diet, Meditation'
    });
  }
  
  // Validate type
  const validTypes = ['article', 'video', 'audio'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid type. Must be one of: article, video, audio'
    });
  }
  
  // Validate contentType if provided
  if (contentType) {
    const validContentTypes = ['All Content', 'Featured Content'];
    if (!validContentTypes.includes(contentType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid content type. Must be one of: All Content, Featured Content'
      });
    }
  }
  
  const content = await Content.create({
    title,
    description,
    category,
    type,
    duration,
    image: imageToSave,
    fullContent: fullContent || '',
    videoUrl: videoUrl || '',
    audioUrl: audioUrl || '',
    featured: featured || false,
    contentType: contentType || 'All Content',
    isActive: true
  });
  
  console.log('✅ Content created successfully:');
  console.log('  - ID:', content._id);
  console.log('  - Title:', content.title);
  console.log('  - FullContent stored:', !!content.fullContent);
  console.log('  - Image URL:', content.image);
  
  res.status(201).json({
    success: true,
    data: { content },
    message: 'Content created successfully'
  });
});

// Update content
const updateContent = asyncHandler(async (req, res) => {
  const { title, description, category, type, duration, image: imageUrl, fullContent, videoUrl, audioUrl, featured, contentType, isActive } = req.body;
  
  const content = await Content.findById(req.params.id);
  
  if (!content) {
    return res.status(404).json({
      success: false,
      message: 'Content not found'
    });
  }
  
  // Check if file was uploaded
  let imageToSave = imageUrl;
  
  if (req.file) {
    // File was uploaded, use the uploaded file
    const uploadedFileName = req.file.filename;
    imageToSave = getFileUrl(uploadedFileName, 'content');
    
    // Convert relative URL to full URL if needed
    if (imageToSave && !imageToSave.startsWith('http')) {
      const baseUrl = ENV.BASE_URL || `http://localhost:${ENV.PORT || 5000}`;
      imageToSave = `${baseUrl}${imageToSave}`;
    }
  }
  
  // Validate category if provided
  if (category) {
    const validCategories = ['Yoga', 'Ayurveda', 'Diet', 'Meditation'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category. Must be one of: Yoga, Ayurveda, Diet, Meditation'
      });
    }
  }
  
  // Validate type if provided
  if (type) {
    const validTypes = ['article', 'video', 'audio'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid type. Must be one of: article, video, audio'
      });
    }
  }
  
  // Validate contentType if provided
  if (contentType) {
    const validContentTypes = ['All Content', 'Featured Content'];
    if (!validContentTypes.includes(contentType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid content type. Must be one of: All Content, Featured Content'
      });
    }
  }
  
  // Update fields
  if (title !== undefined) content.title = title;
  if (description !== undefined) content.description = description;
  if (category !== undefined) content.category = category;
  if (type !== undefined) content.type = type;
  if (duration !== undefined) content.duration = duration;
  if (imageToSave !== undefined) content.image = imageToSave;
  if (fullContent !== undefined) content.fullContent = fullContent;
  if (videoUrl !== undefined) content.videoUrl = videoUrl;
  if (audioUrl !== undefined) content.audioUrl = audioUrl;
  if (featured !== undefined) content.featured = featured;
  if (contentType !== undefined) content.contentType = contentType;
  if (isActive !== undefined) content.isActive = isActive;
  
  await content.save();
  
  res.status(200).json({
    success: true,
    data: { content },
    message: 'Content updated successfully'
  });
});

// Delete content (soft delete)
const deleteContent = asyncHandler(async (req, res) => {
  const content = await Content.findById(req.params.id);
  
  if (!content) {
    return res.status(404).json({
      success: false,
      message: 'Content not found'
    });
  }
  
  // Soft delete by setting isActive to false
  content.isActive = false;
  await content.save();
  
  res.status(200).json({
    success: true,
    message: 'Content deleted successfully'
  });
});

// Permanently delete content
const permanentlyDeleteContent = asyncHandler(async (req, res) => {
  const content = await Content.findById(req.params.id);
  
  if (!content) {
    return res.status(404).json({
      success: false,
      message: 'Content not found'
    });
  }
  
  await content.deleteOne();
  
  res.status(200).json({
    success: true,
    message: 'Content permanently deleted'
  });
});

export {
  getContentStats,
  getContents,
  getContentById,
  createContent,
  updateContent,
  deleteContent,
  permanentlyDeleteContent
};
