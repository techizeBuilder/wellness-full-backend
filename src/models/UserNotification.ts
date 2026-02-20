/**
 * User Notification Model
 * For storing user-specific notifications in database
 */

import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IUserNotification extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: 'general' | 'appointment' | 'payment' | 'subscription' | 'reminder' | 'expert' | 'content';
  subType?: string;
  data?: Record<string, any>;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

type UserNotificationModel = Model<IUserNotification>;

const userNotificationSchema = new Schema<IUserNotification, UserNotificationModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    type: {
      type: String,
      enum: ['general', 'appointment', 'payment', 'subscription', 'reminder', 'expert', 'content'],
      required: true,
      default: 'general',
    },
    subType: {
      type: String,
      trim: true,
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
userNotificationSchema.index({ userId: 1, createdAt: -1 });
userNotificationSchema.index({ userId: 1, read: 1 });

const UserNotification = mongoose.model<IUserNotification>('UserNotification', userNotificationSchema);

export default UserNotification;
