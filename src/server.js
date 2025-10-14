import express from 'express';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import connectDB from './config/database.js';
import { applyMiddleware } from './config/middleware.js';
import { loadRoutes } from './utils/routeLoader.js';
import swaggerConfig from './config/swagger.js';
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

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SSL Configuration - HTTPS ONLY
const SSL_CONFIG = {
  SSL_PATH: path.join(__dirname, '../ssl'),
  PRIVATE_KEY: 'ntc-bustracking.me.key',
  CERTIFICATE: 'ntc-bustracking_me.crt',
  CA_BUNDLE: 'ntc-bustracking_me.ca-bundle',
  HTTPS_PORT: process.env.HTTPS_PORT || (process.env.NODE_ENV === 'production' ? 443 : 3443),
  DOMAIN: 'ntc-bustracking.me',
  FORCE_HTTPS: true // Always use HTTPS only
};

// Load SSL certificates function - REQUIRED for HTTPS-only mode
function loadSSLCertificates() {
  try {
    const privateKeyPath = path.join(SSL_CONFIG.SSL_PATH, SSL_CONFIG.PRIVATE_KEY);
    const certificatePath = path.join(SSL_CONFIG.SSL_PATH, SSL_CONFIG.CERTIFICATE);
    const caBundlePath = path.join(SSL_CONFIG.SSL_PATH, SSL_CONFIG.CA_BUNDLE);

    console.log('✅ Checking SSL certificate files...');
    console.log(`   Private Key: ${privateKeyPath}`);
    console.log(`   Certificate: ${certificatePath}`);
    console.log(`   CA Bundle: ${caBundlePath}`);

    if (!fs.existsSync(privateKeyPath)) {
      throw new Error(`❌ Private key not found: ${privateKeyPath}`);
    }
    if (!fs.existsSync(certificatePath)) {
      throw new Error(`❌ Certificate not found: ${certificatePath}`);
    }
    if (!fs.existsSync(caBundlePath)) {
      throw new Error(`❌ CA bundle not found: ${caBundlePath}`);
    }

    console.log('✅ All SSL files found, loading certificates...');

    const sslOptions = {
      key: fs.readFileSync(privateKeyPath, 'utf8'),
      cert: fs.readFileSync(certificatePath, 'utf8'),
      ca: fs.readFileSync(caBundlePath, 'utf8')
    };

    console.log('✅ SSL certificates loaded successfully');
    return sslOptions;
  } catch (error) {
    console.error('❌ SSL Certificate Error:', error.message);
    process.exit(1); // Exit if SSL fails - HTTPS only mode
  }
}

// Create Express app
const app = express();

// Initialize application
const initializeApp = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Apply middleware configuration
    applyMiddleware(app);
    
    // Serve static files (CSS, images, etc.)
    app.use(express.static('public'));
    
    // Generate Swagger documentation
    console.log('✅ Generating Swagger documentation...');
    const swaggerSpec = swaggerJsdoc(swaggerConfig.options);
    
    // Setup Swagger UI with external CSS
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerConfig.swaggerUiOptions));
    
    // Swagger JSON endpoint
    app.get('/api-docs.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerSpec);
    });
    
    console.log('✅ Swagger documentation configured at /api-docs');
    
    // Setup root path to also serve Swagger UI (additional access point)
    app.use('/', swaggerUi.serve);
    app.get('/', swaggerUi.setup(swaggerSpec, swaggerConfig.swaggerUiOptions));
    
    console.log('✅ Root path (/) also configured to serve Swagger UI');
    
    // Load all routes
    await loadRoutes(app);
    
    console.log('All routes loaded successfully');
    
    return true;
  } catch (error) {
    console.error('Failed to initialize application:', error.message);
    process.exit(1);
  }
};

// Initialize the application
console.log('✅ Starting application initialization...');
await initializeApp();
console.log('✅ Application initialized, setting up middleware...');

// 404 handler (MUST be after all route definitions)
app.all('*', handle404);

// Global error handler
app.use(globalErrorHandler);

console.log('✅ Middleware configured, ready to start servers...');

// HTTPS-ONLY SERVER STARTUP
let httpsServer = null;

// Check if running as main module (handle URL encoding for paths with spaces)
const mainModuleUrl = `file://${process.argv[1]}`;
const currentUrl = import.meta.url;
const isMainModule = currentUrl === mainModuleUrl || decodeURIComponent(currentUrl) === mainModuleUrl;

if (isMainModule) {
  console.log('✅ Running as main module, starting HTTPS-only server...');
  
  // Load SSL certificates (required for HTTPS-only mode)
  const sslOptions = loadSSLCertificates();
  
  // Create HTTPS server only
  httpsServer = https.createServer(sslOptions, app);
  
  httpsServer.listen(SSL_CONFIG.HTTPS_PORT, '0.0.0.0', () => {
    console.log('='.repeat(60));
    console.log('✅ NTC Bus Tracking API - HTTPS ONLY MODE');
    console.log('='.repeat(60));
    console.log(`✅ HTTPS Server running on port: ${SSL_CONFIG.HTTPS_PORT}`);
    console.log(`✅ Domain: ${SSL_CONFIG.DOMAIN}`);
    console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✅ Local test: https://localhost:${SSL_CONFIG.HTTPS_PORT}/api/health`);
    console.log(`✅ Production URL: https://${SSL_CONFIG.DOMAIN}/api/health`);
    console.log(`✅ Swagger UI (Primary): https://${SSL_CONFIG.DOMAIN}/`);
    console.log(`✅ Swagger UI (Alternative): https://${SSL_CONFIG.DOMAIN}/api-docs`);
    console.log(`✅ Started at: ${new Date().toISOString()}`);
    console.log('='.repeat(60));
  });
  
  httpsServer.on('error', (error) => {
    console.error('❌ HTTPS Server Error:', error.message);
    if (error.code === 'EADDRINUSE') {
      console.log(`❌ Port ${SSL_CONFIG.HTTPS_PORT} is already in use`);
    }
    if (error.code === 'EACCES') {
      console.log(`❌ Permission denied. Use 'sudo' for port 443`);
    }
    process.exit(1);
  });

  // Handle unhandled promise rejections and graceful shutdown
  handleUnhandledRejections(httpsServer);
  gracefulShutdown(httpsServer);
}

export default app;
