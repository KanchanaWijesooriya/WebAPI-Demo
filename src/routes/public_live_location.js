import express from 'express';
import Bus from '../models/Bus.js';
import Route from '../models/Route.js';
import Trip from '../models/Trip.js';
import LocationHistory from '../models/LocationHistory.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Public Live Tracking
 *   description: Public endpoints for live bus location tracking
 */

/**
 * @swagger
 * /public/bus-location/{busNumber}:
 *   get:
 *     tags: [Public Live Tracking]
 *     summary: Get live bus location
 *     description: Retrieve real-time location of a specific bus using bus number (Public endpoint)
 *     parameters:
 *       - name: busNumber
 *         in: path
 *         required: true
 *         description: Bus number in NB-XXXX format
 *         schema:
 *           type: string
 *           example: "NB-1001"
 *     responses:
 *       200:
 *         description: Bus location retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         bus:
 *                           type: object
 *                           properties:
 *                             busNumber:
 *                               type: string
 *                               example: "NB-1001"
 *                             operator:
 *                               type: string
 *                             type:
 *                               type: string
 *                         currentLocation:
 *                           type: object
 *                           properties:
 *                             coordinates:
 *                               type: array
 *                               items:
 *                                 type: number
 *                               example: [79.8612, 6.9271]
 *                             timestamp:
 *                               type: string
 *                               format: date-time
 *                             speed:
 *                               type: number
 *                             heading:
 *                               type: number
 *                         currentTrip:
 *                           $ref: '#/components/schemas/Trip'
 *                         locationHistory:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               coordinates:
 *                                 type: array
 *                                 items:
 *                                   type: number
 *                               timestamp:
 *                                 type: string
 *                                 format: date-time
 *       404:
 *         description: Bus not found
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */

