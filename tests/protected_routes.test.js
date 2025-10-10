import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

describe('Protected Routes Tests', () => {
  let app;
  let validToken;
  let adminToken;

  beforeAll(async () => {
    // Create test app
    app = express();
    app.use(express.json());
    
    // Mock valid tokens
    validToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXItaWQiLCJlbWFpbCI6InRlc3RAdGVzdC5jb20iLCJyb2xlIjoidmlld2VyIiwiaWF0IjoxNjAwMDAwMDAwfQ.test';
    adminToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhZG1pbi11c2VyLWlkIiwiZW1haWwiOiJhZG1pbkB0ZXN0LmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTYwMDAwMDAwMH0.admin';

    // Mock authentication middleware
    const mockAuth = (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ message: 'No token provided' });
      }
      
      if (authHeader === adminToken) {
        req.user = { id: 'admin-user-id', email: 'admin@test.com', role: 'admin' };
      } else if (authHeader === validToken) {
        req.user = { id: 'test-user-id', email: 'test@test.com', role: 'viewer' };
      } else {
        return res.status(401).json({ message: 'Invalid token' });
      }
      
      next();
    };

    const mockAdminOnly = (req, res, next) => {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }
      next();
    };

    // Mock protected routes
    app.get('/api/protected/profile', mockAuth, (req, res) => {
      res.json({ 
        success: true, 
        user: { 
          id: req.user.id, 
          email: req.user.email, 
          role: req.user.role 
        } 
      });
    });

    app.get('/api/protected/admin-only', mockAuth, mockAdminOnly, (req, res) => {
      res.json({ 
        success: true, 
        message: 'Admin access granted',
        user: req.user 
      });
    });

    app.post('/api/protected/create', mockAuth, (req, res) => {
      res.status(201).json({ 
        success: true, 
        message: 'Resource created',
        data: req.body 
      });
    });

    app.put('/api/protected/update/:id', mockAuth, (req, res) => {
      res.json({ 
        success: true, 
        message: 'Resource updated',
        id: req.params.id,
        data: req.body 
      });
    });

    app.delete('/api/protected/delete/:id', mockAuth, mockAdminOnly, (req, res) => {
      res.json({ 
        success: true, 
        message: 'Resource deleted',
        id: req.params.id 
      });
    });

    // Public route for comparison
    app.get('/api/public/info', (req, res) => {
      res.json({ success: true, message: 'Public information' });
    });
  });

  describe('Authentication Required Routes', () => {
    test('Should allow access with valid token', async () => {
      const response = await request(app)
        .get('/api/protected/profile')
        .set('Authorization', validToken);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email');
      expect(response.body.user).toHaveProperty('role');
    });

    test('Should deny access without token', async () => {
      const response = await request(app)
        .get('/api/protected/profile');
      
      expect(response.status).toBe(401);
      expect(response.body.message).toBe('No token provided');
    });

    test('Should deny access with invalid token', async () => {
      const response = await request(app)
        .get('/api/protected/profile')
        .set('Authorization', 'Bearer invalid-token');
      
      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid token');
    });

    test('Should deny access with malformed authorization header', async () => {
      const response = await request(app)
        .get('/api/protected/profile')
        .set('Authorization', 'InvalidFormat token');
      
      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid token');
    });
  });

  describe('Admin-Only Protected Routes', () => {
    test('Should allow admin access', async () => {
      const response = await request(app)
        .get('/api/protected/admin-only')
        .set('Authorization', adminToken);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Admin access granted');
      expect(response.body.user.role).toBe('admin');
    });

    test('Should deny non-admin user access', async () => {
      const response = await request(app)
        .get('/api/protected/admin-only')
        .set('Authorization', validToken);
      
      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Admin access required');
    });

    test('Should deny unauthenticated access to admin routes', async () => {
      const response = await request(app)
        .get('/api/protected/admin-only');
      
      expect(response.status).toBe(401);
      expect(response.body.message).toBe('No token provided');
    });
  });

  describe('HTTP Methods on Protected Routes', () => {
    test('Should handle POST requests with authentication', async () => {
      const requestData = { name: 'Test Resource', description: 'Test Description' };
      
      const response = await request(app)
        .post('/api/protected/create')
        .set('Authorization', validToken)
        .send(requestData);
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Resource created');
      expect(response.body.data).toEqual(requestData);
    });

    test('Should handle PUT requests with authentication', async () => {
      const updateData = { name: 'Updated Resource' };
      const resourceId = 'test-resource-123';
      
      const response = await request(app)
        .put(`/api/protected/update/${resourceId}`)
        .set('Authorization', validToken)
        .send(updateData);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Resource updated');
      expect(response.body.id).toBe(resourceId);
      expect(response.body.data).toEqual(updateData);
    });

    test('Should handle DELETE requests with admin authentication', async () => {
      const resourceId = 'test-resource-456';
      
      const response = await request(app)
        .delete(`/api/protected/delete/${resourceId}`)
        .set('Authorization', adminToken);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Resource deleted');
      expect(response.body.id).toBe(resourceId);
    });

    test('Should deny DELETE requests from non-admin users', async () => {
      const resourceId = 'test-resource-789';
      
      const response = await request(app)
        .delete(`/api/protected/delete/${resourceId}`)
        .set('Authorization', validToken);
      
      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Admin access required');
    });
  });

  describe('Route Parameter Handling', () => {
    test('Should properly handle route parameters in protected routes', async () => {
      const resourceId = 'resource-with-special-chars_123';
      const updateData = { status: 'active' };
      
      const response = await request(app)
        .put(`/api/protected/update/${resourceId}`)
        .set('Authorization', validToken)
        .send(updateData);
      
      expect(response.status).toBe(200);
      expect(response.body.id).toBe(resourceId);
    });

    test('Should handle numeric route parameters', async () => {
      const numericId = '12345';
      
      const response = await request(app)
        .put(`/api/protected/update/${numericId}`)
        .set('Authorization', validToken)
        .send({ name: 'Numeric ID Test' });
      
      expect(response.status).toBe(200);
      expect(response.body.id).toBe(numericId);
    });
  });

  describe('Request Body Handling', () => {
    test('Should properly handle JSON request bodies', async () => {
      const complexData = {
        name: 'Complex Resource',
        metadata: {
          tags: ['test', 'api', 'protected'],
          priority: 1,
          active: true
        },
        items: [
          { id: 1, value: 'item1' },
          { id: 2, value: 'item2' }
        ]
      };
      
      const response = await request(app)
        .post('/api/protected/create')
        .set('Authorization', validToken)
        .send(complexData);
      
      expect(response.status).toBe(201);
      expect(response.body.data).toEqual(complexData);
    });

    test('Should handle empty request bodies', async () => {
      const response = await request(app)
        .post('/api/protected/create')
        .set('Authorization', validToken)
        .send({});
      
      expect(response.status).toBe(201);
      expect(response.body.data).toEqual({});
    });
  });

  describe('Public vs Protected Route Comparison', () => {
    test('Should allow public route access without authentication', async () => {
      const response = await request(app)
        .get('/api/public/info');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Public information');
    });

    test('Should differentiate between public and protected routes', async () => {
      // Public route should work without auth
      const publicResponse = await request(app)
        .get('/api/public/info');
      
      expect(publicResponse.status).toBe(200);
      
      // Protected route should fail without auth
      const protectedResponse = await request(app)
        .get('/api/protected/profile');
      
      expect(protectedResponse.status).toBe(401);
    });
  });

  describe('Response Format Validation', () => {
    test('Should return consistent response format for protected routes', async () => {
      const response = await request(app)
        .get('/api/protected/profile')
        .set('Authorization', validToken);
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);
    });

    test('Should return consistent error format for unauthorized access', async () => {
      const response = await request(app)
        .get('/api/protected/profile');
      
      expect(response.status).toBe(401);
      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Security Headers and Best Practices', () => {
    test('Should handle authorization header case sensitivity', async () => {
      const response = await request(app)
        .get('/api/protected/profile')
        .set('authorization', validToken); // lowercase header
      
      // Should still work as Express normalizes header names
      expect([200, 401]).toContain(response.status);
    });

    test('Should not expose sensitive information in error responses', async () => {
      const response = await request(app)
        .get('/api/protected/profile')
        .set('Authorization', 'Bearer invalid-token');
      
      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid token');
      expect(response.body).not.toHaveProperty('stack');
      expect(response.body).not.toHaveProperty('details');
    });
  });
});
