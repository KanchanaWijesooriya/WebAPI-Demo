import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import connectDB from './config/database.js';

// Import routes - temporarily commented out due to import issues
// import authRoutes from './routes/auth.js';
// import routeRoutes from './routes/routes.js';
// import busRoutes from './routes/buses.js';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use('/api', limiter);

// Compression middleware
app.use(compression());

// Request logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'NTC Bus Tracking API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: '1.0.0'
  });
});

// API Documentation endpoint
app.get('/api/docs', (req, res) => {
  res.status(200).json({
    name: 'NTC Bus Tracking API',
    version: '1.0.0',
    description: 'Real-Time Bus Tracking System for Sri Lanka National Transport Commission',
    endpoints: {
      health: 'GET /api/health',
      authentication: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login'
      },
      routes: {
        getAll: 'GET /api/routes',
        create: 'POST /api/routes',
        getById: 'GET /api/routes/:id',
        update: 'PUT /api/routes/:id',
        delete: 'DELETE /api/routes/:id'
      },
      buses: {
        getAll: 'GET /api/buses',
        create: 'POST /api/buses',  
        getById: 'GET /api/buses/:id',
        update: 'PUT /api/buses/:id',
        delete: 'DELETE /api/buses/:id'
      },
      trips: {
        getAll: 'GET /api/trips',
        create: 'POST /api/trips',
        getById: 'GET /api/trips/:id', 
        update: 'PUT /api/trips/:id',
        delete: 'DELETE /api/trips/:id'
      },
      tracking: {
        getBusLocation: 'GET /api/tracking/buses/:busId/location',
        updateLocation: 'POST /api/tracking/buses/:busId/location',
        getRouteBuses: 'GET /api/tracking/routes/:routeId/buses'
      }
    }
  });
});

// Import routes (we'll create these next)
// import authRoutes from './routes/auth.js';
// import routeRoutes from './routes/routes.js';
// import busRoutes from './routes/buses.js';
// import tripRoutes from './routes/trips.js';
// import trackingRoutes from './routes/tracking.js';

// Use routes
// app.use('/api/auth', authRoutes);
// app.use('/api/routes', routeRoutes);
// app.use('/api/buses', busRoutes);
// app.use('/api/trips', tripRoutes);
// app.use('/api/tracking', trackingRoutes);

// Test route to debug
app.get('/api/test', (req, res) => {
  res.json({ message: 'Test route works!' });
});

// Simple routes test without controller
app.get('/api/routes-simple', (req, res) => {
  res.json({ message: 'Simple routes test works!' });
});

