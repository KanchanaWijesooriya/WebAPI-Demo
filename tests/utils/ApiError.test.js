import { ApiError } from '../../src/utils/ApiError.js';

describe('ApiError Utility Class', () => {
  describe('Constructor', () => {
    test('should create ApiError with required parameters', () => {
      const error = new ApiError(404, 'Not Found');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Not Found');
      expect(error.isOperational).toBe(true);
    });

    test('should create ApiError with all parameters', () => {
      const customStack = 'Custom stack trace';
      const error = new ApiError(500, 'Internal Server Error', false, customStack);
      
      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Internal Server Error');
      expect(error.isOperational).toBe(false);
      expect(error.stack).toBe(customStack);
    });

    test('should capture stack trace when no custom stack provided', () => {
      const error = new ApiError(400, 'Bad Request');
      
      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
      expect(error.stack.length).toBeGreaterThan(0);
    });

    test('should use custom stack when provided', () => {
      const customStack = 'Error at line 42';
      const error = new ApiError(403, 'Forbidden', true, customStack);
      
      expect(error.stack).toBe(customStack);
    });
  });

  describe('Default Values', () => {
    test('should have default isOperational value of true', () => {
      const error = new ApiError(401, 'Unauthorized');
      
      expect(error.isOperational).toBe(true);
    });

    test('should handle empty stack parameter', () => {
      const error = new ApiError(422, 'Unprocessable Entity', true, '');
      
      expect(error.stack).toBeDefined();
      expect(error.stack).not.toBe('');
    });
  });

  describe('Error Properties', () => {
    test('should inherit from Error class', () => {
      const error = new ApiError(429, 'Too Many Requests');
      
      expect(error instanceof Error).toBe(true);
      expect(error.name).toBe('Error');
    });

    test('should have correct message property', () => {
      const message = 'Custom error message with special characters !@#$%';
      const error = new ApiError(418, message);
      
      expect(error.message).toBe(message);
    });

    test('should preserve all custom properties', () => {
      const error = new ApiError(502, 'Bad Gateway', false);
      
      expect(error).toHaveProperty('statusCode');
      expect(error).toHaveProperty('message');
      expect(error).toHaveProperty('isOperational');
      expect(error).toHaveProperty('stack');
    });
  });

  describe('Edge Cases', () => {
    test('should handle zero status code', () => {
      const error = new ApiError(0, 'No status code');
      
      expect(error.statusCode).toBe(0);
    });

    test('should handle negative status code', () => {
      const error = new ApiError(-1, 'Negative status code');
      
      expect(error.statusCode).toBe(-1);
    });

    test('should handle very large status code', () => {
      const error = new ApiError(99999, 'Large status code');
      
      expect(error.statusCode).toBe(99999);
    });

    test('should handle empty message', () => {
      const error = new ApiError(500, '');
      
      expect(error.message).toBe('');
    });

    test('should handle null message', () => {
      const error = new ApiError(500, null);
      
      expect(error.message).toBe('null'); // Error constructor converts null to 'null'
    });

    test('should handle undefined message', () => {
      const error = new ApiError(500, undefined);
      
      expect(error.message).toBe(''); // Error constructor converts undefined to empty string
    });
  });

  describe('Stack Trace Handling', () => {
    test('should handle null stack parameter', () => {
      const error = new ApiError(503, 'Service Unavailable', true, null);
      
      expect(error.stack).toBeDefined();
      expect(error.stack).not.toBeNull();
    });

    test('should handle undefined stack parameter', () => {
      const error = new ApiError(504, 'Gateway Timeout', true, undefined);
      
      expect(error.stack).toBeDefined();
    });

    test('should handle multiline stack trace', () => {
      const multilineStack = `Error: Test error
        at Object.<anonymous> (/path/to/file.js:10:15)
        at Module._compile (module.js:456:26)
        at Object.Module._extensions..js (module.js:474:10)`;
      
      const error = new ApiError(507, 'Insufficient Storage', true, multilineStack);
      
      expect(error.stack).toBe(multilineStack);
    });
  });

  describe('Serialization', () => {
    test('should be serializable to JSON', () => {
      const error = new ApiError(400, 'Bad Request', true);
      
      const serialized = JSON.stringify(error);
      const parsed = JSON.parse(serialized);
      
      // Error objects don't serialize their message property by default
      expect(parsed).toHaveProperty('statusCode');
      expect(parsed.statusCode).toBe(400);
      expect(parsed).toHaveProperty('isOperational');
      expect(parsed.isOperational).toBe(true);
    });

    test('should preserve custom properties in serialization', () => {
      const error = new ApiError(403, 'Forbidden', false);
      error.customProperty = 'test value';
      
      const serialized = JSON.stringify(error);
      const parsed = JSON.parse(serialized);
      
      expect(parsed.customProperty).toBe('test value');
    });
  });
});