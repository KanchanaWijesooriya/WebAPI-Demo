import mongoose from 'mongoose';

const routeSchema = new mongoose.Schema({
  routeId: {
    type: String,
    required: [true, 'Route ID is required'],
    unique: true,
    trim: true,
    index: true
  },
  routeNumber: {
    type: String,
    required: [true, 'Route number is required'],
    trim: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Route name is required'],
    trim: true
  },
  start: {
    city: {
      type: String,
      required: [true, 'start city is required'],
      trim: true
    },
    province: {
      type: String,
      required: [true, 'start province is required'],
      trim: true
    },
    coordinates: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true }
    }
  },
  destination: {
    city: {
      type: String,
      required: [true, 'Destination city is required'],
      trim: true
    },
    province: {
      type: String,
      required: [true, 'Destination province is required'],  
      trim: true
    },
    coordinates: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true }
    }
  },
  distance: {
    type: Number,
    required: [true, 'Route distance is required'],
    min: [0, 'Distance cannot be negative']
  },
  estimatedDuration: {
    type: Number, // in minutes
    required: [true, 'Estimated duration is required'],
    min: [0, 'Duration cannot be negative']
  },
  stops: [{
    name: { type: String, required: true },
    coordinates: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true }
    },
    order: { type: Number, required: true },
    distanceFromstart: { type: Number, default: 0 }, // km from start
    cumulativeDistance: { type: Number, default: 0 }  // total distance covered
  }],
  // Stopwise pricing information
  pricingInfo: {
    // baseFare: { type: Number, default: 50 }, // minimum fare
    // pricePerKm: { type: Number, default: 7 }, // rate per kilometer
    stopwisePricing: [{
      fromStop: { type: String, required: true },
      toStop: { type: String, required: true },
      distance: { type: Number, required: true }, // in km
      price: { type: Number, required: true }, // in LKR
      busTypeMultipliers: {
        Normal: { type: Number, default: 1.0 },
        'Express': { type: Number, default: 1.6 },
        'Intercity Express': { type: Number, default: 1.8 }
      }
    }]
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
routeSchema.index({ 'start.city': 1, 'destination.city': 1 });
routeSchema.index({ 'start.province': 1, 'destination.province': 1 });
routeSchema.index({ isActive: 1 });

// Virtual for route display name
routeSchema.virtual('displayName').get(function() {
  return `${this.start.city} - ${this.destination.city}`;
});

export default mongoose.model('Route', routeSchema);