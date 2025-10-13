/**
 * Comprehensive test suite for auth.js routes
 * Testing the actual auth routes implementation
 */

import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

// Test setup
let app;

// Mock the AuthController to avoid dependencies
const mockAuthController = {
  register: jest.fn(),
  login: jest.fn(),
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
  changePassword: jest.fn()
};

// Mock the protect middleware
const mockProtect = jest.fn();

beforeAll(async () => {
  // Create Express app
  app = express();
  app.use(express.json());
  
  // Mock the imports before importing the router
  jest.unstable_mockModule('../src/controllers/authController.js', () => ({
    default: mockAuthController
  }));
  
  jest.unstable_mockModule('../src/middleware/auth.js', () => ({
    protect: mockProtect
  }));
  
  // Import and use the auth routes after mocking
  const { default: authRoutes } = await import('../src/routes/auth.js');
  app.use('/api/auth', authRoutes);
});

beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks();
  
  // Default mock implementations
  mockAuthController.register.mockImplementation((req, res) => {
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: { userId: 'mock-user-id', username: req.body.username }
    });
  });
  
  mockAuthController.login.mockImplementation((req, res) => {
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { token: 'mock-jwt-token', user: { id: 'mock-user-id' } }
    });
  });
  
  mockAuthController.getProfile.mockImplementation((req, res) => {
    res.status(200).json({
      success: true,
      data: { id: 'mock-user-id', username: 'testuser', email: 'test@example.com' }
    });
  });
  
  mockAuthController.updateProfile.mockImplementation((req, res) => {
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { ...req.body, id: 'mock-user-id' }
    });
  });
  
  mockAuthController.changePassword.mockImplementation((req, res) => {
    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  });
  
  // Mock protect middleware to call next() for authenticated routes
  mockProtect.mockImplementation((req, res, next) => {
    req.user = { id: 'mock-user-id', username: 'testuser' };
    next();
  });
});

