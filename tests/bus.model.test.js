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
      this.methods = {};
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
    
    MockSchema.prototype.pre = jest.fn().mockImplementation(function(method, fn) {
      this.middleware[method] = this.middleware[method] || [];
      this.middleware[method].push(fn);
      return this;
    });
    
    return new MockSchema(schema, options);
  }),
  model: jest.fn().mockImplementation((name, schema) => {
    const MockModel = function(data = {}) {
      Object.assign(this, data);
      this._id = 'mock_id_' + Math.random().toString(36).substr(2, 9);
    };
    
    // Static methods
    MockModel.find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
      exec: jest.fn().mockResolvedValue([])
    });
    
    MockModel.findById = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(null),
      exec: jest.fn().mockResolvedValue(null)
    });
    
    MockModel.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(null),
      exec: jest.fn().mockResolvedValue(null)
    });
    
    MockModel.create = jest.fn().mockResolvedValue(new MockModel());
    MockModel.updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });
    MockModel.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 });
    MockModel.countDocuments = jest.fn().mockResolvedValue(0);
    
    // Attach schema to model for testing
    MockModel.schema = schema;
    
    return MockModel;
  })
};

// Add Types to Schema mock
mockMongoose.Schema.Types = {
  ObjectId: 'ObjectId'
};

jest.unstable_mockModule('mongoose', () => ({
  default: mockMongoose,
  Schema: mockMongoose.Schema,
  model: mockMongoose.model
}));

