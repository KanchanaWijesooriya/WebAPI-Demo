import mongoose from 'mongoose';

const busSchema = new mongoose.Schema({
  busNumber: {
    type: String,
    required: [true, 'Bus number is required'],
    unique: true,
    trim: true,
    index: true
  },
  registrationNumber: {
    type: String,
    required: [true, 'Registration number is required'],
    unique: true,
    trim: true
  },
  operator: {
    name: {
      type: String,
      required: [true, 'Operator name is required'],
      trim: true
    },
    contactNumber: {
      type: String,
      required: [true, 'Operator contact is required'],
      trim: true
    },
    licenseNumber: {
      type: String,
      required: [true, 'Operator license is required'],
      trim: true
    }
  },
  route: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
    required: [true, 'Route assignment is required'],
    index: true
  },
  capacity: {
    type: Number,
    required: [true, 'Bus capacity is required'],
    min: [1, 'Capacity must be at least 1'],
    max: [100, 'Capacity cannot exceed 100']
  },
  busType: {
    type: String,
    enum: ['Normal', 'Semi-Luxury', 'Luxury', 'Air-Conditioned'],
    default: 'Normal'
  },
  facilities: [{
    type: String,
    enum: ['WiFi', 'AC', 'Charging Ports', 'Entertainment System', 'Washroom']
  }],
  currentLocation: {
    coordinates: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null }
    },
    lastUpdated: { type: Date, default: null },
    accuracy: { type: Number, default: null }, // GPS accuracy in meters
    speed: { type: Number, default: 0 }, // Current speed in km/h
    heading: { type: Number, default: null } // Direction in degrees
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Maintenance', 'Out of Service'],
    default: 'Inactive',
    index: true
  },
  isOnline: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
busSchema.index({ route: 1, status: 1 });
busSchema.index({ isOnline: 1, status: 1 });
busSchema.index({ 'currentLocation.lastUpdated': -1 });

// Virtual for location status
busSchema.virtual('locationStatus').get(function() {
  if (!this.currentLocation.lastUpdated) return 'No GPS Data';
  
  const timeDiff = Date.now() - this.currentLocation.lastUpdated.getTime();
  const minutesDiff = timeDiff / (1000 * 60);
  
  if (minutesDiff < 5) return 'Live';
  if (minutesDiff < 15) return 'Recent';
  return 'Outdated';
});

export default mongoose.model('Bus', busSchema);