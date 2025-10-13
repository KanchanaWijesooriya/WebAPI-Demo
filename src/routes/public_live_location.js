import express from 'express';
import Bus from '../models/Bus.js';
import Trip from '../models/Trip.js';
import LocationHistory from '../models/LocationHistory.js';

const router = express.Router();

// GET /api/public/bus-location/:busId - Public endpoint to get live bus location
router.get('/bus-location/:busId', async (req, res) => {
  try {
    const { busId } = req.params;
    
    // Find bus by ID or registration number
    let bus;
    
    // Try to find by MongoDB ObjectId first
    if (busId.match(/^[0-9a-fA-F]{24}$/)) {
      bus = await Bus.findById(busId).select('registrationNumber operator type isActive').lean();
    }
    
    // If not found, try to find by registration number
    if (!bus) {
      bus = await Bus.findOne({ registrationNumber: busId })
        .select('registrationNumber operator type isActive')
        .lean();
    }
    
    if (!bus) {
      return res.status(404).json({
        success: false,
        message: `Bus not found with ID/Registration: ${busId}`,
        availableBuses: 'Try: CAA-5678, CAB-9012, CAC-3456, CAD-7890, or CAE-2468',
        note: 'Use actual bus registration numbers or ObjectIds from database'
      });
    }
    
    if (!bus.isActive) {
      return res.status(200).json({
        success: true,
        message: 'Bus is currently not in service',
        data: {
          busInfo: {
            registrationNumber: bus.registrationNumber,
            operator: bus.operator,
            type: bus.type,
            status: 'Not in service'
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
        registrationNumber: bus.registrationNumber,
        operator: bus.operator,
        type: bus.type,
        status: bus.isActive ? 'Active' : 'Inactive'
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

// GET /api/public/route-buses/:routeId - Get all buses currently on a specific route
router.get('/route-buses/:routeId', async (req, res) => {
  try {
    const { routeId } = req.params;
    
    // Find current trips on this route
    const currentTrips = await Trip.find({
      route: routeId,
      status: 'In Progress'
    })
    .populate('bus', 'registrationNumber operator type capacity')
    .populate('route', 'routeNumber name start destination distance')
    .lean();
    
    if (currentTrips.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No buses currently active on this route',
        data: {
          routeId,
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
      
      return {
        bus: {
          registrationNumber: trip.bus.registrationNumber,
          operator: trip.bus.operator,
          type: trip.bus.type,
          capacity: trip.bus.capacity
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
      message: `Found ${activeBuses.length} active buses on route`,
      data: {
        routeId,
        routeInfo: currentTrips[0]?.route ? {
          routeNumber: currentTrips[0].route.routeNumber,
          routeName: currentTrips[0].route.name,
          start: currentTrips[0].route.start?.city,
          destination: currentTrips[0].route.destination?.city
        } : null,
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
    
    // Check if identifier is MongoDB ObjectId format
    if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
      // Search by ObjectId
      bus = await Bus.findById(identifier)
        .populate('route', 'name routeNumber start destination')
        .lean();
    } else {
      // Search by registration number
      bus = await Bus.findOne({ registrationNumber: identifier })
        .populate('route', 'name routeNumber start destination')
        .lean();
    }

    if (!bus) {
      return res.status(404).json({
        success: false,
        message: `Bus not found with identifier: ${identifier}`,
        suggestion: 'Try using bus registration number (e.g., CAA-5678) or valid ObjectId'
      });
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
      busId: bus._id,
      busNumber: bus.registrationNumber || bus.busNumber,
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