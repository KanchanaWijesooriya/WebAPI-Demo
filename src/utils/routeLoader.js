/**
 * Route loader utility to organize and mount all routes
 */

/**
 * Load and mount all application routes
 * @param {Express} app - Express application instance
 */
export const loadRoutes = async (app) => {
  try {
    // Root welcome route
    app.get('/', (req, res) => {
      res.json({
        status: 'success',
        message: 'Welcome to NTC Bus Tracking API',
        version: '2.0.0',
        student: {
          name: 'W.M.G.C.K. Wijesooriya',
          studentId: 'COBSCCOMP24.1P-020',
          coventryIndex: '15386722'
        },
        endpoints: {
          health: '/api/health',
          documentation: '/api/docs',
          routes: '/api/routes',
          buses: '/api/buses',
          trips: '/api/trips',
          auth: '/api/auth'
        },
        links: {
          apiDocs: `${req.protocol}://${req.get('host')}/api/docs`,
          healthCheck: `${req.protocol}://${req.get('host')}/api/health`,
          github: 'https://github.com/KanchanaWijesooriya/WebAPI-Demo'
        },
        timestamp: new Date().toISOString()
      });
    });

    // System routes (health, docs)
    const systemRoutes = (await import('../routes/system.js')).default;
    app.use('/api', systemRoutes);

    // Authentication routes
    const authRoutes = (await import('../routes/auth.js')).default;
    app.use('/api/auth', authRoutes);

    // User management routes
    const userRoutes = (await import('../routes/user_management.js')).default;
    app.use('/api/users', userRoutes);

    // Core API routes
    const routeRoutes = (await import('../routes/routes.js')).default;
    const busRoutes = (await import('../routes/buses.js')).default;
    const tripRoutes = (await import('../routes/trips.js')).default;
    app.use('/api/routes', routeRoutes);
    app.use('/api/buses', busRoutes);
    app.use('/api/trips', tripRoutes);

    // Search and filtering routes
    const searchRoutes = (await import('../routes/search_filter.js')).default;
    app.use('/api/search', searchRoutes);

    // Admin and public routes
    const adminRoutes = (await import('../routes/admin_enhanced.js')).default;
    const adminBusRoutes = (await import('../routes/admin_bus_details.js')).default;
    const ddosMonitoringRoutes = (await import('../routes/ddos_monitoring.js')).default;
    const publicRoutes = (await import('../routes/public_live_location.js')).default;
    app.use('/api/admin', adminRoutes);
    app.use('/api/admin', adminBusRoutes);
    app.use('/api/admin', ddosMonitoringRoutes);
    app.use('/api/public', publicRoutes);

    console.log('All routes loaded successfully');
    
    return {
      routes: [
        { path: '/', description: 'Welcome page and API information' },
        { path: '/api', description: 'System routes (health, docs)' },
        { path: '/api/auth', description: 'Authentication routes' },
        { path: '/api/users', description: 'User management routes' },
        { path: '/api/routes', description: 'Route management routes' },
        { path: '/api/buses', description: 'Bus management routes' },
        { path: '/api/trips', description: 'Trip management routes' },
        { path: '/api/search', description: 'Search and filtering routes' },
        { path: '/api/admin', description: 'Admin-specific routes' },
        { path: '/api/public', description: 'Public access routes' }
      ]
    };
    
  } catch (error) {
    console.error('Error loading routes:', error.message);
    throw new Error(`Failed to load routes: ${error.message}`);
  }
};

/**
 * Get route summary for logging/debugging
 */
export const getRouteSummary = () => {
  return {
    totalRouteFiles: 9,
    routeCategories: [
      'System (health, docs)',
      'Authentication & Users', 
      'Core API (routes, buses, trips)',
      'Search & Filtering',
      'Admin & Public Access'
    ],
    loadingMethod: 'Dynamic ES modules import',
    organization: 'Feature-based routing'
  };
};