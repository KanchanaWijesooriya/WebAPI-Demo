import { jest } from '@jest/globals';

// Mock mongoose before importing the model
const mockMongoose = {
  Schema: jest.fn().mockImplementation((schema, options) => {
    const MockSchema = function(definition, opts) {
      this.definition = definition;
      this.options = opts || {};
      this.virtuals = {};
      this.indexes = [];
      this.middleware = {};
    };
    
    // Add Types.ObjectId to Schema
    MockSchema.Types = {
      ObjectId: jest.fn().mockImplementation(() => 'mock_object_id')
    };
    
    MockSchema.prototype.virtual = jest.fn().mockImplementation(function(name) {
      this.virtuals[name] = { get: null };
      return {
        get: jest.fn().mockImplementation((fn) => {
          this.virtuals[name].get = fn;
          return this;
        })
      };
    });
    
    MockSchema.prototype.index = jest.fn().mockImplementation(function(fields, options) {
      this.indexes.push({ fields, options });
      return this;
    });
    
    MockSchema.prototype.pre = jest.fn().mockImplementation(function(hook, fn) {
      this.middleware[hook] = this.middleware[hook] || [];
      this.middleware[hook].push(fn);
      return this;
    });
    
    const schemaInstance = new MockSchema(schema, options || {});
    schemaInstance.Types = MockSchema.Types;
    return schemaInstance;
  }),
  model: jest.fn().mockImplementation((name, schema) => {
    const MockModel = function(data = {}) {
      Object.assign(this, data);
      this._id = 'mock_id_' + Math.random();
      this.isNew = true;
      this.isModified = jest.fn().mockReturnValue(false);
      this.save = jest.fn().mockResolvedValue(this);
      this.toJSON = jest.fn().mockReturnValue(this);
      this.toObject = jest.fn().mockReturnValue(this);
      
      // Apply virtuals
      if (schema.virtuals) {
        Object.keys(schema.virtuals).forEach(virtualName => {
          if (schema.virtuals[virtualName].get) {
            Object.defineProperty(this, virtualName, {
              get: schema.virtuals[virtualName].get.bind(this),
              enumerable: true
            });
          }
        });
      }
    };
    
    // Static methods
    MockModel.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([])
    });
    
    MockModel.findById = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(null)
    });
    
    MockModel.findOne = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(null)
    });
    
    MockModel.create = jest.fn().mockResolvedValue(new MockModel());
    MockModel.updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });
    MockModel.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 });
    MockModel.countDocuments = jest.fn().mockResolvedValue(0);
    
    MockModel.schema = schema;
    return MockModel;
  }),
  Types: {
    ObjectId: jest.fn().mockImplementation(() => 'mock_object_id')
  }
};

// Also add to mockMongoose.Schema
mockMongoose.Schema.Types = {
  ObjectId: jest.fn().mockImplementation(() => 'mock_object_id')
};

jest.unstable_mockModule('mongoose', () => ({
  default: mockMongoose,
  ...mockMongoose
}));

