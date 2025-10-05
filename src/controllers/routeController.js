import Route from '../models/Route.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiFeatures } from '../utils/ApiFeatures.js';

// Helper function to filter route data based on user role
function filterRouteDataForUser(route, isAdmin) {
  if (isAdmin) {
    return route; // Admin sees all data
  }
  
  // Public user: hide internal/sensitive information
  const filteredRoute = route.toObject ? { ...route.toObject() } : { ...route };
  
  // Remove internal database fields
  delete filteredRoute._id;
  delete filteredRoute.__v;
  delete filteredRoute.createdAt;
  delete filteredRoute.updatedAt;
  delete filteredRoute.createdBy;
  delete filteredRoute.updatedBy;
  delete filteredRoute.id; // Remove the virtual id field as well
  
  // Only show active routes to public
  if (filteredRoute.isActive === false) {
    return null; // Don't show inactive routes to public
  }
  delete filteredRoute.isActive;
  
  return filteredRoute;
}

class RouteController {
  // GET /api/routes - List all routes with filtering, sorting, pagination and role-based filtering
  static async getAllRoutes(req, res, next) {
    try {
      // Check if user is admin
      const isAdmin = req.user && req.user.role === 'admin';
      
      // Apply base filter for public users (only active routes)
      const baseQuery = isAdmin ? {} : { isActive: true };
      
      const features = new ApiFeatures(Route.find(baseQuery), req.query)
        .filter()
        .sort()
        .limitFields()
        .paginate();

      const routes = await features.query;
      const total = await Route.countDocuments(baseQuery);
      
      // Filter data based on user role
      const filteredRoutes = routes
        .map(route => filterRouteDataForUser(route, isAdmin))
        .filter(route => route !== null); // Remove null entries (inactive routes for public)

      res.status(200).json(new ApiResponse(200, {
        routes: filteredRoutes,
        pagination: {
          total,
          page: req.query.page * 1 || 1,
          limit: req.query.limit * 1 || 10,
          pages: Math.ceil(total / (req.query.limit * 1 || 10))
        },
        dataLevel: isAdmin ? 'full' : 'public'
      }, 'Routes retrieved successfully'));
    } catch (error) {
      next(new ApiError(500, 'Error retrieving routes'));
    }
  }

  // GET /api/routes/:id - Get single route with role-based data filtering
  static async getRoute(req, res, next) {
    try {
      // Check if user is admin
      const isAdmin = req.user && req.user.role === 'admin';
      
      // For public users, only show active routes
      const query = isAdmin 
        ? { _id: req.params.id }
        : { _id: req.params.id, isActive: true };
      
      const route = await Route.findOne(query);
      
      if (!route) {
        return next(new ApiError(404, 'Route not found or not available'));
      }
      
      // Filter data based on user role
      const filteredRoute = filterRouteDataForUser(route, isAdmin);

      res.status(200).json(new ApiResponse(200, {
        route: filteredRoute,
        dataLevel: isAdmin ? 'full' : 'public'
      }, 'Route retrieved successfully'));
    } catch (error) {
      next(new ApiError(500, 'Error retrieving route'));
    }
  }

  // POST /api/routes - Create new route (admin only)
  static async createRoute(req, res, next) {
    try {
      const route = await Route.create(req.body);
      
      res.status(201).json(new ApiResponse(201, route, 'Route created successfully'));
    } catch (error) {
      if (error.name === 'ValidationError') {
        return next(new ApiError(400, error.message));
      }
      if (error.code === 11000) {
        return next(new ApiError(400, 'Route number already exists'));
      }
      next(new ApiError(500, 'Error creating route'));
    }
  }

  // PUT /api/routes/:id - Update route (admin only)
  static async updateRoute(req, res, next) {
    try {
      const route = await Route.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );

      if (!route) {
        return next(new ApiError(404, 'Route not found'));
      }

      res.status(200).json(new ApiResponse(200, route, 'Route updated successfully'));
    } catch (error) {
      if (error.name === 'ValidationError') {
        return next(new ApiError(400, error.message));
      }
      next(new ApiError(500, 'Error updating route'));
    }
  }

  // DELETE /api/routes/:id - Delete route (admin only)
  static async deleteRoute(req, res, next) {
    try {
      const route = await Route.findByIdAndDelete(req.params.id);

      if (!route) {
        return next(new ApiError(404, 'Route not found'));
      }

      res.status(200).json(new ApiResponse(200, null, 'Route deleted successfully'));
    } catch (error) {
      next(new ApiError(500, 'Error deleting route'));
    }
  }

  // GET /api/routes/:id/buses - Get buses on specific route with role-based filtering
  static async getRouteBuses(req, res, next) {
    try {
      const Bus = (await import('../models/Bus.js')).default;
      
      // Check if user is admin
      const isAdmin = req.user && req.user.role === 'admin';
      
      const buses = await Bus.find({ route: req.params.id })
        .populate('route', 'routeNumber name origin destination distance');
      
      // Filter buses data based on user role using the same helper function
      const filteredBuses = buses.map(bus => {
        if (isAdmin) {
          return bus; // Admin sees all data
        }
        
        // Public user: hide sensitive information
        const filteredBus = { ...bus.toObject() };
        
        // Remove sensitive fields for public users
        delete filteredBus.registrationNumber;
        delete filteredBus._id;
        delete filteredBus.__v;
        delete filteredBus.createdAt;
        delete filteredBus.updatedAt;
        
        // Filter operator information
        if (filteredBus.operator && typeof filteredBus.operator === 'object') {
          delete filteredBus.operator.licenseNumber;
          delete filteredBus.operator.contactNumber;
          delete filteredBus.operator.email;
        }
        
        // Filter route information
        if (filteredBus.route) {
          delete filteredBus.route._id;
          delete filteredBus.route.__v;
          delete filteredBus.route.createdAt;
          delete filteredBus.route.updatedAt;
        }
        
        return filteredBus;
      });

      res.status(200).json(new ApiResponse(200, {
        buses: filteredBuses,
        dataLevel: isAdmin ? 'full' : 'public'
      }, 'Route buses retrieved successfully'));
    } catch (error) {
      next(new ApiError(500, 'Error retrieving route buses'));
    }
  }
}

export default RouteController;