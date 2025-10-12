import mongoose from 'mongoose';

const locationHistorySchema = new mongoose.Schema({
  bus: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
    required: [true, 'Bus reference is required'],
    index: true
  },
  trip: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    index: true
  },
  route: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
    index: true
  },
  busRegistration: {
    type: String,
    trim: true,
    index: true
  },
  routeNumber: {
    type: String,
    trim: true,
    index: true
  },
  coordinates: {
    latitude: {
      type: Number,
      required: [true, 'Latitude is required'],
      min: [-90, 'Latitude must be between -90 and 90'],
      max: [90, 'Latitude must be between -90 and 90']
    },
    longitude: {
      type: Number,
      required: [true, 'Longitude is required'],
      min: [-180, 'Longitude must be between -180 and 180'],
      max: [180, 'Longitude must be between -180 and 180']
    }
  },
  accuracy: {
    type: Number,
    default: null, // GPS accuracy in meters
    min: [0, 'Accuracy cannot be negative']
  },
  speed: {
    type: Number,
    default: 0, // Speed in km/h
    min: [0, 'Speed cannot be negative'],
    max: [200, 'Speed seems unrealistic']
  },
  heading: {
    type: Number,
    default: null, // Direction in degrees (0-360)
    min: [0, 'Heading must be between 0 and 360'],
    max: [360, 'Heading must be between 0 and 360']
  },
  altitude: {
    type: Number,
    default: null // Altitude in meters
  },
  deviceInfo: {
    deviceId: { type: String, trim: true },
    batteryLevel: { type: Number, min: 0, max: 100 },
    signalStrength: { type: Number, min: -120, max: 0 } // dBm
  },
  dataSource: {
    type: String,
    enum: ['GPS', 'Network', 'Manual'],
    default: 'GPS'
  },
  isValidLocation: {
    type: Boolean,
    default: true
  },
  routeDeviation: {
    type: Number,
    default: 0 // meters from planned route
  }
}, {
  timestamps: { createdAt: 'timestamp', updatedAt: false },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for efficient queries
locationHistorySchema.index({ bus: 1, timestamp: -1 });
locationHistorySchema.index({ trip: 1, timestamp: -1 });
locationHistorySchema.index({ timestamp: -1 });
locationHistorySchema.index({ 'coordinates.latitude': 1, 'coordinates.longitude': 1 });

// TTL index for data retention (keep data for 30 days)
locationHistorySchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

// Virtual for coordinate string
locationHistorySchema.virtual('coordinateString').get(function() {
  return `${this.coordinates.latitude},${this.coordinates.longitude}`;
});

// Method to calculate distance from a point
locationHistorySchema.methods.distanceFrom = function(lat, lon) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat - this.coordinates.latitude) * Math.PI / 180;
  const dLon = (lon - this.coordinates.longitude) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(this.coordinates.latitude * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in kilometers
};

export default mongoose.model('LocationHistory', locationHistorySchema);