import Route from '../models/Route.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiFeatures } from '../utils/ApiFeatures.js';

class RouteController {
  // GET /api/routes - List all routes with filtering, sorting, pagination
  static async getAllRoutes(req, res, next) {
    try {
      const features = new ApiFeatures(Route.find(), req.query)
        .filter()
        .sort()
        .limitFields()
        .paginate();

      const routes = await features.query;
      const total = await Route.countDocuments();

      res.status(200).json(new ApiResponse(200, {
        routes,
        pagination: {
          total,
          page: req.query.page * 1 || 1,
          limit: req.query.limit * 1 || 10,
          pages: Math.ceil(total / (req.query.limit * 1 || 10))
        }
      }, 'Routes retrieved successfully'));
    } catch (error) {
      next(new ApiError(500, 'Error retrieving routes'));
    }
  }

  // GET /api/routes/:id - Get single route
  static async getRoute(req, res, next) {
    try {
      const route = await Route.findById(req.params.id);
      
      if (!route) {
        return next(new ApiError(404, 'Route not found'));
      }

      res.status(200).json(new ApiResponse(200, route, 'Route retrieved successfully'));
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

  // GET /api/routes/:id/buses - Get buses on specific route
  static async getRouteBuses(req, res, next) {
    try {
      const Bus = (await import('../models/Bus.js')).default;
      const buses = await Bus.find({ route: req.params.id }).populate('route', 'routeNumber startLocation endLocation');

      res.status(200).json(new ApiResponse(200, buses, 'Route buses retrieved successfully'));
    } catch (error) {
      next(new ApiError(500, 'Error retrieving route buses'));
    }
  }
}

export default RouteController;