import mongoose, { Document, Model } from 'mongoose';

export interface IPayment extends Document {
  user: mongoose.Types.ObjectId;
  expert?: mongoose.Types.ObjectId;
  appointment?: mongoose.Types.ObjectId;
  subscription?: mongoose.Types.ObjectId;
  plan?: mongoose.Types.ObjectId;
  
  // Razorpay details
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  
  // Payment details
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';
  paymentMethod?: 'card' | 'upi' | 'wallet' | 'netbanking' | 'other';
  
  // Payment metadata
  description?: string;
  receipt?: string;
  notes?: string;
  
  // Timestamps
  paidAt?: Date;
  failedAt?: Date;
  refundedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

type PaymentModel = Model<IPayment>;

const paymentSchema = new mongoose.Schema<IPayment, PaymentModel>({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
    index: true
  },
  expert: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Expert',
    index: true
  },
  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    index: true
  },
  subscription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserSubscription',
    index: true
  },
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    index: true
  },
  razorpayOrderId: {
    type: String,
    index: true,
    sparse: true
  },
  razorpayPaymentId: {
    type: String,
    index: true,
    sparse: true
  },
  razorpaySignature: {
    type: String
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  currency: {
    type: String,
    default: 'INR',
    enum: ['INR', 'USD', 'EUR'],
    uppercase: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'],
    default: 'pending',
    index: true
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'upi', 'wallet', 'netbanking', 'other']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  receipt: {
    type: String
  },
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  paidAt: {
    type: Date
  },
  failedAt: {
    type: Date
  },
  refundedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
paymentSchema.index({ user: 1, status: 1 });
paymentSchema.index({ razorpayOrderId: 1 });
paymentSchema.index({ razorpayPaymentId: 1 });
paymentSchema.index({ createdAt: -1 });

// Virtual to check if payment is successful
paymentSchema.virtual('isSuccessful').get(function(this: IPayment) {
  return this.status === 'completed';
});

// Method to mark payment as completed
paymentSchema.methods.markAsCompleted = async function(paymentId: string, signature?: string) {
  this.status = 'completed';
  this.razorpayPaymentId = paymentId;
  if (signature) {
    this.razorpaySignature = signature;
  }
  this.paidAt = new Date();
  await this.save();
};

// Method to mark payment as failed
paymentSchema.methods.markAsFailed = async function(reason?: string) {
  this.status = 'failed';
  this.failedAt = new Date();
  if (reason) {
    this.notes = reason;
  }
  await this.save();
};

const Payment = mongoose.model<IPayment, PaymentModel>('Payment', paymentSchema);

export default Payment;
