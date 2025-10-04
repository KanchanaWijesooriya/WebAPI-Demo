import express from 'express';
import Route from '../models/Route.js';
import Trip from '../models/Trip.js';

const router = express.Router();

// Import optional auth middleware for role-based filtering
import { optionalAuth } from '../middleware/auth.js';

// Apply optional authentication to all search routes
router.use(optionalAuth);

// Helper function to filter data based on user role
function filterDataForUser(data, isAdmin) {
  if (isAdmin) {
    // Admin: Return all data
    return data;
  }
  
  // Public: Remove internal/sensitive fields
  if (Array.isArray(data)) {
    return data.map(item => filterSingleItem(item, false));
  } else {
    return filterSingleItem(data, false);
  }
}

function filterSingleItem(item, isAdmin) {
  if (!item || typeof item !== 'object') return item;
  
  const filtered = { ...item };
  
  if (!isAdmin) {
    // Remove internal database fields
    delete filtered._id;
    delete filtered.__v;
    delete filtered.createdAt;
    delete filtered.updatedAt;
    delete filtered.isActive;
    
    // Filter route data if present
    if (filtered.route && typeof filtered.route === 'object') {
      delete filtered.route._id;
      delete filtered.route.__v;
      delete filtered.route.createdAt;
      delete filtered.route.updatedAt;
      delete filtered.route.isActive;
    }
    
    // Filter bus data if present
    if (filtered.bus && typeof filtered.bus === 'object') {
      delete filtered.bus._id;
      delete filtered.bus.__v;
      delete filtered.bus.createdAt;
      delete filtered.bus.updatedAt;
      delete filtered.bus.registrationNumber;
      
      // Filter operator data in bus
      if (filtered.bus.operator) {
        delete filtered.bus.operator.licenseNumber;
        delete filtered.bus.operator.contactNumber;
      }
    }
    
    // Remove driver data completely for privacy
    delete filtered.driver;
    
    // Remove sensitive trip fields
    delete filtered.passengers;
    delete filtered.actualArrival;
    delete filtered.actualDeparture;
    delete filtered.delay;
    delete filtered.weatherCondition;
  }
  
  return filtered;
}

// GET /api/search/routes - Simplified route filtering
router.get('/routes', async (req, res) => {
  try {
    const {
      start,        // origin city
      end,          // destination city  
      stops,        // search in intermediate stops
      page = 1,
      limit = 10,
      sortBy = 'distance',
      sortOrder = 'asc'
    } = req.query;

    // Build filter object
    let filter = { isActive: true };
    
    // Filter by start location (origin) - exact match
    if (start) {
      filter['origin.city'] = { $regex: `^${start.trim()}$`, $options: 'i' };
    }
    
    // Filter by end location (destination) - exact match
    if (end) {
      filter['destination.city'] = { $regex: `^${end.trim()}$`, $options: 'i' };
    }
    
    // Filter by intermediate stops
    if (stops) {
      filter['stops.name'] = { $regex: stops, $options: 'i' };
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const routes = await Route.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count
    const totalRoutes = await Route.countDocuments(filter);
    
    // Check if user is admin
    const isAdmin = req.user && req.user.role === 'admin';
    
    // Filter data based on user role
    const filteredRoutes = filterDataForUser(routes, isAdmin);
    
    res.json({
      success: true,
      data: {
        routes: filteredRoutes,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(totalRoutes / limit),
          total: totalRoutes,
          hasNext: page * limit < totalRoutes,
          hasPrev: page > 1
        }
      },
      dataLevel: isAdmin ? 'full' : 'public'
    });

  } catch (error) {
    console.error('Route search error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching routes',
      error: error.message
    });
  }
});