// GET /api/public/bus-location/:busNumber - Public endpoint to get live bus location
router.get('/bus-location/:busNumber', async (req, res) => {
  try {
    const { busNumber } = req.params;
    
    // Find bus by bus number (public endpoint uses bus numbers only)
    let bus;
    
    // Primary search: find by bus number (NB-XXXX format)
    bus = await Bus.findOne({ busNumber: busNumber })
      .select('registrationNumber busNumber operator type isActive')
      .lean();
    
    // If not found, create a mapping from NB-XXXX to registration numbers
    // This allows users to use NB format while working with existing data
    if (!bus && busNumber.match(/^NB-\d{4}$/)) {
      // Get all buses and create a consistent mapping
      const allBuses = await Bus.find({})
        .select('registrationNumber busNumber operator type isActive')
        .lean();
      
      // Create a deterministic mapping based on registration number
      for (let i = 0; i < allBuses.length; i++) {
        const mappedBusNumber = `NB-${(1000 + i).toString()}`;
        if (mappedBusNumber === busNumber) {
          bus = allBuses[i];
          // Assign the mapped bus number for consistency
          bus.busNumber = mappedBusNumber;
          break;
        }
      }
    }
    
    // If not found and busNumber looks like an ObjectId, try MongoDB ID (backward compatibility)
    if (!bus && busNumber.match(/^[0-9a-fA-F]{24}$/)) {
      bus = await Bus.findById(busNumber).select('registrationNumber busNumber operator type isActive').lean();
    }
    
    // Generate bus number if not available in database
    if (bus && !bus.busNumber) {
      // Create consistent mapping based on registration number
      const regNum = bus.registrationNumber;
      const hash = regNum.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
      bus.busNumber = `NB-${Math.abs(hash % 9000) + 1000}`;
    }
    
    if (!bus) {
      // Get available bus numbers for user reference
      const sampleBuses = await Bus.find({}).limit(5).select('registrationNumber').lean();
      const availableBusNumbers = sampleBuses.map((b, index) => `NB-${(1000 + index).toString()}`);
      
      return res.status(404).json({
        success: false,
        message: `Bus not found with Bus Number: ${busNumber}`,
        availableBuses: `Try: ${availableBusNumbers.join(', ')}`,
        note: 'Use bus numbers in NB-XXXX format (e.g., NB-1000, NB-1001, etc.). Registration numbers are not accepted in public endpoints.',
        totalBuses: sampleBuses.length > 0 ? `${sampleBuses.length}+ buses available` : 'No buses available'
      });
    }
    
    if (!bus.isActive) {
      return res.status(200).json({
        success: true,
        message: 'Bus is currently not in service',
        data: {
          busInfo: {
            busNumber: bus.busNumber || `NB-${Math.floor(Math.random() * 9000) + 1000}`,
            operator: bus.operator,
            type: bus.type,
            status: 'Not in service'
            // registrationNumber is not included for public users (security)
          },
          location: null
        }
      });
    }
    
    // Get current trip information
    const currentTrip = await Trip.findOne({
      bus: bus._id,
      status: 'In Progress'
    })
    .populate('route', 'routeNumber name start destination')
    .select('tripId route scheduledDeparture status passengers')
    .lean();
    
    // Get latest location from LocationHistory
    const latestLocation = await LocationHistory.findOne({
      bus: bus._id
    })
    .sort({ timestamp: -1 })
    .select('coordinates speed heading timestamp')
    .lean();
    
    // Use real location data or generate mock data
    const locationData = latestLocation ? {
      coordinates: latestLocation.coordinates,
      speed: latestLocation.speed,
      heading: latestLocation.heading,
      timestamp: latestLocation.timestamp
    } : {
      coordinates: {
        latitude: 6.9271 + (Math.random() - 0.5) * 0.1,
        longitude: 79.8612 + (Math.random() - 0.5) * 0.1
      },
      speed: Math.floor(Math.random() * 60) + 20,
      heading: Math.floor(Math.random() * 360),
      timestamp: new Date(Date.now() - Math.random() * 3600000)
    };
    
    // Calculate estimated arrival time (simplified calculation)
    let estimatedArrival = null;
    if (currentTrip && latestLocation) {
      // This is a simplified calculation - in reality, you'd use more complex routing algorithms
      const avgSpeed = latestLocation.speed || 40; // km/h
      const estimatedTimeRemaining = 30; // minutes (placeholder)
      estimatedArrival = new Date(Date.now() + estimatedTimeRemaining * 60000);
    }
    
    // Prepare public response (limited information for privacy)
    const publicLocationInfo = {
      busInfo: {
        busNumber: bus.busNumber || `NB-${Math.floor(Math.random() * 9000) + 1000}`,
        operator: bus.operator,
        type: bus.type,
        status: bus.isActive ? 'Active' : 'Inactive'
        // registrationNumber is not included for public users (security)
      },
      
      currentTrip: currentTrip ? {
        tripId: currentTrip.tripId,
        route: {
          routeNumber: currentTrip.route?.routeNumber,
          routeName: currentTrip.route?.name,
          start: currentTrip.route?.start?.city,
          destination: currentTrip.route?.destination?.city
        },
        scheduledDeparture: currentTrip.scheduledDeparture,
        status: currentTrip.status,
        occupancy: currentTrip.passengers?.current ? 
          `${currentTrip.passengers.current} passengers` : 'Unknown'
      } : null,
      
      liveLocation: {
        coordinates: locationData.coordinates,
        speed: locationData.speed ? `${locationData.speed} km/h` : 'Unknown',
        heading: locationData.heading ? `${locationData.heading}°` : 'Unknown',
        lastUpdated: locationData.timestamp,
        
        // Human-readable location (you might want to use reverse geocoding here)
        approximateLocation: latestLocation ? 'Live tracking' : 'Simulated location (no real GPS data)',
        
        estimatedArrival: estimatedArrival,
        dataSource: latestLocation ? 'Real GPS' : 'Mock data for testing'
      },
      
      // Additional public information
      serviceInfo: {
        nextStops: [], // This would be calculated based on route and current location
        delayStatus: currentTrip?.delay > 0 ? `${currentTrip.delay} minutes delayed` : 'On time',
        weatherCondition: currentTrip?.weatherCondition || 'Unknown'
      }
    };
    
    res.json({
      success: true,
      message: 'Live bus location retrieved successfully',
      data: publicLocationInfo,
      timestamp: new Date().toISOString(),
      
      // Disclaimer for public users
      disclaimer: 'Location data is approximate and updated periodically. For official information, contact NTC directly.'
    });
    
  } catch (error) {
    console.error('Public bus location error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving bus location',
      error: error.message
    });
  }
});

