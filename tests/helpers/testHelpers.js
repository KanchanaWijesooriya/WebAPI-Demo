import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

/**
 * Generate JWT token for testing
 */
export const generateTestToken = (userId, email, role = 'viewer') => {
  const payload = {
    userId,
    email,
    role
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET || 'test-secret-key', {
    expiresIn: '1h'
  });
};

/**
 * Generate admin token for testing
 */
export const generateAdminToken = () => {
  return generateTestToken('admin-test-id', 'admin@test.com', 'admin');
};

/**
 * Generate operator token for testing
 */
export const generateOperatorToken = () => {
  return generateTestToken('operator-test-id', 'operator@test.com', 'operator');
};

/**
 * Generate driver token for testing
 */
export const generateDriverToken = () => {
  return generateTestToken('driver-test-id', 'driver@test.com', 'driver');
};

/**
 * Generate viewer token for testing
 */
export const generateViewerToken = () => {
  return generateTestToken('viewer-test-id', 'viewer@test.com', 'viewer');
};

/**
 * Create authenticated request with token
 */
export const authenticatedRequest = (app, method = 'get', endpoint, token) => {
  return request(app)
    [method](endpoint)
    .set('Authorization', `Bearer ${token}`);
};

/**
 * Create admin authenticated request
 */
export const adminRequest = (app, method = 'get', endpoint) => {
  const adminToken = generateAdminToken();
  return authenticatedRequest(app, method, endpoint, adminToken);
};

/**
 * Create operator authenticated request
 */
export const operatorRequest = (app, method = 'get', endpoint) => {
  const operatorToken = generateOperatorToken();
  return authenticatedRequest(app, method, endpoint, operatorToken);
};

/**
 * Hash password for testing
 */
export const hashPassword = async (password) => {
  return await bcrypt.hash(password, 12);
};

/**
 * Test data generators
 */
export const testData = {
  validUser: {
    name: 'Test User',
    email: 'testuser@example.com',
    password: 'testpass123',
    role: 'viewer'
  },
  
  validRoute: {
    routeNumber: 'R-TEST-001',
    name: 'Test Route',
    start: {
      city: 'Colombo',
      coordinates: [79.8612, 6.9271]
    },
    destination: {
      city: 'Kandy',
      coordinates: [80.6337, 7.2906]
    },
    distance: 115,
    estimatedDuration: 180,
    stops: [
      { name: 'Colombo Fort', coordinates: [79.8612, 6.9271] },
      { name: 'Kandy Central', coordinates: [80.6337, 7.2906] }
    ],
    isActive: true
  },
  
  validBus: {
    registrationNumber: 'BUS-TEST-001',
    operator: 'Test Operator',
    type: 'AC Intercity Express',
    capacity: 45,
    isActive: true,
    features: ['AC', 'WiFi', 'GPS']
  },
  
  validTrip: {
    tripId: 'TRIP-TEST-001',
    scheduledDeparture: new Date('2025-10-04T08:00:00.000Z'),
    scheduledArrival: new Date('2025-10-04T11:00:00.000Z'),
    status: 'Scheduled',
    fare: 250,
    driver: {
      name: 'Test Driver',
      licenseNumber: 'DL-TEST-001',
      contactNumber: '+94-77-111-1111'
    }
  },
  
  invalidUser: {
    name: '',
    email: 'invalid-email',
    password: '123', // Too short
    role: 'invalid-role'
  },
  
  invalidRoute: {
    routeNumber: '', // Empty route number
    name: '',
    start: {},
    destination: {},
    distance: -10, // Negative distance
    estimatedDuration: -5
  }
};

/**
 * Assertion helpers
 */
export const expectSuccess = (response, statusCode = 200) => {
  expect(response.status).toBe(statusCode);
  expect(response.body.success).toBe(true);
  expect(response.body.message).toBeDefined();
};

export const expectError = (response, statusCode = 400) => {
  expect(response.status).toBe(statusCode);
  expect(response.body.success).toBe(false);
  expect(response.body.message).toBeDefined();
};

export const expectValidationError = (response) => {
  expectError(response, 400);
  expect(response.body.message).toMatch(/validation|invalid|required/i);
};

export const expectAuthError = (response) => {
  expectError(response, 401);
  expect(response.body.message).toMatch(/authentication|token|unauthorized/i);
};

export const expectForbiddenError = (response) => {
  expectError(response, 403);
  expect(response.body.message).toMatch(/forbidden|permission|access/i);
};

export const expectNotFoundError = (response) => {
  expectError(response, 404);
  expect(response.body.message).toMatch(/not found/i);
};

/**
 * Database test helpers
 */
export const createTestUser = async (userData = testData.validUser) => {
  const User = (await import('../src/models/User.js')).default;
  const hashedPassword = await hashPassword(userData.password);
  
  return await User.create({
    ...userData,
    password: hashedPassword
  });
};

export const createTestRoute = async (routeData = testData.validRoute) => {
  const Route = (await import('../src/models/Route.js')).default;
  return await Route.create(routeData);
};

export const createTestBus = async (busData = testData.validBus, routeId = null) => {
  const Bus = (await import('../src/models/Bus.js')).default;
  
  if (routeId) {
    busData.route = routeId;
  }
  
  return await Bus.create(busData);
};

export const createTestTrip = async (tripData = testData.validTrip, busId = null, routeId = null) => {
  const Trip = (await import('../src/models/Trip.js')).default;
  
  if (busId) tripData.bus = busId;
  if (routeId) tripData.route = routeId;
  
  return await Trip.create(tripData);
};

/**
 * Wait helper for async operations
 */
export const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Mock data generators with randomization
 */
export const generateMockData = {
  user: (overrides = {}) => ({
    ...testData.validUser,
    email: `test${Date.now()}@example.com`,
    ...overrides
  }),
  
  route: (overrides = {}) => ({
    ...testData.validRoute,
    routeNumber: `R-${Date.now()}`,
    ...overrides
  }),
  
  bus: (overrides = {}) => ({
    ...testData.validBus,
    registrationNumber: `BUS-${Date.now()}`,
    ...overrides
  }),
  
  trip: (overrides = {}) => ({
    ...testData.validTrip,
    tripId: `TRIP-${Date.now()}`,
    ...overrides
  })
};
