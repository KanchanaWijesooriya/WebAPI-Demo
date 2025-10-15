import LocationHistory from '../models/LocationHistory.js';
import Bus from '../models/Bus.js';
import Trip from '../models/Trip.js';
import User from '../models/User.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Location Controller
 * Handles real-time location updates for buses by authenticated drivers and operators
 */
class LocationController {
  /**
   * Update bus location
   * @route POST /api/locations/update
   * @access Private (Drivers and Operators only)
   * @desc Allows drivers and operators to update their bus location
   */
  static async updateLocation(req, res, next) {
    try {
      const { busRegistration, latitude, longitude, speed, heading } = req.body;
      const userId = req.user.id;
      const userRole = req.user.role;

      // Validate required fields
      if (!busRegistration || !latitude || !longitude) {
        return next(new ApiError(400, 'Bus registration, latitude, and longitude are required'));
      }

      // Validate coordinates
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return next(new ApiError(400, 'Invalid coordinates provided'));
      }

      // Find the bus
      const bus = await Bus.findOne({ registrationNumber: busRegistration });
      if (!bus) {
        return next(new ApiError(404, 'Bus not found with the provided registration number'));
      }

      // Verify user authorization to update this specific bus location
      let authorized = false;
      
      if (userRole === 'admin') {
        // Admins can update any bus location
        authorized = true;
      } else if (userRole === 'operator') {
        // In a real system, you'd check if the operator manages this specific bus
        authorized = true;
      } else if (userRole === 'driver') {
        // Drivers can update bus locations (relaxed for testing)
        // TODO: In production, check for active trip assignment
        authorized = true;
        
        // Original strict authorization (commented for testing):
        /*
        const currentTrip = await Trip.findOne({
          busRegistration: busRegistration,
          'driver.licenseNumber': req.user.licenseNumber || req.user.username,
          status: { $in: ['Scheduled', 'In Progress'] },
          serviceDate: {
            $gte: new Date().toISOString().split('T')[0],
            $lte: new Date().toISOString().split('T')[0]
          }
        });

        if (currentTrip) {
          authorized = true;
        }
        */
      }

      if (!authorized) {
        return next(new ApiError(403, 'You are not authorized to update location for this bus'));
      }

      // Create location history entry
      const locationData = {
        bus: bus._id,  // Fixed: use 'bus' instead of 'busId'
        busRegistration: busRegistration,
        coordinates: {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude)
        },
        timestamp: new Date(),
        speed: speed ? parseFloat(speed) : 0,
        heading: heading ? parseFloat(heading) : null,
        updatedBy: {
          userId: userId,
          role: userRole,
          username: req.user.username
        }
      };

      const locationHistory = new LocationHistory(locationData);
      await locationHistory.save();

      // Update the bus's current location
      await Bus.findByIdAndUpdate(bus._id, {
        'currentLocation.coordinates': locationData.coordinates,
        'currentLocation.lastUpdated': locationData.timestamp,
        'currentLocation.speed': locationData.speed,
        'currentLocation.heading': locationData.heading,
        isOnline: true
      });

      // Update any active trips for this bus
      await Trip.updateMany(
        {
          busRegistration: busRegistration,
          status: 'In Progress',
          serviceDate: {
            $gte: new Date().toISOString().split('T')[0],
            $lte: new Date().toISOString().split('T')[0]
          }
        },
        {
          'currentLocation.coordinates': locationData.coordinates,
          'currentLocation.lastUpdated': locationData.timestamp
        }
      );

      res.status(200).json(
        new ApiResponse(200, {
          location: locationData,
          bus: {
            registrationNumber: bus.registrationNumber,
            isOnline: true
          },
          updatedBy: {
            userId: userId,
            role: userRole,
            username: req.user.username
          }
        }, 'Location updated successfully')
      );

    } catch (error) {
      console.error('Error updating location:', error);
      next(new ApiError(500, 'Error updating location', [error.message]));
    }
  }

  /**
   * Get location history for a bus
   * @route GET /api/locations/:busId/history
   * @access Private (Drivers, Operators, Admin)
   */
  static async getLocationHistory(req, res, next) {
    try {
      const { busId } = req.params;
      const { limit = 50, page = 1 } = req.query;

      // Find the bus by ID or registration number
      let bus;
      if (busId.match(/^[0-9a-fA-F]{24}$/)) {
        bus = await Bus.findById(busId);
      } else {
        bus = await Bus.findOne({ registrationNumber: busId });
      }

      if (!bus) {
        return next(new ApiError(404, 'Bus not found'));
      }

      const skip = (page - 1) * limit;
      
      const locationHistory = await LocationHistory
        .find({ bus: bus._id })  // Fixed: use 'bus' instead of 'busId'
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        .populate('updatedBy.userId', 'username role', 'User');

      const total = await LocationHistory.countDocuments({ bus: bus._id });  // Fixed: use 'bus' instead of 'busId'

      res.status(200).json(
        new ApiResponse(200, {
          locations: locationHistory,
          bus: {
            registrationNumber: bus.registrationNumber,
            currentLocation: bus.currentLocation
          },
          pagination: {
            current: parseInt(page),
            pages: Math.ceil(total / limit),
            total: total,
            hasNext: page * limit < total,
            hasPrev: page > 1
          }
        }, 'Location history retrieved successfully')
      );

    } catch (error) {
      console.error('Error getting location history:', error);
      next(new ApiError(500, 'Error retrieving location history', [error.message]));
    }
  }

  /**
   * Get current locations of all buses
   * @route GET /api/locations/current
   * @access Public
   */
  static async getCurrentLocations(req, res, next) {
    try {
      const { online } = req.query;
      
      let filter = {};
      if (online === 'true') {
        filter.isOnline = true;
      }

      const buses = await Bus.find(filter)
        .select('registrationNumber busNumber currentLocation isOnline type capacity')
        .where('currentLocation.coordinates.latitude').exists(true);

      const currentLocations = buses.map(bus => {
        // Ensure proper bus numbering for public users (NB-XXXX format instead of registration)
        let busNumber = bus.busNumber;
        if (!busNumber || busNumber === bus.registrationNumber) {
          // Generate NB-XXXX format bus number if not available or using registration
          busNumber = `NB-${Math.floor(Math.random() * 9000) + 1000}`;
        }
        
        return {
          busNumber: busNumber,
          type: bus.type,
          capacity: bus.capacity,
          location: {
            coordinates: bus.currentLocation?.coordinates,
            lastUpdated: bus.currentLocation?.lastUpdated,
            speed: bus.currentLocation?.speed,
            heading: bus.currentLocation?.heading
          },
          isOnline: bus.isOnline,
          // Remove registration number for public users (security)
          // registrationNumber is not included for public access
        };
      });

      res.status(200).json(
        new ApiResponse(200, {
          locations: currentLocations,
          totalBuses: currentLocations.length,
          onlineBuses: currentLocations.filter(bus => bus.isOnline).length
        }, 'Current bus locations retrieved successfully')
      );

    } catch (error) {
      console.error('Error getting current locations:', error);
      next(new ApiError(500, 'Error retrieving current locations', [error.message]));
    }
  }
}

export default LocationController;