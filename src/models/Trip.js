import mongoose from 'mongoose';

const tripSchema = new mongoose.Schema({
  tripId: {
    type: String,
    required: [true, 'Trip ID is required'],
    unique: true,
    index: true
  },
  bus: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
    required: [true, 'Bus assignment is required'],
    index: true
  },
  route: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
    required: [true, 'Route is required'],
    index: true
  },
  scheduledDeparture: {
    type: Date,
    required: [true, 'Scheduled departure time is required'],
    index: true
  },
  scheduledArrival: {
    type: Date,
    required: [true, 'Scheduled arrival time is required']
  },
  actualDeparture: {
    type: Date,
    default: null
  },
  actualArrival: {
    type: Date,
    default: null
  },
  driver: {
    name: {
      type: String,
      required: [true, 'Driver name is required'],
      trim: true
    },
    licenseNumber: {
      type: String,
      required: [true, 'Driver license is required'],
      trim: true
    },
    contactNumber: {
      type: String,
      required: [true, 'Driver contact is required'],
      trim: true
    }
  },
  conductor: {
    name: {
      type: String,
      trim: true
    },
    contactNumber: {
      type: String,
      trim: true
    }
  },
  status: {
    type: String,
    enum: ['Scheduled', 'In Progress', 'Completed', 'Cancelled', 'Delayed'],
    default: 'Scheduled',
    index: true
  },
  delay: {
    type: Number, // delay in minutes
    default: 0
  },
  fare: {
    type: Number,
    required: [true, 'Fare is required'],
    min: [0, 'Fare cannot be negative']
  },
  passengers: {
    current: { type: Number, default: 0, min: 0 },
    boardings: { type: Number, default: 0, min: 0 },
    alightings: { type: Number, default: 0, min: 0 }
  },
  weatherCondition: {
    type: String,
    enum: ['Clear', 'Rainy', 'Cloudy', 'Stormy'],
    default: 'Clear'
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
tripSchema.index({ scheduledDeparture: 1, status: 1 });
tripSchema.index({ bus: 1, scheduledDeparture: -1 });
tripSchema.index({ route: 1, scheduledDeparture: 1 });

// Virtual for trip duration
tripSchema.virtual('plannedDuration').get(function() {
  return Math.round((this.scheduledArrival - this.scheduledDeparture) / (1000 * 60)); // in minutes
});

// Virtual for actual duration
tripSchema.virtual('actualDuration').get(function() {
  if (!this.actualDeparture || !this.actualArrival) return null;
  return Math.round((this.actualArrival - this.actualDeparture) / (1000 * 60)); // in minutes
});

// Virtual for occupancy rate
tripSchema.virtual('occupancyRate').get(function() {
  if (!this.bus || !this.bus.capacity) return 0;
  return Math.round((this.passengers.current / this.bus.capacity) * 100);
});

export default mongoose.model('Trip', tripSchema);