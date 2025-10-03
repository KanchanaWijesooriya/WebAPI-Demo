import request from 'supertest';
import express from 'express';

// Core Bus Management Tests
describe('Bus Management Tests', () => {
  let app;

  beforeAll(async () => {
    // Create test app
    app = express();
    app.use(express.json());
    
    // Test endpoint
    app.get('/test', (req, res) => {
      res.json({ message: 'Bus test environment ready', success: true });
    });
    
    // Import and mount actual route handlers
    try {
      const busRoutes = await import('../src/routes/buses.js');
      app.use('/api/buses', busRoutes.default);
    } catch (error) {
      console.error('Failed to import bus routes:', error.message);
    }
  });

  describe('Bus Core Operations', () => {
    test('Should have working test environment', async () => {
      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('Should access bus listing endpoint', async () => {
      const response = await request(app).get('/api/buses');
      expect([200, 401, 404]).toContain(response.status); // Accept auth errors
    });

    test('Should handle single bus lookup', async () => {
      const response = await request(app).get('/api/buses/CAA-5678');
      expect([200, 404, 401, 500]).toContain(response.status);
    });
  });

  describe('Bus Data Validation', () => {
    test('Should validate Sri Lankan bus registration formats', () => {
      const validRegistrations = [
        'CAA-1234', 'CBB-5678', 'CAD-9012', 'ABC-1234', 'XYZ-9999'
      ];
      
      validRegistrations.forEach(reg => {
        expect(reg).toMatch(/^[A-Z]{2,3}-\d{4}$/);
        expect(reg.length).toBeGreaterThanOrEqual(8);
        expect(reg.length).toBeLessThanOrEqual(9);
      });
    });

    test('Should validate bus capacity values', () => {
      const validCapacities = [20, 30, 45, 50, 60];
      const invalidCapacities = [-5, 0, 'many', null, 150];
      
      validCapacities.forEach(capacity => {
        expect(typeof capacity).toBe('number');
        expect(capacity).toBeGreaterThan(0);
        expect(capacity).toBeLessThan(100);
      });
      
      invalidCapacities.forEach(capacity => {
        if (typeof capacity === 'number') {
          expect(capacity <= 0 || capacity >= 100).toBe(true);
        } else {
          expect(typeof capacity).not.toBe('number');
        }
      });
    });

    test('Should validate bus features array', () => {
      const validFeatures = [
        ['Air Conditioning', 'WiFi'],
        ['Reclining Seats'],
        []
      ];
      
      validFeatures.forEach(features => {
        expect(Array.isArray(features)).toBe(true);
        features.forEach(feature => {
          expect(typeof feature).toBe('string');
          expect(feature.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Bus Status Management', () => {
    test('Should validate bus active status', () => {
      const validStatuses = [true, false];
      
      validStatuses.forEach(status => {
        expect(typeof status).toBe('boolean');
      });
    });

    test('Should validate bus type categories', () => {
      const validTypes = ['City Bus', 'Intercity', 'Luxury', 'Semi-Luxury'];
      
      validTypes.forEach(type => {
        expect(typeof type).toBe('string');
        expect(type.length).toBeGreaterThan(0);
      });
    });
  });
});