import Bus from '../models/Bus.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiFeatures } from '../utils/ApiFeatures.js';

// Helper function to filter bus data based on user role
function filterBusDataForUser(bus, isAdmin) {
  if (isAdmin) {
    return bus; // Admin sees all data
  }
  
  // Public user: hide sensitive information
  const filteredBus = bus.toObject ? { ...bus.toObject() } : { ...bus };
  
  // Remove sensitive fields for public users
  delete filteredBus.registrationNumber;
  delete filteredBus._id;
  delete filteredBus.__v;
  delete filteredBus.createdAt;
  delete filteredBus.updatedAt;
  delete filteredBus.id; // Remove virtual id field
  
  // Filter operator information
  if (filteredBus.operator && typeof filteredBus.operator === 'object') {
    delete filteredBus.operator.licenseNumber;
    delete filteredBus.operator.contactNumber;
    delete filteredBus.operator.email;
  }
  
  // Clean route information for public users but PRESERVE essential route data for all users
  if (filteredBus.route && typeof filteredBus.route === 'object') {
    // Always preserve route information for user navigation
    const routeInfo = {
      routeNumber: filteredBus.route.routeNumber,
      name: filteredBus.route.name,
      from: filteredBus.route.origin ? {
        city: filteredBus.route.origin.city,
        province: filteredBus.route.origin.province
      } : null,
      to: filteredBus.route.destination ? {
        city: filteredBus.route.destination.city,
        province: filteredBus.route.destination.province
      } : null,
      distance: filteredBus.route.distance,
      estimatedDuration: filteredBus.route.estimatedDuration
    };
    
    // Include stops information (cleaned for public users)
    if (filteredBus.route.stops && Array.isArray(filteredBus.route.stops)) {
      routeInfo.stops = filteredBus.route.stops.map(stop => {
        if (typeof stop === 'object') {
          return {
            name: stop.name,
            coordinates: stop.coordinates,
            order: stop.order
          };
        }
        return stop;
      });
    }
    
    // Replace the full route object with cleaned essential information
    filteredBus.route = routeInfo;
  } else if (!filteredBus.route) {
    // If no route is assigned, make it clear
    filteredBus.route = {
      routeNumber: null,
      name: 'Route not assigned',
      from: null,
      to: null,
      distance: null,
      estimatedDuration: null,
      stops: []
    };
  }
  
  return filteredBus;
}

class BusController {
  // GET /api/buses - List all buses with filtering and role-based data filtering
  static async getAllBuses(req, res, next) {
    try {
      // Check if user is admin (this requires optionalAuth middleware)
      const isAdmin = req.user && req.user.role === 'admin';
      
      const features = new ApiFeatures(Bus.find(), req.query)
        .filter()
        .sort()
        .limitFields()
        .paginate();

      // Populate route information with comprehensive details
      const buses = await features.query.populate({
        path: 'route',
        select: 'routeNumber name origin destination distance estimatedDuration stops',
        populate: {
          path: 'stops',
          select: 'name coordinates order'
        }
      });
      const total = await Bus.countDocuments();
      
      // Filter data based on user role
      const filteredBuses = buses.map(bus => filterBusDataForUser(bus, isAdmin));
      
      // Count buses with and without route assignments for informational purposes
      const busesWithRoutes = filteredBuses.filter(bus => bus.route && bus.route.routeNumber).length;
      const busesWithoutRoutes = filteredBuses.length - busesWithRoutes;

      res.status(200).json(new ApiResponse(200, {
        buses: filteredBuses,
        pagination: {
          total,
          page: req.query.page * 1 || 1,
          limit: req.query.limit * 1 || 10,
          pages: Math.ceil(total / (req.query.limit * 1 || 10))
        },
        routeInfo: {
          busesWithRoutes,
          busesWithoutRoutes,
          note: busesWithoutRoutes > 0 ? 'Some buses do not have route assignments yet' : 'All buses have route assignments'
        },
        dataLevel: isAdmin ? 'full' : 'public'
      }, 'Buses retrieved successfully'));
    } catch (error) {
      next(new ApiError(500, 'Error retrieving buses'));
    }
  }

  // GET /api/buses/:id - Get single bus with role-based data filtering
  static async getBus(req, res, next) {
    try {
      const bus = await Bus.findById(req.params.id).populate({
        path: 'route',
        select: 'routeNumber name origin destination distance estimatedDuration stops',
        populate: {
          path: 'stops',
          select: 'name coordinates order'
        }
      });
      
      if (!bus) {
        return next(new ApiError(404, 'Bus not found'));
      }
      
      // Check if user is admin
      const isAdmin = req.user && req.user.role === 'admin';
      
      // Filter data based on user role
      const filteredBus = filterBusDataForUser(bus, isAdmin);

      res.status(200).json(new ApiResponse(200, {
        bus: filteredBus,
        routeInfo: {
          hasRoute: !!(filteredBus.route && filteredBus.route.routeNumber),
          note: filteredBus.route && filteredBus.route.routeNumber ? 
            `Bus operates on route ${filteredBus.route.routeNumber}: ${filteredBus.route.from?.city} → ${filteredBus.route.to?.city}` :
            'This bus does not have a route assignment yet'
        },
        dataLevel: isAdmin ? 'full' : 'public'
      }, 'Bus retrieved successfully'));
    } catch (error) {
      next(new ApiError(500, 'Error retrieving bus'));
    }
  }

