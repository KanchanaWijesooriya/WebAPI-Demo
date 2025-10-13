import { ApiFeatures } from '../../src/utils/ApiFeatures.js';

import { jest } from '@jest/globals';

describe('ApiFeatures Utility Class', () => {
  let mockQuery;

  beforeEach(() => {
    mockQuery = {
      find: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis()
    };
  });

  describe('Constructor', () => {
    test('should create ApiFeatures with query and queryString', () => {
      const queryString = { name: 'test' };
      const features = new ApiFeatures(mockQuery, queryString);
      
      expect(features.query).toBe(mockQuery);
      expect(features.queryString).toBe(queryString);
    });

    test('should handle empty queryString', () => {
      const features = new ApiFeatures(mockQuery, {});
      
      expect(features.query).toBe(mockQuery);
      expect(features.queryString).toEqual({});
    });
  });

  describe('filter() method', () => {
    test('should filter basic fields', () => {
      const queryString = { name: 'John', age: 25 };
      const features = new ApiFeatures(mockQuery, queryString);
      
      const result = features.filter();
      
      expect(mockQuery.find).toHaveBeenCalledWith({ name: 'John', age: 25 });
      expect(result).toBe(features);
    });

    test('should exclude pagination and utility fields', () => {
      const queryString = { 
        name: 'John', 
        page: 2, 
        sort: 'name', 
        limit: 10, 
        fields: 'name,email' 
      };
      const features = new ApiFeatures(mockQuery, queryString);
      
      features.filter();
      
      expect(mockQuery.find).toHaveBeenCalledWith({ name: 'John' });
    });

    test('should handle advanced filtering operators', () => {
      const queryString = { 
        age: { gte: 18, lte: 65 }, 
        price: { gt: 100, lt: 1000 } 
      };
      const features = new ApiFeatures(mockQuery, queryString);
      
      features.filter();
      
      expect(mockQuery.find).toHaveBeenCalledWith({
        age: { $gte: 18, $lte: 65 },
        price: { $gt: 100, $lt: 1000 }
      });
    });

    test('should handle empty filter object', () => {
      const queryString = { page: 1, sort: 'name' };
      const features = new ApiFeatures(mockQuery, queryString);
      
      features.filter();
      
      expect(mockQuery.find).toHaveBeenCalledWith({});
    });
  });

  describe('sort() method', () => {
    test('should sort by specified field', () => {
      const queryString = { sort: 'name' };
      const features = new ApiFeatures(mockQuery, queryString);
      
      const result = features.sort();
      
      expect(mockQuery.sort).toHaveBeenCalledWith('name');
      expect(result).toBe(features);
    });

    test('should handle multiple sort fields', () => {
      const queryString = { sort: 'name,age,-createdAt' };
      const features = new ApiFeatures(mockQuery, queryString);
      
      features.sort();
      
      expect(mockQuery.sort).toHaveBeenCalledWith('name age -createdAt');
    });

    test('should use default sort when no sort specified', () => {
      const queryString = {};
      const features = new ApiFeatures(mockQuery, queryString);
      
      features.sort();
      
      expect(mockQuery.sort).toHaveBeenCalledWith('-createdAt');
    });

    test('should handle empty sort string', () => {
      const queryString = { sort: '' };
      const features = new ApiFeatures(mockQuery, queryString);
      
      features.sort();
      
      expect(mockQuery.sort).toHaveBeenCalledWith('-createdAt'); // Default sort
    });
  });

  describe('limitFields() method', () => {
    test('should select specified fields', () => {
      const queryString = { fields: 'name,email' };
      const features = new ApiFeatures(mockQuery, queryString);
      
      const result = features.limitFields();
      
      expect(mockQuery.select).toHaveBeenCalledWith('name email');
      expect(result).toBe(features);
    });

    test('should handle single field selection', () => {
      const queryString = { fields: 'name' };
      const features = new ApiFeatures(mockQuery, queryString);
      
      features.limitFields();
      
      expect(mockQuery.select).toHaveBeenCalledWith('name');
    });

    test('should exclude __v by default when no fields specified', () => {
      const queryString = {};
      const features = new ApiFeatures(mockQuery, queryString);
      
      features.limitFields();
      
      expect(mockQuery.select).toHaveBeenCalledWith('-__v');
    });

    test('should handle empty fields string', () => {
      const queryString = { fields: '' };
      const features = new ApiFeatures(mockQuery, queryString);
      
      features.limitFields();
      
      expect(mockQuery.select).toHaveBeenCalledWith('-__v'); // Default exclude __v
    });

    test('should handle field exclusion', () => {
      const queryString = { fields: 'name,-password,-__v' };
      const features = new ApiFeatures(mockQuery, queryString);
      
      features.limitFields();
      
      expect(mockQuery.select).toHaveBeenCalledWith('name -password -__v');
    });
  });

  describe('paginate() method', () => {
    test('should paginate with default values', () => {
      const queryString = {};
      const features = new ApiFeatures(mockQuery, queryString);
      
      const result = features.paginate();
      
      expect(mockQuery.skip).toHaveBeenCalledWith(0);  // (1-1) * 10
      expect(mockQuery.limit).toHaveBeenCalledWith(10);
      expect(result).toBe(features);
    });

    test('should paginate with custom page and limit', () => {
      const queryString = { page: '3', limit: '20' };
      const features = new ApiFeatures(mockQuery, queryString);
      
      features.paginate();
      
      expect(mockQuery.skip).toHaveBeenCalledWith(40);  // (3-1) * 20
      expect(mockQuery.limit).toHaveBeenCalledWith(20);
    });

    test('should handle page 1', () => {
      const queryString = { page: '1', limit: '15' };
      const features = new ApiFeatures(mockQuery, queryString);
      
      features.paginate();
      
      expect(mockQuery.skip).toHaveBeenCalledWith(0);  // (1-1) * 15
      expect(mockQuery.limit).toHaveBeenCalledWith(15);
    });

    test('should handle string numbers', () => {
      const queryString = { page: '5', limit: '25' };
      const features = new ApiFeatures(mockQuery, queryString);
      
      features.paginate();
      
      expect(mockQuery.skip).toHaveBeenCalledWith(100);  // (5-1) * 25
      expect(mockQuery.limit).toHaveBeenCalledWith(25);
    });

    test('should handle invalid page numbers', () => {
      const queryString = { page: 'abc', limit: 'xyz' };
      const features = new ApiFeatures(mockQuery, queryString);
      
      features.paginate();
      
      expect(mockQuery.skip).toHaveBeenCalledWith(0);   // Default to page 1
      expect(mockQuery.limit).toHaveBeenCalledWith(10); // Default limit
    });

    test('should handle zero and negative values', () => {
      const queryString = { page: '0', limit: '-5' };
      const features = new ApiFeatures(mockQuery, queryString);
      
      features.paginate();
      
      expect(mockQuery.skip).toHaveBeenCalledWith(-0); // page defaults to 1, so (1-1) * -5 = -0
      expect(mockQuery.limit).toHaveBeenCalledWith(-5);
    });
  });

  describe('Method Chaining', () => {
    test('should allow method chaining', () => {
      const queryString = { 
        name: 'John', 
        sort: 'name', 
        fields: 'name,email', 
        page: '2', 
        limit: '20' 
      };
      const features = new ApiFeatures(mockQuery, queryString);
      
      const result = features
        .filter()
        .sort()
        .limitFields()
        .paginate();
      
      expect(result).toBe(features);
      expect(mockQuery.find).toHaveBeenCalled();
      expect(mockQuery.sort).toHaveBeenCalled();
      expect(mockQuery.select).toHaveBeenCalled();
      expect(mockQuery.skip).toHaveBeenCalled();
      expect(mockQuery.limit).toHaveBeenCalled();
    });

    test('should maintain query object throughout chain', () => {
      const queryString = { name: 'test' };
      const features = new ApiFeatures(mockQuery, queryString);
      
      features.filter().sort().limitFields().paginate();
      
      expect(features.query).toBe(mockQuery);
    });
  });

  describe('Edge Cases', () => {
    test('should handle null queryString', () => {
      const features = new ApiFeatures(mockQuery, null);
      
      expect(() => features.filter()).not.toThrow();
    });

    test('should handle queryString with nested objects', () => {
      const queryString = { 
        user: { name: 'John', age: { gte: 18 } },
        page: 1
      };
      const features = new ApiFeatures(mockQuery, queryString);
      
      features.filter();
      
      expect(mockQuery.find).toHaveBeenCalledWith({
        user: { name: 'John', age: { $gte: 18 } }
      });
    });

    test('should handle complex filtering with arrays', () => {
      const queryString = { 
        tags: ['javascript', 'node'],
        status: 'active'
      };
      const features = new ApiFeatures(mockQuery, queryString);
      
      features.filter();
      
      expect(mockQuery.find).toHaveBeenCalledWith({
        tags: ['javascript', 'node'],
        status: 'active'
      });
    });
  });
});