import Route from '../models/Route.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiFeatures } from '../utils/ApiFeatures.js';
import { filterRouteData, filterBusData, getDataLevel } from '../utils/dataFilters.js';

class RouteController {
  // GET /api/routes - List all routes with filtering, sorting, pagination and role-based filtering
  static async getAllRoutes(req, res, next) {
    try {
      // Get user role
      const userRole = req.user?.role || null;
      
      // Apply base filter for non-admin users (only active routes)
      const baseQuery = userRole === 'admin' ? {} : { isActive: true };
      
      const features = new ApiFeatures(Route.find(baseQuery), req.query)
        .filter()
        .sort()
        .limitFields()
        .paginate();

      const routes = await features.query.populate('stops');
      const total = await Route.countDocuments(baseQuery);
      
      // Filter routes based on user role - show all stops by default
      const filteredRoutes = routes
        .map(route => filterRouteData(route, userRole, { limitStops: false }))
        .filter(route => route !== null);

      const response = new ApiResponse(
        200,
        {
          routes: filteredRoutes,
          pagination: {
            total,
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 10,
            pages: Math.ceil(total / (parseInt(req.query.limit) || 10))
          },
          dataLevel: getDataLevel(userRole)
        },
        'Routes retrieved successfully'
      );

      res.status(200).json(response);
    } catch (error) {
      next(new ApiError(500, 'Error retrieving routes'));
    }
  }