// Test routes with direct database access
app.get('/api/routes-direct', async (req, res) => {
  try {
    const Route = (await import('./models/Route.js')).default;
    const routes = await Route.find();
    res.json({
      success: true,
      count: routes.length,
      data: routes
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get individual route by ID
app.get('/api/routes-direct/:id', async (req, res) => {
  try {
    const Route = (await import('./models/Route.js')).default;
    const route = await Route.findById(req.params.id);
    
    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    }
    
    res.json({
      success: true,
      data: route
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Import optional auth middleware at top level
const { optionalAuth } = await import('./middleware/auth.js');

// Buses endpoint is now handled by proper route files with comprehensive RBAC

// Authentication routes
const authWorkingRoutes = (await import('./routes/auth_working.js')).default;
app.use('/api/auth', authWorkingRoutes);

// Protected routes with RBAC are now integrated into the main route controllers

// User management routes with RBAC
const userManagementRoutes = (await import('./routes/user_management.js')).default;
app.use('/api/users', userManagementRoutes);

// Search and filtering routes
const searchFilterRoutes = (await import('./routes/search_filter.js')).default;
const adminEnhancedRoutes = (await import('./routes/admin_enhanced.js')).default;
const publicLiveLocationRoutes = (await import('./routes/public_live_location.js')).default;
app.use('/api/search', searchFilterRoutes);
app.use('/api/admin', adminEnhancedRoutes);
app.use('/api/public', publicLiveLocationRoutes);

// Mount RBAC-enabled route modules
const routeRoutes = (await import('./routes/routes.js')).default;
const busRoutes = (await import('./routes/buses.js')).default;
app.use('/api/routes', routeRoutes);
app.use('/api/buses', busRoutes);

// Note: All public endpoints now implement intelligent role-based filtering
// - Public users see clean, essential information without sensitive data
// - Admin users see complete data including internal fields and sensitive information
// - All endpoints use optionalAuth middleware to detect user role without requiring authentication

// Buses are now handled by proper route files with RBAC
    
// Single bus endpoint is now handled by proper route files with RBAC

// Working trips endpoint with role-based filtering
const tripsRouter = express.Router();

// Apply optional authentication
tripsRouter.use(optionalAuth);

// Helper function to filter trip data based on user role
function filterTripDataForUser(trip, isAdmin) {
  if (isAdmin) {
    return trip; // Admin sees all data
  }
  
  // Public user: remove sensitive/internal information
  const filtered = { ...trip };
  
  // Remove internal fields
  delete filtered._id;
  delete filtered.__v;
  delete filtered.createdAt;
  delete filtered.updatedAt;
  delete filtered.driver; // Always remove driver info for privacy
  delete filtered.passengers;
  delete filtered.actualArrival;
  delete filtered.actualDeparture;
  delete filtered.delay;
  delete filtered.weatherCondition;
  
  // Filter route data
  if (filtered.route && typeof filtered.route === 'object') {
    delete filtered.route._id;
    delete filtered.route.__v;
    delete filtered.route.createdAt;
    delete filtered.route.updatedAt;
  }
  
  // Filter bus data - remove sensitive info
  if (filtered.bus && typeof filtered.bus === 'object') {
    delete filtered.bus._id;
    delete filtered.bus.__v;
    delete filtered.bus.registrationNumber; // Hide registration for public
    if (filtered.bus.operator && typeof filtered.bus.operator === 'object') {
      delete filtered.bus.operator.licenseNumber;
      delete filtered.bus.operator.contactNumber;
    }
  }
  
  return filtered;
}

// GET /api/trips - List all trips with role-based filtering
tripsRouter.get('/', async (req, res) => {
  try {
    const Trip = (await import('./models/Trip.js')).default;
    
    // Check if user is admin
    const isAdmin = req.user && req.user.role === 'admin';
    
    const trips = await Trip.find()
      .populate('route', 'routeNumber name origin destination distance')
      .populate('bus', 'registrationNumber operator type capacity')
      .limit(20) // Limit results for performance
      .lean();
    
    // Filter data based on user role
    const filteredTrips = trips.map(trip => filterTripDataForUser(trip, isAdmin));
    
    res.status(200).json({
      statusCode: 200,
      data: {
        trips: filteredTrips,
        pagination: {
          total: trips.length,
          page: 1,
          limit: 20,
          pages: Math.ceil(trips.length / 20)
        },
        dataLevel: isAdmin ? 'full' : 'public'
      },
      message: 'Trips retrieved successfully',
      success: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      success: false,
      message: 'Error retrieving trips',
      error: error.message
    });
  }
});

// GET /api/trips/:id - Get single trip with role-based filtering
tripsRouter.get('/:id', async (req, res) => {
  try {
    const Trip = (await import('./models/Trip.js')).default;
    
    // Check if user is admin
    const isAdmin = req.user && req.user.role === 'admin';
    
    const trip = await Trip.findById(req.params.id)
      .populate('route', 'routeNumber name origin destination distance stops')
      .populate('bus', 'registrationNumber operator type capacity')
      .lean();
    
    if (!trip) {
      return res.status(404).json({
        statusCode: 404,
        success: false,
        message: 'Trip not found'
      });
    }
    
    // Filter data based on user role
    const filteredTrip = filterTripDataForUser(trip, isAdmin);
    
    res.status(200).json({
      statusCode: 200,
      data: {
        trip: filteredTrip,
        dataLevel: isAdmin ? 'full' : 'public'
      },
      message: 'Trip retrieved successfully',
      success: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      success: false,
      message: 'Error retrieving trip',
      error: error.message
    });
  }
});

// Mount the trips router
app.use('/api/trips', tripsRouter);

// Redirect /api/search/trips for better search functionality
app.get('/api/search/trips', (req, res) => {
  // Redirect to search endpoint with better functionality
  res.redirect(307, '/api/search/trips');
});

// 404 handler (MUST be after all route definitions)
app.all('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.originalUrl} not found`,
    availableEndpoints: [
      'GET /api/health',
      'GET /api/docs',
      'GET /api/trips',
      'GET /api/search/routes',
      'GET /api/search/trips',
      'GET /api/search/combined'
    ]
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`NTC Bus Tracking API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`API docs: http://localhost:${PORT}/api/docs`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

export default app;