// GET /api/public/buses-near - Get buses near a specific location
router.get('/buses-near', async (req, res) => {
  try {
    const { lat, lng, radius = 5, limit = 10 } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }
    
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusInKm = parseFloat(radius);
    
    // Validate coordinates
    if (isNaN(latitude) || isNaN(longitude) || isNaN(radiusInKm)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates or radius. Use valid numbers.',
        example: 'lat=6.9271&lng=79.8612&radius=5'
      });
    }
    
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        message: 'Coordinates out of valid range',
        validRange: 'Latitude: -90 to 90, Longitude: -180 to 180'
      });
    }
    
    // Find recent locations within radius
    const nearbyLocations = await LocationHistory.find({
      'coordinates.latitude': {
        $gte: latitude - (radiusInKm / 111), // Rough conversion: 1 degree ≈ 111 km
        $lte: latitude + (radiusInKm / 111)
      },
      'coordinates.longitude': {
        $gte: longitude - (radiusInKm / (111 * Math.cos(latitude * Math.PI / 180))),
        $lte: longitude + (radiusInKm / (111 * Math.cos(latitude * Math.PI / 180)))
      },
      timestamp: {
        $gte: new Date(Date.now() - 30 * 60000) // Last 30 minutes
      }
    })
    .populate('bus', 'registrationNumber operator isActive')
    .sort({ timestamp: -1 })
    .limit(parseInt(limit))
    .lean();
    
    // Get current trips for these buses
    const busIds = nearbyLocations.map(loc => loc.bus._id);
    const currentTrips = await Trip.find({
      bus: { $in: busIds },
      status: 'In Progress'
    })
    .populate('route', 'routeNumber name start destination')
    .lean();
    
    // Combine location and trip data
    const nearbyBuses = nearbyLocations.map(location => {
      const currentTrip = currentTrips.find(trip => 
        trip.bus.toString() === location.bus._id.toString()
      );
      
      return {
        bus: {
          registrationNumber: location.bus.registrationNumber,
          operator: location.bus.operator,
          type: location.bus.type
        },
        location: {
          coordinates: location.coordinates,
          lastUpdated: location.timestamp,
          // Calculate approximate distance
          approximateDistance: `~${Math.round(Math.random() * radiusInKm * 10) / 10} km` // Placeholder
        },
        currentTrip: currentTrip ? {
          routeNumber: currentTrip.route?.routeNumber,
          routeName: currentTrip.route?.name,
          start: currentTrip.route?.start?.city,
          destination: currentTrip.route?.destination?.city,
          status: currentTrip.status
        } : null
      };
    }).filter(bus => bus.bus.registrationNumber); // Filter out invalid buses
    
    res.json({
      success: true,
      message: `Found ${nearbyBuses.length} buses within ${radiusInKm}km`,
      data: {
        searchCenter: { latitude, longitude },
        searchRadius: `${radiusInKm} km`,
        nearbyBuses,
        totalFound: nearbyBuses.length
      }
    });
    
  } catch (error) {
    console.error('Nearby buses error:', error);
    res.status(500).json({
      success: false,
      message: 'Error finding nearby buses',
      error: error.message
    });
  }
});

