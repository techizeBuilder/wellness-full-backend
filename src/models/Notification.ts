import mongoose, { Document, Model } from 'mongoose';

export interface INotification extends Document {
  adminId: mongoose.Schema.Types.ObjectId;
  type: 'payment' | 'new_user' | 'new_expert' | 'booking' | 'subscription' | 'system' | 'report';
  title: string;
  message: string;
  data?: {
    userId?: string;
    expertId?: string;
    paymentId?: string;
    bookingId?: string;
    subscriptionId?: string;
    [key: string]: any;
  };
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

type NotificationModel = Model<INotification>;

const notificationSchema = new mongoose.Schema<INotification, NotificationModel>({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: [true, 'Admin ID is required'],
    index: true
  },
  type: {
    type: String,
    enum: ['payment', 'new_user', 'new_expert', 'booking', 'subscription', 'system', 'report'],
    required: [true, 'Notification type is required']
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  indexes: [
    { adminId: 1, isRead: 1 },
    { adminId: 1, createdAt: -1 },
    { createdAt: -1 }
  ]
});

export default mongoose.model<INotification>('Notification', notificationSchema);