describe('Auth Routes Tests', () => {
  describe('Public Routes', () => {
    test('POST /api/auth/register - Should call register controller', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'TestPass123!',
        role: 'passenger'
      };
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(mockAuthController.register).toHaveBeenCalledTimes(1);
      // Routes are properly configured and controller is called correctly
    });

    test('POST /api/auth/login - Should call login controller', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'TestPass123!'
      };
      
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockAuthController.login).toHaveBeenCalledTimes(1);
      // Routes are properly configured and controller is called correctly
    });

    test('POST /api/auth/register - Should handle registration with different user data', async () => {
      const userData = {
        username: 'operator1',
        email: 'operator@example.com',
        password: 'OperatorPass123!',
        role: 'operator',
        phoneNumber: '+1234567890'
      };
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);
      
      expect(response.status).toBe(201);
      expect(mockAuthController.register).toHaveBeenCalledTimes(1);
    });

    test('POST /api/auth/login - Should handle login with different credentials', async () => {
      const loginData = {
        username: 'testuser', // Test login with username instead of email
        password: 'TestPass123!'
      };
      
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);
      
      expect(response.status).toBe(200);
      expect(mockAuthController.login).toHaveBeenCalledTimes(1);
    });
  });

  describe('Protected Routes', () => {
    test('GET /api/auth/profile - Should call getProfile controller with authentication', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer mock-token');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockProtect).toHaveBeenCalledTimes(1);
      expect(mockAuthController.getProfile).toHaveBeenCalledTimes(1);
    });

    test('PUT /api/auth/profile - Should call updateProfile controller with authentication', async () => {
      const updateData = {
        username: 'updateduser',
        email: 'updated@example.com',
        phoneNumber: '+9876543210'
      };
      
      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', 'Bearer mock-token')
        .send(updateData);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockProtect).toHaveBeenCalledTimes(1);
      expect(mockAuthController.updateProfile).toHaveBeenCalledTimes(1);
      // Routes are properly configured and controller is called correctly
    });

    test('POST /api/auth/change-password - Should call changePassword controller with authentication', async () => {
      const passwordData = {
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass123!',
        confirmPassword: 'NewPass123!'
      };
      
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', 'Bearer mock-token')
        .send(passwordData);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockProtect).toHaveBeenCalledTimes(1);
      expect(mockAuthController.changePassword).toHaveBeenCalledTimes(1);
      // Routes are properly configured and controller is called correctly
    });
  });

  describe('Middleware Integration', () => {
    test('Should apply protect middleware to all protected routes', async () => {
      // Test all protected routes to ensure middleware is applied
      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer mock-token');
      
      await request(app)
        .put('/api/auth/profile')
        .set('Authorization', 'Bearer mock-token')
        .send({ username: 'test' });
      
      await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', 'Bearer mock-token')
        .send({ currentPassword: 'old', newPassword: 'new' });
      
      // Protect middleware should be called 3 times (once for each protected route)
      expect(mockProtect).toHaveBeenCalledTimes(3);
    });

    test('Should not apply protect middleware to public routes', async () => {
      // Reset mock call count
      jest.clearAllMocks();
      
      await request(app)
        .post('/api/auth/register')
        .send({ username: 'test', email: 'test@test.com', password: 'test123' });
      
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'test123' });
      
      // Protect middleware should not be called for public routes
      expect(mockProtect).toHaveBeenCalledTimes(0);
    });
  });

  describe('Controller Error Handling', () => {
    test('Should handle registration errors', async () => {
      mockAuthController.register.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          message: 'Registration failed',
          error: 'Invalid data provided'
        });
      });
      
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'invalid',
          email: 'invalid-email',
          password: '123'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(mockAuthController.register).toHaveBeenCalledTimes(1);
    });

    test('Should handle login errors', async () => {
      mockAuthController.login.mockImplementation((req, res) => {
        res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      });
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'wrong@example.com',
          password: 'wrongpassword'
        });
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(mockAuthController.login).toHaveBeenCalledTimes(1);
    });

    test('Should handle profile update errors', async () => {
      mockAuthController.updateProfile.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          message: 'Profile update failed',
          error: 'Invalid update data'
        });
      });
      
      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', 'Bearer mock-token')
        .send({ email: 'invalid-email-format' });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(mockAuthController.updateProfile).toHaveBeenCalledTimes(1);
    });

    test('Should handle password change errors', async () => {
      mockAuthController.changePassword.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          message: 'Password change failed',
          error: 'Current password is incorrect'
        });
      });
      
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', 'Bearer mock-token')
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'NewPass123!',
          confirmPassword: 'NewPass123!'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(mockAuthController.changePassword).toHaveBeenCalledTimes(1);
    });
  });

  describe('Authentication Middleware Scenarios', () => {
    test('Should handle authentication failure in protect middleware', async () => {
      mockProtect.mockImplementation((req, res, next) => {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      });
      
      const response = await request(app)
        .get('/api/auth/profile');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(mockProtect).toHaveBeenCalledTimes(1);
      expect(mockAuthController.getProfile).toHaveBeenCalledTimes(0);
    });

    test('Should handle different authentication scenarios for protected routes', async () => {
      // Test with missing token
      mockProtect.mockImplementation((req, res, next) => {
        res.status(401).json({
          success: false,
          message: 'No token provided'
        });
      });
      
      const response1 = await request(app)
        .put('/api/auth/profile')
        .send({ username: 'test' });
      
      expect(response1.status).toBe(401);
      
      // Reset and test with invalid token
      jest.clearAllMocks();
      mockProtect.mockImplementation((req, res, next) => {
        res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      });
      
      const response2 = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', 'Bearer invalid-token')
        .send({ currentPassword: 'old', newPassword: 'new' });
      
      expect(response2.status).toBe(401);
    });
  });

  describe('Route Method Coverage', () => {
    test('Should handle POST method for register route', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'posttest',
          email: 'post@test.com',
          password: 'PostTest123!'
        });
      
      expect(response.status).toBe(201);
      expect(mockAuthController.register).toHaveBeenCalledTimes(1);
    });

    test('Should handle POST method for login route', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@test.com',
          password: 'LoginTest123!'
        });
      
      expect(response.status).toBe(200);
      expect(mockAuthController.login).toHaveBeenCalledTimes(1);
    });

    test('Should handle GET method for profile route', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer token');
      
      expect(response.status).toBe(200);
      expect(mockAuthController.getProfile).toHaveBeenCalledTimes(1);
    });

    test('Should handle PUT method for profile update route', async () => {
      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', 'Bearer token')
        .send({ username: 'updated' });
      
      expect(response.status).toBe(200);
      expect(mockAuthController.updateProfile).toHaveBeenCalledTimes(1);
    });

    test('Should handle POST method for change password route', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', 'Bearer token')
        .send({
          currentPassword: 'current',
          newPassword: 'new'
        });
      
      expect(response.status).toBe(200);
      expect(mockAuthController.changePassword).toHaveBeenCalledTimes(1);
    });
  });
});