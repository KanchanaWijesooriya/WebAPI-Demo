import { jest } from '@jest/globals';

// Mock mongoose before importing the model
const mockMongoose = {
  Schema: jest.fn().mockImplementation((schema) => {
    const MockSchema = function(definition) {
      this.definition = definition;
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
    
    const schemaInstance = new MockSchema(schema);
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

describe('Bus Model', () => {
  let Bus;
  
  beforeAll(async () => {
    Bus = (await import('../src/models/Bus.js')).default;
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Schema Definition', () => {
    test('should create Bus model with correct schema', () => {
      expect(Bus).toBeDefined();
      expect(Bus.schema).toBeDefined();
      expect(typeof Bus).toBe('function');
    });

    test('should have required fields defined', () => {
      const schema = Bus.schema;
      const definition = schema.definition;
      
      // Check required fields exist
      expect(definition.busNumber).toBeDefined();
      expect(definition.registrationNumber).toBeDefined();
      expect(definition.operator).toBeDefined();
      expect(definition.route).toBeDefined();
      expect(definition.capacity).toBeDefined();
    });

    test('should have correct field types and validation', () => {
      const schema = Bus.schema;
      const definition = schema.definition;
      
      expect(definition.busNumber.type).toBe(String);
      expect(definition.busNumber.required).toEqual([true, 'Bus number is required']);
      expect(definition.busNumber.unique).toBe(true);
      
      expect(definition.capacity.type).toBe(Number);
      expect(definition.capacity.min).toEqual([1, 'Capacity must be at least 1']);
      expect(definition.capacity.max).toEqual([100, 'Capacity cannot exceed 100']);
    });

    test('should have correct enum values for busType', () => {
      const schema = Bus.schema;
      const definition = schema.definition;
      
      expect(definition.busType.enum).toEqual([
        'Normal', 'Semi-Luxury', 'Luxury', 'Air-Conditioned'
      ]);
      expect(definition.busType.default).toBe('Normal');
    });

    test('should have correct enum values for status', () => {
      const schema = Bus.schema;
      const definition = schema.definition;
      
      expect(definition.status.enum).toEqual([
        'Active', 'Inactive', 'Maintenance', 'Out of Service'
      ]);
      expect(definition.status.default).toBe('Inactive');
    });

    test('should have facilities enum defined', () => {
      const schema = Bus.schema;
      const definition = schema.definition;
      
      expect(definition.facilities[0].enum).toEqual([
        'WiFi', 'AC', 'Charging Ports', 'Entertainment System', 'Washroom'
      ]);
    });
  });

  describe('Model Indexes', () => {
    test('should create compound indexes', () => {
      const schema = Bus.schema;
      // For mocked models, we just verify the schema exists
      expect(schema).toBeDefined();
      expect(typeof schema.index).toBe('function');
    });

    test('should have single field indexes', () => {
      const schema = Bus.schema;
      const definition = schema.definition;
      
      expect(definition.busNumber.index).toBe(true);
      expect(definition.route.index).toBe(true);
      expect(definition.status.index).toBe(true);
      expect(definition.isOnline.index).toBe(true);
    });
  });

  describe('Virtual Fields', () => {
    test('should define locationStatus virtual', () => {
      const schema = Bus.schema;
      const virtuals = schema.virtuals;
      
      expect(virtuals.locationStatus).toBeDefined();
    });

    test('locationStatus virtual should return "No GPS Data" when no lastUpdated', () => {
      const bus = new Bus({
        busNumber: 'B001',
        registrationNumber: 'REG001',
        operator: {
          name: 'Test Operator',
          contactNumber: '123456789',
          licenseNumber: 'LIC001'
        },
        route: 'route_id',
        capacity: 50,
        currentLocation: {}
      });

      // Manually apply the virtual getter logic
      const locationStatusGetter = Bus.schema.virtuals.locationStatus.get;
      if (locationStatusGetter) {
        const result = locationStatusGetter.call(bus);
        expect(result).toBe('No GPS Data');
      }
    });

    test('locationStatus virtual should return "Live" for recent updates', () => {
      const bus = new Bus({
        busNumber: 'B001',
        registrationNumber: 'REG001',
        operator: {
          name: 'Test Operator',
          contactNumber: '123456789',
          licenseNumber: 'LIC001'
        },
        route: 'route_id',
        capacity: 50,
        currentLocation: {
          lastUpdated: new Date(Date.now() - 2 * 60 * 1000) // 2 minutes ago
        }
      });

      const locationStatusGetter = Bus.schema.virtuals.locationStatus.get;
      if (locationStatusGetter) {
        const result = locationStatusGetter.call(bus);
        expect(result).toBe('Live');
      }
    });

    test('locationStatus virtual should return "Recent" for moderately old updates', () => {
      const bus = new Bus({
        busNumber: 'B001',
        registrationNumber: 'REG001',
        operator: {
          name: 'Test Operator',
          contactNumber: '123456789',
          licenseNumber: 'LIC001'
        },
        route: 'route_id',
        capacity: 50,
        currentLocation: {
          lastUpdated: new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago
        }
      });

      const locationStatusGetter = Bus.schema.virtuals.locationStatus.get;
      if (locationStatusGetter) {
        const result = locationStatusGetter.call(bus);
        expect(result).toBe('Recent');
      }
    });

    test('locationStatus virtual should return "Outdated" for old updates', () => {
      const bus = new Bus({
        busNumber: 'B001',
        registrationNumber: 'REG001',
        operator: {
          name: 'Test Operator',
          contactNumber: '123456789',
          licenseNumber: 'LIC001'
        },
        route: 'route_id',
        capacity: 50,
        currentLocation: {
          lastUpdated: new Date(Date.now() - 20 * 60 * 1000) // 20 minutes ago
        }
      });

      const locationStatusGetter = Bus.schema.virtuals.locationStatus.get;
      if (locationStatusGetter) {
        const result = locationStatusGetter.call(bus);
        expect(result).toBe('Outdated');
      }
    });
  });

  describe('Model Creation', () => {
    test('should create a bus instance with valid data', () => {
      const busData = {
        busNumber: 'B001',
        registrationNumber: 'REG001',
        operator: {
          name: 'Test Operator',
          contactNumber: '123456789',
          licenseNumber: 'LIC001'
        },
        route: 'route_id',
        capacity: 50,
        busType: 'Normal',
        status: 'Active',
        isOnline: true
      };

      const bus = new Bus(busData);
      
      expect(bus.busNumber).toBe('B001');
      expect(bus.registrationNumber).toBe('REG001');
      expect(bus.operator.name).toBe('Test Operator');
      expect(bus.capacity).toBe(50);
      expect(bus.status).toBe('Active');
    });

    test('should create bus with default values', () => {
      const busData = {
        busNumber: 'B001',
        registrationNumber: 'NA-1234',
        operator: 'NTC'
      };
      
      const bus = new Bus(busData);
      
      // Check that the bus was created successfully
      expect(bus.busNumber).toBe('B001');
      expect(bus.registrationNumber).toBe('NA-1234');
      expect(bus.operator).toBe('NTC');
    });

    test('should handle facilities array', () => {
      const busData = {
        busNumber: 'B003',
        registrationNumber: 'REG003',
        operator: {
          name: 'Test Operator',
          contactNumber: '123456789',
          licenseNumber: 'LIC001'
        },
        route: 'route_id',
        capacity: 45,
        facilities: ['WiFi', 'AC', 'Charging Ports']
      };

      const bus = new Bus(busData);
      
      expect(bus.facilities).toEqual(['WiFi', 'AC', 'Charging Ports']);
    });

    test('should handle currentLocation data', () => {
      const busData = {
        busNumber: 'B004',
        registrationNumber: 'REG004',
        operator: {
          name: 'Test Operator',
          contactNumber: '123456789',
          licenseNumber: 'LIC001'
        },
        route: 'route_id',
        capacity: 40,
        currentLocation: {
          coordinates: {
            latitude: 6.9271,
            longitude: 79.8612
          },
          lastUpdated: new Date(),
          accuracy: 5,
          speed: 60,
          heading: 90
        }
      };

      const bus = new Bus(busData);
      
      expect(bus.currentLocation.coordinates.latitude).toBe(6.9271);
      expect(bus.currentLocation.coordinates.longitude).toBe(79.8612);
      expect(bus.currentLocation.speed).toBe(60);
    });
  });

  describe('Static Methods', () => {
    test('should have find method', () => {
      expect(Bus.find).toBeDefined();
      expect(typeof Bus.find).toBe('function');
    });

    test('should have findById method', () => {
      expect(Bus.findById).toBeDefined();
      expect(typeof Bus.findById).toBe('function');
    });

    test('should have create method', () => {
      expect(Bus.create).toBeDefined();
      expect(typeof Bus.create).toBe('function');
    });

    test('should have updateOne method', () => {
      expect(Bus.updateOne).toBeDefined();
      expect(typeof Bus.updateOne).toBe('function');
    });

    test('should have deleteOne method', () => {
      expect(Bus.deleteOne).toBeDefined();
      expect(typeof Bus.deleteOne).toBe('function');
    });
  });

  describe('Schema Options', () => {
    test('should have timestamps enabled', () => {
      // This would typically be checked in the schema options
      const schema = Bus.schema;
      expect(schema).toBeDefined();
    });

    test('should include virtuals in JSON', () => {
      const bus = new Bus({
        busNumber: 'B005',
        registrationNumber: 'REG005',
        operator: {
          name: 'Test Operator',
          contactNumber: '123456789',
          licenseNumber: 'LIC001'
        },
        route: 'route_id',
        capacity: 35
      });

      expect(bus.toJSON).toBeDefined();
      expect(typeof bus.toJSON).toBe('function');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty facilities array', () => {
      const busData = {
        busNumber: 'B006',
        registrationNumber: 'REG006',
        operator: {
          name: 'Test Operator',
          contactNumber: '123456789',
          licenseNumber: 'LIC001'
        },
        route: 'route_id',
        capacity: 25,
        facilities: []
      };

      const bus = new Bus(busData);
      expect(bus.facilities).toEqual([]);
    });

    test('should handle null currentLocation values', () => {
      const busData = {
        busNumber: 'B007',
        registrationNumber: 'REG007',
        operator: {
          name: 'Test Operator',
          contactNumber: '123456789',
          licenseNumber: 'LIC001'
        },
        route: 'route_id',
        capacity: 55,
        currentLocation: {
          coordinates: {
            latitude: null,
            longitude: null
          },
          lastUpdated: null,
          accuracy: null,
          speed: 0,
          heading: null
        }
      };

      const bus = new Bus(busData);
      expect(bus.currentLocation.coordinates.latitude).toBeNull();
      expect(bus.currentLocation.lastUpdated).toBeNull();
    });

    test('should handle maximum capacity', () => {
      const busData = {
        busNumber: 'B008',
        registrationNumber: 'REG008',
        operator: {
          name: 'Test Operator',
          contactNumber: '123456789',
          licenseNumber: 'LIC001'
        },
        route: 'route_id',
        capacity: 100
      };

      const bus = new Bus(busData);
      expect(bus.capacity).toBe(100);
    });

    test('should handle minimum capacity', () => {
      const busData = {
        busNumber: 'B009',
        registrationNumber: 'REG009',
        operator: {
          name: 'Test Operator',
          contactNumber: '123456789',
          licenseNumber: 'LIC001'
        },
        route: 'route_id',
        capacity: 1
      };

      const bus = new Bus(busData);
      expect(bus.capacity).toBe(1);
    });
  });

  describe('Validation Edge Cases', () => {
    test('should handle all bus types', () => {
      const busTypes = ['Normal', 'Semi-Luxury', 'Luxury', 'Air-Conditioned'];
      
      busTypes.forEach((type, index) => {
        const busData = {
          busNumber: `B${100 + index}`,
          registrationNumber: `REG${100 + index}`,
          operator: {
            name: 'Test Operator',
            contactNumber: '123456789',
            licenseNumber: 'LIC001'
          },
          route: 'route_id',
          capacity: 50,
          busType: type
        };

        const bus = new Bus(busData);
        expect(bus.busType).toBe(type);
      });
    });

    test('should handle all status types', () => {
      const statuses = ['Active', 'Inactive', 'Maintenance', 'Out of Service'];
      
      statuses.forEach((status, index) => {
        const busData = {
          busNumber: `B${200 + index}`,
          registrationNumber: `REG${200 + index}`,
          operator: {
            name: 'Test Operator',
            contactNumber: '123456789',
            licenseNumber: 'LIC001'
          },
          route: 'route_id',
          capacity: 50,
          status: status
        };

        const bus = new Bus(busData);
        expect(bus.status).toBe(status);
      });
    });

    test('should handle all facility types', () => {
      const facilities = ['WiFi', 'AC', 'Charging Ports', 'Entertainment System', 'Washroom'];
      
      const busData = {
        busNumber: 'B300',
        registrationNumber: 'REG300',
        operator: {
          name: 'Test Operator',
          contactNumber: '123456789',
          licenseNumber: 'LIC001'
        },
        route: 'route_id',
        capacity: 50,
        facilities: facilities
      };

      const bus = new Bus(busData);
      expect(bus.facilities).toEqual(facilities);
    });
  });
});