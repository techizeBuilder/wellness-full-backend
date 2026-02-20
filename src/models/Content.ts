import mongoose, { Document, Model } from 'mongoose';

export interface IContent extends Document {
  title: string;
  description: string;
  category: 'Yoga' | 'Ayurveda' | 'Diet' | 'Meditation';
  type: 'article' | 'video' | 'audio';
  duration: string;
  image: string;
  fullContent: string;
  videoUrl?: string;
  audioUrl?: string;
  featured: boolean;
  contentType: 'All Content' | 'Featured Content';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type ContentModel = Model<IContent>;

const contentSchema = new mongoose.Schema<IContent, ContentModel>({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: ['Yoga', 'Ayurveda', 'Diet', 'Meditation'],
      message: 'Category must be one of: Yoga, Ayurveda, Diet, Meditation'
    }
  },
  type: {
    type: String,
    required: [true, 'Type is required'],
    enum: {
      values: ['article', 'video', 'audio'],
      message: 'Type must be one of: article, video, audio'
    }
  },
  duration: {
    type: String,
    required: [true, 'Duration is required'],
    trim: true,
    maxlength: [50, 'Duration cannot exceed 50 characters']
  },
  image: {
    type: String,
    required: [true, 'Image URL is required'],
    trim: true
  },
  fullContent: {
    type: String,
    trim: true,
    maxlength: [50000, 'Full content cannot exceed 50000 characters']
  },
  videoUrl: {
    type: String,
    trim: true
  },
  audioUrl: {
    type: String,
    trim: true
  },
  featured: {
    type: Boolean,
    default: false
  },
  contentType: {
    type: String,
    enum: {
      values: ['All Content', 'Featured Content'],
      message: 'Content type must be one of: All Content, Featured Content'
    },
    default: 'All Content'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
contentSchema.index({ category: 1 });
contentSchema.index({ type: 1 });
contentSchema.index({ featured: 1 });
contentSchema.index({ contentType: 1 });
contentSchema.index({ isActive: 1 });
contentSchema.index({ createdAt: -1 });

// Text index for search functionality
contentSchema.index({ title: 'text', description: 'text' });

const Content = mongoose.model<IContent, ContentModel>('Content', contentSchema);

export default Content;
