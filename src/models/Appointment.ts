import mongoose, { Document, Model } from 'mongoose';

export interface IAppointment extends Document {
  user: mongoose.Types.ObjectId;
  expert: mongoose.Types.ObjectId;
  sessionDate: Date;
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  duration: number; // in minutes
  consultationMethod: string; // 'video', 'audio', 'chat', 'in-person'
  sessionType: string; // 'one-on-one', 'one-to-many'
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rejected';
  price: number;
  planId?: mongoose.Types.ObjectId;
  planType?: 'single' | 'monthly';
  planInstanceId?: string;
  planName?: string;
  planSessionNumber?: number;
  planTotalSessions?: number;
  planPrice?: number;
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'refunded';
  notes?: string;
  meetingLink?: string;
  cancelledBy?: 'user' | 'expert';
  cancellationReason?: string;
  agoraChannelName?: string;
  groupSessionId?: string; // For grouping appointments in the same group session
  isDynamicGroupSession?: boolean; // Flag to indicate this is a dynamic group session that references plan for date/time
  feedbackRating?: number;
  feedbackComment?: string;
  feedbackSubmittedAt?: Date;
  userReminderSentAt?: Date;
  expertReminderSentAt?: Date;
  prescription?: {
    fileName?: string;
    originalName?: string;
    mimeType?: string;
    size?: number;
    url?: string;
    uploadedAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

type AppointmentModel = Model<IAppointment>;

const appointmentSchema = new mongoose.Schema<IAppointment, AppointmentModel>({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  expert: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Expert',
    required: [true, 'Expert is required']
  },
  sessionDate: {
    type: Date
    // Not required for dynamic group sessions (will be fetched from plan)
  },
  startTime: {
    type: String,
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format. Use HH:MM format']
    // Not required for dynamic group sessions (will be fetched from plan)
  },
  endTime: {
    type: String,
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format. Use HH:MM format']
    // Not required for dynamic group sessions (will be fetched from plan)
  },
  duration: {
    type: Number,
    required: [true, 'Duration is required'],
    min: [15, 'Duration must be at least 15 minutes'],
    max: [480, 'Duration cannot exceed 8 hours']
  },
  consultationMethod: {
    type: String,
    required: [true, 'Consultation method is required'],
    enum: ['video', 'audio', 'chat', 'in-person']
  },
  sessionType: {
    type: String,
    required: [true, 'Session type is required'],
    enum: ['one-on-one', 'one-to-many']
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled', 'rejected'],
    default: 'pending'
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan'
  },
  planType: {
    type: String,
    enum: ['single', 'monthly']
  },
  planInstanceId: {
    type: String,
    index: true
  },
  planName: {
    type: String
  },
  planSessionNumber: {
    type: Number,
    min: [1, 'Plan session number must be at least 1']
  },
  planTotalSessions: {
    type: Number,
    min: [1, 'Plan total sessions must be at least 1']
  },
  planPrice: {
    type: Number,
    min: [0, 'Plan price cannot be negative']
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
    index: true
  },
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  meetingLink: {
    type: String
  },
  cancelledBy: {
    type: String,
    enum: ['user', 'expert']
  },
  cancellationReason: {
    type: String,
    maxlength: [500, 'Cancellation reason cannot exceed 500 characters']
  },
  agoraChannelName: {
    type: String,
    index: true
  },
  groupSessionId: {
    type: String,
    index: true
  },
  // Flag to indicate this is a dynamic group session that references plan for date/time
  isDynamicGroupSession: {
    type: Boolean,
    default: false
  },
  feedbackRating: {
    type: Number,
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5']
  },
  feedbackComment: {
    type: String,
    maxlength: [1000, 'Feedback cannot exceed 1000 characters']
  },
  feedbackSubmittedAt: {
    type: Date
  },
  userReminderSentAt: {
    type: Date
  },
  expertReminderSentAt: {
    type: Date
  },
  prescription: {
    fileName: {
      type: String
    },
    originalName: {
      type: String
    },
    mimeType: {
      type: String
    },
    size: {
      type: Number
    },
    url: {
      type: String
    },
    uploadedAt: {
      type: Date
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
appointmentSchema.index({ user: 1, sessionDate: 1 });
appointmentSchema.index({ expert: 1, sessionDate: 1 });
appointmentSchema.index({ expert: 1, sessionDate: 1, startTime: 1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ sessionDate: 1, startTime: 1, endTime: 1 });
appointmentSchema.index({ planId: 1 });

// Pre-save validation: ensure end time is after start time (skip for dynamic group sessions)
appointmentSchema.pre('save', function(next) {
  // Skip validation for dynamic group sessions (date/time comes from plan)
  if ((this as any).isDynamicGroupSession) {
    return next();
  }

  if (
    !this.isModified('startTime') &&
    !this.isModified('endTime') &&
    !this.isModified('duration')
  ) {
    return next();
  }

  // Skip if startTime or endTime are not set (dynamic group session)
  if (!this.startTime || !this.endTime) {
    return next();
  }

  const [startHour, startMin] = this.startTime.split(':').map(Number);
  const [endHour, endMin] = this.endTime.split(':').map(Number);
  const startTotal = startHour * 60 + startMin;
  const endTotal = endHour * 60 + endMin;
  
  if (endTotal <= startTotal) {
    return next(new Error('End time must be after start time'));
  }
  
  // Validate duration matches time difference
  const calculatedDuration = endTotal - startTotal;
  if (Math.abs(calculatedDuration - this.duration) > 5) { // Allow 5 minute tolerance
    return next(new Error('Duration does not match the time difference'));
  }
  
  next();
});

appointmentSchema.pre('save', function(next) {
  // Set agoraChannelName for video/audio consultations
  if ((this.consultationMethod === 'video' || this.consultationMethod === 'audio') && !this.agoraChannelName) {
    if (this.sessionType === 'one-to-many') {
      // For group sessions, use shared channel
      if ((this as any).groupSessionId) {
        // Monthly group session created by expert - use groupSessionId
        this.agoraChannelName = `group_${(this as any).groupSessionId}`;
      } else if (this.planId) {
        // For dynamic group sessions, use planId only (not date/time since it can change)
        if ((this as any).isDynamicGroupSession) {
          this.agoraChannelName = `group_plan_${this.planId.toString()}`;
        } else {
          // Legacy: Single group session plan with fixed date/time
          const sessionDate = new Date(this.sessionDate);
          const dateStr = sessionDate.toISOString().split('T')[0].replace(/-/g, '');
          const timeStr = this.startTime?.replace(':', '') || '';
          this.agoraChannelName = `group_plan_${this.planId.toString()}_${dateStr}_${timeStr}`;
        }
      } else {
        // Fallback to appointment ID (shouldn't happen for group sessions)
        this.agoraChannelName = `booking_${this._id.toString()}`;
      }
    } else {
      // One-on-one session - use appointment ID
      this.agoraChannelName = `booking_${this._id.toString()}`;
    }
  }
  next();
});

const Appointment = mongoose.model<IAppointment, AppointmentModel>(
  'Appointment',
  appointmentSchema
);

export default Appointment;

