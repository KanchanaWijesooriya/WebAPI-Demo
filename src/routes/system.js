import express from 'express';

const router = express.Router();

/**
 * API Health Check endpoint
 * @route GET /api/health
 * @access Public
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'NTC Bus Tracking API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: process.env.API_VERSION || '2.0.0',
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
    }
  });
});

/**
 * API Documentation endpoint
 * @route GET /api/docs
 * @access Public
 */
router.get('/docs', (req, res) => {
  res.status(200).json({
    name: 'NTC Bus Tracking API',
    version: '2.0.0',
    description: 'Enhanced Real-Time Bus Tracking System with 7-Day Scheduling & Advanced Search',
    features: [
      'Role-based access control (Admin/Operator/Passenger)',
      '7-day trip scheduling system',
      'Enhanced bus types (Normal, Express, Intercity Express)',
      'Advanced search and filtering',
      'Stopwise pricing calculations',
      'Real-time location tracking'
    ],
    endpoints: {
      system: {
        health: 'GET /api/health',
        docs: 'GET /api/docs'
      },
      authentication: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        logout: 'POST /api/auth/logout'
      },
      routes: {
        list: 'GET /api/routes',
        getById: 'GET /api/routes/:id',
        getBuses: 'GET /api/routes/:id/buses',
        pricing: 'GET /api/routes/pricing/:from/:to',
        manage: 'POST|PUT|DELETE /api/routes (Admin only)'
      },
      buses: {
        list: 'GET /api/buses',
        getById: 'GET /api/buses/:id',
        getTrips: 'GET /api/buses/:id/trips',
        manage: 'POST|PUT|DELETE /api/buses (Admin only)'
      },
      trips: {
        list: 'GET /api/trips',
        getById: 'GET /api/trips/:id',
        live: 'GET /api/trips/live',
        byDate: 'GET /api/trips/date/:date',
        byRoute: 'GET /api/trips/route/:routeId',
        stats: 'GET /api/trips/stats (Admin/Operator)',
        manage: 'POST|PUT|DELETE /api/trips (Admin only)'
      },
      search: {
        routes: 'GET /api/search/routes?start=&end=&distance=',
        trips: 'GET /api/search/trips?date=&busType=&departure=',
        combined: 'GET /api/search/combined?start=&end=&date=',
        pricing: 'GET /api/search/pricing/:from/:to?busType='
      },
      admin: {
        dashboard: 'GET /api/admin/dashboard (Admin only)',
        busDetails: 'GET /api/admin/bus/:id (Admin only)'
      },
      public: {
        liveLocation: 'GET /api/public/live-location',
        nearbyBuses: 'GET /api/public/nearby-buses'
      }
    },
    queryParameters: {
      pagination: 'page, limit',
      filtering: 'start, end, date, busType, status',
      sorting: 'sort, order (asc/desc)'
    },
    authentication: {
      type: 'Bearer Token (JWT)',
      header: 'Authorization: Bearer <token>',
      note: 'Many endpoints work without authentication but provide enhanced data when authenticated'
    },
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
      note: 'Rate limiting applied to all /api/* endpoints'
    }
  });
});

export default router;