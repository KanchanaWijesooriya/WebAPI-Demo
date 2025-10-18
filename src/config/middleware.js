import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import cookieParser from 'cookie-parser';
import { 
  advancedDDoSProtection, 
  requestSizeProtection,
  geoRateLimit 
} from '../middleware/ddosProtection.js';

/**
 * Configure CORS middleware
 */
export const configureCORS = () => {
  const corsOptions = {
    origin: true, // Allow all origins for development
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
  };
  return cors(corsOptions);
};

/**
 * Configure security middleware
 */
export const configureSecurity = () => {
  return helmet({
    crossstartResourcePolicy: { policy: 'cross-start' }
  });
};

/**
 * Configure multiple rate limiting middleware layers for DDoS protection
 */

// General API rate limiting - broader protection
export const configureGeneralRateLimit = () => {
  return rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests per 15 minutes
    message: {
      success: false,
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000),
      type: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Custom key generator to include user agent for better tracking
    keyGenerator: (req) => {
      return req.ip + ':' + (req.get('User-Agent') || 'unknown').slice(0, 50);
    }
  });
};

// Strict rate limiting for authentication endpoints - prevent brute force
export const configureAuthRateLimit = () => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Only 10 login attempts per 15 minutes
    message: {
      success: false,
      error: 'Too many authentication attempts, please try again later.',
      retryAfter: 900, // 15 minutes in seconds
      type: 'AUTH_RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful requests
  });
};

// Moderate rate limiting for search endpoints - prevent search abuse
export const configureSearchRateLimit = () => {
  return rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // 30 search requests per minute
    message: {
      success: false,
      error: 'Too many search requests, please slow down.',
      retryAfter: 60,
      type: 'SEARCH_RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Admin endpoint protection - stricter limits for sensitive operations
export const configureAdminRateLimit = () => {
  return rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 50, // 50 admin requests per 5 minutes
    message: {
      success: false,
      error: 'Too many admin requests, please wait before continuing.',
      retryAfter: 300,
      type: 'ADMIN_RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Aggressive rate limiting for suspected attacks - very strict
export const configureStrictRateLimit = () => {
  return rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5, // Only 5 requests per minute
    message: {
      success: false,
      error: 'Rate limit exceeded. Access temporarily restricted.',
      retryAfter: 60,
      type: 'STRICT_RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

/**
 * Configure request logging middleware
 */
export const configureLogging = () => {
  if (process.env.NODE_ENV === 'development') {
    return morgan('dev');
  } else {
    return morgan('combined');
  }
};

/**
 * Configure body parsing middleware
 */
export const configureBodyParsing = (app) => {
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
};

/**
 * Apply all middleware configurations to the Express app with comprehensive DDoS protection
 */
export const applyMiddleware = (app) => {
  // Security middleware - First line of defense
  app.use(configureSecurity());
  
  // CORS configuration
  app.use(configureCORS());
  
  // Advanced DDoS Protection Layer - FIRST PRIORITY
  app.use(requestSizeProtection);        // Prevent large payload attacks
  app.use(geoRateLimit);                 // Geographic-based rate limiting
  app.use(advancedDDoSProtection);       // Suspicious pattern detection
  
  // Layered Rate Limiting - Multiple layers of protection
  
  // 1. General API protection - applies to all API routes
  app.use('/api', configureGeneralRateLimit());
  
  // 2. Strict authentication rate limiting - prevent brute force attacks
  app.use('/api/auth/login', configureAuthRateLimit());
  app.use('/api/auth/register', configureAuthRateLimit());
  
  // 3. Search endpoint protection - prevent search abuse
  app.use('/api/search', configureSearchRateLimit());
  
  // 4. Admin endpoint protection - stricter limits for sensitive operations
  app.use('/api/admin', configureAdminRateLimit());
  
  // 5. User management protection - prevent account manipulation abuse
  app.use('/api/users', configureAdminRateLimit());
  
  // Compression middleware
  app.use(compression());
  
  // Request logging
  app.use(configureLogging());
  
  // Body parsing middleware with size limits to prevent payload attacks
  configureBodyParsing(app);
  
  // Cookie parser middleware
  app.use(cookieParser());
  
  // Session middleware
  app.use(session({
    secret: process.env.SESSION_SECRET || 'ntc-bus-tracking-session-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: 'sessions',
      ttl: 60 * 60 // 1 hour
    }),
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 60 * 60 * 1000, // 1 hour
      sameSite: 'strict'
    },
    name: 'ntc.sid'
  }));
  
  console.log('Session management configured with MongoDB store');
  console.log('Comprehensive DDoS protection enabled');
  console.log('   - Advanced threat detection active');
  console.log('   - Request size monitoring: 10MB limit');
  console.log('   - Multi-layer rate limiting:');
  console.log('      - General API: 100 requests/15min');
  console.log('      - Authentication: 10 requests/15min');
  console.log('      - Search: 30 requests/1min');
  console.log('      - Admin: 50 requests/5min');
  console.log('   - Suspicious pattern detection');
  console.log('   - IP-based request tracking');
};