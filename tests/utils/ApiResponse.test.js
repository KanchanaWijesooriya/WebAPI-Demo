import { ApiResponse } from '../../src/utils/ApiResponse.js';

describe('ApiResponse Utility Class', () => {
  describe('Constructor', () => {
    it('should create ApiResponse with success status for 2xx status codes', () => {
      const response = new ApiResponse(200, { id: 1, name: 'Test' }, 'Data retrieved successfully');
      
      expect(response.statusCode).toBe(200);
      expect(response.data).toEqual({ id: 1, name: 'Test' });
      expect(response.message).toBe('Data retrieved successfully');
      expect(response.success).toBe(true);
      expect(typeof response.timestamp).toBe('string');
      expect(response.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should create ApiResponse with success status for 3xx status codes', () => {
      const response = new ApiResponse(301, { redirectUrl: '/new-path' }, 'Moved permanently');
      
      expect(response.statusCode).toBe(301);
      expect(response.data).toEqual({ redirectUrl: '/new-path' });
      expect(response.message).toBe('Moved permanently');
      expect(response.success).toBe(true);
      expect(typeof response.timestamp).toBe('string');
    });

    it('should create ApiResponse with failure status for 4xx status codes', () => {
      const response = new ApiResponse(400, null, 'Bad request');
      
      expect(response.statusCode).toBe(400);
      expect(response.data).toBe(null);
      expect(response.message).toBe('Bad request');
      expect(response.success).toBe(false);
      expect(typeof response.timestamp).toBe('string');
    });

    it('should create ApiResponse with failure status for 5xx status codes', () => {
      const response = new ApiResponse(500, { error: 'Internal error' }, 'Server error');
      
      expect(response.statusCode).toBe(500);
      expect(response.data).toEqual({ error: 'Internal error' });
      expect(response.message).toBe('Server error');
      expect(response.success).toBe(false);
      expect(typeof response.timestamp).toBe('string');
    });

    it('should use default message when not provided', () => {
      const response = new ApiResponse(200, { test: 'data' });
      
      expect(response.statusCode).toBe(200);
      expect(response.data).toEqual({ test: 'data' });
      expect(response.message).toBe('Success');
      expect(response.success).toBe(true);
      expect(typeof response.timestamp).toBe('string');
    });

    it('should handle edge case with status code exactly 400', () => {
      const response = new ApiResponse(400, { error: 'Bad request' }, 'Validation failed');
      
      expect(response.statusCode).toBe(400);
      expect(response.success).toBe(false);
      expect(response.message).toBe('Validation failed');
    });

    it('should handle edge case with status code 399 (success)', () => {
      const response = new ApiResponse(399, { data: 'custom' }, 'Custom success');
      
      expect(response.statusCode).toBe(399);
      expect(response.success).toBe(true);
      expect(response.message).toBe('Custom success');
    });
  });

  describe('Data Handling', () => {
    it('should handle null data', () => {
      const response = new ApiResponse(204, null, 'No content');
      
      expect(response.data).toBe(null);
      expect(response.success).toBe(true);
    });

    it('should handle undefined data', () => {
      const response = new ApiResponse(200, undefined);
      
      expect(response.data).toBe(undefined);
      expect(response.success).toBe(true);
    });

    it('should handle empty object data', () => {
      const response = new ApiResponse(200, {});
      
      expect(response.data).toEqual({});
      expect(response.success).toBe(true);
    });

    it('should handle array data', () => {
      const testData = [{ id: 1 }, { id: 2 }];
      const response = new ApiResponse(200, testData, 'List retrieved');
      
      expect(response.data).toEqual(testData);
      expect(response.success).toBe(true);
    });

    it('should handle string data', () => {
      const response = new ApiResponse(200, 'Simple string response');
      
      expect(response.data).toBe('Simple string response');
      expect(response.success).toBe(true);
    });

    it('should handle numeric data', () => {
      const response = new ApiResponse(200, 42);
      
      expect(response.data).toBe(42);
      expect(response.success).toBe(true);
    });

    it('should handle boolean data', () => {
      const response = new ApiResponse(200, true);
      
      expect(response.data).toBe(true);
      expect(response.success).toBe(true);
    });
  });

  describe('Message Handling', () => {
    it('should handle empty string message', () => {
      const response = new ApiResponse(200, { test: 'data' }, '');
      
      expect(response.message).toBe('');
      expect(response.success).toBe(true);
    });

    it('should handle very long message', () => {
      const longMessage = 'A'.repeat(1000);
      const response = new ApiResponse(200, null, longMessage);
      
      expect(response.message).toBe(longMessage);
      expect(response.success).toBe(true);
    });

    it('should handle message with special characters', () => {
      const specialMessage = 'Success! @#$%^&*()_+-=[]{}|;:,.<>?';
      const response = new ApiResponse(200, null, specialMessage);
      
      expect(response.message).toBe(specialMessage);
      expect(response.success).toBe(true);
    });
  });

  describe('Status Code Edge Cases', () => {
    it('should handle status code 0', () => {
      const response = new ApiResponse(0, null, 'Zero status');
      
      expect(response.statusCode).toBe(0);
      expect(response.success).toBe(true); // 0 < 400
    });

    it('should handle negative status code', () => {
      const response = new ApiResponse(-1, null, 'Negative status');
      
      expect(response.statusCode).toBe(-1);
      expect(response.success).toBe(true); // -1 < 400
    });

    it('should handle very large status code', () => {
      const response = new ApiResponse(999, null, 'Large status');
      
      expect(response.statusCode).toBe(999);
      expect(response.success).toBe(false); // 999 >= 400
    });
  });

  describe('Timestamp Generation', () => {
    it('should generate timestamp in ISO format', () => {
      const response = new ApiResponse(200, 'data');
      
      expect(typeof response.timestamp).toBe('string');
      expect(response.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      
      // Verify it's a valid date
      const timestampDate = new Date(response.timestamp);
      expect(timestampDate).toBeInstanceOf(Date);
      expect(isNaN(timestampDate.getTime())).toBe(false);
    });
    
    it('should generate timestamps close to current time', () => {
      const beforeTime = new Date().getTime();
      const response = new ApiResponse(200, 'data');
      const afterTime = new Date().getTime();
      
      const responseTime = new Date(response.timestamp).getTime();
      expect(responseTime).toBeGreaterThanOrEqual(beforeTime);
      expect(responseTime).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('Object Structure', () => {
    it('should have all required properties', () => {
      const response = new ApiResponse(200, { test: 'data' }, 'Test message');
      
      expect(response).toHaveProperty('statusCode');
      expect(response).toHaveProperty('data');
      expect(response).toHaveProperty('message');
      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('timestamp');
    });

    it('should be serializable to JSON', () => {
      const response = new ApiResponse(200, { nested: { value: 'test' } }, 'JSON test');
      
      const jsonString = JSON.stringify(response);
      const parsed = JSON.parse(jsonString);
      
      expect(parsed.statusCode).toBe(200);
      expect(parsed.data.nested.value).toBe('test');
      expect(parsed.message).toBe('JSON test');
      expect(parsed.success).toBe(true);
      expect(typeof parsed.timestamp).toBe('string');
      expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('Integration with Real-world Scenarios', () => {
    it('should handle successful API response scenario', () => {
      const userData = {
        id: 123,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'passenger'
      };
      
      const response = new ApiResponse(200, userData, 'User retrieved successfully');
      
      expect(response.statusCode).toBe(200);
      expect(response.success).toBe(true);
      expect(response.data).toEqual(userData);
      expect(response.message).toBe('User retrieved successfully');
      expect(typeof response.timestamp).toBe('string');
    });

    it('should handle error API response scenario', () => {
      const errorData = {
        field: 'email',
        issue: 'Email already exists'
      };
      
      const response = new ApiResponse(409, errorData, 'Conflict: Email already in use');
      
      expect(response.statusCode).toBe(409);
      expect(response.success).toBe(false);
      expect(response.data).toEqual(errorData);
      expect(response.message).toBe('Conflict: Email already in use');
    });

    it('should handle pagination response scenario', () => {
      const paginationData = {
        items: [{ id: 1 }, { id: 2 }, { id: 3 }],
        total: 100,
        page: 1,
        limit: 10,
        totalPages: 10
      };
      
      const response = new ApiResponse(200, paginationData, 'Page retrieved successfully');
      
      expect(response.statusCode).toBe(200);
      expect(response.success).toBe(true);
      expect(response.data.items).toHaveLength(3);
      expect(response.data.total).toBe(100);
    });
  });
});