// GET /api/search/trips - Trip filtering with departure time, fare, distance, date
router.get('/trips', async (req, res) => {
  try {
    const {
      start,              // origin city
      end,                // destination city
      departureTime,      // HH:MM format (e.g., "08:30")
      minFare,            
      maxFare,            
      minDistance,        
      maxDistance,        
      date,               // YYYY-MM-DD format
      dayType,            // weekday, weekend, sunday, monday, etc.
      page = 1,
      limit = 10,
      sortBy = 'scheduledDeparture',
      sortOrder = 'asc'
    } = req.query;

    // Build route filter first
    let routeFilter = { isActive: true };
    
    if (start) {
      routeFilter['origin.city'] = { $regex: `^${start.trim()}$`, $options: 'i' };
    }
    
    if (end) {
      routeFilter['destination.city'] = { $regex: `^${end.trim()}$`, $options: 'i' };
    }
    
    // Distance filter for routes
    if (minDistance || maxDistance) {
      routeFilter.distance = {};
      if (minDistance) routeFilter.distance.$gte = parseFloat(minDistance);
      if (maxDistance) routeFilter.distance.$lte = parseFloat(maxDistance);
    }

    // Find matching routes first
    const matchingRoutes = await Route.find(routeFilter).select('_id');
    const routeIds = matchingRoutes.map(route => route._id);

    // Build trip filter
    let tripFilter = {
      route: { $in: routeIds },
      status: { $in: ['Scheduled', 'In Progress'] }
    };

    // Fare filter
    if (minFare || maxFare) {
      tripFilter.fare = {};
      if (minFare) tripFilter.fare.$gte = parseFloat(minFare);
      if (maxFare) tripFilter.fare.$lte = parseFloat(maxFare);
    }

    // Date and day type filtering
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      
      tripFilter.scheduledDeparture = {
        $gte: startDate,
        $lt: endDate
      };
    }

    // Day type filtering (if no specific date provided)
    if (dayType && !date) {
      const today = new Date();
      let targetDate = new Date(today);
      
      if (dayType.toLowerCase() === 'weekend') {
        // Find next weekend (Saturday or Sunday)
        const daysUntilWeekend = (6 - today.getDay()) % 7;
        targetDate.setDate(today.getDate() + daysUntilWeekend);
      } else if (dayType.toLowerCase() === 'weekday') {
        // Find next weekday (Monday to Friday)
        if (today.getDay() === 0) targetDate.setDate(today.getDate() + 1); // Sunday to Monday
        else if (today.getDay() === 6) targetDate.setDate(today.getDate() + 2); // Saturday to Monday
      } else {
        // Specific days (monday, tuesday, etc.)
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const targetDay = days.indexOf(dayType.toLowerCase());
        if (targetDay !== -1) {
          const daysUntilTarget = (targetDay - today.getDay() + 7) % 7;
          targetDate.setDate(today.getDate() + daysUntilTarget);
        }
      }
      
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      tripFilter.scheduledDeparture = {
        $gte: startOfDay,
        $lte: endOfDay
      };
    }

    // Departure time filtering
    if (departureTime) {
      const [hours, minutes] = departureTime.split(':').map(Number);
      
      // If we have a date filter, add time constraint to existing date filter
      if (tripFilter.scheduledDeparture) {
        const baseDate = tripFilter.scheduledDeparture.$gte || new Date();
        const startTime = new Date(baseDate);
        startTime.setHours(hours, minutes, 0, 0);
        
        const endTime = new Date(baseDate);
        endTime.setHours(hours, minutes + 30, 0, 0); // 30 minute window
        
        tripFilter.scheduledDeparture = {
          ...tripFilter.scheduledDeparture,
          $gte: startTime,
          $lte: endTime
        };
      } else {
        // General time filter for any day
        tripFilter.$expr = {
          $and: [
            { $eq: [{ $hour: '$scheduledDeparture' }, hours] },
            { $gte: [{ $minute: '$scheduledDeparture' }, minutes] },
            { $lte: [{ $minute: '$scheduledDeparture' }, minutes + 30] }
          ]
        };
      }
    }

    // Pagination
    const skip = (page - 1) * limit;
    
    // Sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with population (limited fields for privacy)
    const trips = await Trip.find(tripFilter)
      .select('-driver') // Remove driver info for privacy
      .populate('route', 'routeNumber name origin destination distance stops')
      .populate('bus', 'registrationNumber operator type capacity')
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalTrips = await Trip.countDocuments(tripFilter);
    
    // Check if user is admin
    const isAdmin = req.user && req.user.role === 'admin';
    
    // Filter data based on user role
    const filteredTrips = filterDataForUser(trips, isAdmin);
    
    res.json({
      success: true,
      data: {
        trips: filteredTrips,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(totalTrips / limit),
          total: totalTrips,
          hasNext: page * limit < totalTrips,
          hasPrev: page > 1
        },
        filters: {
          route: { start, end, minDistance, maxDistance },
          trip: { departureTime, minFare, maxFare, date, dayType }
        }
      },
      dataLevel: isAdmin ? 'full' : 'public'
    });

  } catch (error) {
    console.error('Trip search error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching trips',
      error: error.message
    });
  }
});

