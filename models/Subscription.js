const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Subscription name is required'],
    unique: true,
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  duration: {
    type: Number,
    required: [true, 'Duration is required'],
    min: [1, 'Duration must be at least 1 day']
  },
  durationType: {
    type: String,
    enum: ['days', 'weeks', 'months', 'years'],
    default: 'months'
  },
  type: {
    type: String,
    required: [true, 'Subscription type is required'],
    enum: ['basic', 'premium', 'enterprise', 'trial'],
    default: 'basic',
    lowercase: true
  },
  features: {
    type: [String],
    default: []
  },
  maxExperts: {
    type: Number,
    default: 1
  },
  maxSessions: {
    type: Number,
    default: 10
  },
  hasVideoCall: {
    type: Boolean,
    default: false
  },
  hasChat: {
    type: Boolean,
    default: true
  },
  hasGroupSessions: {
    type: Boolean,
    default: false
  },
  priority: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  discount: {
    type: Number,
    min: [0, 'Discount cannot be negative'],
    max: [100, 'Discount cannot exceed 100%'],
    default: 0
  },
  validFrom: {
    type: Date,
    default: Date.now
  },
  validUntil: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for efficient queries
subscriptionSchema.index({ isActive: 1, type: 1 });
subscriptionSchema.index({ price: 1 });
subscriptionSchema.index({ name: 1 });

// Virtual for formatted price
subscriptionSchema.virtual('formattedPrice').get(function() {
  return `$${this.price.toFixed(2)}`;
});

// Virtual for duration text
subscriptionSchema.virtual('durationText').get(function() {
  return `${this.duration} ${this.durationType}`;
});

// Method to check if subscription is currently valid
subscriptionSchema.methods.isCurrentlyValid = function() {
  const now = new Date();
  return this.isActive && 
         now >= this.validFrom && 
         (!this.validUntil || now <= this.validUntil);
};

// Static method to get active subscriptions
subscriptionSchema.statics.getActiveSubscriptions = function() {
  return this.find({ 
    isActive: true,
    validFrom: { $lte: new Date() },
    $or: [
      { validUntil: { $exists: false } },
      { validUntil: { $gte: new Date() } }
    ]
  }).sort({ priority: -1, price: 1 });
};

// Pre-save middleware
subscriptionSchema.pre('save', function(next) {
  // Ensure validFrom is not in the future if not explicitly set
  if (this.isNew && !this.validFrom) {
    this.validFrom = new Date();
  }
  
  // If validUntil is set, ensure it's after validFrom
  if (this.validUntil && this.validUntil <= this.validFrom) {
    return next(new Error('Valid until date must be after valid from date'));
  }
  
  next();
});

module.exports = mongoose.model('Subscription', subscriptionSchema);