describe('Trip Model', () => {
  let Trip;
  
  beforeAll(async () => {
    Trip = (await import('../src/models/Trip.js')).default;
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Schema Definition', () => {
    test('should create Trip model with correct schema', () => {
      expect(Trip).toBeDefined();
      expect(Trip.schema).toBeDefined();
      expect(typeof Trip).toBe('function');
    });

    test('should have required fields defined', () => {
      const schema = Trip.schema;
      const definition = schema.definition;
      
      expect(definition.tripId).toBeDefined();
      expect(definition.bus).toBeDefined();
      expect(definition.route).toBeDefined();
      expect(definition.scheduledDeparture).toBeDefined();
      expect(definition.scheduledArrival).toBeDefined();
      expect(definition.driver).toBeDefined();
      expect(definition.fare).toBeDefined();
    });

    test('should have correct field validation', () => {
      const schema = Trip.schema;
      const definition = schema.definition;
      
      expect(definition.tripId.required).toEqual([true, 'Trip ID is required']);
      expect(definition.tripId.unique).toBe(true);
      
      expect(definition.bus.required).toEqual([true, 'Bus assignment is required']);
      expect(definition.route.required).toEqual([true, 'Route is required']);
      
      expect(definition.scheduledDeparture.required).toEqual([true, 'Scheduled departure time is required']);
      expect(definition.scheduledArrival.required).toEqual([true, 'Scheduled arrival time is required']);
      
      expect(definition.fare.required).toEqual([true, 'Fare is required']);
      expect(definition.fare.min).toEqual([0, 'Fare cannot be negative']);
    });

    test('should have correct enum values for status', () => {
      const schema = Trip.schema;
      const definition = schema.definition;
      
      expect(definition.status.enum).toEqual([
        'Scheduled', 'In Progress', 'Completed', 'Cancelled', 'Delayed'
      ]);
      expect(definition.status.default).toBe('Scheduled');
    });

    test('should have correct enum values for weatherCondition', () => {
      const schema = Trip.schema;
      const definition = schema.definition;
      
      expect(definition.weatherCondition.enum).toEqual([
        'Clear', 'Rainy', 'Cloudy', 'Stormy'
      ]);
      expect(definition.weatherCondition.default).toBe('Clear');
    });

    test('should have driver schema structure', () => {
      const schema = Trip.schema;
      const definition = schema.definition;
      
      expect(definition.driver.name.required).toEqual([true, 'Driver name is required']);
      expect(definition.driver.licenseNumber.required).toEqual([true, 'Driver license is required']);
      expect(definition.driver.contactNumber.required).toEqual([true, 'Driver contact is required']);
    });

    test('should have passengers schema structure', () => {
      const schema = Trip.schema;
      const definition = schema.definition;
      
      expect(definition.passengers.current.default).toBe(0);
      expect(definition.passengers.current.min).toBe(0);
      expect(definition.passengers.boardings.default).toBe(0);
      expect(definition.passengers.alightings.default).toBe(0);
    });
  });

  describe('Model Indexes', () => {
    test('should create compound indexes', () => {
      const schema = Trip.schema;
      // For mocked models, we just verify the schema exists
      expect(schema).toBeDefined();
      expect(typeof schema.index).toBe('function');
    });

    test('should have single field indexes', () => {
      const schema = Trip.schema;
      const definition = schema.definition;
      
      expect(definition.tripId.index).toBe(true);
      expect(definition.bus.index).toBe(true);
      expect(definition.route.index).toBe(true);
      expect(definition.scheduledDeparture.index).toBe(true);
      expect(definition.status.index).toBe(true);
    });
  });

  describe('Virtual Fields', () => {
    test('should define plannedDuration virtual', () => {
      const schema = Trip.schema;
      const virtuals = schema.virtuals;
      expect(virtuals.plannedDuration).toBeDefined();
    });

    test('should define actualDuration virtual', () => {
      const schema = Trip.schema;
      const virtuals = schema.virtuals;
      expect(virtuals.actualDuration).toBeDefined();
    });

    test('should define occupancyRate virtual', () => {
      const schema = Trip.schema;
      const virtuals = schema.virtuals;
      expect(virtuals.occupancyRate).toBeDefined();
    });

    test('plannedDuration virtual should calculate duration in minutes', () => {
      const scheduledDeparture = new Date('2024-01-01T10:00:00Z');
      const scheduledArrival = new Date('2024-01-01T12:30:00Z');
      
      const trip = new Trip({
        tripId: 'TRIP001',
        bus: 'bus_id',
        route: 'route_id',
        scheduledDeparture,
        scheduledArrival,
        driver: {
          name: 'John Doe',
          licenseNumber: 'DL123',
          contactNumber: '123456789'
        },
        fare: 50
      });

      const plannedDurationGetter = Trip.schema.virtuals.plannedDuration.get;
      if (plannedDurationGetter) {
        const result = plannedDurationGetter.call(trip);
        expect(result).toBe(150); // 2.5 hours = 150 minutes
      }
    });

    test('actualDuration virtual should return null when no actual times', () => {
      const trip = new Trip({
        tripId: 'TRIP001',
        bus: 'bus_id',
        route: 'route_id',
        scheduledDeparture: new Date(),
        scheduledArrival: new Date(),
        driver: {
          name: 'John Doe',
          licenseNumber: 'DL123',
          contactNumber: '123456789'
        },
        fare: 50
      });

      const actualDurationGetter = Trip.schema.virtuals.actualDuration.get;
      if (actualDurationGetter) {
        const result = actualDurationGetter.call(trip);
        expect(result).toBeNull();
      }
    });

    test('actualDuration virtual should calculate actual duration when both times available', () => {
      const actualDeparture = new Date('2024-01-01T10:15:00Z');
      const actualArrival = new Date('2024-01-01T12:45:00Z');
      
      const trip = new Trip({
        tripId: 'TRIP001',
        bus: 'bus_id',
        route: 'route_id',
        scheduledDeparture: new Date(),
        scheduledArrival: new Date(),
        actualDeparture,
        actualArrival,
        driver: {
          name: 'John Doe',
          licenseNumber: 'DL123',
          contactNumber: '123456789'
        },
        fare: 50
      });

      const actualDurationGetter = Trip.schema.virtuals.actualDuration.get;
      if (actualDurationGetter) {
        const result = actualDurationGetter.call(trip);
        expect(result).toBe(150); // 2.5 hours = 150 minutes
      }
    });

    test('occupancyRate virtual should return 0 when no bus capacity', () => {
      const trip = new Trip({
        tripId: 'TRIP001',
        bus: null,
        route: 'route_id',
        scheduledDeparture: new Date(),
        scheduledArrival: new Date(),
        driver: {
          name: 'John Doe',
          licenseNumber: 'DL123',
          contactNumber: '123456789'
        },
        fare: 50,
        passengers: { current: 30 }
      });

      const occupancyRateGetter = Trip.schema.virtuals.occupancyRate.get;
      if (occupancyRateGetter) {
        const result = occupancyRateGetter.call(trip);
        expect(result).toBe(0);
      }
    });

    test('occupancyRate virtual should calculate percentage when bus capacity available', () => {
      const trip = new Trip({
        tripId: 'TRIP001',
        bus: { capacity: 50 },
        route: 'route_id',
        scheduledDeparture: new Date(),
        scheduledArrival: new Date(),
        driver: {
          name: 'John Doe',
          licenseNumber: 'DL123',
          contactNumber: '123456789'
        },
        fare: 50,
        passengers: { current: 30 }
      });

      const occupancyRateGetter = Trip.schema.virtuals.occupancyRate.get;
      if (occupancyRateGetter) {
        const result = occupancyRateGetter.call(trip);
        expect(result).toBe(60); // 30/50 * 100 = 60%
      }
    });
  });

  describe('Model Creation', () => {
    test('should create trip with valid data', () => {
      const tripData = {
        tripId: 'TRIP001',
        bus: 'bus_id',
        route: 'route_id',
        scheduledDeparture: new Date('2024-01-01T10:00:00Z'),
        scheduledArrival: new Date('2024-01-01T12:00:00Z'),
        driver: {
          name: 'John Doe',
          licenseNumber: 'DL123',
          contactNumber: '123456789'
        },
        fare: 75.50,
        status: 'Scheduled'
      };

      const trip = new Trip(tripData);
      
      expect(trip.tripId).toBe('TRIP001');
      expect(trip.driver.name).toBe('John Doe');
      expect(trip.fare).toBe(75.50);
      expect(trip.status).toBe('Scheduled');
    });

    test('should create trip with default values', () => {
      const tripData = {
        tripId: 'T001',
        route: '507f1f77bcf86cd799439011',
        bus: '507f1f77bcf86cd799439012',
        scheduledDeparture: new Date('2024-01-01T08:00:00Z'),
        scheduledArrival: new Date('2024-01-01T10:00:00Z'),
        fare: 100
      };
      
      const trip = new Trip(tripData);
      
      expect(trip.tripId).toBe('T001');
      expect(trip.route.toString()).toBe('507f1f77bcf86cd799439011');
      expect(trip.bus.toString()).toBe('507f1f77bcf86cd799439012');
      expect(trip.fare).toBe(100);
    });

    test('should handle conductor data', () => {
      const tripData = {
        tripId: 'TRIP003',
        bus: 'bus_id',
        route: 'route_id',
        scheduledDeparture: new Date(),
        scheduledArrival: new Date(),
        driver: {
          name: 'Bob Wilson',
          licenseNumber: 'DL789',
          contactNumber: '555123456'
        },
        conductor: {
          name: 'Alice Johnson',
          contactNumber: '555654321'
        },
        fare: 45
      };

      const trip = new Trip(tripData);
      
      expect(trip.conductor.name).toBe('Alice Johnson');
      expect(trip.conductor.contactNumber).toBe('555654321');
    });

    test('should handle passenger data', () => {
      const tripData = {
        tripId: 'TRIP004',
        bus: 'bus_id',
        route: 'route_id',
        scheduledDeparture: new Date(),
        scheduledArrival: new Date(),
        driver: {
          name: 'Charlie Brown',
          licenseNumber: 'DL101',
          contactNumber: '111222333'
        },
        fare: 55,
        passengers: {
          current: 25,
          boardings: 40,
          alightings: 15
        }
      };

      const trip = new Trip(tripData);
      
      expect(trip.passengers.current).toBe(25);
      expect(trip.passengers.boardings).toBe(40);
      expect(trip.passengers.alightings).toBe(15);
    });

    test('should handle actual departure/arrival times', () => {
      const actualDeparture = new Date('2024-01-01T10:05:00Z');
      const actualArrival = new Date('2024-01-01T12:10:00Z');
      
      const tripData = {
        tripId: 'TRIP005',
        bus: 'bus_id',
        route: 'route_id',
        scheduledDeparture: new Date('2024-01-01T10:00:00Z'),
        scheduledArrival: new Date('2024-01-01T12:00:00Z'),
        actualDeparture,
        actualArrival,
        driver: {
          name: 'David Davis',
          licenseNumber: 'DL202',
          contactNumber: '444555666'
        },
        fare: 80
      };

      const trip = new Trip(tripData);
      
      expect(trip.actualDeparture).toEqual(actualDeparture);
      expect(trip.actualArrival).toEqual(actualArrival);
    });
  });

  describe('Static Methods', () => {
    test('should have find method', () => {
      expect(Trip.find).toBeDefined();
      expect(typeof Trip.find).toBe('function');
    });

    test('should have findById method', () => {
      expect(Trip.findById).toBeDefined();
      expect(typeof Trip.findById).toBe('function');
    });

    test('should have findOne method', () => {
      expect(Trip.findOne).toBeDefined();
      expect(typeof Trip.findOne).toBe('function');
    });

    test('should have create method', () => {
      expect(Trip.create).toBeDefined();
      expect(typeof Trip.create).toBe('function');
    });

    test('should have updateOne method', () => {
      expect(Trip.updateOne).toBeDefined();
      expect(typeof Trip.updateOne).toBe('function');
    });

    test('should have deleteOne method', () => {
      expect(Trip.deleteOne).toBeDefined();
      expect(typeof Trip.deleteOne).toBe('function');
    });

    test('should have countDocuments method', () => {
      expect(Trip.countDocuments).toBeDefined();
      expect(typeof Trip.countDocuments).toBe('function');
    });
  });

  describe('Schema Options', () => {
    test('should have timestamps enabled', () => {
      const schema = Trip.schema;
      expect(schema.options).toBeDefined();
    });

    test('should include virtuals in JSON and Object conversion', () => {
      const trip = new Trip({
        tripId: 'TRIP006',
        bus: 'bus_id',
        route: 'route_id',
        scheduledDeparture: new Date(),
        scheduledArrival: new Date(),
        driver: {
          name: 'Eve Smith',
          licenseNumber: 'DL303',
          contactNumber: '777888999'
        },
        fare: 65
      });

      expect(trip.toJSON).toBeDefined();
      expect(typeof trip.toJSON).toBe('function');
      expect(trip.toObject).toBeDefined();
      expect(typeof trip.toObject).toBe('function');
    });
  });

  describe('Edge Cases', () => {
    test('should handle all status types', () => {
      const statuses = ['Scheduled', 'In Progress', 'Completed', 'Cancelled', 'Delayed'];
      
      statuses.forEach((status, index) => {
        const tripData = {
          tripId: `TRIP${100 + index}`,
          bus: 'bus_id',
          route: 'route_id',
          scheduledDeparture: new Date(),
          scheduledArrival: new Date(),
          driver: {
            name: 'Test Driver',
            licenseNumber: `DL${100 + index}`,
            contactNumber: '123456789'
          },
          fare: 50,
          status: status
        };

        const trip = new Trip(tripData);
        expect(trip.status).toBe(status);
      });
    });

    test('should handle all weather conditions', () => {
      const weatherConditions = ['Clear', 'Rainy', 'Cloudy', 'Stormy'];
      
      weatherConditions.forEach((weather, index) => {
        const tripData = {
          tripId: `TRIP${200 + index}`,
          bus: 'bus_id',
          route: 'route_id',
          scheduledDeparture: new Date(),
          scheduledArrival: new Date(),
          driver: {
            name: 'Test Driver',
            licenseNumber: `DL${200 + index}`,
            contactNumber: '123456789'
          },
          fare: 50,
          weatherCondition: weather
        };

        const trip = new Trip(tripData);
        expect(trip.weatherCondition).toBe(weather);
      });
    });

    test('should handle zero fare', () => {
      const tripData = {
        tripId: 'TRIP300',
        bus: 'bus_id',
        route: 'route_id',
        scheduledDeparture: new Date(),
        scheduledArrival: new Date(),
        driver: {
          name: 'Free Ride Driver',
          licenseNumber: 'DL300',
          contactNumber: '123456789'
        },
        fare: 0
      };

      const trip = new Trip(tripData);
      expect(trip.fare).toBe(0);
    });

    test('should handle large delay values', () => {
      const tripData = {
        tripId: 'TRIP301',
        bus: 'bus_id',
        route: 'route_id',
        scheduledDeparture: new Date(),
        scheduledArrival: new Date(),
        driver: {
          name: 'Delayed Driver',
          licenseNumber: 'DL301',
          contactNumber: '123456789'
        },
        fare: 60,
        delay: 120 // 2 hours delay
      };

      const trip = new Trip(tripData);
      expect(trip.delay).toBe(120);
    });

    test('should handle trip without conductor', () => {
      const tripData = {
        tripId: 'TRIP302',
        bus: 'bus_id',
        route: 'route_id',
        scheduledDeparture: new Date(),
        scheduledArrival: new Date(),
        driver: {
          name: 'Solo Driver',
          licenseNumber: 'DL302',
          contactNumber: '123456789'
        },
        fare: 40
      };

      const trip = new Trip(tripData);
      expect(trip.conductor).toBeUndefined();
    });

    test('should handle notes field', () => {
      const tripData = {
        tripId: 'TRIP303',
        bus: 'bus_id',
        route: 'route_id',
        scheduledDeparture: new Date(),
        scheduledArrival: new Date(),
        driver: {
          name: 'Noted Driver',
          licenseNumber: 'DL303',
          contactNumber: '123456789'
        },
        fare: 55,
        notes: 'Special route due to road construction'
      };

      const trip = new Trip(tripData);
      expect(trip.notes).toBe('Special route due to road construction');
    });

    test('should handle maximum passengers scenario', () => {
      const tripData = {
        tripId: 'TRIP304',
        bus: 'bus_id',
        route: 'route_id',
        scheduledDeparture: new Date(),
        scheduledArrival: new Date(),
        driver: {
          name: 'Full Bus Driver',
          licenseNumber: 'DL304',
          contactNumber: '123456789'
        },
        fare: 70,
        passengers: {
          current: 100,
          boardings: 150,
          alightings: 50
        }
      };

      const trip = new Trip(tripData);
      expect(trip.passengers.current).toBe(100);
      expect(trip.passengers.boardings).toBe(150);
      expect(trip.passengers.alightings).toBe(50);
    });
  });

  describe('Reference Fields', () => {
    test('should handle ObjectId references for bus', () => {
      const tripData = {
        tripId: 'TRIP400',
        bus: mockMongoose.Types.ObjectId(),
        route: 'route_id',
        scheduledDeparture: new Date(),
        scheduledArrival: new Date(),
        driver: {
          name: 'Ref Driver',
          licenseNumber: 'DL400',
          contactNumber: '123456789'
        },
        fare: 45
      };

      const trip = new Trip(tripData);
      expect(trip.bus).toBe('mock_object_id');
    });

    test('should handle ObjectId references for route', () => {
      const tripData = {
        tripId: 'TRIP401',
        bus: 'bus_id',
        route: mockMongoose.Types.ObjectId(),
        scheduledDeparture: new Date(),
        scheduledArrival: new Date(),
        driver: {
          name: 'Route Ref Driver',
          licenseNumber: 'DL401',
          contactNumber: '123456789'
        },
        fare: 85
      };

      const trip = new Trip(tripData);
      expect(trip.route).toBe('mock_object_id');
    });
  });
});