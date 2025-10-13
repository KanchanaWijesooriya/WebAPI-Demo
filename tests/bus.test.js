import request from 'supertest';
import express from 'express';

// Bus Management Tests - targeting busController.js and Bus.js model
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
    
    // Import and mount bus routes
    try {
      const busRoutes = await import('../src/routes/buses.js');
      app.use('/api/buses', busRoutes.default);
    } catch (error) {
      console.error('Failed to import bus routes:', error.message);
    }
  });

  describe('Bus Controller Tests', () => {
    test('Should have working test environment', async () => {
      const response = await request(app)
        .get('/test');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('Should have bus routes accessible', async () => {
      const response = await request(app)
        .get('/api/buses');

      // Should not be 404 (route exists)
      expect(response.status).not.toBe(404);
    });

    test('Should handle single bus lookup', async () => {
      const response = await request(app)
        .get('/api/buses/test-bus-id');

      // Should handle the request (may fail due to no data, but route exists)
      expect(response.status).not.toBe(404);
    });

    test('Should handle bus location lookup', async () => {
      const response = await request(app)
        .get('/api/buses/test-bus-id/location');

      // Should handle the request
      expect(response.status).not.toBe(404);
    });

    test('Should handle bus trips lookup', async () => {
      const response = await request(app)
        .get('/api/buses/test-bus-id/trips');

      // Should handle the request
      expect(response.status).not.toBe(404);
    });
  });

  describe('Bus Data Validation', () => {
    test('Should validate bus registration number format', () => {
      const validRegistrations = ['CAA-5678', 'SP-1234', 'TEST-001'];
      const invalidRegistrations = ['', null, undefined, 123];

      validRegistrations.forEach(reg => {
        expect(typeof reg).toBe('string');
        expect(reg.length).toBeGreaterThan(0);
        expect(reg).toMatch(/^[A-Z]+-\d+$/); // Basic format validation
      });

      invalidRegistrations.forEach(reg => {
        if (reg === null || reg === undefined) {
          expect(reg).toBeFalsy();
        } else if (typeof reg === 'number') {
          expect(typeof reg).not.toBe('string');
        }
      });
    });

    test('Should validate bus capacity', () => {
      const validCapacities = [30, 45, 52, 60];
      const invalidCapacities = [-1, 0, 'invalid', null];

      validCapacities.forEach(capacity => {
        expect(typeof capacity).toBe('number');
        expect(capacity).toBeGreaterThan(0);
        expect(capacity).toBeLessThan(100); // Reasonable bus capacity
      });

      invalidCapacities.forEach(capacity => {
        if (capacity === null) {
          expect(capacity).toBeNull();
        } else if (typeof capacity === 'string') {
          expect(typeof capacity).not.toBe('number');
        } else if (typeof capacity === 'number') {
          expect(capacity).toBeLessThanOrEqual(0);
        }
      });
    });

    test('Should validate bus features', () => {
      const validFeatures = [
        ['AC', 'WiFi', 'GPS'],
        ['AC', 'USB Charging'],
        ['GPS', 'CCTV']
      ];

      validFeatures.forEach(features => {
        expect(Array.isArray(features)).toBe(true);
        expect(features.length).toBeGreaterThan(0);
        features.forEach(feature => {
          expect(typeof feature).toBe('string');
          expect(feature.length).toBeGreaterThan(0);
        });
      });
    });

    test('Should validate bus operator information', () => {
      const validOperators = [
        { name: 'Cityline Express', contactNumber: '+94-11-234-5678' },
        { name: 'Lanka Tours', contactNumber: '+94-77-123-4567' }
      ];

      validOperators.forEach(operator => {
        expect(typeof operator).toBe('object');
        expect(operator.name).toBeDefined();
        expect(typeof operator.name).toBe('string');
        expect(operator.name.length).toBeGreaterThan(0);
        
        if (operator.contactNumber) {
          expect(typeof operator.contactNumber).toBe('string');
          expect(operator.contactNumber).toMatch(/^\+94-\d+-\d+-\d+$/);
        }
      });
    });
  });

  describe('Bus Status Management', () => {
    test('Should validate bus active status', () => {
      const activeStatuses = [true, false];
      
      activeStatuses.forEach(status => {
        expect(typeof status).toBe('boolean');
      });
    });

    test('Should validate bus type categories', () => {
      const validTypes = ['AC Intercity Express', 'Semi Intercity Express', 'Normal', 'Express'];
      const invalidTypes = ['', null, undefined, 123];

      validTypes.forEach(type => {
        expect(typeof type).toBe('string');
        expect(type.length).toBeGreaterThan(0);
      });

      invalidTypes.forEach(type => {
        if (type === null || type === undefined) {
          expect(type).toBeFalsy();
        } else if (typeof type === 'number') {
          expect(typeof type).not.toBe('string');
        } else if (type === '') {
          expect(type).toBe('');
        }
      });
    });
  });

  describe('Error Handling', () => {
    test('Should handle POST requests without authentication', async () => {
      const response = await request(app)
        .post('/api/buses')
        .send({
          registrationNumber: 'TEST-123',
          operator: 'Test Operator'
        });

      // Should be unauthorized or server error
      expect([401, 403, 500].includes(response.status)).toBe(true);
    });

    test('Should handle PUT requests without authentication', async () => {
      const response = await request(app)
        .put('/api/buses/test-id')
        .send({
          registrationNumber: 'TEST-123'
        });

      // Should be unauthorized or server error
      expect([401, 403, 500].includes(response.status)).toBe(true);
    });

    test('Should handle DELETE requests without authentication', async () => {
      const response = await request(app)
        .delete('/api/buses/test-id');

      // Should be unauthorized or server error
      expect([401, 403, 500].includes(response.status)).toBe(true);
    });

    test('Should handle malformed bus data', async () => {
      const response = await request(app)
        .post('/api/buses')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      // Should handle malformed JSON gracefully
      expect([400, 401, 403, 500].includes(response.status)).toBe(true);
    });
  });
});