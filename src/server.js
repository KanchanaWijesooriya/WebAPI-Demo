import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/database.js';
import { applyMiddleware } from './config/middleware.js';
import { loadRoutes } from './utils/routeLoader.js';
import { 
  handle404, 
  globalErrorHandler, 
  handleUnhandledRejections, 
  handleUncaughtExceptions, 
  gracefulShutdown 
} from './utils/errorHandler.js';

// Load environment variables first
dotenv.config();

// Handle uncaught exceptions early
handleUncaughtExceptions();

// Create Express app
const app = express();

// Initialize application
const initializeApp = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Apply middleware configuration
    applyMiddleware(app);
    
    // Load all routes
    const routeInfo = await loadRoutes(app);
    
    console.log('Route Summary:');
    routeInfo.routes.forEach(route => {
      console.log(`  ${route.path} - ${route.description}`);
    });
    
    return true;
  } catch (error) {
    console.error('Failed to initialize application:', error.message);
    process.exit(1);
  }
};

// Initialize the application
await initializeApp();

// 404 handler (MUST be after all route definitions)
app.all('*', handle404);

// Global error handler
app.use(globalErrorHandler);

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log('NTC Bus Tracking API Started Successfully!');
  console.log('='.repeat(50));
  console.log(`Server running on port: ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`API docs: http://localhost:${PORT}/api/docs`);
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('='.repeat(50));
});

// Handle unhandled promise rejections
handleUnhandledRejections(server);

// Setup graceful shutdown
gracefulShutdown(server);

export default app;