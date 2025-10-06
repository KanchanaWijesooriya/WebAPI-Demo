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

  // GET /api/routes/pricing/:from/:to - Get stopwise pricing between two cities
  static async getStopwisePricing(req, res, next) {
    try {
      const { from, to } = req.params;
      const { busType = 'Normal' } = req.query;

      // Find routes that serve this journey (both directions)
      const routes = await Route.find({
        $or: [
          {
            'origin.city': { $regex: new RegExp(from, 'i') },
            'destination.city': { $regex: new RegExp(to, 'i') }
          },
          {
            'origin.city': { $regex: new RegExp(to, 'i') },
            'destination.city': { $regex: new RegExp(from, 'i') }
          },
          {
            'stops.name': { $regex: new RegExp(from, 'i') },
            'destination.city': { $regex: new RegExp(to, 'i') }
          },
          {
            'origin.city': { $regex: new RegExp(from, 'i') },
            'stops.name': { $regex: new RegExp(to, 'i') }
          },
          {
            'stops.name': { $all: [new RegExp(from, 'i'), new RegExp(to, 'i')] }
          }
        ],
        isActive: true
      });

      if (routes.length === 0) {
        return next(new ApiError(404, `No routes found between ${from} and ${to}`));
      }

      const pricingResults = [];

      for (const route of routes) {
        const routeStops = [
          { name: route.origin.city, order: 0, coordinates: route.origin.coordinates },
          ...route.stops.sort((a, b) => a.order - b.order),
          { name: route.destination.city, order: route.stops.length + 1, coordinates: route.destination.coordinates }
        ];

        // Find start and end stop indices
        const startIndex = routeStops.findIndex(stop => 
          stop.name.toLowerCase().includes(from.toLowerCase())
        );
        const endIndex = routeStops.findIndex(stop => 
          stop.name.toLowerCase().includes(to.toLowerCase())
        );

        if (startIndex === -1 || endIndex === -1) continue;

        // Ensure proper order (start before end)
        const fromIndex = Math.min(startIndex, endIndex);
        const toIndex = Math.max(startIndex, endIndex);

        // Calculate stopwise pricing
        const stopwisePricing = [];
        let cumulativeDistance = 0;
        let cumulativePrice = 0;

        // Base pricing logic
        const baseFare = route.pricingInfo?.baseFare || 50;
        const pricePerKm = route.pricingInfo?.pricePerKm || 3;
        const busTypeMultiplier = getBusTypeMultiplier(busType);

        for (let i = fromIndex; i < toIndex; i++) {
          const currentStop = routeStops[i];
          const nextStop = routeStops[i + 1];
          
          // Calculate distance between stops (rough calculation)
          const distance = calculateDistance(
            currentStop.coordinates,
            nextStop.coordinates
          );
          
          cumulativeDistance += distance;
          const segmentPrice = Math.round((baseFare + (distance * pricePerKm)) * busTypeMultiplier);
          cumulativePrice += segmentPrice;

          stopwisePricing.push({
            from: currentStop.name,
            to: nextStop.name,
            distance: Math.round(distance * 10) / 10, // Round to 1 decimal
            segmentPrice: segmentPrice,
            cumulativeDistance: Math.round(cumulativeDistance * 10) / 10,
            cumulativePrice: cumulativePrice
          });
        }

        pricingResults.push({
          route: {
            _id: route._id,
            name: route.name,
            routeNumber: route.routeNumber,
            routeId: route.routeId
          },
          journey: {
            from: routeStops[fromIndex].name,
            to: routeStops[toIndex].name,
            totalDistance: Math.round(cumulativeDistance * 10) / 10,
            totalPrice: cumulativePrice,
            busType: busType,
            multiplier: busTypeMultiplier
          },
          stopwisePricing: stopwisePricing
        });
      }

      if (pricingResults.length === 0) {
        return next(new ApiError(404, `No valid pricing found for journey ${from} to ${to}`));
      }

      res.status(200).json(new ApiResponse(200, {
        journey: { from, to, busType },
        routes: pricingResults,
        count: pricingResults.length
      }, 'Stopwise pricing retrieved successfully'));

    } catch (error) {
      next(new ApiError(500, 'Error retrieving stopwise pricing', [error.message]));
    }
  }
}

// Helper function to get bus type multiplier
function getBusTypeMultiplier(busType) {
  const multipliers = {
    'Normal': 1.0,
    'Semi-Luxury': 1.3,
    'Luxury': 1.6,
    'Super Luxury': 2.0,
    'Intercity Express': 1.8
  };
  return multipliers[busType] || 1.0;
}

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(coord1, coord2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (coord2.latitude - coord1.latitude) * Math.PI / 180;
  const dLon = (coord2.longitude - coord1.longitude) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(coord1.latitude * Math.PI / 180) * Math.cos(coord2.latitude * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
}

export default RouteController;