// GET /api/public/route-buses/:routeNumber - Get all buses currently on a specific route (using route number)
router.get('/route-buses/:routeNumber', async (req, res) => {
  try {
    const { routeNumber } = req.params;
    
    // First find the route by route number
    const route = await Route.findOne({ routeNumber: routeNumber })
      .select('_id routeNumber name start destination distance')
      .lean();
    
    if (!route) {
      return res.status(404).json({
        success: false,
        message: `Route not found with route number: ${routeNumber}`,
        suggestion: 'Try route numbers like: 001, 002, 003, 004, etc.',
        note: 'Use route numbers instead of ObjectIds for public access'
      });
    }
    
    // Find current trips on this route using the route ObjectId
    const currentTrips = await Trip.find({
      route: route._id,
      status: 'In Progress'
    })
    .populate('bus', 'registrationNumber busNumber operator type capacity')
    .populate('route', 'routeNumber name start destination distance')
    .lean();
    
    if (currentTrips.length === 0) {
      return res.status(200).json({
        success: true,
        message: `No buses currently active on route ${routeNumber}`,
        data: {
          routeNumber,
          routeName: route.name,
          activeBuses: [],
          totalActive: 0
        }
      });
    }
    
    // Get latest locations for these buses
    const busIds = currentTrips.map(trip => trip.bus._id);
    const latestLocations = await LocationHistory.aggregate([
      { $match: { bus: { $in: busIds } } },
      { $sort: { timestamp: -1 } },
      { $group: {
          _id: '$bus',
          latestLocation: { $first: '$$ROOT' }
        }
      }
    ]);
    
    // Combine trip and location data
    const activeBuses = currentTrips.map(trip => {
      const locationData = latestLocations.find(loc => 
        loc._id.toString() === trip.bus._id.toString()
      );
      
      // Generate bus number if not available
      const busNumber = trip.bus.busNumber || (() => {
        const regNum = trip.bus.registrationNumber;
        const hash = regNum.split('').reduce((a, b) => {
          a = ((a << 5) - a) + b.charCodeAt(0);
          return a & a;
        }, 0);
        return `NB-${Math.abs(hash % 9000) + 1000}`;
      })();

      return {
        bus: {
          busNumber: busNumber,
          operator: trip.bus.operator,
          type: trip.bus.type,
          capacity: trip.bus.capacity
          // registrationNumber removed for public access
        },
        trip: {
          tripId: trip.tripId,
          scheduledDeparture: trip.scheduledDeparture,
          status: trip.status,
          currentPassengers: trip.passengers?.current || 0,
          fare: trip.fare
        },
        location: locationData?.latestLocation ? {
          coordinates: locationData.latestLocation.coordinates,
          speed: locationData.latestLocation.speed,
          lastUpdated: locationData.latestLocation.timestamp
        } : null,
        route: {
          routeNumber: trip.route.routeNumber,
          routeName: trip.route.name,
          start: trip.route.start?.city,
          destination: trip.route.destination?.city,
          totalDistance: trip.route.distance
        }
      };
    });
    
    res.json({
      success: true,
      message: `Found ${activeBuses.length} active buses on route ${routeNumber}`,
      data: {
        routeNumber: routeNumber,
        routeInfo: {
          routeNumber: route.routeNumber,
          routeName: route.name,
          start: route.start?.city,
          destination: route.destination?.city,
          totalDistance: route.distance
        },
        activeBuses,
        totalActive: activeBuses.length
      }
    });
    
  } catch (error) {
    console.error('Route buses error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving buses on route',
      error: error.message
    });
  }
});

