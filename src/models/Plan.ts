import mongoose, { Document, Model } from 'mongoose';

export interface IPlan extends Document {
  expert: mongoose.Types.ObjectId;
  name: string;
  type: 'single' | 'monthly';
  description?: string;
  // For single class
  sessionClassType?: string; // e.g., "Power Yoga", "Meditation Yoga"
  sessionFormat?: 'one-on-one' | 'one-to-many';
  price: number;
  duration?: number; // in minutes
  
  // For monthly subscription
  classesPerMonth?: number;
  monthlyPrice?: number;
  
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type PlanModel = Model<IPlan>;

const planSchema = new mongoose.Schema<IPlan, PlanModel>({
  expert: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Expert',
    required: [true, 'Expert is required'],
    index: true
  },
  name: {
    type: String,
    required: [true, 'Plan name is required'],
    trim: true,
    maxlength: [100, 'Plan name cannot exceed 100 characters']
  },
  type: {
    type: String,
    enum: ['single', 'monthly'],
    required: [true, 'Plan type is required']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  // For single class
  sessionClassType: {
    type: String,
    trim: true
  },
  sessionFormat: {
    type: String,
    enum: ['one-on-one', 'one-to-many']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  duration: {
    type: Number,
    min: [15, 'Duration must be at least 15 minutes'],
    max: [480, 'Duration cannot exceed 8 hours']
  },
  // For monthly subscription
  classesPerMonth: {
    type: Number,
    min: [1, 'Classes per month must be at least 1'],
    max: [100, 'Classes per month cannot exceed 100']
  },
  monthlyPrice: {
    type: Number,
    min: [0, 'Monthly price cannot be negative']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
planSchema.index({ expert: 1, isActive: 1 });
planSchema.index({ type: 1, isActive: 1 });

// Validation: For monthly plans, classesPerMonth and monthlyPrice are required
planSchema.pre('save', function(next) {
  if (this.type === 'monthly') {
    if (!this.classesPerMonth || this.classesPerMonth < 1) {
      return next(new Error('Monthly plans must specify classesPerMonth (minimum 1)'));
    }
    if (!this.monthlyPrice || this.monthlyPrice < 0) {
      return next(new Error('Monthly plans must specify monthlyPrice'));
    }
  }
  if (this.type === 'single') {
    if (!this.sessionFormat) {
      return next(new Error('Single class plans must specify sessionFormat'));
    }
  }
  next();
});

const Plan = mongoose.model<IPlan, PlanModel>('Plan', planSchema);

export default Plan;

