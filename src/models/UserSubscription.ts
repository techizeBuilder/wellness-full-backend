import mongoose, { Document, Model } from 'mongoose';

export interface IUserSubscription extends Document {
  user: mongoose.Types.ObjectId;
  expert: mongoose.Types.ObjectId;
  plan: mongoose.Types.ObjectId;
  planInstanceId: string; // Links to appointments with same planInstanceId
  planName: string;
  planType: 'single' | 'monthly';
  startDate: Date;
  expiryDate: Date;
  nextBillingDate?: Date; // For monthly subscriptions
  totalSessions: number; // Total sessions in this subscription
  sessionsUsed: number; // Number of sessions completed/used
  sessionsRemaining: number; // Calculated: totalSessions - sessionsUsed
  monthlyPrice?: number;
  status: 'active' | 'expired' | 'cancelled';
  autoRenewal: boolean;
  cancelledAt?: Date;
  cancelledBy?: 'user' | 'expert';
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

type UserSubscriptionModel = Model<IUserSubscription>;

const userSubscriptionSchema = new mongoose.Schema<IUserSubscription, UserSubscriptionModel>({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
    index: true
  },
  expert: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Expert',
    required: [true, 'Expert is required'],
    index: true
  },
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    required: [true, 'Plan is required'],
    index: true
  },
  planInstanceId: {
    type: String,
    required: [true, 'Plan instance ID is required'],
    index: true
  },
  planName: {
    type: String,
    required: [true, 'Plan name is required'],
    trim: true
  },
  planType: {
    type: String,
    enum: ['single', 'monthly'],
    required: [true, 'Plan type is required']
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required'],
    default: Date.now
  },
  expiryDate: {
    type: Date,
    required: [true, 'Expiry date is required']
  },
  nextBillingDate: {
    type: Date
  },
  totalSessions: {
    type: Number,
    required: [true, 'Total sessions is required'],
    min: [1, 'Total sessions must be at least 1']
  },
  sessionsUsed: {
    type: Number,
    default: 0,
    min: [0, 'Sessions used cannot be negative']
  },
  sessionsRemaining: {
    type: Number,
    default: function(this: IUserSubscription) {
      return this.totalSessions - this.sessionsUsed;
    },
    min: [0, 'Sessions remaining cannot be negative']
  },
  monthlyPrice: {
    type: Number,
    min: [0, 'Monthly price cannot be negative']
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled'],
    default: 'active',
    index: true
  },
  autoRenewal: {
    type: Boolean,
    default: true
  },
  cancelledAt: {
    type: Date
  },
  cancelledBy: {
    type: String,
    enum: ['user', 'expert']
  },
  cancellationReason: {
    type: String,
    maxlength: [500, 'Cancellation reason cannot exceed 500 characters']
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
userSubscriptionSchema.index({ user: 1, status: 1 });
userSubscriptionSchema.index({ expert: 1, status: 1 });
userSubscriptionSchema.index({ planInstanceId: 1 });
userSubscriptionSchema.index({ expiryDate: 1, status: 1 });
userSubscriptionSchema.index({ nextBillingDate: 1, status: 1 });

// Virtual to check if subscription is currently active
userSubscriptionSchema.virtual('isActive').get(function(this: IUserSubscription) {
  const now = new Date();
  return this.status === 'active' && 
         now >= this.startDate && 
         now <= this.expiryDate &&
         this.sessionsRemaining > 0;
});

// Method to update sessions used (call this when appointment is completed)
userSubscriptionSchema.methods.incrementSessionsUsed = async function() {
  if (this.sessionsUsed < this.totalSessions) {
    this.sessionsUsed += 1;
    this.sessionsRemaining = this.totalSessions - this.sessionsUsed;
    await this.save();
  }
};

// Method to cancel subscription
userSubscriptionSchema.methods.cancel = async function(cancelledBy: 'user' | 'expert', reason?: string) {
  this.status = 'cancelled';
  this.cancelledAt = new Date();
  this.cancelledBy = cancelledBy;
  if (reason) {
    this.cancellationReason = reason;
  }
  this.autoRenewal = false;
  await this.save();
};

// Pre-save middleware to calculate sessions remaining
userSubscriptionSchema.pre('save', function(next) {
  this.sessionsRemaining = this.totalSessions - this.sessionsUsed;
  
  // Auto-expire if past expiry date
  if (this.status === 'active' && new Date() > this.expiryDate) {
    this.status = 'expired';
  }
  
  next();
});

const UserSubscription = mongoose.model<IUserSubscription, UserSubscriptionModel>('UserSubscription', userSubscriptionSchema);

export default UserSubscription;