// GET /api/search/combined - Combined route filters with multiple criteria
router.get('/combined', async (req, res) => {
  try {
    const {
      start,
      end,
      stops,
      departureTime,
      minFare,
      maxFare,
      minDistance,
      maxDistance,
      date,
      dayType,
      page = 1,
      limit = 5
    } = req.query;

    // Use both endpoints' logic combined
    let routeFilter = { isActive: true };
    
    if (start) routeFilter['origin.city'] = { $regex: `^${start.trim()}$`, $options: 'i' };
    if (end) routeFilter['destination.city'] = { $regex: `^${end.trim()}$`, $options: 'i' };
    if (stops) routeFilter['stops.name'] = { $regex: stops, $options: 'i' };
    if (minDistance || maxDistance) {
      routeFilter.distance = {};
      if (minDistance) routeFilter.distance.$gte = parseFloat(minDistance);
      if (maxDistance) routeFilter.distance.$lte = parseFloat(maxDistance);
    }

    // Get matching routes
    const routes = await Route.find(routeFilter).lean();
    const routeIds = routes.map(r => r._id);

    // Build trip filter for these routes
    let tripFilter = {
      route: { $in: routeIds },
      status: { $in: ['Scheduled', 'In Progress'] }
    };

    // Apply trip-specific filters
    if (minFare || maxFare) {
      tripFilter.fare = {};
      if (minFare) tripFilter.fare.$gte = parseFloat(minFare);
      if (maxFare) tripFilter.fare.$lte = parseFloat(maxFare);
    }

    // Date/time filters (simplified version)
    if (date || dayType || departureTime) {
      let dateFilter = {};
      
      if (date) {
        const startDate = new Date(date);
        const endDate = new Date(date);
        endDate.setDate(endDate.getDate() + 1);
        dateFilter = { $gte: startDate, $lt: endDate };
      }
      
      if (dateFilter.$gte || dateFilter.$lt) {
        tripFilter.scheduledDeparture = dateFilter;
      }
    }

    // Get trips with populated data (limited fields for privacy)
    const trips = await Trip.find(tripFilter)
      .populate('route', 'routeNumber name origin destination distance stops')
      .populate('bus', 'registrationNumber operator type capacity')
      .populate('driver', 'name employeeId') // Only basic driver info
      .limit(parseInt(limit))
      .lean();

    // Check if user is admin
    const isAdmin = req.user && req.user.role === 'admin';
    
    // Group by route and filter properly
    const routeMap = {};
    routes.forEach(route => {
      const routeTrips = trips.filter(trip => 
        trip.route._id.toString() === route._id.toString()
      );
      
      // Only include routes that have matching trips
      if (routeTrips.length > 0) {
        routeMap[route._id] = {
          ...route,
          availableTrips: routeTrips
        };
      }
    });

    const results = Object.values(routeMap).slice((page - 1) * limit, page * limit);
    
    // Filter data based on user role
    const filteredResults = results.map(result => {
      const filteredResult = filterSingleItem(result, isAdmin);
      if (filteredResult.availableTrips) {
        filteredResult.availableTrips = filterDataForUser(filteredResult.availableTrips, isAdmin);
      }
      return filteredResult;
    });

    res.json({
      success: true,
      data: {
        results: filteredResults,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(routes.length / limit),
          total: routes.length,
          hasNext: page * limit < routes.length,
          hasPrev: page > 1
        },
        summary: {
          routesFound: routes.length,
          tripsFound: trips.length,
          appliedFilters: { start, end, stops, departureTime, minFare, maxFare, minDistance, maxDistance, date, dayType }
        }
      },
      dataLevel: isAdmin ? 'full' : 'public'
    });

  } catch (error) {
    console.error('Combined search error:', error);
    res.status(500).json({
      success: false,
      message: 'Error in combined search',
      error: error.message
    });
  }
});

export default router;