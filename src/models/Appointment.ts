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
  notes?: string;
  meetingLink?: string;
  cancelledBy?: 'user' | 'expert';
  cancellationReason?: string;
  agoraChannelName?: string;
  feedbackRating?: number;
  feedbackComment?: string;
  feedbackSubmittedAt?: Date;
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
    type: Date,
    required: [true, 'Session date is required']
  },
  startTime: {
    type: String,
    required: [true, 'Start time is required'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format. Use HH:MM format']
  },
  endTime: {
    type: String,
    required: [true, 'End time is required'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format. Use HH:MM format']
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

// Pre-save validation: ensure end time is after start time
appointmentSchema.pre('save', function(next) {
  if (
    !this.isModified('startTime') &&
    !this.isModified('endTime') &&
    !this.isModified('duration')
  ) {
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
  if (this.consultationMethod === 'video' && !this.agoraChannelName) {
    this.agoraChannelName = `booking_${this._id.toString()}`;
  }
  next();
});

const Appointment = mongoose.model<IAppointment, AppointmentModel>(
  'Appointment',
  appointmentSchema
);

export default Appointment;