  // GET /api/routes/:id - Get single route with role-based data filtering (supports bidirectional)
  static async getRoute(req, res, next) {
    try {
      // Check if user is admin
      const isAdmin = req.user && req.user.role === 'admin';
      const userRole = req.user?.role || null;
      
      // Try to find by MongoDB ObjectId first, then by route number
      let query = {};
      let isSingleRoute = false;
      
      if (req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
        // It's a valid MongoDB ObjectId - return single route
        query = isAdmin ? { _id: req.params.id } : { _id: req.params.id, isActive: true };
        isSingleRoute = true;
      } else {
        // It's likely a route number - find all routes with this base number (bidirectional)
        const routeNum = req.params.id;
        query = isAdmin 
          ? { $or: [
              { routeNumber: routeNum }, 
              { routeNumber: new RegExp(routeNum, 'i') }, 
              { routeId: new RegExp(routeNum, 'i') }
            ]}
          : { $or: [
              { routeNumber: routeNum }, 
              { routeNumber: new RegExp(routeNum, 'i') }, 
              { routeId: new RegExp(routeNum, 'i') }
            ], isActive: true };
      }
      
      if (isSingleRoute) {
        // Single route by ObjectId
        const route = await Route.findOne(query);
        
        if (!route) {
          return next(new ApiError(404, 'Route not found or not available'));
        }
        
        const filteredRoute = filterRouteData(route, userRole, { limitStops: false });

        res.status(200).json(new ApiResponse(200, {
          route: filteredRoute,
          dataLevel: getDataLevel(userRole)
        }, 'Route retrieved successfully'));
        
      } else {
        // Multiple routes by route number (bidirectional support)
        const routes = await Route.find(query);
        
        if (!routes || routes.length === 0) {
          return next(new ApiError(404, 'Route not found or not available'));
        }
        
        // Filter routes based on user role - show all stops by default
        const filteredRoutes = routes
          .map(route => filterRouteData(route, userRole, { limitStops: false }))
          .filter(route => route !== null);

        // If only one route found, return single route format for backward compatibility
        if (filteredRoutes.length === 1) {
          res.status(200).json(new ApiResponse(200, {
            route: filteredRoutes[0],
            dataLevel: getDataLevel(userRole)
          }, 'Route retrieved successfully'));
        } else {
          // Multiple routes found - return bidirectional format
          res.status(200).json(new ApiResponse(200, {
            routes: filteredRoutes,
            routeNumber: req.params.id,
            bidirectional: true,
            summary: {
              totalRoutes: filteredRoutes.length,
              directions: filteredRoutes.map(r => r.direction).filter((v, i, a) => a.indexOf(v) === i),
              routeInfo: `Found ${filteredRoutes.length} route(s) for route number ${req.params.id}`
            },
            dataLevel: getDataLevel(userRole)
          }, `Found ${filteredRoutes.length} route(s) for route number ${req.params.id}`));
        }
      }
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
      const userRole = req.user?.role || null;
      
      let routeQuery = {};
      let routeIds = [];
      
      // Check if the parameter is a MongoDB ObjectId or route number
      if (req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
        // It's a MongoDB ObjectId - use it directly
        routeIds = [req.params.id];
      } else {
        // It's a route number - find all routes with this number
        const routeNum = req.params.id;
        routeQuery = isAdmin 
          ? { $or: [
              { routeNumber: routeNum }, 
              { routeNumber: new RegExp(routeNum, 'i') }, 
              { routeId: new RegExp(routeNum, 'i') }
            ]}
          : { $or: [
              { routeNumber: routeNum }, 
              { routeNumber: new RegExp(routeNum, 'i') }, 
              { routeId: new RegExp(routeNum, 'i') }
            ], isActive: true };
            
        // Find routes that match the route number
        const routes = await Route.find(routeQuery).select('_id');
        routeIds = routes.map(route => route._id);
        
        if (routeIds.length === 0) {
          return next(new ApiError(404, `No routes found for route number ${req.params.id}`));
        }
      }
      
      // Find buses that serve any of these routes
      const buses = await Bus.find({ route: { $in: routeIds } })
        .populate('route', 'routeNumber name start destination distance');
      
      // Filter buses data based on user role and remove sensitive data for this endpoint
      const filteredBuses = buses
        .map(bus => {
          const filteredBus = filterBusData(bus, userRole);
          if (filteredBus && filteredBus.currentLocation !== undefined) {
            delete filteredBus.currentLocation;
          }
          // Remove _id and other sensitive data for non-admin users
          if (!isAdmin && filteredBus) {
            delete filteredBus._id;
            delete filteredBus.__v;
            if (filteredBus.route && filteredBus.route._id) {
              delete filteredBus.route._id;
            }
          }
          return filteredBus;
        })
        .filter(bus => bus !== null);

      // Get route information for from/to display
      const routeInfo = await Route.findOne({ _id: { $in: routeIds } })
        .select('routeNumber name start destination');

      // Add start/end information to each bus after route field
      const busesWithRouteInfo = filteredBuses.map(bus => {
        const { route, ...busData } = bus;
        return {
          ...busData,
          route: route || req.params.id,
          start: routeInfo?.start?.city || 'Unknown',
          end: routeInfo?.destination?.city || 'Unknown'
        };
      });

      // Prepare response data with route from/to information (without name field)
      const responseData = {
        route: routeInfo ? {
          routeNumber: routeInfo.routeNumber,
          from: routeInfo.start?.city || 'Unknown',
          to: routeInfo.destination?.city || 'Unknown'
        } : null,
        buses: busesWithRouteInfo,
        searchParameter: req.params.id,
        dataLevel: getDataLevel(userRole)
      };
      
      // Add routeIds only for admin users
      if (isAdmin) {
        responseData.routeIds = routeIds;
      }

      res.status(200).json(new ApiResponse(200, responseData, `Route buses retrieved successfully for ${req.params.id}`));
    } catch (error) {
      console.error('Error in getRouteBuses:', error);
      next(new ApiError(500, `Error retrieving route buses: ${error.message}`));
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
            'start.city': { $regex: new RegExp(from, 'i') },
            'destination.city': { $regex: new RegExp(to, 'i') }
          },
          {
            'start.city': { $regex: new RegExp(to, 'i') },
            'destination.city': { $regex: new RegExp(from, 'i') }
          },
          {
            'stops.name': { $regex: new RegExp(from, 'i') },
            'destination.city': { $regex: new RegExp(to, 'i') }
          },
          {
            'start.city': { $regex: new RegExp(from, 'i') },
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
          { name: route.start.city, order: 0, coordinates: route.start.coordinates },
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

        // Calculate stopwise pricing (simplified)
        const stopwisePricing = [];
        let totalPrice = 0;

        // Base pricing logic
        const baseFare = route.pricingInfo?.baseFare || 50;
        const pricePerKm = route.pricingInfo?.pricePerKm || 7;
        const busTypeMultiplier = getBusTypeMultiplier(busType);

        for (let i = fromIndex; i < toIndex; i++) {
          const currentStop = routeStops[i];
          const nextStop = routeStops[i + 1];
          
          // Calculate distance between stops (rough calculation)
          const distance = calculateDistance(
            currentStop.coordinates,
            nextStop.coordinates
          );
          
          const segmentPrice = Math.round((baseFare + (distance * pricePerKm)) * busTypeMultiplier);
          totalPrice += segmentPrice;

          stopwisePricing.push({
            from: currentStop.name,
            to: nextStop.name,
            fare: `LKR ${segmentPrice}`
          });
        }

        pricingResults.push({
          routeNumber: route.routeNumber,
          routeName: route.name,
          busType: busType,
          totalFare: `LKR ${totalPrice}`,
          duration: route.estimatedDuration ? `${Math.round(route.estimatedDuration / 60)} hours` : null,
          stopwiseFares: stopwisePricing
        });
      }

      if (pricingResults.length === 0) {
        return next(new ApiError(404, `No valid pricing found for journey ${from} to ${to}`));
      }

      res.status(200).json(new ApiResponse(200, {
        from,
        to,
        busType,
        routes: pricingResults,
        totalOptions: pricingResults.length
      }, `Found ${pricingResults.length} route(s) for ${from} to ${to}`));

    } catch (error) {
      next(new ApiError(500, 'Error retrieving stopwise pricing', [error.message]));
    }
  }
}

// Helper function to get bus type multiplier
function getBusTypeMultiplier(busType) {
  const multipliers = {
    'Normal': 1.0,
    'Express': 1.3,
    'Intercity Express': 1.6,
    'Super Intercity Express': 2.0,
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