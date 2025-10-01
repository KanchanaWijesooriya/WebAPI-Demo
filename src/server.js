import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import connectDB from './config/database.js';

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

// 404 handler
app.all('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.originalUrl} not found`,
    availableEndpoints: [
      'GET /api/health',
      'GET /api/docs'
    ]
  });
});

// Global error handler
// Import routes
import authRoutes from './routes/auth.js';
import routeRoutes from './routes/routes.js';
import busRoutes from './routes/buses.js';

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/buses', busRoutes);

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