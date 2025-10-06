/**
 * Enhanced 404 handler
 */
export const handle404 = (req, res) => {
  res.status(404).json({
    status: 'error',
    statusCode: 404,
    message: `Route ${req.originalUrl} not found`,
    method: req.method,
    timestamp: new Date().toISOString(),
    suggestions: [
      'Check the URL spelling and method',
      'Visit GET /api/docs for available endpoints',
      'Ensure you are using the correct HTTP method'
    ]
  });
};

/**
 * Global error handler middleware
 */
export const globalErrorHandler = (err, req, res, next) => {
  console.error(`Error ${err.statusCode || 500}: ${err.message}`);
  console.error(err.stack);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      status: 'error',
      statusCode: 400,
      message: 'Validation Error',
      errors: errors,
      timestamp: new Date().toISOString()
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      status: 'error',
      statusCode: 400,
      message: `Duplicate value for ${field}. Please use another value.`,
      timestamp: new Date().toISOString()
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      status: 'error',
      statusCode: 401,
      message: 'Invalid token. Please log in again.',
      timestamp: new Date().toISOString()
    });
  }

  // JWT expired error
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      status: 'error',
      statusCode: 401,
      message: 'Token expired. Please log in again.',
      timestamp: new Date().toISOString()
    });
  }

  // Cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      status: 'error',
      statusCode: 400,
      message: 'Invalid ID format',
      timestamp: new Date().toISOString()
    });
  }

  // Default error response
  res.status(err.statusCode || 500).json({
    status: 'error',
    statusCode: err.statusCode || 500,
    message: err.message || 'Internal Server Error',
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      details: err 
    })
  });
};

/**
 * Async error catcher wrapper
 */
export const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Handle unhandled promise rejections
 */
export const handleUnhandledRejections = (server) => {
  process.on('unhandledRejection', (err, promise) => {
    console.error('Unhandled Promise Rejection:', err.message);
    console.error(err.stack);
    
    // Close server gracefully
    console.log('Shutting down server due to unhandled promise rejection...');
    server.close(() => {
      process.exit(1);
    });
  });
};

/**
 * Handle uncaught exceptions
 */
export const handleUncaughtExceptions = () => {
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err.message);
    console.error(err.stack);
    console.log('Shutting down due to uncaught exception...');
    process.exit(1);
  });
};

/**
 * Graceful shutdown handler
 */
export const gracefulShutdown = (server) => {
  const shutdown = (signal) => {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    
    server.close(() => {
      console.log('Process terminated gracefully');
      process.exit(0);
    });
    
    // Force close after 30 seconds
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};