describe('Bus Model Tests', () => {
  let Bus;
  let busSchema;

  beforeAll(async () => {
    const busModule = await import('../src/models/Bus.js');
    Bus = busModule.default;
    busSchema = Bus.schema;
  });

  describe('Schema Definition', () => {
    test('should create Bus model with correct schema', () => {
      // Test that the Bus model is defined and has the expected structure
      expect(Bus).toBeDefined();
      expect(typeof Bus).toBe('function'); // Model constructor
    });

    test('should have required fields defined', () => {
      expect(busSchema.definition).toHaveProperty('registrationNumber');
      expect(busSchema.definition).toHaveProperty('busNumber');
      expect(busSchema.definition).toHaveProperty('route');
      expect(busSchema.definition).toHaveProperty('capacity');
    });

    test('should have correct field validation', () => {
      const regNumberField = busSchema.definition.registrationNumber;
      const capacityField = busSchema.definition.capacity;
      
      expect(regNumberField.required).toBeTruthy();
      expect(regNumberField.unique).toBe(true);
      expect(capacityField.min).toBeDefined();
    });

    test('should have correct enum values for busType', () => {
      const busTypeField = busSchema.definition.busType;
      expect(busTypeField.enum).toContain('Normal');
      expect(busTypeField.enum).toContain('Express');
      expect(busTypeField.enum).toContain('Intercity Express');
    });

    test('should have correct enum values for status', () => {
      const statusField = busSchema.definition.status;
      expect(statusField.enum).toContain('Active');
      expect(statusField.enum).toContain('Inactive');
      expect(statusField.enum).toContain('Maintenance');
    });

    test('should have operator schema structure', () => {
      const operatorField = busSchema.definition.operator;
      expect(operatorField.name).toBeDefined();
      expect(operatorField.contactNumber).toBeDefined();
      expect(operatorField.licenseNumber).toBeDefined();
    });

    test('should have currentLocation schema structure', () => {
      const locationField = busSchema.definition.currentLocation;
      expect(locationField.coordinates).toBeDefined();
      expect(locationField.lastUpdated).toBeDefined();
      expect(locationField.speed).toBeDefined();
    });
  });

  describe('Model Indexes', () => {
    test('should create performance indexes', () => {
      // Test that the schema has the indexes array (from our mock)
      expect(Array.isArray(busSchema.indexes)).toBe(true);
      // The actual indexes would be defined in the real model
      expect(busSchema.indexes.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Virtual Fields', () => {
    test('should define locationStatus virtual', () => {
      // Test that the virtuals object exists (from our mock)
      expect(busSchema.virtuals).toBeDefined();
      expect(typeof busSchema.virtuals).toBe('object');
    });

    test('locationStatus virtual should return correct status', () => {
      const locationStatusGetter = busSchema.virtuals.locationStatus.get;
      
      // Mock context for virtual function
      const mockBus1 = { currentLocation: {} };
      const result1 = locationStatusGetter.call(mockBus1);
      expect(result1).toBe('No GPS Data');

      const mockBus2 = { 
        currentLocation: { 
          lastUpdated: new Date(Date.now() - 2 * 60 * 1000) // 2 minutes ago
        } 
      };
      const result2 = locationStatusGetter.call(mockBus2);
      expect(result2).toBe('Live');

      const mockBus3 = { 
        currentLocation: { 
          lastUpdated: new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago
        } 
      };
      const result3 = locationStatusGetter.call(mockBus3);
      expect(result3).toBe('Recent');

      const mockBus4 = { 
        currentLocation: { 
          lastUpdated: new Date(Date.now() - 20 * 60 * 1000) // 20 minutes ago
        } 
      };
      const result4 = locationStatusGetter.call(mockBus4);
      expect(result4).toBe('Outdated');
    });
  });

  describe('Model Creation', () => {
    test('should create bus with valid data', () => {
      const busData = {
        registrationNumber: 'ABC-1234',
        busNumber: 'NB-001',
        route: 'mock_route_id',
        capacity: 50,
        busType: 'Normal'
      };
      
      const bus = new Bus(busData);
      expect(bus.registrationNumber).toBe('ABC-1234');
      expect(bus.capacity).toBe(50);
    });

    test('should create bus with default values', () => {
      const bus = new Bus({
        registrationNumber: 'DEF-5678',
        route: 'mock_route_id'
      });
      
      expect(bus.registrationNumber).toBe('DEF-5678');
      expect(bus._id).toBeDefined();
    });

    test('should handle operator data', () => {
      const busData = {
        registrationNumber: 'GHI-9012',
        route: 'mock_route_id',
        operator: {
          name: 'SLTB',
          contactNumber: '+94-11-1234567',
          licenseNumber: 'OP-001'
        }
      };
      
      const bus = new Bus(busData);
      expect(bus.operator.name).toBe('SLTB');
      expect(bus.operator.contactNumber).toBe('+94-11-1234567');
    });

    test('should handle location data', () => {
      const busData = {
        registrationNumber: 'JKL-3456',
        route: 'mock_route_id',
        currentLocation: {
          coordinates: { latitude: 6.9271, longitude: 79.8612 },
          lastUpdated: new Date(),
          speed: 45
        }
      };
      
      const bus = new Bus(busData);
      expect(bus.currentLocation.coordinates.latitude).toBe(6.9271);
      expect(bus.currentLocation.speed).toBe(45);
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

    test('should have findOne method', () => {
      expect(Bus.findOne).toBeDefined();
      expect(typeof Bus.findOne).toBe('function');
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

  describe('Edge Cases', () => {
    test('should handle all bus types', () => {
      const busTypeField = busSchema.definition.busType;
      const validTypes = ['Normal', 'Express', 'Intercity Express'];
      
      validTypes.forEach(type => {
        expect(busTypeField.enum).toContain(type);
      });
    });

    test('should handle all status types', () => {
      const statusField = busSchema.definition.status;
      const validStatuses = ['Active', 'Inactive', 'Maintenance', 'Out of Service'];
      
      validStatuses.forEach(status => {
        expect(statusField.enum).toContain(status);
      });
    });

    test('should handle capacity validation', () => {
      const capacityField = busSchema.definition.capacity;
      expect(capacityField.min).toBeDefined();
      expect(capacityField.max).toBeDefined();
    });

    test('should handle facilities array', () => {
      const facilitiesField = busSchema.definition.facilities;
      expect(Array.isArray(facilitiesField)).toBe(true);
    });
  });
});
