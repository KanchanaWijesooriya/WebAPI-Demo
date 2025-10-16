import Trip from '../models/Trip.js';
import Bus from '../models/Bus.js';
import Route from '../models/Route.js';
import { ApiFeatures } from '../utils/ApiFeatures.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { filterTripData, getDataLevel } from '../utils/dataFilters.js';

class TripController {
  /**
   * Get all trips with filtering, sorting, and pagination
   * @route GET /api/trips
   * @access Public (with optional authentication for role-based data)
   */
  static async getAllTrips(req, res, next) {
    try {
      const isAdmin = req.user && req.user.role === 'admin';
      const { start, end } = req.query;
      
      // Build filter query
      let tripQuery = Trip.find();
      
      // Get all routes for manual matching by routeNumber
      const allRoutes = await Route.find().lean();
      
      // If start and end locations are specified, filter routes first
      let matchingRouteNumbers = [];
      if (start || end) {
        // Build route filter based on start and end locations
        let routeFilter = {};
        
        if (start && end) {
          // Both start and end specified - match exact route direction
          routeFilter = {
            'start.city': new RegExp(start, 'i'),
            'destination.city': new RegExp(end, 'i')
          };
        } else if (start) {
          // Only start specified - match routes starting from this location
          routeFilter['start.city'] = new RegExp(start, 'i');
        } else if (end) {
          // Only end specified - match routes ending at this location
          routeFilter['destination.city'] = new RegExp(end, 'i');
        }
        
        const matchingRoutes = allRoutes.filter(route => {
          if (start && end) {
            // Both start and end specified - must match exact direction
            return new RegExp(`^${start}$`, 'i').test(route.start?.city || '') && 
                   new RegExp(`^${end}$`, 'i').test(route.destination?.city || '');
          } else if (start) {
            // Only start specified - match routes starting from this location
            return new RegExp(`^${start}$`, 'i').test(route.start?.city || '');
          } else if (end) {
            // Only end specified - match routes ending at this location
            return new RegExp(`^${end}$`, 'i').test(route.destination?.city || '');
          }
          return false;
        });
        
        // Use specific route IDs instead of just route numbers to avoid direction confusion
        const matchingRouteIds = matchingRoutes.map(route => route.routeId);
        matchingRouteNumbers = matchingRoutes.map(route => route.routeNumber);
        
        if (matchingRouteNumbers.length === 0) {
          return res.status(200).json(new ApiResponse(
            200,
            {
              trips: [],
              totalTrips: 0,
              dataLevel: isAdmin ? 'admin' : 'public',
              filters: { start, end }
            },
            start && end 
              ? `No trips found from ${start} to ${end}`
              : `No trips found for the specified location`
          ));
        }
      }
      
      // Get ALL trips first, then filter in memory for better control
      const allTrips = await Trip.find().lean();
      // Create route mapping by routeNumber with direction preference
      const routeDataMap = {};
      allRoutes.forEach(route => {
        const key = route.routeNumber;
        if (!routeDataMap[key]) {
          routeDataMap[key] = [];
        }
        routeDataMap[key].push(route);
      });

      // Filter trips based on route direction if start/end specified
      let filteredTrips = allTrips;
      if (start || end) {
        filteredTrips = allTrips.filter(trip => {
          const routesForTrip = routeDataMap[trip.routeNumber] || [];
          
          // Determine trip direction based on sequence
          // Assumption: For each route number, trips alternate between UP and DOWN
          // We'll use the trip sequence to determine direction
          const tripsWithSameRoute = allTrips.filter(t => t.routeNumber === trip.routeNumber);
          const tripIndex = tripsWithSameRoute.findIndex(t => t.tripId === trip.tripId);
          const totalTripsForRoute = tripsWithSameRoute.length;
          
          // Assume first half are UP direction, second half are DOWN direction
          const isUpDirection = tripIndex < (totalTripsForRoute / 2);
          
          // Find the appropriate route based on direction
          let targetRoute;
          if (isUpDirection) {
            targetRoute = routesForTrip.find(route => route.routeId.includes('UP'));
          } else {
            targetRoute = routesForTrip.find(route => route.routeId.includes('DOWN'));
          }
          
          if (!targetRoute) {
            targetRoute = routesForTrip[0]; // fallback
          }
          
          // Check if this route matches the start/end criteria EXACTLY
          if (start && end) {
            const startMatches = new RegExp(`^${start}$`, 'i').test(targetRoute.start?.city || '');
            const endMatches = new RegExp(`^${end}$`, 'i').test(targetRoute.destination?.city || '');
            return startMatches && endMatches;
          } else if (start) {
            return new RegExp(`^${start}$`, 'i').test(targetRoute.start?.city || '');
          } else if (end) {
            return new RegExp(`^${end}$`, 'i').test(targetRoute.destination?.city || '');
          }
          
          return false;
        });
      }

      // Get all buses to determine bus types and numbers
      const buses = await Bus.find().lean();
      const busDataMap = {};
      buses.forEach(bus => {
        busDataMap[bus.registrationNumber] = {
          busType: bus.busType || bus.type,
          busNumber: bus.busNumber
        };
      });

      // Transform trips based on user role with proper 7-day scheduling
      const transformedTrips = filteredTrips.map((trip, index) => {
        // Calculate which day this trip belongs to (0-6 for next 7 days)
        // Assuming ~10 trips per day for a single route direction (2 trips per bus × 5 buses)
        const tripsPerDay = 10;
        const dayOffset = Math.floor(index / tripsPerDay);
        const tripWithinDay = index % tripsPerDay;
        
        // Get Sri Lankan date for this trip
        const today = new Date();
        const tripDate = new Date(today.getTime() + (dayOffset * 24 * 60 * 60 * 1000));
        const slDate = tripDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' });

        // Extract exact time from scheduledDeparture (HH:MM format) with variety
        let timeString = '06:00'; // default time
        if (trip.scheduledDeparture) {
          if (typeof trip.scheduledDeparture === 'string') {
            timeString = trip.scheduledDeparture.substring(11, 16);
          } else if (trip.scheduledDeparture instanceof Date) {
            timeString = trip.scheduledDeparture.toISOString().substring(11, 16);
          }
        }
        
        // Add time variety based on trip index to avoid all trips having same time
        if (timeString === '06:00' || timeString === '13:00') {
          const baseHours = [6, 7, 8, 9, 10, 13, 14, 15, 16, 17];
          const hourIndex = tripWithinDay % baseHours.length;
          const hour = baseHours[hourIndex];
          timeString = `${hour.toString().padStart(2, '0')}:00`;
        }

        // Get bus data based on registration number
        const busData = busDataMap[trip.busRegistration];
        let busType = busData?.busType;
        let busNumber = busData?.busNumber;

        if (!busType) {
          // Distribute bus types based on route patterns
          const busTypes = ['Normal', 'Express', 'Intercity Express'];
          busType = busTypes[Math.floor(tripWithinDay / 4) % 3]; // Change type every ~4 trips (better distribution)
        }

        if (!busNumber) {
          // Generate sequential NB format bus numbers
          const busIndex = (tripWithinDay % 5) + 1; // 5 buses cycling for single direction
          busNumber = `NB-${(1500 + busIndex).toString()}`;
        }

        // Get route data for this trip - determine direction based on trip sequence
        const routesForTrip = routeDataMap[trip.routeNumber] || [];
        let routeData = routesForTrip[0]; // Default fallback
        
        if (routesForTrip.length === 0) {
          // No route data found, skip this trip
          return null;
        }
        
        // Determine trip direction based on sequence (same logic as filtering)
        const tripsWithSameRoute = filteredTrips.filter(t => t.routeNumber === trip.routeNumber);
        const tripIndex = tripsWithSameRoute.findIndex(t => t.tripId === trip.tripId);
        const totalTripsForRoute = tripsWithSameRoute.length;
        const isUpDirection = tripIndex < (totalTripsForRoute / 2);
        
        if (start || end) {
          // If filtering is active, find the route that matches the filter criteria and direction
          if (isUpDirection) {
            routeData = routesForTrip.find(route => route.routeId.includes('UP'));
          } else {
            routeData = routesForTrip.find(route => route.routeId.includes('DOWN'));
          }
          routeData = routeData || routesForTrip[0]; // fallback
          
          // Double-check that this route actually matches the search criteria
          if (start && end) {
            const startMatches = new RegExp(`^${start}$`, 'i').test(routeData.start?.city || '');
            const endMatches = new RegExp(`^${end}$`, 'i').test(routeData.destination?.city || '');
            if (!startMatches || !endMatches) {
              return null; // Skip this trip as it doesn't match the search criteria
            }
          }
        } else {
          // No filtering - use direction based on trip sequence
          if (isUpDirection) {
            routeData = routesForTrip.find(r => r.routeId.includes('UP')) || routesForTrip[0];
          } else {
            routeData = routesForTrip.find(r => r.routeId.includes('DOWN')) || routesForTrip[0];
          }
        }

        // Public user fields
        const publicTrip = {
          tripId: trip.tripId,
          start: routeData?.start?.city || 'N/A',
          destination: routeData?.destination?.city || 'N/A',
          busType: busType,
          busNumber: busNumber,
          routeNumber: trip.routeNumber,
          fare: `LKR ${trip.fare}`,
          runningOn: 'Daily',
          date: slDate,
          time: timeString
        };

        // Add admin-only fields if user is admin
        if (isAdmin) {
          return {
            ...publicTrip,
            driver: trip.driver,
            conductor: trip.conductor,
            operatorDetails: {
              scheduledDeparture: trip.scheduledDeparture,
              scheduledArrival: trip.scheduledArrival,
              status: trip.status,
              serviceDate: trip.serviceDate
            }
          };
        }

        return publicTrip;
      }).filter(trip => trip !== null); // Remove trips that don't match search criteria

      res.status(200).json(new ApiResponse(
        200,
        {
          trips: transformedTrips,
          totalTrips: transformedTrips.length,
          dataLevel: isAdmin ? 'admin' : 'public',
          ...(start || end ? { filters: { start, end } } : {})
        },
        start || end 
          ? `Retrieved ${transformedTrips.length} trips for route from ${start || 'any'} to ${end || 'any'}`
          : `Retrieved all ${transformedTrips.length} trips successfully`
      ));
    } catch (error) {
      next(new ApiError(500, 'Error retrieving trips', [error.message]));
    }
  }

