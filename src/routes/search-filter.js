import express from 'express';

const router = express.Router();

/**
 * ADVANCED FILTERING ROUTES FOR NTC BUS TRACKING API
 * These routes implement comprehensive filtering capabilities for better user experience
 */

// GET /api/search/routes - Advanced route filtering
router.get('/routes', async (req, res) => {
  try {
    const Route = (await import('../models/Route.js')).default;
    
    // Build filter object from query parameters
    let filter = { isActive: true }; // Only active routes by default
    let sort = {};
    
    // City-based filtering
    if (req.query.origin) {
      filter['origin.city'] = new RegExp(req.query.origin, 'i'); // Case-insensitive search
    }
    
    if (req.query.destination) {
      filter['destination.city'] = new RegExp(req.query.destination, 'i');
    }
    
    // Province-based filtering
    if (req.query.originProvince) {
      filter['origin.province'] = new RegExp(req.query.originProvince, 'i');
    }
    
    if (req.query.destinationProvince) {
      filter['destination.province'] = new RegExp(req.query.destinationProvince, 'i');
    }
    
    // Distance filtering
    if (req.query.maxDistance) {
      filter.distance = { $lte: parseInt(req.query.maxDistance) };
    }
    
    if (req.query.minDistance) {
      filter.distance = { ...filter.distance, $gte: parseInt(req.query.minDistance) };
    }
    
    // Duration filtering (in minutes)
    if (req.query.maxDuration) {
      filter.estimatedDuration = { $lte: parseInt(req.query.maxDuration) };
    }
    
    // Route number search
    if (req.query.routeNumber) {
      filter.routeNumber = new RegExp(req.query.routeNumber, 'i');
    }
    
    // Route name search
    if (req.query.name) {
      filter.name = new RegExp(req.query.name, 'i');
    }
    
    // Sorting options
    if (req.query.sortBy) {
      const sortField = req.query.sortBy;
      const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
      sort[sortField] = sortOrder;
    } else {
      sort = { routeNumber: 1 }; // Default sort by route number
    }
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Execute query
    const routes = await Route.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit);
    
    // Get total count for pagination
    const totalRoutes = await Route.countDocuments(filter);
    const totalPages = Math.ceil(totalRoutes / limit);
    
    // Build response
    res.status(200).json({
      statusCode: 200,
      success: true,
      message: 'Routes filtered successfully',
      data: {
        routes,
        pagination: {
          currentPage: page,
          totalPages,
          totalRoutes,
          routesPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        },
        filters: {
          applied: req.query,
          availableFilters: {
            origin: 'Filter by origin city (e.g., ?origin=Colombo)',
            destination: 'Filter by destination city (e.g., ?destination=Kandy)',
            maxDistance: 'Maximum distance in km (e.g., ?maxDistance=100)',
            minDistance: 'Minimum distance in km (e.g., ?minDistance=50)',
            maxDuration: 'Maximum duration in minutes (e.g., ?maxDuration=180)',
            routeNumber: 'Search by route number (e.g., ?routeNumber=001)',
            name: 'Search by route name (e.g., ?name=Express)',
            sortBy: 'Sort by field (distance, estimatedDuration, routeNumber)',
            sortOrder: 'Sort direction (asc, desc)',
            page: 'Page number for pagination (e.g., ?page=2)',
            limit: 'Results per page (e.g., ?limit=5)'
          }
        }
      }
    });
    
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      success: false,
      message: 'Error filtering routes',
      error: error.message
    });
  }
});

