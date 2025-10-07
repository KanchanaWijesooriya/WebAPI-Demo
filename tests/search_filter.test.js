import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Mock the models before importing the router
const mockRoute = {
  find: jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([]),
    select: jest.fn().mockReturnThis()
  }),
  countDocuments: jest.fn().mockResolvedValue(0),
  aggregate: jest.fn().mockResolvedValue([])
};

const mockTrip = {
  find: jest.fn().mockReturnValue({
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([])
  }),
  countDocuments: jest.fn().mockResolvedValue(0)
};

jest.unstable_mockModule('../src/models/Route.js', () => ({
  default: mockRoute
}));

jest.unstable_mockModule('../src/models/Trip.js', () => ({
  default: mockTrip
}));

describe('Search Filter Routes', () => {
  let app;
  let searchRouter;

  beforeAll(async () => {
    // Import router after mocking
    const routerModule = await import('../src/routes/search_filter.js');
    searchRouter = routerModule.default;
    
    // Create Express app
    app = express();
    app.use(express.json());
    app.use('/api/search', searchRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset default mock behaviors
    mockRoute.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
      select: jest.fn().mockResolvedValue([
        { _id: 'route1' },
        { _id: 'route2' }
      ])
    });
    
    mockRoute.aggregate.mockResolvedValue([]);
    
    mockTrip.find.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([])
    });
  });

  describe('GET /api/search/routes', () => {
    test('should return routes with default parameters', async () => {
      const mockRoutes = [
        {
          _id: '507f1f77bcf86cd799439011',
          routeNumber: 'R001',
          name: 'Colombo - Kandy',
          start: { city: 'Colombo', province: 'Western' },
          destination: { city: 'Kandy', province: 'Central' },
          distance: 115,
          isActive: true
        }
      ];

      mockRoute.find().lean.mockResolvedValue(mockRoutes);
      mockRoute.countDocuments.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/search/routes')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.routes).toEqual(mockRoutes);
      expect(response.body.data.pagination).toEqual({
        current: 1,
        pages: 1,
        total: 1,
        hasNext: false,
        hasPrev: false
      });

      expect(mockRoute.find).toHaveBeenCalledWith({ isActive: true });
    });

    test('should filter routes by start city', async () => {
      const response = await request(app)
        .get('/api/search/routes')
        .query({ start: 'Colombo' })
        .expect(200);

      expect(mockRoute.find).toHaveBeenCalledWith({
        isActive: true,
        'start.city': { $regex: 'Colombo', $options: 'i' }
      });
    });

    test('should filter routes by end city', async () => {
      const response = await request(app)
        .get('/api/search/routes')
        .query({ end: 'Kandy' })
        .expect(200);

      expect(mockRoute.find).toHaveBeenCalledWith({
        isActive: true,
        'destination.city': { $regex: 'Kandy', $options: 'i' }
      });
    });

    test('should filter routes by stops', async () => {
      const response = await request(app)
        .get('/api/search/routes')
        .query({ stops: 'Kegalle' })
        .expect(200);

      expect(mockRoute.find).toHaveBeenCalledWith({
        isActive: true,
        'stops.name': { $regex: 'Kegalle', $options: 'i' }
      });
    });

    test('should combine multiple filters', async () => {
      const response = await request(app)
        .get('/api/search/routes')
        .query({ start: 'Colombo', end: 'Kandy', stops: 'Kegalle' })
        .expect(200);

      expect(mockRoute.find).toHaveBeenCalledWith({
        isActive: true,
        'start.city': { $regex: 'Colombo', $options: 'i' },
        'destination.city': { $regex: 'Kandy', $options: 'i' },
        'stops.name': { $regex: 'Kegalle', $options: 'i' }
      });
    });

    test('should handle pagination parameters', async () => {
      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([])
      };
      
      mockRoute.find.mockReturnValue(mockChain);

      const response = await request(app)
        .get('/api/search/routes')
        .query({ page: 2, limit: 5 })
        .expect(200);

      expect(mockChain.skip).toHaveBeenCalledWith(5);
      expect(mockChain.limit).toHaveBeenCalledWith(5);
    });

    test('should handle sorting parameters', async () => {
      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([])
      };
      
      mockRoute.find.mockReturnValue(mockChain);

      const response = await request(app)
        .get('/api/search/routes')
        .query({ sortBy: 'distance', sortOrder: 'desc' })
        .expect(200);

      expect(mockChain.sort).toHaveBeenCalledWith({ distance: -1 });
    });

    test('should handle database errors', async () => {
      mockRoute.find.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const response = await request(app)
        .get('/api/search/routes')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Error searching routes');
      expect(response.body.error).toBe('Database connection failed');
    });
  });

  describe('GET /api/search/trips', () => {
    beforeEach(() => {
      // Mock Route.find to return route IDs
      mockRoute.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([
          { _id: 'route1' },
          { _id: 'route2' }
        ])
      });
    });

    test('should return trips with default parameters', async () => {
      const mockTrips = [
        {
          _id: '507f1f77bcf86cd799439012',
          tripId: 'T001',
          route: 'route1',
          scheduledDeparture: '2024-01-01T08:00:00.000Z',
          fare: 100,
          status: 'Scheduled'
        }
      ];

      mockTrip.find().lean.mockResolvedValue(mockTrips);
      mockTrip.countDocuments.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/search/trips')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.trips).toEqual(mockTrips);
      expect(mockTrip.find).toHaveBeenCalledWith({
        route: { $in: ['route1', 'route2'] },
        status: { $in: ['Scheduled', 'In Progress'] }
      });
    });

    test('should filter trips by start and end cities', async () => {
      const response = await request(app)
        .get('/api/search/trips')
        .query({ start: 'Colombo', end: 'Kandy' })
        .expect(200);

      expect(mockRoute.find).toHaveBeenCalledWith({
        isActive: true,
        'start.city': { $regex: 'Colombo', $options: 'i' },
        'destination.city': { $regex: 'Kandy', $options: 'i' }
      });
    });

    test('should filter trips by fare range', async () => {
      const response = await request(app)
        .get('/api/search/trips')
        .query({ minFare: 50, maxFare: 150 })
        .expect(200);

      expect(mockTrip.find).toHaveBeenCalledWith({
        route: { $in: ['route1', 'route2'] },
        status: { $in: ['Scheduled', 'In Progress'] },
        fare: { $gte: 50, $lte: 150 }
      });
    });

    test('should filter trips by distance range', async () => {
      const response = await request(app)
        .get('/api/search/trips')
        .query({ minDistance: 100, maxDistance: 200 })
        .expect(200);

      expect(mockRoute.find).toHaveBeenCalledWith({
        isActive: true,
        distance: { $gte: 100, $lte: 200 }
      });
    });

    test('should filter trips by specific date', async () => {
      const testDate = '2024-01-01';
      const response = await request(app)
        .get('/api/search/trips')
        .query({ date: testDate })
        .expect(200);

      const expectedStartDate = new Date(testDate);
      const expectedEndDate = new Date(testDate);
      expectedEndDate.setDate(expectedEndDate.getDate() + 1);

      expect(mockTrip.find).toHaveBeenCalledWith({
        route: { $in: ['route1', 'route2'] },
        status: { $in: ['Scheduled', 'In Progress'] },
        scheduledDeparture: {
          $gte: expectedStartDate,
          $lt: expectedEndDate
        }
      });
    });

    test('should filter trips by departure time with date', async () => {
      const testDate = '2024-01-01';
      const departureTime = '08:30';
      
      const response = await request(app)
        .get('/api/search/trips')
        .query({ date: testDate, departureTime: departureTime })
        .expect(200);

      const calls = mockTrip.find.mock.calls;
      const lastCall = calls[calls.length - 1][0];
      
      expect(lastCall).toHaveProperty('scheduledDeparture');
      expect(lastCall.scheduledDeparture).toHaveProperty('$gte');
      expect(lastCall.scheduledDeparture).toHaveProperty('$lte');
    });

    test('should filter trips by departure time without date', async () => {
      const response = await request(app)
        .get('/api/search/trips')
        .query({ departureTime: '08:30' })
        .expect(200);

      const calls = mockTrip.find.mock.calls;
      const lastCall = calls[calls.length - 1][0];
      
      expect(lastCall).toHaveProperty('$expr');
      expect(lastCall.$expr).toHaveProperty('$and');
    });

    test('should filter trips by weekend day type', async () => {
      const response = await request(app)
        .get('/api/search/trips')
        .query({ dayType: 'weekend' })
        .expect(200);

      const calls = mockTrip.find.mock.calls;
      const lastCall = calls[calls.length - 1][0];
      
      expect(lastCall).toHaveProperty('scheduledDeparture');
    });

    test('should populate route and bus data', async () => {
      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([])
      };
      
      mockTrip.find.mockReturnValue(mockChain);

      const response = await request(app)
        .get('/api/search/trips')
        .expect(200);

      expect(mockChain.populate).toHaveBeenCalledWith('route', 'routeNumber name start destination distance stops');
      expect(mockChain.populate).toHaveBeenCalledWith('bus', 'registrationNumber operator type capacity');
    });

    test('should handle database errors in trips search', async () => {
      mockRoute.find.mockImplementation(() => {
        throw new Error('Route database error');
      });

      const response = await request(app)
        .get('/api/search/trips')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Error searching trips');
      expect(response.body.error).toBe('Route database error');
    });
  });

  describe('GET /api/search/combined', () => {
    beforeEach(() => {
      // Mock Route.find to return routes for combined search
      mockRoute.find().lean.mockResolvedValue([
        {
          _id: 'route1',
          routeNumber: 'R001',
          name: 'Colombo - Kandy',
          start: { city: 'Colombo' },
          destination: { city: 'Kandy' },
          distance: 120
        }
      ]);

      // Mock Trip.find to return trips for combined search
      mockTrip.find().populate().sort().lean.mockResolvedValue([
        {
          _id: 'trip1',
          tripId: 'T001',
          route: {
            _id: 'route1',
            routeNumber: 'R001',
            name: 'Colombo - Kandy'
          },
          scheduledDeparture: '2024-01-01T08:00:00.000Z',
          fare: 100,
          status: 'Scheduled'
        }
      ]);
    });

    test('should return combined routes and trips with default parameters', async () => {
      const response = await request(app)
        .get('/api/search/combined')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('results');
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data).toHaveProperty('summary');
      expect(mockRoute.find).toHaveBeenCalled();
      expect(mockTrip.find).toHaveBeenCalled();
    });

    test('should filter by start and end cities', async () => {
      const response = await request(app)
        .get('/api/search/combined')
        .query({ start: 'Colombo', end: 'Kandy' })
        .expect(200);

      expect(mockRoute.find).toHaveBeenCalledWith({
        isActive: true,
        'start.city': { $regex: 'Colombo', $options: 'i' },
        'destination.city': { $regex: 'Kandy', $options: 'i' }
      });
    });

    test('should filter by distance range', async () => {
      const response = await request(app)
        .get('/api/search/combined')
        .query({ minDistance: 50, maxDistance: 200 })
        .expect(200);

      expect(mockRoute.find).toHaveBeenCalledWith({
        isActive: true,
        distance: { $gte: 50, $lte: 200 }
      });
    });

    test('should filter trips by fare range', async () => {
      const response = await request(app)
        .get('/api/search/combined')
        .query({ minFare: 50, maxFare: 150 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockTrip.find).toHaveBeenCalled();
      
      // Check that Trip.find was called with fare filter
      const tripCalls = mockTrip.find.mock.calls;
      const hasFareFilter = tripCalls.some(call => 
        call[0] && call[0].fare && call[0].fare.$gte === 50 && call[0].fare.$lte === 150
      );
      expect(hasFareFilter).toBe(true);
    });

    test('should handle pagination correctly', async () => {
      const response = await request(app)
        .get('/api/search/combined')
        .query({ page: 2, limit: 3 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination.current).toBe(2);
    });

    test('should handle database errors in combined search', async () => {
      mockRoute.find.mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .get('/api/search/combined')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Error in combined search');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty route results for trips search', async () => {
      mockRoute.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([])
      });

      const response = await request(app)
        .get('/api/search/trips')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.trips).toEqual([]);
    });

    test('should handle invalid pagination parameters', async () => {
      const response = await request(app)
        .get('/api/search/routes')
        .query({ page: -1, limit: 0 })
        .expect(200);

      // Should default to page 1, limit 10
      expect(mockRoute.find).toHaveBeenCalled();
    });

    test('should handle invalid date format gracefully', async () => {
      const response = await request(app)
        .get('/api/search/trips')
        .query({ date: 'invalid-date' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should handle invalid time format', async () => {
      const response = await request(app)
        .get('/api/search/trips')
        .query({ departureTime: '25:99' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should handle trip query error in combined search', async () => {
      mockTrip.find.mockImplementation(() => {
        throw new Error('Trip query failed');
      });

      const response = await request(app)
        .get('/api/search/combined')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Error in combined search');
    });

    test('should handle trip population chain errors', async () => {
      const mockChain = {
        populate: jest.fn().mockImplementation(() => {
          throw new Error('Population failed');
        })
      };
      
      mockTrip.find.mockReturnValue(mockChain);

      const response = await request(app)
        .get('/api/search/trips')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Error searching trips');
    });

    test('should handle large page numbers gracefully', async () => {
      const response = await request(app)
        .get('/api/search/combined')
        .query({ page: 999999, limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination.current).toBe(999999);
    });
  });
});