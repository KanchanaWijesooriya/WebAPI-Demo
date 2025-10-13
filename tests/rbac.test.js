/**
 * Comprehensive test suite for rbac.js middleware
 * Testing authentication and authorization middleware functions
 */

import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';

// Mock the User model
const mockUser = {
  findById: jest.fn()
};

// Mock modules BEFORE importing the middleware
jest.unstable_mockModule('../src/models/User.js', () => ({
  default: mockUser
}));

// Mock environment variables
process.env.JWT_SECRET = 'test_secret_key_for_rbac_tests';

describe('RBAC Middleware Tests', () => {
  let req, res, next;
  let authenticate, authorize, requirePermission, adminOnly, operatorOrAdmin, selfOrAdmin;

  beforeAll(async () => {
    // Import middleware AFTER mocking
    const middlewareModule = await import('../src/middleware/rbac.js');
    authenticate = middlewareModule.authenticate;
    authorize = middlewareModule.authorize;
    requirePermission = middlewareModule.requirePermission;
    adminOnly = middlewareModule.adminOnly;
    operatorOrAdmin = middlewareModule.operatorOrAdmin;
    selfOrAdmin = middlewareModule.selfOrAdmin;
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mock request, response, and next function
    req = {
      headers: {},
      params: {},
      user: null
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    next = jest.fn();
  });

  describe('authenticate middleware', () => {
    test('Should authenticate user with valid token', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const token = jwt.sign({ userId }, process.env.JWT_SECRET);
      
      req.headers.authorization = `Bearer ${token}`;
      
      const mockUserData = {
        _id: userId,
        username: 'testuser',
        email: 'test@example.com',
        role: 'admin',
        permissions: [{ resource: 'routes', actions: ['create', 'read'] }],
        profile: { firstName: 'Test', lastName: 'User' },
        isActive: true
      };
      
      const mockSelectMethod = jest.fn().mockResolvedValue(mockUserData);
      mockUser.findById.mockReturnValue({
        select: mockSelectMethod
      });
      
      await authenticate(req, res, next);
      
      expect(mockUser.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(mockSelectMethod).toHaveBeenCalledWith('+permissions');
      expect(req.user).toEqual({
        id: mockUserData._id,
        username: mockUserData.username,
        email: mockUserData.email,
        role: mockUserData.role,
        permissions: mockUserData.permissions,
        profile: mockUserData.profile
      });
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('Should reject request without authorization header', async () => {
      await authenticate(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        statusCode: 401,
        success: false,
        message: 'Access denied. Authentication token is required.',
        error: 'NO_TOKEN_PROVIDED'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('Should reject request with malformed authorization header', async () => {
      req.headers.authorization = 'InvalidFormat token';
      
      await authenticate(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        statusCode: 401,
        success: false,
        message: 'Access denied. Authentication token is required.',
        error: 'NO_TOKEN_PROVIDED'
      });
    });

    test('Should reject request with invalid JWT token', async () => {
            req.headers.authorization = 'Bearer invalidtoken';
            
            await authenticate(req, res, next);
            
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
              statusCode: 401,
              success: false,
              message: 'Access denied. Malformed authentication token.',
              error: 'MALFORMED_TOKEN'
            });
          });

    test('Should reject request with expired JWT token', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const expiredToken = jwt.sign({ userId, exp: Math.floor(Date.now() / 1000) - 3600 }, process.env.JWT_SECRET);
      
      req.headers.authorization = `Bearer ${expiredToken}`;
      
      await authenticate(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        statusCode: 401,
        success: false,
        message: 'Access denied. Authentication token has expired.',
        error: 'TOKEN_EXPIRED'
      });
    });

    test('Should reject request when user not found in database', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const token = jwt.sign({ userId }, process.env.JWT_SECRET);
      
      req.headers.authorization = `Bearer ${token}`;
      
      const mockSelectMethod = jest.fn().mockResolvedValue(null);
      mockUser.findById.mockReturnValue({
        select: mockSelectMethod
      });
      
      await authenticate(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        statusCode: 401,
        success: false,
        message: 'Access denied. User account not found.',
        error: 'USER_NOT_FOUND'
      });
    });

    test('Should reject request when user account is deactivated', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const token = jwt.sign({ userId }, process.env.JWT_SECRET);
      
      req.headers.authorization = `Bearer ${token}`;
      
      const mockUserData = {
        _id: userId,
        username: 'testuser',
        email: 'test@example.com',
        role: 'admin',
        permissions: [{ resource: 'routes', actions: ['create', 'read'] }],
        profile: { firstName: 'Test', lastName: 'User' },
        isActive: false // Deactivated user
      };
      
      const mockSelectMethod = jest.fn().mockResolvedValue(mockUserData);
      mockUser.findById.mockReturnValue({
        select: mockSelectMethod
      });
      
      await authenticate(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        statusCode: 401,
        success: false,
        message: 'Access denied. User account has been deactivated.',
        error: 'ACCOUNT_DEACTIVATED'
      });
    });

    test('Should handle database connection errors', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const token = jwt.sign({ userId }, process.env.JWT_SECRET);
      
      req.headers.authorization = `Bearer ${token}`;
      
      const mockSelectMethod = jest.fn().mockRejectedValue(new Error('Database connection failed'));
      mockUser.findById.mockReturnValue({
        select: mockSelectMethod
      });
      
      await authenticate(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          success: false
        })
      );
    });
  });

  describe('authorize middleware', () => {
    test('Should allow access for user with correct role', async () => {
      req.user = { role: 'admin' };
      const middleware = authorize(['admin', 'operator']);
      
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    test('Should deny access for user with incorrect role', async () => {
      req.user = { role: 'passenger' };
      const middleware = authorize(['admin', 'operator']);
      
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          success: false,
          error: 'INSUFFICIENT_ROLE_PERMISSIONS',
          userRole: 'passenger',
          requiredRoles: ['admin', 'operator']
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('Should deny access when user is not authenticated', async () => {
      const middleware = authorize(['admin']);
      
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        statusCode: 401,
        success: false,
        message: 'Authentication required. Please log in first.',
        error: 'AUTHENTICATION_REQUIRED'
      });
    });

    test('Should handle single role authorization', async () => {
      req.user = { role: 'admin' };
      const middleware = authorize('admin');
      
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('requirePermission middleware', () => {
    test('Should allow access when user has required permission', async () => {
      req.user = {
        role: 'operator',
        permissions: [
          { resource: 'routes', actions: ['create', 'read', 'update'] },
          { resource: 'buses', actions: ['read'] }
        ]
      };
      
      const middleware = requirePermission('routes', 'create');
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('Should deny access when user lacks required action permission', async () => {
      req.user = {
        role: 'operator',
        permissions: [
          { resource: 'routes', actions: ['read'] }, // No 'create' action
          { resource: 'buses', actions: ['read'] }
        ]
      };
      
      const middleware = requirePermission('routes', 'create');
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    test('Should deny access when user lacks resource permission', async () => {
      req.user = {
        role: 'operator',
        permissions: [
          { resource: 'buses', actions: ['read'] } // No 'routes' resource
        ]
      };
      
      const middleware = requirePermission('routes', 'read');
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('Should deny access when user is not authenticated', async () => {
      const middleware = requirePermission('routes', 'read');
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('Should deny access when user has no permissions array', async () => {
      req.user = { role: 'operator' }; // No permissions property
      
      const middleware = requirePermission('routes', 'read');
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('Should deny access when user has empty permissions array', async () => {
      req.user = { 
        role: 'operator',
        permissions: [] // Empty array
      };
      
      const middleware = requirePermission('routes', 'read');
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('adminOnly middleware', () => {
    test('Should allow access for admin user', async () => {
      req.user = { role: 'admin' };
      
      await adminOnly(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('Should deny access for non-admin user', async () => {
      req.user = { role: 'operator' };
      
      await adminOnly(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('operatorOrAdmin middleware', () => {
    test('Should allow access for operator user', async () => {
      req.user = { role: 'operator' };
      
      await operatorOrAdmin(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('Should allow access for admin user', async () => {
      req.user = { role: 'admin' };
      
      await operatorOrAdmin(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('Should deny access for passenger user', async () => {
      req.user = { role: 'passenger' };
      
      await operatorOrAdmin(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('selfOrAdmin middleware', () => {
    test('Should allow admin to access any user data', async () => {
      req.user = { role: 'admin', id: 'admin123' };
      req.params = { userId: 'other456' };
      
      await selfOrAdmin(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('Should allow user to access their own data using userId param', async () => {
      req.user = { role: 'passenger', id: 'user123' };
      req.params = { userId: 'user123' };
      
      await selfOrAdmin(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('Should allow user to access their own data using id param', async () => {
      req.user = { role: 'passenger', id: 'user123' };
      req.params = { id: 'user123' };
      
      await selfOrAdmin(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('Should deny user access to other user data', async () => {
      req.user = { role: 'passenger', id: 'user123' };
      req.params = { userId: 'other456' };
      
      await selfOrAdmin(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('Should deny access when user is not authenticated', async () => {
      req.params = { userId: 'user123' };
      
      await selfOrAdmin(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('Should deny access when no user ID in params', async () => {
      req.user = { role: 'passenger', id: 'user123' };
      req.params = {}; // No userId or id
      
      await selfOrAdmin(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('authenticate should handle missing JWT_SECRET', async () => {
      const orgSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;
      
      const userId = '507f1f77bcf86cd799439011';
      const token = jwt.sign({ userId }, 'temp_secret');
      req.headers.authorization = `Bearer ${token}`;
      
      await authenticate(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      
      // Restore secret
      process.env.JWT_SECRET = orgSecret;
    });

    test('Should handle authorization header with exactly "Bearer " (7 chars)', async () => {
      req.headers.authorization = 'Bearer ';
      
      await authenticate(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('Should handle non-array permissions in requirePermission', async () => {
      req.user = {
        role: 'operator',
        permissions: 'not-an-array' // Invalid permissions format
      };
      
      const middleware = requirePermission('routes', 'read');
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});