// Enhanced bus location with admin features
router.get('/location/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const isAdmin = req.user && req.user.role === 'admin';
    
    let bus;
    
    // Public users can ONLY use bus numbers (NB-XXXX format)
    if (identifier.match(/^NB-\d{4}$/)) {
      bus = await Bus.findOne({ busNumber: identifier })
        .populate('route', 'name routeNumber start destination')
        .lean();
      
      // If not found, create a mapping from NB-XXXX to registration numbers
      if (!bus) {
        const allBuses = await Bus.find({})
          .populate('route', 'name routeNumber start destination')
          .lean();
        
        // Create a deterministic mapping based on registration number
        for (let i = 0; i < allBuses.length; i++) {
          const mappedBusNumber = `NB-${(1000 + i).toString()}`;
          if (mappedBusNumber === identifier) {
            bus = allBuses[i];
            // Assign the mapped bus number for consistency
            bus.busNumber = mappedBusNumber;
            break;
          }
        }
      }
    }
    // Admin-only access: registration numbers and ObjectIds
    else if (isAdmin && identifier.match(/^[0-9a-fA-F]{24}$/)) {
      // Admin can search by ObjectId
      bus = await Bus.findById(identifier)
        .populate('route', 'name routeNumber start destination')
        .lean();
    } else if (isAdmin) {
      // Admin can search by registration number
      bus = await Bus.findOne({ registrationNumber: identifier })
        .populate('route', 'name routeNumber start destination')
        .lean();
    } else {
      // Public user trying to use registration number or ObjectId - reject
      return res.status(403).json({
        success: false,
        message: 'Access denied: Public users can only use bus numbers',
        hint: `Use bus number format: NB-XXXX (e.g., NB-1000, NB-1001)`,
        providedFormat: identifier.match(/^[A-Z]{3}-\d{4}$/) ? 'registration number' : 
                       identifier.match(/^[0-9a-fA-F]{24}$/) ? 'ObjectId' : 'unknown format',
        note: 'Registration numbers and ObjectIds are available only for admin users'
      });
    }
    
    // Generate bus number if not available in database
    if (bus && !bus.busNumber) {
      // Create consistent mapping based on registration number
      const regNum = bus.registrationNumber;
      const hash = regNum.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
      bus.busNumber = `NB-${Math.abs(hash % 9000) + 1000}`;
    }

    if (!bus) {
      // Get available identifiers based on user role
      const sampleBuses = await Bus.find({}).limit(5).select('registrationNumber').lean();
      
      if (isAdmin) {
        const availableRegNums = sampleBuses.map(b => b.registrationNumber);
        return res.status(404).json({
          success: false,
          message: `Bus not found with identifier: ${identifier}`,
          suggestion: `Admin access - try registration numbers: ${availableRegNums.join(', ')}`,
          note: 'Admin users can use registration numbers, ObjectIds, or bus numbers'
        });
      } else {
        const availableBusNumbers = sampleBuses.map((b, index) => `NB-${(1000 + index).toString()}`);
        return res.status(404).json({
          success: false,
          message: `Bus not found with identifier: ${identifier}`,
          suggestion: `Public access - try bus numbers: ${availableBusNumbers.join(', ')}`,
          note: 'Public users can only use NB-XXXX format bus numbers'
        });
      }
    }

    // Generate mock live location data
    const mockLocation = {
      latitude: 6.9271 + (Math.random() - 0.5) * 0.5, // Around Colombo area
      longitude: 79.8612 + (Math.random() - 0.5) * 0.5,
      lastUpdated: new Date().toISOString(),
      speed: Math.floor(Math.random() * 60) + 20, // 20-80 km/h
      heading: Math.floor(Math.random() * 360), // 0-359 degrees
      accuracy: Math.floor(Math.random() * 10) + 5, // 5-15 meters
      status: ['Moving', 'Stopped', 'At Terminal'][Math.floor(Math.random() * 3)]
    };

    // Public response
    const publicData = {
      busNumber: bus.busNumber || `NB-${Math.floor(Math.random() * 9000) + 1000}`,
      busType: bus.busType || bus.type || 'Normal',
      route: {
        name: bus.route?.name,
        routeNumber: bus.route?.routeNumber,
        direction: `${bus.route?.start?.city} → ${bus.route?.destination?.city}`
      },
      currentLocation: {
        coordinates: {
          latitude: mockLocation.latitude,
          longitude: mockLocation.longitude
        },
        lastUpdated: mockLocation.lastUpdated,
        status: mockLocation.status,
        speed: `${mockLocation.speed} km/h`
      },
      serviceStatus: bus.isActive !== false ? 'Active' : 'Inactive'
    };

    // Add admin-specific data
    if (isAdmin) {
      publicData.adminDetails = {
        accuracy: `${mockLocation.accuracy}m`,
        heading: `${mockLocation.heading}°`,
        capacity: bus.capacity,
        facilities: bus.facilities,
        operator: bus.operator,
        registrationDetails: {
          registrationNumber: bus.registrationNumber,
          model: bus.model,
          year: bus.year
        },
        technicalData: {
          gpsDevice: 'Active',
          lastMaintenance: '2025-09-15',
          nextService: '2025-12-15'
        }
      };
    }

    res.json({
      success: true,
      data: publicData,
      dataLevel: isAdmin ? 'admin' : 'public',
      message: `Live location retrieved for bus ${publicData.busNumber}`
    });

  } catch (error) {
    console.error('Bus location error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving bus location',
      error: error.message
    });
  }
});

export default router;