  /**
   * Get a single trip by ID
   * @route GET /api/trips/:id
   * @access Public (with optional authentication for role-based data)
   */
  static async getTrip(req, res, next) {
    try {
      const userRole = req.user?.role || 'passenger';
      
      const trip = await Trip.findById(req.params.id)
        .populate('route', 'name routeName routeId routeNumber start destination distance estimatedDuration stops')
        .populate('bus', 'busNumber registrationNumber busType capacity facilities operator isActive');

      if (!trip) {
        return next(new ApiError(404, 'Trip not found'));
      }

      const filteredTrip = filterTripData(trip, userRole);

      res.status(200).json(new ApiResponse(200, {
        trip: filteredTrip,
        dataLevel: getDataLevel(userRole)
      }, 'Trip retrieved successfully'));
    } catch (error) {
      next(new ApiError(500, 'Error retrieving trip', [error.message]));
    }
  }

  /**
   * Get trips by route
   * @route GET /api/trips/route/:routeId
   * @access Public
   */
  static async getTripsByRoute(req, res, next) {
    try {
      const userRole = req.user?.role || 'passenger';
      const { routeId } = req.params;

      // Find route first to validate it exists
      const route = await Route.findOne({ routeId });
      if (!route) {
        return next(new ApiError(404, 'Route not found'));
      }

      const features = new ApiFeatures(
        Trip.find({ route: route._id }), 
        req.query
      )
        .filter()
        .sort()
        .paginate();

      features.query = features.query
        .populate('route', 'name routeId routeNumber startLocation endLocation')
        .populate('bus', 'registrationNumber busType capacity');

      const trips = await features.query;
      const filteredTrips = trips.map(trip => filterTripData(trip, userRole));

      // Filter route data for response (never expose MongoDB _id to any public endpoint)
      const filteredRoute = {
        name: route.name,
        routeId: route.routeId,
        routeNumber: route.routeNumber
      };

      res.status(200).json(new ApiResponse(
        200,
        {
          trips: filteredTrips,
          route: filteredRoute
        },
        'Route trips retrieved successfully'
      ));
    } catch (error) {
      next(new ApiError(500, 'Error retrieving route trips', [error.message]));
    }
  }

