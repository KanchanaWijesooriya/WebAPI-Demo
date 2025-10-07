import Bus from '../models/Bus.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiFeatures } from '../utils/ApiFeatures.js';
import { filterBusData, getDataLevel } from '../utils/dataFilters.js';

class BusController {
  // GET /api/buses - List all buses with filtering and role-based data filtering
  static async getAllBuses(req, res, next) {
    try {
      // Get user role
      const userRole = req.user?.role || null;
      
      // Set default limit to show all buses if not specified
      const queryWithDefaults = {
        ...req.query,
        limit: req.query.limit || 50 // Show up to 50 buses by default instead of 10
      };
      
      const features = new ApiFeatures(Bus.find(), queryWithDefaults)
        .filter()
        .sort()
        .limitFields()
        .paginate();

      // Populate route information with start and destination details
      const buses = await features.query.populate({
        path: 'route',
        select: 'routeNumber name start destination'
      });
      const total = await Bus.countDocuments();
      
      // Filter data based on user role and add route from-to info
      const filteredBuses = buses
        .map(bus => {
          const filteredBus = filterBusData(bus, userRole);
          if (filteredBus) {
            // Add from-to information based on actual route direction from route name
            if (bus.route && typeof bus.route === 'object' && bus.route.name) {
              const routeName = bus.route.name;
              // Extract from and to from route name (e.g., "Colombo Fort - Badulla" or "Badulla - Colombo Fort")
              const parts = routeName.split(' - ');
              if (parts.length === 2) {
                filteredBus.fromTo = `${parts[0]}-->${parts[1]}`;
              } else {
                filteredBus.fromTo = routeName;
              }
            } else {
              filteredBus.fromTo = 'Route not assigned';
            }
          }
          return filteredBus;
        })
        .filter(bus => bus !== null);

      res.status(200).json(new ApiResponse(200, {
        buses: filteredBuses,
        pagination: {
          total,
          page: queryWithDefaults.page * 1 || 1,
          limit: queryWithDefaults.limit * 1 || 50,
          pages: Math.ceil(total / (queryWithDefaults.limit * 1 || 50))
        },
        dataLevel: getDataLevel(userRole)
      }, 'Buses retrieved successfully'));
    } catch (error) {
      next(new ApiError(500, 'Error retrieving buses'));
    }
  }

  // GET /api/buses/:id - Get single bus with role-based data filtering
  static async getBus(req, res, next) {
    try {
      let bus;
      
      // Try to find by MongoDB ObjectId first, then by bus number
      if (req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
        // It's a valid MongoDB ObjectId
        bus = await Bus.findById(req.params.id).populate({
          path: 'route',
          select: 'routeNumber name start destination distance estimatedDuration stops',
          populate: {
            path: 'stops',
            select: 'name coordinates order'
          }
        });
      } else {
        // Try to find by bus number or registration number
        bus = await Bus.findOne({
          $or: [
            { busNumber: req.params.id },
            { registrationNumber: req.params.id },
            { busNumber: new RegExp(req.params.id, 'i') },
            { registrationNumber: new RegExp(req.params.id, 'i') }
          ]
        }).populate({
          path: 'route',
          select: 'routeNumber name start destination distance estimatedDuration stops',
          populate: {
            path: 'stops',
            select: 'name coordinates order'
          }
        });
      }
      
      if (!bus) {
        return next(new ApiError(404, 'Bus not found'));
      }
      
      // Check if user is admin
      const isAdmin = req.user && req.user.role === 'admin';
      
      // Filter data based on user role
      const userRole = req.user?.role || null;
      const filteredBus = filterBusData(bus, userRole);

      res.status(200).json(new ApiResponse(200, {
        bus: filteredBus,
        routeInfo: {
          hasRoute: !!(filteredBus.route && filteredBus.route !== 'Not Assigned'),
          note: filteredBus.route && filteredBus.route !== 'Not Assigned' ? 
            `Bus operates on route ${filteredBus.route}` :
            'This bus does not have a route assignment yet'
        },
        dataLevel: getDataLevel(userRole)
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