// GET /api/search/buses - Advanced bus filtering
router.get('/buses', async (req, res) => {
  try {
    const Bus = (await import('../models/Bus.js')).default;
    
    let filter = { isActive: true };
    let sort = {};
    
    // Route-based filtering
    if (req.query.routeId) {
      filter.route = req.query.routeId;
    }
    
    // Bus number search
    if (req.query.busNumber) {
      filter.busNumber = new RegExp(req.query.busNumber, 'i');
    }
    
    // Registration number search
    if (req.query.registrationNumber) {
      filter.registrationNumber = new RegExp(req.query.registrationNumber, 'i');
    }
    
    // Capacity filtering
    if (req.query.minCapacity) {
      filter.capacity = { $gte: parseInt(req.query.minCapacity) };
    }
    
    if (req.query.maxCapacity) {
      filter.capacity = { ...filter.capacity, $lte: parseInt(req.query.maxCapacity) };
    }
    
    // Bus type filtering
    if (req.query.busType) {
      filter.busType = new RegExp(req.query.busType, 'i');
    }
    
    // Operator filtering
    if (req.query.operator) {
      filter['operator.name'] = new RegExp(req.query.operator, 'i');
    }
    
    // Status filtering (active/inactive)
    if (req.query.status) {
      filter.isActive = req.query.status === 'active';
    }
    
    // Sorting
    if (req.query.sortBy) {
      const sortField = req.query.sortBy;
      const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
      sort[sortField] = sortOrder;
    } else {
      sort = { busNumber: 1 };
    }
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Execute query with route population
    const buses = await Bus.find(filter)
      .populate('route', 'routeNumber name origin destination')
      .sort(sort)
      .skip(skip)
      .limit(limit);
    
    const totalBuses = await Bus.countDocuments(filter);
    const totalPages = Math.ceil(totalBuses / limit);
    
    res.status(200).json({
      statusCode: 200,
      success: true,
      message: 'Buses filtered successfully',
      data: {
        buses,
        pagination: {
          currentPage: page,
          totalPages,
          totalBuses,
          busesPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        },
        filters: {
          applied: req.query,
          availableFilters: {
            routeId: 'Filter by route ID (e.g., ?routeId=64a7b8c9d1e2f3g4h5i6j7k8)',
            busNumber: 'Search by bus number (e.g., ?busNumber=NB-1501)',
            registrationNumber: 'Search by registration (e.g., ?registrationNumber=CAB-2023)',
            minCapacity: 'Minimum seating capacity (e.g., ?minCapacity=40)',
            maxCapacity: 'Maximum seating capacity (e.g., ?maxCapacity=60)',
            busType: 'Filter by bus type (e.g., ?busType=Express)',
            operator: 'Filter by operator name (e.g., ?operator=SLTB)',
            status: 'Filter by status (active/inactive)',
            sortBy: 'Sort by field (busNumber, capacity, busType)',
            sortOrder: 'Sort direction (asc, desc)',
            page: 'Page number for pagination',
            limit: 'Results per page'
          }
        }
      }
    });
    
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      success: false,
      message: 'Error filtering buses',
      error: error.message
    });
  }
});

// GET /api/search/buses-by-route - Find buses between specific cities
router.get('/buses-by-route', async (req, res) => {
  try {
    const { origin, destination } = req.query;
    
    if (!origin || !destination) {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        message: 'Both origin and destination are required',
        example: '/api/search/buses-by-route?origin=Colombo&destination=Kandy'
      });
    }
    
    const Route = (await import('../models/Route.js')).default;
    const Bus = (await import('../models/Bus.js')).default;
    
    // First find routes that match origin and destination
    const matchingRoutes = await Route.find({
      $and: [
        { 'origin.city': new RegExp(origin, 'i') },
        { 'destination.city': new RegExp(destination, 'i') },
        { isActive: true }
      ]
    });
    
    if (matchingRoutes.length === 0) {
      return res.status(404).json({
        statusCode: 404,
        success: false,
        message: `No routes found between ${origin} and ${destination}`,
        suggestion: 'Try searching with different city names or check available routes'
      });
    }
    
    // Get all buses operating on these routes
    const routeIds = matchingRoutes.map(route => route._id);
    const buses = await Bus.find({
      route: { $in: routeIds },
      isActive: true
    }).populate('route', 'routeNumber name distance estimatedDuration');
    
    res.status(200).json({
      statusCode: 200,
      success: true,
      message: `Found ${buses.length} buses operating between ${origin} and ${destination}`,
      data: {
        searchCriteria: {
          origin,
          destination
        },
        matchingRoutes: matchingRoutes.length,
        availableBuses: buses.length,
        buses: buses.map(bus => ({
          busId: bus._id,
          busNumber: bus.busNumber,
          registrationNumber: bus.registrationNumber,
          capacity: bus.capacity,
          busType: bus.busType,
          operator: bus.operator.name,
          route: {
            routeNumber: bus.route.routeNumber,
            name: bus.route.name,
            distance: bus.route.distance,
            estimatedDuration: bus.route.estimatedDuration
          }
        }))
      }
    });
    
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      success: false,
      message: 'Error searching buses by route',
      error: error.message
    });
  }
});

export default router;