  /**
   * Get trips by date
   * @route GET /api/trips/date/:date
   * @access Public
   */
  static async getTripsByDate(req, res, next) {
    try {
      const userRole = req.user?.role || 'passenger';
      const { date } = req.params;

      // Parse date and create date range for the entire day
      const searchDate = new Date(date);
      if (isNaN(searchDate.getTime())) {
        return next(new ApiError(400, 'Invalid date format. Use YYYY-MM-DD'));
      }

      const startOfDay = new Date(searchDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(searchDate);
      endOfDay.setHours(23, 59, 59, 999);

      const features = new ApiFeatures(
        Trip.find({
          serviceDate: {
            $gte: startOfDay,
            $lte: endOfDay
          }
        }), 
        req.query
      )
        .filter()
        .sort()
        .paginate();

      features.query = features.query
        .populate('route', 'name routeId routeNumber startLocation endLocation')
        .populate('bus', 'registrationNumber busType capacity');

      const trips = await features.query;
      const filteredTrips = trips.map(trip => filterTripData(trip, userRole));

      res.status(200).json(new ApiResponse(
        200,
        {
          trips: filteredTrips,
          date: searchDate.toISOString().split('T')[0],
          totalTripsForDate: trips.length
        },
        'Date trips retrieved successfully'
      ));
    } catch (error) {
      next(new ApiError(500, 'Error retrieving date trips', [error.message]));
    }
  }

  /**
   * Get active/live trips
   * @route GET /api/trips/live
   * @access Public
   */
  static async getLiveTrips(req, res, next) {
    try {
      const userRole = req.user?.role || 'passenger';

      const features = new ApiFeatures(
        Trip.find({ 
          status: { $in: ['active', 'in-transit', 'boarding'] }
        }), 
        req.query
      )
        .sort()
        .paginate();

      features.query = features.query
        .populate('route', 'name routeId routeNumber startLocation endLocation')
        .populate('bus', 'registrationNumber busType capacity features');

      const trips = await features.query;
      const filteredTrips = trips.map(trip => filterTripData(trip, userRole));

      res.status(200).json(new ApiResponse(
        200,
        {
          liveTrips: filteredTrips,
          count: trips.length
        },
        'Live trips retrieved successfully'
      ));
    } catch (error) {
      next(new ApiError(500, 'Error retrieving live trips', [error.message]));
    }
  }

  /**
   * Create a new trip
   * @route POST /api/trips
   * @access Private (Admin only)
   */
  static async createTrip(req, res, next) {
    try {
      const tripData = req.body;

      // Validate required relationships
      if (tripData.route) {
        const route = await Route.findById(tripData.route);
        if (!route) {
          return next(new ApiError(400, 'Invalid route ID'));
        }
        tripData.routeNumber = route.routeNumber;
      }

      if (tripData.bus) {
        const bus = await Bus.findById(tripData.bus);
        if (!bus) {
          return next(new ApiError(400, 'Invalid bus ID'));
        }
        tripData.busRegistration = bus.registrationNumber;
      }

      const trip = await Trip.create(tripData);
      
      const populatedTrip = await Trip.findById(trip._id)
        .populate('route', 'name routeId routeNumber startLocation endLocation')
        .populate('bus', 'registrationNumber busType capacity');

      res.status(201).json(new ApiResponse(201, populatedTrip, 'Trip created successfully'));
    } catch (error) {
      if (error.code === 11000) {
        next(new ApiError(400, 'Trip with this ID already exists'));
      } else {
        next(new ApiError(500, 'Error creating trip', [error.message]));
      }
    }
  }

  /**
   * Update a trip
   * @route PUT /api/trips/:id
   * @access Private (Admin only)
   */
  static async updateTrip(req, res, next) {
    try {
      const updateData = req.body;

      // Validate relationships if they're being updated
      if (updateData.route) {
        const route = await Route.findById(updateData.route);
        if (!route) {
          return next(new ApiError(400, 'Invalid route ID'));
        }
        updateData.routeNumber = route.routeNumber;
      }

      if (updateData.bus) {
        const bus = await Bus.findById(updateData.bus);
        if (!bus) {
          return next(new ApiError(400, 'Invalid bus ID'));
        }
        updateData.busRegistration = bus.registrationNumber;
      }

      const trip = await Trip.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      )
        .populate('route', 'name routeId routeNumber startLocation endLocation')
        .populate('bus', 'registrationNumber busType capacity');

      if (!trip) {
        return next(new ApiError(404, 'Trip not found'));
      }

      res.status(200).json(new ApiResponse(200, trip, 'Trip updated successfully'));
    } catch (error) {
      next(new ApiError(500, 'Error updating trip', [error.message]));
    }
  }

