import Trip from '../models/Trip.js';
import Bus from '../models/Bus.js';
import Route from '../models/Route.js';
import { ApiFeatures } from '../utils/ApiFeatures.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';

/**
 * Filter trip data based on user role
 * @param {Object} trip - Trip object from database
 * @param {string} role - User role ('admin', 'operator', 'passenger')
 * @returns {Object} Filtered trip data
 */
const filterTripDataForUser = (trip, role) => {
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

  if (role === 'admin') {
    // Admins get all data including sensitive operational details
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
  } else if (role === 'operator') {
    // Operators get operational data but not detailed financial info
    return {
      ...baseData,
      driver: trip.driver,
      conductor: trip.conductor,
      estimatedRevenue: trip.estimatedRevenue,
      operationalNotes: trip.operationalNotes
    };
  } else {
    // Passengers get only public information
    return baseData;
  }
};

class TripController {
  /**
   * Get all trips with filtering, sorting, and pagination
   * @route GET /api/trips
   * @access Public (with optional authentication for role-based data)
   */
  static async getAllTrips(req, res, next) {
    try {
      const userRole = req.user?.role || 'passenger';
      
      // Create API features instance for filtering, sorting, pagination
      const features = new ApiFeatures(Trip.find(), req.query)
        .filter()
        .sort()
        .limitFields()
        .paginate();

      // Add population for related data
      features.query = features.query
        .populate('route', 'name routeId routeNumber startLocation endLocation')
        .populate('bus', 'registrationNumber busType capacity features operator');

      const trips = await features.query;
      
      // Filter data based on user role
      const filteredTrips = trips.map(trip => filterTripDataForUser(trip, userRole));

      // Get total count for pagination
      const totalTrips = await Trip.countDocuments();

      res.status(200).json(new ApiResponse(
        200,
        {
          trips: filteredTrips,
          totalTrips,
          currentPage: parseInt(req.query.page) || 1,
          totalPages: Math.ceil(totalTrips / (parseInt(req.query.limit) || 10))
        },
        'Trips retrieved successfully'
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
        .populate('route', 'name routeId routeNumber startLocation endLocation distance duration')
        .populate('bus', 'registrationNumber busType capacity features availability');

      if (!trip) {
        return next(new ApiError(404, 'Trip not found'));
      }

      const filteredTrip = filterTripDataForUser(trip, userRole);

      res.status(200).json(new ApiResponse(200, filteredTrip, 'Trip retrieved successfully'));
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
      const filteredTrips = trips.map(trip => filterTripDataForUser(trip, userRole));

      res.status(200).json(new ApiResponse(
        200,
        {
          trips: filteredTrips,
          route: {
            _id: route._id,
            name: route.name,
            routeId: route.routeId,
            routeNumber: route.routeNumber
          }
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
      const filteredTrips = trips.map(trip => filterTripDataForUser(trip, userRole));

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
      const filteredTrips = trips.map(trip => filterTripDataForUser(trip, userRole));

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