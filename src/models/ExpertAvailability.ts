import mongoose, { Document, Model } from 'mongoose';

interface ITimeRange {
  startTime: string;
  endTime: string;
}

interface IDayAvailability {
  day: string;
  dayName: string;
  isOpen: boolean;
  timeRanges: ITimeRange[];
}

export interface IExpertAvailability extends Document {
  expert: mongoose.Types.ObjectId;
  availability: IDayAvailability[];
  createdAt: Date;
  updatedAt: Date;
}

type ExpertAvailabilityModel = Model<IExpertAvailability>;

const timeRangeSchema = new mongoose.Schema({
  startTime: {
    type: String,
    required: true,
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format. Use HH:MM format']
  },
  endTime: {
    type: String,
    required: true,
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format. Use HH:MM format']
  }
}, { _id: false });

const dayAvailabilitySchema = new mongoose.Schema({
  day: {
    type: String,
    required: true,
    enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  },
  dayName: {
    type: String,
    required: true,
    enum: ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  },
  isOpen: {
    type: Boolean,
    default: false
  },
  timeRanges: {
    type: [timeRangeSchema],
    default: []
  }
}, { _id: false });

const expertAvailabilitySchema = new mongoose.Schema<IExpertAvailability, ExpertAvailabilityModel>({
  expert: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Expert',
    required: true,
    unique: true
  },
  availability: {
    type: [dayAvailabilitySchema],
    required: true,
    validate: {
      validator: function(availability: IDayAvailability[]) {
        // Ensure we have exactly 7 days
        return availability.length === 7;
      },
      message: 'Availability must contain exactly 7 days (Sunday through Saturday)'
    }
  }
}, {
  timestamps: true
});

// Index for expert lookup
expertAvailabilitySchema.index({ expert: 1 });

// Ensure one availability record per expert
expertAvailabilitySchema.index({ expert: 1 }, { unique: true });

// Pre-save validation: ensure time ranges are valid
expertAvailabilitySchema.pre('save', function(next) {
  for (const day of this.availability) {
    if (day.isOpen && day.timeRanges.length === 0) {
      return next(new Error(`Day ${day.day} is marked as open but has no time ranges`));
    }
    
    for (const range of day.timeRanges) {
      const [startHour, startMin] = range.startTime.split(':').map(Number);
      const [endHour, endMin] = range.endTime.split(':').map(Number);
      const startTotal = startHour * 60 + startMin;
      const endTotal = endHour * 60 + endMin;
      
      if (endTotal <= startTotal) {
        return next(new Error(`Invalid time range for ${day.day}: end time must be after start time`));
      }
    }
  }
  next();
});

const ExpertAvailability = mongoose.model<IExpertAvailability, ExpertAvailabilityModel>(
  'ExpertAvailability',
  expertAvailabilitySchema
);

export default ExpertAvailability;