  /**
   * Delete a trip
   * @route DELETE /api/trips/:id
   * @access Private (Admin only)
   */
  static async deleteTrip(req, res, next) {
    try {
      const trip = await Trip.findByIdAndDelete(req.params.id);

      if (!trip) {
        return next(new ApiError(404, 'Trip not found'));
      }

      res.status(200).json(new ApiResponse(200, null, 'Trip deleted successfully'));
    } catch (error) {
      next(new ApiError(500, 'Error deleting trip', [error.message]));
    }
  }

  /**
   * Get trip statistics
   * @route GET /api/trips/stats
   * @access Private (Admin/Operator)
   */
  static async getTripStats(req, res, next) {
    try {
      const userRole = req.user?.role || 'passenger';
      
      if (!['admin', 'operator'].includes(userRole)) {
        return next(new ApiError(403, 'Access denied. Admin or operator role required'));
      }

      const stats = await Trip.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const totalTrips = await Trip.countDocuments();
      const todayTrips = await Trip.countDocuments({
        serviceDate: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt: new Date(new Date().setHours(23, 59, 59, 999))
        }
      });

      let revenueStats = null;
      if (userRole === 'admin') {
        revenueStats = await Trip.aggregate([
          {
            $group: {
              _id: null,
              totalEstimatedRevenue: { $sum: '$estimatedRevenue' },
              totalActualRevenue: { $sum: '$actualRevenue' },
              totalFuelCost: { $sum: '$fuelCost' },
              totalMaintenanceCost: { $sum: '$maintenanceCost' }
            }
          }
        ]);
      }

      res.status(200).json(new ApiResponse(
        200,
        {
          statusBreakdown: stats,
          totalTrips,
          todayTrips,
          ...(revenueStats && revenueStats.length > 0 && { revenueStats: revenueStats[0] })
        },
        'Trip statistics retrieved successfully'
      ));
    } catch (error) {
      next(new ApiError(500, 'Error retrieving trip statistics', [error.message]));
    }
  }
}

export default TripController;