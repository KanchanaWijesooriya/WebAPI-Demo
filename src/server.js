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

// Get buses endpoint with role-based data filtering
app.get('/api/buses', optionalAuth, async (req, res) => {
  try {
    const Bus = (await import('./models/Bus.js')).default;
    
    // Check if user is authenticated and is admin
    const isAdmin = req.user && req.user.role === 'admin';
    
    // Debug logging
    console.log('Bus endpoint debug:', {
      hasUser: !!req.user,
      userRole: req.user?.role,
      isAdmin: isAdmin,
      authHeader: req.headers.authorization ? 'present' : 'missing'
    });
    
    let buses;
    if (isAdmin) {
      // Admin: Show all data including sensitive information
      console.log('Admin access: showing all data');
      buses = await Bus.find().populate('route', 'routeNumber name');
    } else {
      // Public: Hide sensitive data (registrationNumber, operator.licenseNumber, operator.contactNumber)
      console.log('Public access: hiding sensitive data');
      buses = await Bus.find()
        .select('-registrationNumber -operator.licenseNumber -operator.contactNumber')
        .populate('route', 'routeNumber name');
    }
    
    res.json({
      success: true,
      count: buses.length,
      data: buses,
      dataLevel: isAdmin ? 'full' : 'public' // Indicate what level of data is returned
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Authentication routes
const authWorkingRoutes = (await import('./routes/auth_working.js')).default;
app.use('/api/auth', authWorkingRoutes);

// Protected routes with RBAC
const protectedRoutes = (await import('./routes/protected_routes.js')).default;
app.use('/api/routes', protectedRoutes);

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

// Mount routes - using working inline implementations
// Note: Commenting out problematic route file imports
// app.use('/api/auth', authRoutes);  // Temporarily disabled - import issues
// app.use('/api/buses', busRoutes);  // Temporarily disabled - import issues

// Working routes endpoint without problematic imports
const routesRouter = express.Router();

// GET /api/routes - List all routes
routesRouter.get('/', async (req, res) => {
  try {
    const Route = (await import('./models/Route.js')).default;
    const routes = await Route.find();
    
    res.status(200).json({
      statusCode: 200,
      data: {
        routes,
        pagination: {
          total: routes.length,
          page: 1,
          limit: 10,
          pages: 1
        }
      },
      message: 'Routes retrieved successfully',
      success: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      success: false,
      message: 'Error retrieving routes',
      error: error.message
    });
  }
});

// GET /api/routes/:id - Get single route
routesRouter.get('/:id', async (req, res) => {
  try {
    const Route = (await import('./models/Route.js')).default;
    const route = await Route.findById(req.params.id);
    
    if (!route) {
      return res.status(404).json({
        statusCode: 404,
        success: false,
        message: 'Route not found'
      });
    }

    res.status(200).json({
      statusCode: 200,
      data: route,
      message: 'Route retrieved successfully',
      success: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      success: false,
      message: 'Error retrieving route',
      error: error.message
    });
  }
});

app.use('/api/routes', routesRouter);

// Working buses endpoint with role-based data filtering (DISABLED - using main endpoint above)
const busesRouter = express.Router();

// Apply optional authentication to check user role
busesRouter.use(optionalAuth);

// GET /api/buses - List all buses with role-based data filtering
busesRouter.get('/', async (req, res) => {
  try {
    const Bus = (await import('./models/Bus.js')).default;
    
    // Check if user is authenticated and is admin
    const isAdmin = req.user && req.user.role === 'admin';
    
    let buses;
    if (isAdmin) {
      // Admin: Show all data including sensitive information
      buses = await Bus.find().populate('route', 'routeNumber name');
    } else {
      // Public: Hide sensitive data (registrationNumber, operator.licenseNumber, operator.contactNumber)
      buses = await Bus.find()
        .select('-registrationNumber -operator.licenseNumber -operator.contactNumber')
        .populate('route', 'routeNumber name');
    }
    
    res.status(200).json({
      statusCode: 200,
      data: {
        buses,
        pagination: {
          total: buses.length,
          page: 1,
          limit: 10,
          pages: Math.ceil(buses.length / 10)
        },
        dataLevel: isAdmin ? 'full' : 'public' // Indicate what level of data is returned
      },
      message: 'Buses retrieved successfully',
      success: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      success: false,
      message: 'Error retrieving buses',
      error: error.message
    });
  }
});

// GET /api/buses/:id - Get single bus with role-based data filtering
busesRouter.get('/:id', async (req, res) => {
  try {
    const Bus = (await import('./models/Bus.js')).default;
    
    // Check if user is authenticated and is admin
    const isAdmin = req.user && req.user.role === 'admin';
    
    let bus;
    if (isAdmin) {
      // Admin: Show all data including sensitive information
      bus = await Bus.findById(req.params.id).populate('route', 'routeNumber name');
    } else {
      // Public: Hide sensitive data
      bus = await Bus.findById(req.params.id)
        .select('-registrationNumber -operator.licenseNumber -operator.contactNumber')
        .populate('route', 'routeNumber name');
    }
    
    if (!bus) {
      return res.status(404).json({
        statusCode: 404,
        success: false,
        message: 'Bus not found'
      });
    }
    
    res.status(200).json({
      statusCode: 200,
      data: bus,
      dataLevel: isAdmin ? 'full' : 'public',
      message: 'Bus retrieved successfully',
      success: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      success: false,
      message: 'Error retrieving bus',
      error: error.message
    });
  }
});

// Mount the buses router - DISABLED: Using main endpoint with role-based filtering instead
// app.use('/api/buses', busesRouter);

// Get single bus endpoint with role-based data filtering
app.get('/api/buses/:id', async (req, res) => {
  try {
    // Import optional auth middleware and apply it
    const { optionalAuth } = await import('./middleware/auth.js');
    
    // Apply optional auth to check user role
    await new Promise((resolve, reject) => {
      optionalAuth(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    
    const Bus = (await import('./models/Bus.js')).default;
    
    // Check if user is authenticated and is admin
    const isAdmin = req.user && req.user.role === 'admin';
    
    let bus;
    if (isAdmin) {
      // Admin: Show all data including sensitive information
      bus = await Bus.findById(req.params.id).populate('route', 'routeNumber name');
    } else {
      // Public: Hide sensitive data
      bus = await Bus.findById(req.params.id)
        .select('-registrationNumber -operator.licenseNumber -operator.contactNumber')
        .populate('route', 'routeNumber name');
    }
    
    if (!bus) {
      return res.status(404).json({
        success: false,
        message: 'Bus not found'
      });
    }
    
    res.json({
      success: true,
      data: bus,
      dataLevel: isAdmin ? 'full' : 'public'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Working trips endpoint
const tripsRouter = express.Router();

// GET /api/trips - List all trips (redirected from /api/search/trips for better functionality)
tripsRouter.get('/', async (req, res) => {
  try {
    const Trip = (await import('./models/Trip.js')).default;
    const trips = await Trip.find()
      .select('-driver') // Remove driver info completely for privacy
      .populate('route', 'routeNumber name origin destination distance')
      .populate('bus', 'registrationNumber operator type capacity')
      .limit(20) // Limit results for performance
      .lean();
    
    res.status(200).json({
      statusCode: 200,
      data: {
        trips,
        pagination: {
          total: trips.length,
          page: 1,
          limit: 20,
          pages: Math.ceil(trips.length / 20)
        }
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

// GET /api/trips/:id - Get single trip
tripsRouter.get('/:id', async (req, res) => {
  try {
    const Trip = (await import('./models/Trip.js')).default;
    const trip = await Trip.findById(req.params.id)
      .select('-driver') // Remove driver info for privacy
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
    
    res.status(200).json({
      statusCode: 200,
      data: trip,
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