import express from 'express';
import Route from '../models/Route.js';
import Trip from '../models/Trip.js';
import Bus from '../models/Bus.js';
import { filterRouteData, filterBusData, filterTripData, filterSearchResults, getDataLevel } from '../utils/dataFilters.js';

const router = express.Router();

// Import optional auth middleware for role-based filtering
import { optionalAuth } from '../middleware/auth.js';

// Helper functions for data filtering
const filterDataForUser = (data, isAdmin, excludeStopwiseFares = false) => {
  if (!Array.isArray(data)) return data;
  return data.map(item => {
    if (item.route) {
      const filteredTrip = filterTripData(item, isAdmin ? 'admin' : null);
      // Remove stopwise fares for trip search responses if requested
      if (excludeStopwiseFares && filteredTrip) {
        const { stopwiseFares, ...tripWithoutFares } = filteredTrip;
        return tripWithoutFares;
      }
      return filteredTrip;
    }
    // Check for route objects (they have origin/destination or routeId)
    if (item.origin || item.destination || item.routeId || item.routeNumber) {
      return filterRouteData(item, isAdmin ? 'admin' : null);
    }
    return item;
  });
};

const filterSingleItem = (item, isAdmin) => {
  if (item.start) return filterRouteData(item, isAdmin ? 'admin' : null);
  if (item.route) return filterTripData(item, isAdmin ? 'admin' : null);
  return item;
};

// Apply optional authentication to all search routes
router.use(optionalAuth);

