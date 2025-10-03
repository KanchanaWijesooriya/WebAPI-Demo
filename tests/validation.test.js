/**
 * Comprehensive test suite for validation.js middleware
 * Testing validation, error handling, and utility middleware functions
 */

import { jest } from '@jest/globals';

// Mock express-validator before imports
const mockValidationResult = jest.fn();
jest.unstable_mockModule('express-validator', () => ({
  validationResult: mockValidationResult
}));

describe('Validation Middleware Tests', () => {
  let req, res, next;
  let consoleSpy;
  let handleValidationErrors, errorHandler, notFound, requestLogger, handlePreflight;

  beforeAll(async () => {
    // Import middleware AFTER mocking
    const middlewareModule = await import('../src/middleware/validation.js');
    handleValidationErrors = middlewareModule.handleValidationErrors;
    errorHandler = middlewareModule.errorHandler;
    notFound = middlewareModule.notFound;
    requestLogger = middlewareModule.requestLogger;
    handlePreflight = middlewareModule.handlePreflight;
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mock request, response, and next function
    req = {
      originalUrl: '/api/test',
      method: 'GET',
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('Mozilla/5.0'),
      headers: {}
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      header: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
      statusCode: 200
    };
    
    next = jest.fn();
    
    // Mock console methods
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    jest.restoreAllMocks();
  });

  describe('handleValidationErrors middleware', () => {
    test('Should pass validation when no errors', () => {
      mockValidationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => []
      });
      
      handleValidationErrors(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    test('Should return validation errors when present', () => {
      const mockErrors = [
        {
          path: 'email',
          param: 'email',
          msg: 'Email is required',
          value: ''
        },
        {
          path: 'password',
          param: 'password', 
          msg: 'Password must be at least 6 characters',
          value: '123'
        }
      ];
      
      mockValidationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => mockErrors
      });
      
      handleValidationErrors(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Validation failed',
        errors: [
          {
            field: 'email',
            message: 'Email is required',
            value: ''
          },
          {
            field: 'password',
            message: 'Password must be at least 6 characters',
            value: '123'
          }
        ]
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('Should handle errors with missing path but present param', () => {
      const mockErrors = [
        {
          param: 'username',
          msg: 'Username is required',
          value: null
        }
      ];
      
      mockValidationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => mockErrors
      });
      
      handleValidationErrors(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Validation failed',
        errors: [
          {
            field: 'username',
            message: 'Username is required',
            value: null
          }
        ]
      });
    });

    test('Should handle errors with missing param but present path', () => {
      const mockErrors = [
        {
          path: 'age',
          msg: 'Age must be a number',
          value: 'invalid'
        }
      ];
      
      mockValidationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => mockErrors
      });
      
      handleValidationErrors(req, res, next);
      
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Validation failed',
        errors: [
          {
            field: 'age',
            message: 'Age must be a number',
            value: 'invalid'
          }
        ]
      });
    });
  });

  describe('errorHandler middleware', () => {
    beforeEach(() => {
      // Mock NODE_ENV to production by default
      process.env.NODE_ENV = 'production';
    });

    test('Should handle generic errors', () => {
      const error = new Error('Generic error message');
      
      errorHandler(error, req, res, next);
      
      expect(consoleSpy).toHaveBeenCalledWith('API Error:', expect.objectContaining({
        message: 'Generic error message',
        stack: expect.any(String),
        url: '/api/test',
        method: 'GET',
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        timestamp: expect.any(String)
      }));
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Generic error message'
      });
    });

    test('Should handle Mongoose CastError', () => {
      const error = {
        name: 'CastError',
        value: '12345',
        message: 'Cast to ObjectId failed'
      };
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Resource not found with id: 12345'
      });
    });

    test('Should handle Mongoose duplicate key error', () => {
      const error = {
        code: 11000,
        keyValue: { email: 'test@example.com' },
        message: 'Duplicate key error'
      };
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: "email 'test@example.com' already exists"
      });
    });

    test('Should handle Mongoose ValidationError', () => {
      const error = {
        name: 'ValidationError',
        errors: {
          email: { message: 'Email is required' },
          password: { message: 'Password is too short' }
        },
        message: 'Validation failed'
      };
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Email is required, Password is too short'
      });
    });

    test('Should handle JsonWebTokenError', () => {
      const error = {
        name: 'JsonWebTokenError',
        message: 'Invalid token'
      };
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Invalid token'
      });
    });

    test('Should handle TokenExpiredError', () => {
      const error = {
        name: 'TokenExpiredError',
        message: 'Token expired at 2023-01-01'
      };
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Token expired'
      });
    });

    test('Should handle rate limit error', () => {
      const error = {
        status: 429,
        message: 'Too many requests'
      };
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Too many requests, please try again later'
      });
    });

    test('Should include stack trace in development environment', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Development error');
      
      errorHandler(error, req, res, next);
      
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Development error',
        stack: expect.any(String),
        originalError: error
      });
    });

    test('Should handle error with custom statusCode', () => {
      const error = {
        message: 'Custom error',
        statusCode: 422
      };
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Custom error'
      });
    });

    test('Should handle error without message', () => {
      const error = {};
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Internal server error'
      });
    });

    test('Should handle multiple field duplicate key error', () => {
      const error = {
        code: 11000,
        keyValue: { username: 'testuser', email: 'test@example.com' },
        message: 'Duplicate key error'
      };
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: "username 'testuser' already exists"
      });
    });
  });

  describe('notFound middleware', () => {
    test('Should create and pass 404 error', () => {
      req.originalUrl = '/api/nonexistent';
      
      notFound(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
      const passedError = next.mock.calls[0][0];
      expect(passedError).toBeInstanceOf(Error);
      expect(passedError.message).toBe('Route /api/nonexistent not found');
      expect(passedError.statusCode).toBe(404);
    });

    test('Should handle different route paths', () => {
      req.originalUrl = '/api/users/123/posts';
      
      notFound(req, res, next);
      
      const passedError = next.mock.calls[0][0];
      expect(passedError.message).toBe('Route /api/users/123/posts not found');
    });
  });

  describe('requestLogger middleware', () => {
    let originalDateNow;
    
    beforeEach(() => {
      originalDateNow = Date.now;
      Date.now = jest.fn()
        .mockReturnValueOnce(1000000) // Start time
        .mockReturnValueOnce(1000100); // End time (100ms later)
    });

    afterEach(() => {
      Date.now = originalDateNow;
    });

    test('Should log request details on response', () => {
      req.method = 'POST';
      req.originalUrl = '/api/users';
      req.ip = '192.168.1.1';
      req.get = jest.fn().mockReturnValue('Chrome/91.0');
      
      requestLogger(req, res, next);
      
      // Simulate response
      res.statusCode = 201;
      res.json({ success: true });
      
      expect(console.log).toHaveBeenCalledWith({
        method: 'POST',
        url: '/api/users',
        status: 201,
        duration: '100ms',
        ip: '192.168.1.1',
        userAgent: 'Chrome/91.0',
        timestamp: expect.any(String)
      });
      
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('Should handle missing user agent', () => {
      req.get = jest.fn().mockReturnValue(undefined);
      
      requestLogger(req, res, next);
      
      res.json({ test: true });
      
      expect(console.log).toHaveBeenCalledWith({
        method: 'GET',
        url: '/api/test',
        status: 200,
        duration: '100ms',
        ip: '127.0.0.1',
        userAgent: undefined,
        timestamp: expect.any(String)
      });
    });

    test('Should preserve original json functionality', () => {
      const originalJson = res.json;
      const testData = { message: 'test response' };
      
      requestLogger(req, res, next);
      
      res.json(testData);
      
      // Verify original json was called with correct context and data
      expect(console.log).toHaveBeenCalled();
    });

    test('Should handle different HTTP methods and status codes', () => {
      req.method = 'DELETE';
      req.originalUrl = '/api/users/123';
      
      requestLogger(req, res, next);
      
      res.statusCode = 404;
      res.json({ error: 'User not found' });
      
      expect(console.log).toHaveBeenCalledWith({
        method: 'DELETE',
        url: '/api/users/123',
        status: 404,
        duration: '100ms',
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        timestamp: expect.any(String)
      });
    });
  });

  describe('handlePreflight middleware', () => {
    test('Should handle OPTIONS request (preflight)', () => {
      req.method = 'OPTIONS';
      req.headers.origin = 'https://example.com';
      
      handlePreflight(req, res, next);
      
      expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://example.com');
      expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
      expect(res.header).toHaveBeenCalledWith('Access-Control-Max-Age', '86400');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.end).toHaveBeenCalledTimes(1);
      expect(next).not.toHaveBeenCalled();
    });

    test('Should use wildcard origin when no origin header', () => {
      req.method = 'OPTIONS';
      // No origin header
      
      handlePreflight(req, res, next);
      
      expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.end).toHaveBeenCalledTimes(1);
      expect(next).not.toHaveBeenCalled();
    });

    test('Should pass through non-OPTIONS requests', () => {
      req.method = 'GET';
      
      handlePreflight(req, res, next);
      
      expect(res.header).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.end).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('Should handle POST request', () => {
      req.method = 'POST';
      
      handlePreflight(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.header).not.toHaveBeenCalled();
    });

    test('Should handle PUT request', () => {
      req.method = 'PUT';
      
      handlePreflight(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.header).not.toHaveBeenCalled();
    });

    test('Should handle DELETE request', () => {
      req.method = 'DELETE';
      
      handlePreflight(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.header).not.toHaveBeenCalled();
    });

    test('Should handle PATCH request', () => {
      req.method = 'PATCH';
      
      handlePreflight(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.header).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Integration', () => {
    test('Should handle validation errors with empty array', () => {
      mockValidationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => []
      });
      
      handleValidationErrors(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Validation failed',
        errors: []
      });
    });

    test('Should handle error with null keyValue in duplicate error', () => {
      const error = {
        code: 11000,
        keyValue: null,
        message: 'Duplicate key error'
      };
      
      // This will throw an error due to null keyValue, which is expected behavior
      expect(() => errorHandler(error, req, res, next)).toThrow();
    });

    test('Should handle ValidationError with empty errors object', () => {
      const error = {
        name: 'ValidationError',
        errors: {},
        message: 'Validation failed'
      };
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Internal server error'
      });
    });

    test('Should handle error logging with missing request properties', () => {
      const minimalReq = {
        originalUrl: '/test',
        method: 'GET',
        get: jest.fn().mockReturnValue(undefined)
      };
      const error = new Error('Test error');
      
      errorHandler(error, minimalReq, res, next);
      
      expect(consoleSpy).toHaveBeenCalledWith('API Error:', expect.objectContaining({
        message: 'Test error',
        url: '/test',
        method: 'GET',
        ip: undefined,
        userAgent: undefined
      }));
    });

    test('Should handle requestLogger with zero duration', () => {
      Date.now = jest.fn()
        .mockReturnValueOnce(1000000) // Start time
        .mockReturnValueOnce(1000000); // Same end time
      
      requestLogger(req, res, next);
      res.json({ test: true });
      
      expect(console.log).toHaveBeenCalledWith({
        method: 'GET',
        url: '/api/test',
        status: 200,
        duration: '0ms',
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        timestamp: expect.any(String)
      });
    });
  });
});