  // POST /api/buses - Create new bus (operator only)
  static async createBus(req, res, next) {
    try {
      const bus = await Bus.create(req.body);
      await bus.populate('route');
      
      res.status(201).json(new ApiResponse(201, bus, 'Bus created successfully'));
    } catch (error) {
      if (error.name === 'ValidationError') {
        return next(new ApiError(400, error.message));
      }
      if (error.code === 11000) {
        return next(new ApiError(400, 'Bus registration number already exists'));
      }
      next(new ApiError(500, 'Error creating bus'));
    }
  }

  // PUT /api/buses/:id - Update bus (operator only)
  static async updateBus(req, res, next) {
    try {
      const bus = await Bus.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      ).populate('route');

      if (!bus) {
        return next(new ApiError(404, 'Bus not found'));
      }

      res.status(200).json(new ApiResponse(200, bus, 'Bus updated successfully'));
    } catch (error) {
      if (error.name === 'ValidationError') {
        return next(new ApiError(400, error.message));
      }
      next(new ApiError(500, 'Error updating bus'));
    }
  }

  // DELETE /api/buses/:id - Delete bus (admin only)
  static async deleteBus(req, res, next) {
    try {
      const bus = await Bus.findByIdAndDelete(req.params.id);

      if (!bus) {
        return next(new ApiError(404, 'Bus not found'));
      }

      res.status(200).json(new ApiResponse(200, null, 'Bus deleted successfully'));
    } catch (error) {
      next(new ApiError(500, 'Error deleting bus'));
    }
  }

  // GET /api/buses/:id/location - Get current bus location with role-based filtering
  static async getBusLocation(req, res, next) {
    try {
      const LocationHistory = (await import('../models/LocationHistory.js')).default;
      
      // Check if user is admin
      const isAdmin = req.user && req.user.role === 'admin';
      
      const location = await LocationHistory.findOne({ bus: req.params.id })
        .sort({ timestamp: -1 })
        .populate('bus', 'registrationNumber busNumber operator type')
        .populate('trip', 'tripId status');

      if (!location) {
        return next(new ApiError(404, 'No location data found for this bus'));
      }
      
      // Filter location data based on user role
      const filteredLocation = { ...location.toObject() };
      
      if (!isAdmin) {
        // Remove internal fields for public users
        delete filteredLocation._id;
        delete filteredLocation.__v;
        delete filteredLocation.createdAt;
        delete filteredLocation.updatedAt;
        
        // Filter bus information
        if (filteredLocation.bus) {
          delete filteredLocation.bus._id;
          delete filteredLocation.bus.__v;
          delete filteredLocation.bus.registrationNumber; // Hide registration
          
          if (filteredLocation.bus.operator) {
            delete filteredLocation.bus.operator.licenseNumber;
            delete filteredLocation.bus.operator.contactNumber;
          }
        }
        
        // Filter trip information
        if (filteredLocation.trip) {
          delete filteredLocation.trip._id;
          delete filteredLocation.trip.__v;
        }
      }

      res.status(200).json(new ApiResponse(200, {
        location: filteredLocation,
        dataLevel: isAdmin ? 'full' : 'public'
      }, 'Bus location retrieved successfully'));
    } catch (error) {
      next(new ApiError(500, 'Error retrieving bus location'));
    }
  }

  // GET /api/buses/:id/trips - Get trips for specific bus with role-based filtering
  static async getBusTrips(req, res, next) {
    try {
      const Trip = (await import('../models/Trip.js')).default;
      const userRole = req.user?.role || 'passenger';
      
      // Find trips by bus ID or busRegistration
      const trips = await Trip.find({
        $or: [
          { bus: req.params.id },
          { busRegistration: req.params.id }
        ]
      })
        .populate('route', 'name routeId routeNumber startLocation endLocation')
        .populate('bus', 'registrationNumber busType capacity features')
        .sort({ serviceDate: -1, departureTime: -1 });
      
      // Filter trips data based on user role using the same logic as TripController
      const filteredTrips = trips.map(trip => {
        const baseData = {
          _id: trip._id,
          tripId: trip.tripId,
          route: trip.route,
          routeNumber: trip.routeNumber,
          bus: trip.bus,
          busRegistration: trip.busRegistration,
          serviceDate: trip.serviceDate,
          departureTime: trip.departureTime,
          arrivalTime: trip.arrivalTime,
          status: trip.status,
          currentLocation: trip.currentLocation,
          nextStop: trip.nextStop,
          delayMinutes: trip.delayMinutes,
          createdAt: trip.createdAt,
          updatedAt: trip.updatedAt
        };

        if (userRole === 'admin') {
          return {
            ...baseData,
            driver: trip.driver,
            conductor: trip.conductor,
            estimatedRevenue: trip.estimatedRevenue,
            actualRevenue: trip.actualRevenue,
            fuelCost: trip.fuelCost,
            maintenanceCost: trip.maintenanceCost,
            operationalNotes: trip.operationalNotes
          };
        } else if (userRole === 'operator') {
          return {
            ...baseData,
            driver: trip.driver,
            conductor: trip.conductor,
            estimatedRevenue: trip.estimatedRevenue,
            operationalNotes: trip.operationalNotes
          };
        } else {
          return baseData;
        }
      });

      res.status(200).json(new ApiResponse(200, {
        trips: filteredTrips,
        totalTrips: trips.length,
        dataLevel: userRole === 'admin' ? 'full' : userRole === 'operator' ? 'operational' : 'public'
      }, 'Bus trips retrieved successfully'));
    } catch (error) {
      next(new ApiError(500, 'Error retrieving bus trips', [error.message]));
    }
  }
}

export default BusController;