// GET /api/search/routes - Enhanced route filtering with bidirectional support
router.get('/routes', async (req, res) => {
  try {
    const {
      start,        // start city
      end,          // destination city  
      stops,        // search in intermediate stops
      page = 1,
      limit = 10,
      sortBy = 'distance',
      sortOrder = 'asc'
    } = req.query;

    // Helper function to check if route serves the requested journey
    const canServeJourney = (route, startCity, endCity) => {
      if (!startCity && !endCity) return { canServe: true, direction: 'any' };
      
      const routeStops = route.stops || [];
      const allStops = [
        route.origin?.city || route.start?.city,
        ...routeStops.map(stop => stop.name),
        route.destination?.city
      ];
      
      // Check forward direction (start → destination)
      let forwardStartIndex = -1;
      let forwardEndIndex = -1;
      
      // Check reverse direction (destination → start)
      let reverseStartIndex = -1;
      let reverseEndIndex = -1;
      
      allStops.forEach((stop, index) => {
        // Forward direction checks
        if (startCity && stop.toLowerCase().includes(startCity.toLowerCase()) && forwardStartIndex === -1) {
          forwardStartIndex = index;
        }
        if (endCity && stop.toLowerCase().includes(endCity.toLowerCase()) && forwardEndIndex === -1) {
          forwardEndIndex = index;
        }
        
        // Reverse direction checks (for bidirectional routes)
        if (endCity && stop.toLowerCase().includes(endCity.toLowerCase()) && reverseStartIndex === -1) {
          reverseStartIndex = index;
        }
        if (startCity && stop.toLowerCase().includes(startCity.toLowerCase()) && reverseEndIndex === -1) {
          reverseEndIndex = index;
        }
      });
      
      // Only check exact direction matching (start->end)
      // Both locations must be found AND start must come before end in the route
      const exactMatch = forwardStartIndex !== -1 && 
                        forwardEndIndex !== -1 && 
                        forwardStartIndex < forwardEndIndex;
      
      // Return only exact direction matches, no reverse routes
      if (exactMatch) return { canServe: true, direction: 'Down line', priority: 1 };
      
      return { canServe: false, direction: 'none', priority: 99 };
    };

    // Get all active routes first
    let baseFilter = { isActive: true };
    const allRoutes = await Route.find(baseFilter).lean();
    
    let matchingRoutes = [];
    
    // If no specific criteria, return all routes
    if (!start && !end && !stops) {
      matchingRoutes = allRoutes.map(route => ({
        ...route,
        journeyInfo: {
          direction: 'Down line',
          canServe: true,
          matchType: 'all'
        }
      }));
    } else {
      // Filter routes based on criteria
      allRoutes.forEach(route => {
        // Check if route can serve the journey
        const journeyCheck = canServeJourney(route, start, end);
        
        // Check stops if specified
        const stopMatch = !stops || (route.stops && route.stops.some(stop => 
          stop.toLowerCase().includes(stops.toLowerCase())
        ));
        
        if (journeyCheck.canServe && stopMatch) {
          matchingRoutes.push({
            ...route,
            journeyInfo: {
              direction: journeyCheck.direction,
              canServe: true,
              matchType: 'filtered',
              priority: journeyCheck.priority || 1,
              requestedJourney: start && end ? `${start} → ${end}` : null,
              routePath: `${route.origin?.city || route.start?.city || 'Origin'} → ${route.destination?.city || 'Destination'}`,
              intermediateStops: route.stops ? route.stops : []
            }
          });
        }
      });
    }

    // Calculate pagination
    const totalRoutes = matchingRoutes.length;
    const skip = (page - 1) * limit;
    
    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Apply sorting and pagination with relevance priority
    const sortedRoutes = matchingRoutes.sort((a, b) => {
      // First sort by relevance priority (forward direction routes first)
      const priorityA = a.journeyInfo?.priority || 1;
      const priorityB = b.journeyInfo?.priority || 1;
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // Then sort by the requested field
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (sortOrder === 'desc') {
        return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
      }
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    });

    const paginatedRoutes = sortedRoutes.slice(skip, skip + parseInt(limit));
    
    // Check if user is admin
    const isAdmin = req.user && req.user.role === 'admin';
    
    // Filter data based on user role
    const filteredRoutes = filterDataForUser(paginatedRoutes, isAdmin);
    
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
        },
        searchInfo: {
          bidirectionalSupport: true,
          partialJourneySupport: true,
          appliedFilters: { start, end, stops },
          matchingCriteria: start || end || stops ? 'filtered' : 'all'
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

// GET /api/search/buses - Bus filtering by start/end locations and route coverage
router.get('/buses', async (req, res) => {
  try {
    const {
      start,        // origin city
      end,          // destination city
      busType,      // bus type filter
      page = 1,
      limit = 10,
      sortBy = 'busNumber',
      sortOrder = 'asc'
    } = req.query;

    // First find routes that serve the requested journey (exact direction only)
    let routeFilter = { isActive: true };
    let matchingRouteIds = [];

    if (start || end) {
      const routes = await Route.find(routeFilter).lean();
      
      routes.forEach(route => {
        const routeStops = route.stops || [];
        const allStops = [
          route.origin?.city || route.start?.city,
          ...routeStops.map(stop => stop.name),
          route.destination?.city || route.end?.city
        ];
        
        let startIndex = -1;
        let endIndex = -1;
        
        allStops.forEach((stop, index) => {
          if (start && stop && stop.toLowerCase().includes(start.toLowerCase()) && startIndex === -1) {
            startIndex = index;
          }
          if (end && stop && stop.toLowerCase().includes(end.toLowerCase()) && endIndex === -1) {
            endIndex = index;
          }
        });
        
        // Only include routes that serve exact direction (start->end)
        const exactMatch = (!start || startIndex !== -1) && 
                          (!end || endIndex !== -1) && 
                          (startIndex < endIndex || startIndex === -1 || endIndex === -1);
        
        if (exactMatch) {
          matchingRouteIds.push(route._id);
        }
      });
    } else {
      // If no start/end specified, get all route IDs
      const allRoutes = await Route.find(routeFilter).select('_id');
      matchingRouteIds = allRoutes.map(r => r._id);
    }

    // Build bus filter
    let busFilter = { isActive: { $ne: false } };
    
    // Filter by routes that serve the journey
    if (matchingRouteIds.length > 0) {
      busFilter.route = { $in: matchingRouteIds };
    }
    
    // Filter by bus type if specified
    if (busType) {
      busFilter.$or = [
        { busType: { $regex: busType, $options: 'i' } },
        { type: { $regex: busType, $options: 'i' } }
      ];
    }

    // Get total count for pagination
    const totalBuses = await Bus.countDocuments(busFilter);
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with population
    const buses = await Bus.find(busFilter)
      .populate('route', 'name routeNumber origin destination stops')
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Check if user is admin
    const isAdmin = req.user && req.user.role === 'admin';
    const userRole = isAdmin ? 'admin' : null;
    
    // Filter data based on user role
    const filteredBuses = buses.map(bus => filterBusData(bus, userRole));
    
    res.json({
      success: true,
      data: {
        buses: filteredBuses,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(totalBuses / limit),
          total: totalBuses,
          hasNext: page * limit < totalBuses,
          hasPrev: page > 1
        },
        searchInfo: {
          appliedFilters: { start, end, busType },
          matchingRoutes: matchingRouteIds.length,
          requestedJourney: start && end ? `${start} → ${end}` : null
        }
      },
      dataLevel: isAdmin ? 'full' : 'public',
      message: `Found ${filteredBuses.length} buses for your search`
    });

  } catch (error) {
    console.error('Bus search error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching buses',
      error: error.message
    });
  }
});

// GET /api/search/trips - Trip filtering with departure time, fare, distance, date
router.get('/trips', async (req, res) => {
  try {
    const {
      start,              // start city
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

    // Build route filter with flexible city matching (like the route search)
    let routeFilter = { isActive: true };
    
    if (start || end) {
      const orConditions = [];
      
      if (start && end) {
        // Search for routes that serve this journey in either direction
        orConditions.push(
          {
            'start.city': { $regex: start.trim(), $options: 'i' },
            'destination.city': { $regex: end.trim(), $options: 'i' }
          },
          {
            'start.city': { $regex: end.trim(), $options: 'i' },
            'destination.city': { $regex: start.trim(), $options: 'i' }
          },
          {
            'stops.name': { $regex: start.trim(), $options: 'i' },
            'destination.city': { $regex: end.trim(), $options: 'i' }
          },
          {
            'start.city': { $regex: start.trim(), $options: 'i' },
            'stops.name': { $regex: end.trim(), $options: 'i' }
          }
        );
      } else if (start) {
        orConditions.push(
          { 'start.city': { $regex: start.trim(), $options: 'i' } },
          { 'destination.city': { $regex: start.trim(), $options: 'i' } },
          { 'stops.name': { $regex: start.trim(), $options: 'i' } }
        );
      } else if (end) {
        orConditions.push(
          { 'start.city': { $regex: end.trim(), $options: 'i' } },
          { 'destination.city': { $regex: end.trim(), $options: 'i' } },
          { 'stops.name': { $regex: end.trim(), $options: 'i' } }
        );
      }
      
      if (orConditions.length > 0) {
        routeFilter.$or = orConditions;
      }
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

    // Fare filter - handle invalid ranges gracefully
    if (minFare || maxFare) {
      const minFareNum = parseFloat(minFare) || 0;
      const maxFareNum = parseFloat(maxFare) || 10000;
      
      // If minFare > maxFare, swap them or show no results
      if (minFareNum > maxFareNum) {
        console.log(`Invalid fare range: min (${minFareNum}) > max (${maxFareNum})`);
        // Return empty results for invalid ranges
        return res.json({
          success: true,
          data: { trips: [], pagination: { current: 1, pages: 0, total: 0 } },
          message: `Invalid fare range: minimum fare (${minFareNum}) cannot be greater than maximum fare (${maxFareNum})`
        });
      }
      
      tripFilter.fare = {};
      if (minFare) tripFilter.fare.$gte = minFareNum;
      if (maxFare) tripFilter.fare.$lte = maxFareNum;
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
      
      tripFilter.serviceDate = {
        $gte: startOfDay,
        $lte: endOfDay
      };
    }

    // Departure time filtering
    if (departureTime) {
      const [hours, minutes] = departureTime.split(':').map(Number);
      
      // If we have a date filter, add time constraint to existing date filter
      if (tripFilter.serviceDate) {
        const baseDate = tripFilter.serviceDate.$gte || new Date();
        const startTime = new Date(baseDate);
        startTime.setHours(hours, minutes, 0, 0);
        
        const endTime = new Date(baseDate);
        endTime.setHours(hours, minutes + 30, 0, 0); // 30 minute window
        
        // Create a combined filter for date and time
        const combinedStartDate = new Date(tripFilter.serviceDate.$gte);
        combinedStartDate.setHours(hours, minutes, 0, 0);
        
        const combinedEndDate = new Date(tripFilter.serviceDate.$lte);
        combinedEndDate.setHours(hours, minutes + 30, 0, 0);
        
        tripFilter.$and = [
          { serviceDate: tripFilter.serviceDate },
          { departureTime: { $gte: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}` } },
          { departureTime: { $lte: `${hours.toString().padStart(2, '0')}:${(minutes + 30).toString().padStart(2, '0')}` } }
        ];
        delete tripFilter.serviceDate;
      } else {
        // General time filter for any day
        tripFilter.departureTime = {
          $gte: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
          $lte: `${hours.toString().padStart(2, '0')}:${(minutes + 30).toString().padStart(2, '0')}`
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
      .select('-driver -conductor') // Remove driver/conductor info for privacy
      .populate('route', 'name routeId routeNumber startLocation endLocation distance stops')
      .populate('bus', 'registrationNumber busType capacity features')
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalTrips = await Trip.countDocuments(tripFilter);
    
    // Check if user is admin
    const isAdmin = req.user && req.user.role === 'admin';
    
    // Filter data based on user role - exclude stopwise fares for trip search
    const filteredTrips = filterDataForUser(trips, isAdmin, true);
    
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

// GET /api/search/combined - Enhanced search with bidirectional route support and intermediate stops
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

    let matchingRoutes = [];
    
    // Helper function to check if a stop exists in a route's stops array
    const hasStop = (route, stopName) => {
      return route.stops && route.stops.some(stop => 
        stop.name.toLowerCase().includes(stopName.toLowerCase())
      );
    };

    // Helper function to check if route can serve the journey (including partial journeys)
    const canServeJourney = (route, startCity, endCity) => {
      if (!startCity && !endCity) return true;
      
      const routeStops = route.stops || [];
      const allStops = [
        route.start.city,
        ...routeStops.map(stop => stop.name),
        route.destination.city
      ];
      
      let startFound = false;
      let endFound = false;
      let startIndex = -1;
      let endIndex = -1;
      
      // Check if both cities exist in the route (in order)
      allStops.forEach((stop, index) => {
        if (startCity && stop.toLowerCase().includes(startCity.toLowerCase())) {
          if (!startFound) {
            startFound = true;
            startIndex = index;
          }
        }
        if (endCity && stop.toLowerCase().includes(endCity.toLowerCase())) {
          if (!endFound) {
            endFound = true;
            endIndex = index;
          }
        }
      });
      
      // If only start specified, check if start exists
      if (startCity && !endCity) return startFound;
      
      // If only end specified, check if end exists
      if (!startCity && endCity) return endFound;
      
      // If both specified, check if they exist in correct order
      if (startCity && endCity) {
        return startFound && endFound && startIndex < endIndex;
      }
      
      return true;
    };

    // Base filter for active routes
    let baseRouteFilter = { isActive: true };
    
    // Apply distance filters if specified
    if (minDistance || maxDistance) {
      baseRouteFilter.distance = {};
      if (minDistance) baseRouteFilter.distance.$gte = parseFloat(minDistance);
      if (maxDistance) baseRouteFilter.distance.$lte = parseFloat(maxDistance);
    }

    // Get all routes that could potentially match
    const allRoutes = await Route.find(baseRouteFilter).lean();
    
    // Filter routes based on start/end/stops criteria
    if (start || end || stops) {
      allRoutes.forEach(route => {
        // Check direct routes (start to destination)
        const directMatch = (!start || route.start.city.toLowerCase().includes(start.toLowerCase())) &&
                           (!end || route.destination.city.toLowerCase().includes(end.toLowerCase()));
        
        // Check reverse routes (destination to start) - for bidirectional support
        const reverseMatch = (!start || route.destination.city.toLowerCase().includes(start.toLowerCase())) &&
                            (!end || route.start.city.toLowerCase().includes(end.toLowerCase()));
        
        // Check if it's a partial journey within the route
        const partialMatch = canServeJourney(route, start, end);
        
        // Check stops if specified
        const stopMatch = !stops || hasStop(route, stops);
        
        // Include route if any condition matches and stops match
        if ((directMatch || reverseMatch || partialMatch) && stopMatch) {
          // Add direction indicator for user understanding
          let routeDirection = 'forward';
          if (reverseMatch && !directMatch) {
            routeDirection = 'reverse';
          } else if (partialMatch && !directMatch && !reverseMatch) {
            routeDirection = 'partial';
          }
          
          const enhancedRoute = {
            ...route,
            matchType: routeDirection,
            servesJourney: {
              from: start || route.start.city,
              to: end || route.destination.city,
              direction: routeDirection
            }
          };
          
          matchingRoutes.push(enhancedRoute);
        }
      });
    } else {
      // No specific start/end criteria, include all routes
      matchingRoutes = allRoutes.map(route => ({
        ...route,
        matchType: 'all',
        servesJourney: {
          from: route.start.city,
          to: route.destination.city,
          direction: 'forward'
        }
      }));
    }

    // Get route IDs for trip filtering
    const routeIds = matchingRoutes.map(r => r._id);

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

    // Date/time filters
    if (date || dayType || departureTime) {
      let dateFilter = {};
      
      if (date) {
        const startDate = new Date(date);
        const endDate = new Date(date);
        endDate.setDate(endDate.getDate() + 1);
        dateFilter = { $gte: startDate, $lt: endDate };
      }
      
      if (dateFilter.$gte || dateFilter.$lt) {
        tripFilter.serviceDate = dateFilter;
      }
    }

    // Get trips with populated data
    const trips = await Trip.find(tripFilter)
      .populate('route', 'name routeId routeNumber startLocation endLocation distance stops')
      .populate('bus', 'registrationNumber busType capacity features')
      .limit(parseInt(limit) * 2) // Get more trips to ensure we have options
      .lean();

    // Check if user is admin
    const isAdmin = req.user && req.user.role === 'admin';
    
    // Group routes with their trips and add journey information
    const routeMap = {};
    matchingRoutes.forEach(route => {
      const routeTrips = trips.filter(trip => 
        trip.route._id.toString() === route._id.toString()
      );
      
      // Only include routes that have matching trips or show all routes for better UX
      routeMap[route._id] = {
        ...route,
        availableTrips: routeTrips,
        // Enhanced journey information
        journeyInfo: {
          canTravel: true,
          routeDirection: route.matchType,
          fullRoute: `${route.start.city} → ${route.destination.city}`,
          requestedJourney: start && end ? `${start} → ${end}` : null,
          intermediateStops: route.stops ? route.stops.map(stop => stop.name) : [],
          totalDistance: route.distance,
          estimatedDuration: route.estimatedDuration
        }
      };
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
          pages: Math.ceil(matchingRoutes.length / limit),
          total: matchingRoutes.length,
          hasNext: page * limit < matchingRoutes.length,
          hasPrev: page > 1
        },
        summary: {
          routesFound: matchingRoutes.length,
          tripsFound: trips.length,
          searchCriteria: {
            bidirectionalSearch: !!(start && end),
            partialJourneySupport: true,
            intermediateStopSearch: !!stops
          },
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

// GET /api/search/pricing/:from/:to - Get stopwise pricing between two cities
router.get('/pricing/:from/:to', async (req, res) => {
  try {
    const { from, to } = req.params;
    const { busType = 'Normal' } = req.query;
    const isAdmin = req.user && req.user.role === 'admin';

    // Find routes that serve this journey (both directions and intermediate stops)
    const routes = await Route.find({
      $or: [
        {
          'start.city': { $regex: new RegExp(from, 'i') },
          'destination.city': { $regex: new RegExp(to, 'i') }
        },
        {
          'start.city': { $regex: new RegExp(to, 'i') },
          'destination.city': { $regex: new RegExp(from, 'i') }
        },
        {
          'stops.name': { $regex: new RegExp(from, 'i') }
        },
        {
          'stops.name': { $regex: new RegExp(to, 'i') }
        }
      ],
      isActive: true
    });

    if (routes.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No routes found between ${from} and ${to}`,
        suggestion: 'Try searching with shorter city names like "Kandy" instead of "Kandy City"'
      });
    }

    const pricingResults = [];

    // Helper function to calculate distance between coordinates
    const calculateDistance = (coord1, coord2) => {
      if (!coord1 || !coord2 || typeof coord1.latitude !== 'number' || typeof coord2.latitude !== 'number') {
        return 10; // Default distance if coordinates are invalid
      }
      const R = 6371; 
      const dLat = (coord2.latitude - coord1.latitude) * Math.PI / 180;
      const dLon = (coord2.longitude - coord1.longitude) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(coord1.latitude * Math.PI / 180) * Math.cos(coord2.latitude * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    // Helper function to get bus type multiplier
    const getBusTypeMultiplier = (type) => {
      const multipliers = {
        'Normal': 1.0,
        'Express': 1.3,
        'Intercity Express': 1.6,
        'Super Intercity Express': 2.0,
        'Intercity Express': 1.8
      };
      return multipliers[type] || 1.0;
    };

    for (const route of routes) {
      const allStops = [
        { 
          name: route.start.city, 
          order: 0, 
          coordinates: route.start.coordinates,
          isstart: true 
        },
        ...route.stops.sort((a, b) => a.order - b.order),
        { 
          name: route.destination.city, 
          order: route.stops.length + 1, 
          coordinates: route.destination.coordinates,
          isDestination: true 
        }
      ];

      // Find start and end positions
      const startIndex = allStops.findIndex(stop => 
        stop.name.toLowerCase().includes(from.toLowerCase())
      );
      const endIndex = allStops.findIndex(stop => 
        stop.name.toLowerCase().includes(to.toLowerCase())
      );

      if (startIndex === -1 || endIndex === -1 || startIndex === endIndex) continue;

      // Ensure proper order
      const fromIndex = Math.min(startIndex, endIndex);
      const toIndex = Math.max(startIndex, endIndex);
      const isReverse = startIndex > endIndex;

      // Calculate stopwise pricing
      const stopwisePricing = [];
      let cumulativeDistance = 0;
      let cumulativePrice = 0;

      // Pricing parameters - use route's pricing if available
      const baseFare = route.pricingInfo?.baseFare || 50;
      const pricePerKm = route.pricingInfo?.pricePerKm || 4;
      const busTypeMultiplier = getBusTypeMultiplier(busType);

      for (let i = fromIndex; i < toIndex; i++) {
        const currentStop = allStops[i];
        const nextStop = allStops[i + 1];
        
        // Calculate distance between consecutive stops
        const segmentDistance = calculateDistance(
          currentStop.coordinates,
          nextStop.coordinates
        );
        
        cumulativeDistance += segmentDistance;
        
        // Calculate segment price with bus type multiplier and round to end with 5 or 0
        const baseSegmentPrice = Math.max(baseFare * 0.3, segmentDistance * pricePerKm);
        const rawPrice = Math.round(baseSegmentPrice * busTypeMultiplier);
        // Round to nearest 5 or 0
        const remainder = rawPrice % 10;
        const segmentPrice = remainder === 0 || remainder === 5 ? rawPrice : 
          remainder < 3 ? rawPrice - remainder : 
          remainder < 8 ? rawPrice - remainder + 5 : rawPrice - remainder + 10;
        cumulativePrice += segmentPrice;

        stopwisePricing.push({
          from: currentStop.name,
          to: nextStop.name,
          distance: `${Math.round(segmentDistance * 10) / 10} km`,
          fare: `LKR ${segmentPrice}`
        });
      }

      // Add route information
      pricingResults.push({
        route: {
          _id: route._id,
          name: route.name,
          routeNumber: route.routeNumber,
          routeId: route.routeId || `RT-${route.routeNumber}`,
          direction: isReverse ? 'Reverse' : 'Forward'
        },
        journey: {
          from: allStops[fromIndex].name,
          to: allStops[toIndex].name,
          totalFare: `LKR ${cumulativePrice}`,
          busType: busType
        },
        stoppings: stopwisePricing
      });
    }

    if (pricingResults.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No valid routes found for journey ${from} to ${to}`,
        availableRoutes: routes.map(r => ({ 
          name: r.name, 
          start: r.start.city, 
          destination: r.destination.city,
          stops: r.stops.map(s => s.name) 
        }))
      });
    }

    res.json({
      success: true,
      data: {
        journey: { from, to, busType },
        availableRoutes: pricingResults,
        summary: {
          routesFound: pricingResults.length,
          cheapestRoute: pricingResults.reduce((min, route) => 
            route.journey.totalPrice < min.journey.totalPrice ? route : min
          ),
          averagePrice: Math.round(
            pricingResults.reduce((sum, route) => sum + route.journey.totalPrice, 0) / pricingResults.length
          )
        }
      },
      message: 'Stopwise pricing retrieved successfully',
      dataLevel: isAdmin ? 'full' : 'public'
    });

  } catch (error) {
    console.error('Pricing search error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving stopwise pricing',
      error: error.message
    });
  }
});

export default router;