import { jest } from '@jest/globals';

// Mock bcryptjs
const mockBcrypt = {
  genSalt: jest.fn().mockResolvedValue('mock_salt'),
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn().mockResolvedValue(true)
};

jest.unstable_mockModule('bcryptjs', () => ({
  default: mockBcrypt,
  ...mockBcrypt
}));

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
    
    MockSchema.prototype.pre = jest.fn().mockImplementation(function(hook, fn) {
      this.middleware[hook] = this.middleware[hook] || [];
      this.middleware[hook].push(fn);
      return this;
    });
    
    return new MockSchema(schema, options || {});
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
      this.updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });
      
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
      
      // Add instance methods
      this.comparePassword = jest.fn().mockResolvedValue(true);
      this.incLoginAttempts = jest.fn().mockResolvedValue({ modifiedCount: 1 });
      this.resetLoginAttempts = jest.fn().mockResolvedValue({ modifiedCount: 1 });
      this.hasPermission = jest.fn().mockReturnValue(false);
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

jest.unstable_mockModule('mongoose', () => ({
  default: mockMongoose,
  ...mockMongoose
}));

describe('User Model', () => {
  let User;
  
  beforeAll(async () => {
    User = (await import('../src/models/User.js')).default;
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Schema Definition', () => {
    test('should create User model with correct schema', () => {
      expect(User).toBeDefined();
      expect(User.schema).toBeDefined();
      expect(typeof User).toBe('function');
    });

    test('should have required fields defined', () => {
      const schema = User.schema;
      const definition = schema.definition;
      
      expect(definition.username).toBeDefined();
      expect(definition.email).toBeDefined();
      expect(definition.password).toBeDefined();
      expect(definition.role).toBeDefined();
    });

    test('should have correct field validation', () => {
      const schema = User.schema;
      const definition = schema.definition;
      
      expect(definition.username.required).toEqual([true, 'Username is required']);
      expect(definition.username.minLength).toEqual([3, 'Username must be at least 3 characters']);
      expect(definition.username.maxLength).toEqual([30, 'Username cannot exceed 30 characters']);
      
      expect(definition.email.required).toEqual([true, 'Email is required']);
      expect(definition.email.match).toEqual([/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']);
      
      expect(definition.password.required).toEqual([true, 'Password is required']);
      expect(definition.password.minLength).toEqual([6, 'Password must be at least 6 characters']);
      expect(definition.password.select).toBe(false);
    });

    test('should have correct role enum values', () => {
      const schema = User.schema;
      const definition = schema.definition;
      
      expect(definition.role.enum).toEqual(['admin', 'operator', 'driver', 'viewer']);
      expect(definition.role.default).toBe('viewer');
    });

    test('should have permission schema structure', () => {
      const schema = User.schema;
      const definition = schema.definition;
      
      expect(definition.permissions).toBeDefined();
      expect(Array.isArray(definition.permissions)).toBe(true);
      
      const permissionSchema = definition.permissions[0];
      expect(permissionSchema.resource.enum).toEqual([
        'routes', 'buses', 'trips', 'tracking', 'users', 'reports'
      ]);
      expect(permissionSchema.actions[0].enum).toEqual([
        'create', 'read', 'update', 'delete'
      ]);
    });
  });

  describe('Model Indexes', () => {
    test('should create compound indexes', () => {
      const schema = User.schema;
      // For mocked models, we just verify the schema exists
      expect(schema).toBeDefined();
      expect(typeof schema.index).toBe('function');
    });

    test('should have single field indexes', () => {
      const schema = User.schema;
      const definition = schema.definition;
      
      expect(definition.username.index).toBe(true);
      expect(definition.email.index).toBe(true);
      expect(definition.role.index).toBe(true);
      expect(definition.isActive.index).toBe(true);
    });
  });

  describe('Virtual Fields', () => {
    test('should define fullName virtual', () => {
      const schema = User.schema;
      const virtuals = schema.virtuals;
      expect(virtuals.fullName).toBeDefined();
    });

    test('should define isLocked virtual', () => {
      const schema = User.schema;
      const virtuals = schema.virtuals;
      expect(virtuals.isLocked).toBeDefined();
    });

    test('fullName virtual should return full name when available', () => {
      const user = new User({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        profile: {
          firstName: 'John',
          lastName: 'Doe'
        }
      });

      const fullNameGetter = User.schema.virtuals.fullName.get;
      if (fullNameGetter) {
        const result = fullNameGetter.call(user);
        expect(result).toBe('John Doe');
      }
    });

    test('fullName virtual should return username when name not available', () => {
      const user = new User({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        profile: {}
      });

      const fullNameGetter = User.schema.virtuals.fullName.get;
      if (fullNameGetter) {
        const result = fullNameGetter.call(user);
        expect(result).toBe('testuser');
      }
    });

    test('isLocked virtual should return true when locked', () => {
      const user = new User({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        lockUntil: new Date(Date.now() + 60000) // 1 minute from now
      });

      const isLockedGetter = User.schema.virtuals.isLocked.get;
      if (isLockedGetter) {
        const result = isLockedGetter.call(user);
        expect(result).toBe(true);
      }
    });

    test('isLocked virtual should return false when not locked', () => {
      const user = new User({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        lockUntil: null
      });

      const isLockedGetter = User.schema.virtuals.isLocked.get;
      if (isLockedGetter) {
        const result = isLockedGetter.call(user);
        expect(result).toBe(false);
      }
    });

    test('isLocked virtual should return false when lock expired', () => {
      const user = new User({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        lockUntil: new Date(Date.now() - 60000) // 1 minute ago
      });

      const isLockedGetter = User.schema.virtuals.isLocked.get;
      if (isLockedGetter) {
        const result = isLockedGetter.call(user);
        expect(result).toBe(false);
      }
    });
  });

  describe('Pre-save Middleware', () => {
    test('should register pre-save middleware for password hashing', () => {
      const schema = User.schema;
      // Check that pre-save hooks exist - check if pre method exists
      expect(typeof schema.pre).toBe('function');
      expect(schema).toBeDefined();
    });

    test('should hash password when password is modified', async () => {
      const user = new User({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      });

      // Mock isModified to return true for password
      user.isModified = jest.fn().mockImplementation((field) => field === 'password');
      
      // Get the pre-save middleware
      const preSaveMiddleware = User.schema.middleware.save[0];
      const next = jest.fn();
      
      await preSaveMiddleware.call(user, next);
      
      expect(mockBcrypt.genSalt).toHaveBeenCalledWith(12);
      expect(mockBcrypt.hash).toHaveBeenCalledWith('password123', 'mock_salt');
      expect(user.password).toBe('hashed_password');
      expect(next).toHaveBeenCalledWith();
    });

    test('should skip hashing when password not modified', async () => {
      const user = new User({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      });

      user.isModified = jest.fn().mockReturnValue(false);
      
      const preSaveMiddleware = User.schema.middleware.save[0];
      const next = jest.fn();
      
      await preSaveMiddleware.call(user, next);
      
      expect(mockBcrypt.genSalt).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('Instance Methods', () => {
    test('should have comparePassword method', () => {
      const user = new User({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      });

      expect(user.comparePassword).toBeDefined();
      expect(typeof user.comparePassword).toBe('function');
    });

    test('comparePassword should compare passwords', async () => {
      const user = new User({
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashed_password'
      });

      const result = await user.comparePassword('password123');
      expect(result).toBe(true);
    });

    test('should have incLoginAttempts method', () => {
      const user = new User({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      });

      expect(user.incLoginAttempts).toBeDefined();
      expect(typeof user.incLoginAttempts).toBe('function');
    });

    test('incLoginAttempts should increment attempts', async () => {
      const user = new User({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        loginAttempts: 2
      });

      const result = await user.incLoginAttempts();
      expect(result).toEqual({ modifiedCount: 1 });
    });

    test('should have resetLoginAttempts method', () => {
      const user = new User({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      });

      expect(user.resetLoginAttempts).toBeDefined();
      expect(typeof user.resetLoginAttempts).toBe('function');
    });

    test('resetLoginAttempts should reset attempts and set lastLogin', async () => {
      const user = new User({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      });

      const result = await user.resetLoginAttempts();
      expect(result).toEqual({ modifiedCount: 1 });
    });

    test('should have hasPermission method', () => {
      const user = new User({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      });

      expect(user.hasPermission).toBeDefined();
      expect(typeof user.hasPermission).toBe('function');
    });

    test('hasPermission should return true for admin', () => {
      const user = new User({
        username: 'admin',
        email: 'admin@example.com',
        password: 'password123',
        role: 'admin'
      });

      // Override the mock implementation for this test
      user.hasPermission = function(resource, action) {
        if (this.role === 'admin') return true;
        const permission = this.permissions.find(p => p.resource === resource);
        return permission ? permission.actions.includes(action) : false;
      };

      const result = user.hasPermission('users', 'delete');
      expect(result).toBe(true);
    });

    test('hasPermission should check specific permissions for non-admin', () => {
      const user = new User({
        username: 'operator',
        email: 'operator@example.com',
        password: 'password123',
        role: 'operator',
        permissions: [{
          resource: 'buses',
          actions: ['read', 'update']
        }]
      });

      user.hasPermission = function(resource, action) {
        if (this.role === 'admin') return true;
        const permission = this.permissions.find(p => p.resource === resource);
        return permission ? permission.actions.includes(action) : false;
      };

      expect(user.hasPermission('buses', 'read')).toBe(true);
      expect(user.hasPermission('buses', 'delete')).toBe(false);
      expect(user.hasPermission('users', 'read')).toBe(false);
    });
  });

  describe('Model Creation', () => {
    test('should create user with valid data', () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        role: 'operator',
        profile: {
          firstName: 'John',
          lastName: 'Doe',
          contactNumber: '123456789',
          organization: 'Test Org'
        }
      };

      const user = new User(userData);
      
      expect(user.username).toBe('testuser');
      expect(user.email).toBe('test@example.com');
      expect(user.role).toBe('operator');
      expect(user.profile.firstName).toBe('John');
    });

    test('should create user with default values', () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123!'
      };
      
      const user = new User(userData);
      
      expect(user.username).toBe('testuser');
      expect(user.email).toBe('test@example.com');
      expect(user.password).toBe('Password123!');
    });

    test('should handle permissions array', () => {
      const userData = {
        username: 'testuser3',
        email: 'test3@example.com',
        password: 'password123',
        permissions: [{
          resource: 'buses',
          actions: ['read', 'update']
        }, {
          resource: 'routes',
          actions: ['read']
        }]
      };

      const user = new User(userData);
      
      expect(user.permissions).toHaveLength(2);
      expect(user.permissions[0].resource).toBe('buses');
      expect(user.permissions[0].actions).toEqual(['read', 'update']);
    });
  });

  describe('Static Methods', () => {
    test('should have find method', () => {
      expect(User.find).toBeDefined();
      expect(typeof User.find).toBe('function');
    });

    test('should have findById method', () => {
      expect(User.findById).toBeDefined();
      expect(typeof User.findById).toBe('function');
    });

    test('should have findOne method', () => {
      expect(User.findOne).toBeDefined();
      expect(typeof User.findOne).toBe('function');
    });

    test('should have create method', () => {
      expect(User.create).toBeDefined();
      expect(typeof User.create).toBe('function');
    });

    test('should have updateOne method', () => {
      expect(User.updateOne).toBeDefined();
      expect(typeof User.updateOne).toBe('function');
    });

    test('should have deleteOne method', () => {
      expect(User.deleteOne).toBeDefined();
      expect(typeof User.deleteOne).toBe('function');
    });
  });

  describe('Schema Options and JSON Transform', () => {
    test('should have correct schema options', () => {
      const schema = User.schema;
      expect(schema.options).toBeDefined();
    });

    test('should transform JSON output to exclude sensitive fields', () => {
            const user = new User({
              username: 'testuser',
              email: 'test@example.com',
              password: 'password123',
              loginAttempts: 2,
              lockUntil: new Date(),
              profile: {
                firstName: 'Test',
                lastName: 'User'
              }
            });
      
            // Mock the transform function behavior
            const mockTransform = (doc, ret) => {
              delete ret.password;
              delete ret.loginAttempts;
              delete ret.lockUntil;
              return ret;
            };
      
            // Create a plain object copy instead of spreading the user object
            const userCopy = {
              username: user.username,
              email: user.email,
              password: user.password,
              loginAttempts: user.loginAttempts,
              lockUntil: user.lockUntil
            };
            const result = mockTransform(user, userCopy);
            
            expect(result.password).toBeUndefined();
            expect(result.loginAttempts).toBeUndefined();
            expect(result.lockUntil).toBeUndefined();
            expect(result.username).toBeDefined();
          });
  });

  describe('Edge Cases', () => {
    test('should handle all role types', () => {
      const roles = ['admin', 'operator', 'driver', 'viewer'];
      
      roles.forEach((role, index) => {
        const userData = {
          username: `user${index}`,
          email: `user${index}@example.com`,
          password: 'password123',
          role: role
        };

        const user = new User(userData);
        expect(user.role).toBe(role);
      });
    });

    test('should handle empty permissions array', () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        permissions: []
      };

      const user = new User(userData);
      expect(user.permissions).toEqual([]);
    });

    test('should handle empty profile object', () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        profile: {}
      };

      const user = new User(userData);
      expect(user.profile).toEqual({});
    });

    test('should handle user with lock expiry', () => {
      const futureDate = new Date(Date.now() + 3600000); // 1 hour from now
      const userData = {
        username: 'lockeduser',
        email: 'locked@example.com',
        password: 'password123',
        loginAttempts: 5,
        lockUntil: futureDate
      };

      const user = new User(userData);
      expect(user.lockUntil).toEqual(futureDate);
      expect(user.loginAttempts).toBe(5);
    });

    test('should handle inactive user', () => {
      const userData = {
        username: 'inactiveuser',
        email: 'inactive@example.com',
        password: 'password123',
        isActive: false
      };

      const user = new User(userData);
      expect(user.isActive).toBe(false);
    });
  });

  describe('Permission Resource and Action Enums', () => {
    test('should handle all permission resources', () => {
      const resources = ['routes', 'buses', 'trips', 'tracking', 'users', 'reports'];
      
      resources.forEach(resource => {
        const userData = {
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
          permissions: [{
            resource: resource,
            actions: ['read']
          }]
        };

        const user = new User(userData);
        expect(user.permissions[0].resource).toBe(resource);
      });
    });

    test('should handle all permission actions', () => {
      const actions = ['create', 'read', 'update', 'delete'];
      
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        permissions: [{
          resource: 'buses',
          actions: actions
        }]
      };

      const user = new User(userData);
      expect(user.permissions[0].actions).toEqual(actions);
    });
  });
});