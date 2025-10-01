import Bus from '../models/Bus.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiFeatures } from '../utils/ApiFeatures.js';

class BusController {
  // GET /api/buses - List all buses with filtering
  static async getAllBuses(req, res, next) {
    try {
      const features = new ApiFeatures(Bus.find(), req.query)
        .filter()
        .sort()
        .limitFields()
        .paginate();

      const buses = await features.query.populate('route', 'routeNumber startLocation endLocation');
      const total = await Bus.countDocuments();

      res.status(200).json(new ApiResponse(200, {
        buses,
        pagination: {
          total,
          page: req.query.page * 1 || 1,
          limit: req.query.limit * 1 || 10,
          pages: Math.ceil(total / (req.query.limit * 1 || 10))
        }
      }, 'Buses retrieved successfully'));
    } catch (error) {
      next(new ApiError(500, 'Error retrieving buses'));
    }
  }

  // GET /api/buses/:id - Get single bus
  static async getBus(req, res, next) {
    try {
      const bus = await Bus.findById(req.params.id).populate('route');
      
      if (!bus) {
        return next(new ApiError(404, 'Bus not found'));
      }

      res.status(200).json(new ApiResponse(200, bus, 'Bus retrieved successfully'));
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

  // GET /api/buses/:id/location - Get current bus location
  static async getBusLocation(req, res, next) {
    try {
      const LocationHistory = (await import('../models/LocationHistory.js')).default;
      const location = await LocationHistory.findOne({ bus: req.params.id })
        .sort({ timestamp: -1 })
        .populate('bus', 'registrationNumber busNumber')
        .populate('trip', 'tripId status');

      if (!location) {
        return next(new ApiError(404, 'No location data found for this bus'));
      }

      res.status(200).json(new ApiResponse(200, location, 'Bus location retrieved successfully'));
    } catch (error) {
      next(new ApiError(500, 'Error retrieving bus location'));
    }
  }

  // GET /api/buses/:id/trips - Get trips for specific bus
  static async getBusTrips(req, res, next) {
    try {
      const Trip = (await import('../models/Trip.js')).default;
      const trips = await Trip.find({ bus: req.params.id })
        .populate('route', 'routeNumber startLocation endLocation')
        .sort({ scheduledDeparture: -1 });

      res.status(200).json(new ApiResponse(200, trips, 'Bus trips retrieved successfully'));
    } catch (error) {
      next(new ApiError(500, 'Error retrieving bus trips'));
    }
  }
}

export default BusController;