import express from 'express';
import { 
  authenticate, 
  authorize, 
  requirePermission, 
  adminOnly, 
  operatorOrAdmin 
} from '../middleware/rbac.js';

const router = express.Router();

/**
 * PROTECTED ROUTES FOR BUS ROUTES MANAGEMENT
 * These routes implement different levels of access control based on user roles and permissions
 */

// ==================== PUBLIC ROUTES (No Authentication Required) ====================

/**
 * GET /api/routes - Get all bus routes (Public access)
 * Anyone can view available bus routes without authentication
 * This is essential for public users to see available transportation options
 */
router.get('/', async (req, res) => {
  try {
    const Route = (await import('../models/Route.js')).default;
    
    // Apply basic filtering for public view (only active routes)
    const routes = await Route.find({ isActive: true }).select('-__v');
    
    res.status(200).json({
      statusCode: 200,
      success: true,
      message: 'Routes retrieved successfully',
      data: {
        routes,
        total: routes.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      success: false,
      message: 'Failed to retrieve routes',
      error: error.message
    });
  }
});

/**
 * GET /api/routes/:id - Get single route by ID (Public access)
 * Public users can view detailed information about a specific route
 */
router.get('/:id', async (req, res) => {
  try {
    const Route = (await import('../models/Route.js')).default;
    
    const route = await Route.findOne({ 
      _id: req.params.id, 
      isActive: true 
    }).select('-__v');
    
    if (!route) {
      return res.status(404).json({
        statusCode: 404,
        success: false,
        message: 'Route not found or inactive'
      });
    }
    
    res.status(200).json({
      statusCode: 200,
      success: true,
      message: 'Route retrieved successfully',
      data: route
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      success: false,
      message: 'Failed to retrieve route',
      error: error.message
    });
  }
});

// ==================== AUTHENTICATED ROUTES ====================

/**
 * GET /api/routes/admin/all - Get all routes including inactive ones (Admin only)
 * Only administrators can view all routes including inactive/draft routes
 * This is for administrative oversight and management purposes
 */
router.get('/admin/all', 
  authenticate,           // Must be logged in
  adminOnly,             // Must be admin role
  async (req, res) => {
    try {
      const Route = (await import('../models/Route.js')).default;
      
      // Admin can see all routes regardless of status
      const routes = await Route.find({}).select('-__v');
      
      res.status(200).json({
        statusCode: 200,
        success: true,
        message: 'All routes retrieved successfully (Admin view)',
        data: {
          routes,
          total: routes.length,
          activeCount: routes.filter(r => r.isActive).length,
          inactiveCount: routes.filter(r => !r.isActive).length,
          requestedBy: {
            userId: req.user.id,
            role: req.user.role,
            username: req.user.username
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        statusCode: 500,
        success: false,
        message: 'Failed to retrieve routes',
        error: error.message
      });
    }
  }
);

/**
 * POST /api/routes - Create new route (Admin only with specific permission)
 * Only users with admin role AND create permission for routes can add new routes
 * This ensures tight control over who can modify the transportation network
 */
router.post('/',
  authenticate,                    // Must be logged in
  requirePermission('routes', 'create'),  // Must have create permission for routes
  async (req, res) => {
    try {
      const Route = (await import('../models/Route.js')).default;
      
      // Extract route data from request body
      const routeData = req.body;
      
      // Add metadata about who created this route
      routeData.createdBy = req.user.id;
      routeData.createdAt = new Date();
      
      // Create new route
      const newRoute = await Route.create(routeData);
      
      res.status(201).json({
        statusCode: 201,
        success: true,
        message: 'Route created successfully',
        data: {
          route: newRoute,
          createdBy: {
            userId: req.user.id,
            username: req.user.username,
            role: req.user.role
          }
        }
      });
    } catch (error) {
      res.status(400).json({
        statusCode: 400,
        success: false,
        message: 'Failed to create route',
        error: error.message
      });
    }
  }
);

/**
 * PUT /api/routes/:id - Update route (Admin only with update permission)
 * Only administrators with update permissions can modify existing routes
 */
router.put('/:id',
  authenticate,
  requirePermission('routes', 'update'),
  async (req, res) => {
    try {
      const Route = (await import('../models/Route.js')).default;
      
      // Add update metadata
      const updateData = {
        ...req.body,
        updatedBy: req.user.id,
        updatedAt: new Date()
      };
      
      const updatedRoute = await Route.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );
      
      if (!updatedRoute) {
        return res.status(404).json({
          statusCode: 404,
          success: false,
          message: 'Route not found'
        });
      }
      
      res.status(200).json({
        statusCode: 200,
        success: true,
        message: 'Route updated successfully',
        data: {
          route: updatedRoute,
          updatedBy: {
            userId: req.user.id,
            username: req.user.username,
            role: req.user.role
          }
        }
      });
    } catch (error) {
      res.status(400).json({
        statusCode: 400,
        success: false,
        message: 'Failed to update route',
        error: error.message
      });
    }
  }
);

/**
 * DELETE /api/routes/:id - Delete route (Admin only with delete permission)
 * Only administrators with delete permissions can remove routes
 * This is a sensitive operation that affects the entire transportation network
 */
router.delete('/:id',
  authenticate,
  requirePermission('routes', 'delete'),
  async (req, res) => {
    try {
      const Route = (await import('../models/Route.js')).default;
      
      const deletedRoute = await Route.findByIdAndDelete(req.params.id);
      
      if (!deletedRoute) {
        return res.status(404).json({
          statusCode: 404,
          success: false,
          message: 'Route not found'
        });
      }
      
      res.status(200).json({
        statusCode: 200,
        success: true,
        message: 'Route deleted successfully',
        data: {
          deletedRoute,
          deletedBy: {
            userId: req.user.id,
            username: req.user.username,
            role: req.user.role
          },
          deletedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(500).json({
        statusCode: 500,
        success: false,
        message: 'Failed to delete route',
        error: error.message
      });
    }
  }
);

/**
 * GET /api/routes/:id/buses - Get buses operating on a specific route
 * Operators and admins can see detailed bus information
 * Public users see limited information
 */
router.get('/:id/buses',
  // No authentication required, but we'll check if user is authenticated to provide different data
  async (req, res) => {
    try {
      const Bus = (await import('../models/Bus.js')).default;
      
      // Check if user is authenticated (optional for this endpoint)
      let isAuthenticated = false;
      let userRole = 'public';
      
      if (req.headers.authorization) {
        try {
          const jwt = (await import('jsonwebtoken')).default;
          const token = req.headers.authorization.substring(7);
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          isAuthenticated = true;
          userRole = decoded.role || 'public';
        } catch (error) {
          // Token invalid, continue as public user
        }
      }
      
      // Different data based on authentication status
      let selectFields = 'busNumber registrationNumber capacity isActive';
      
      if (isAuthenticated && (userRole === 'admin' || userRole === 'operator')) {
        // Authenticated operators/admins get more detailed information
        selectFields = '-__v';
      }
      
      const buses = await Bus.find({ 
        route: req.params.id,
        isActive: true 
      }).select(selectFields).populate('route', 'routeNumber name');
      
      res.status(200).json({
        statusCode: 200,
        success: true,
        message: 'Buses retrieved successfully',
        data: {
          buses,
          total: buses.length,
          routeId: req.params.id,
          dataLevel: isAuthenticated ? `${userRole}_authenticated` : 'public'
        }
      });
    } catch (error) {
      res.status(500).json({
        statusCode: 500,
        success: false,
        message: 'Failed to retrieve buses',
        error: error.message
      });
    }
  }
);

export default router;