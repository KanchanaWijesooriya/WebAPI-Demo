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
      // Get bus type from populated bus or determine from registration
      let busType = 'Normal';
      if (item.bus && item.bus.busType) {
        busType = item.bus.busType;
      } else {
        // Map bus types based on registration patterns from JSON data
        const reg = item.busRegistration || item.bus?.registrationNumber;
        if (reg) {
          if (reg.includes('CAB') || reg.includes('NB-15')) busType = 'Express';
          else if (reg.includes('NBC') || reg.includes('NB-16')) busType = 'Intercity Express';
        }
      }

      // Return simplified trip data structure
      return {
        tripId: item.tripId,
        busNumber: item.bus ? item.bus.registrationNumber : item.busRegistration,
        busType: busType,
        route: {
          id: item.route.routeId,
          name: item.route.name,
          routeNumber: item.route.routeNumber
        },
        departureTime: item.scheduledDeparture,
        arrivalTime: item.scheduledArrival,
        baseFare: item.fare,
        status: item.status,
        date: item.serviceDate
      };
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
      minDistance,  // minimum route distance
      maxDistance,  // maximum route distance
      page = 1,
      limit = 10,
      sortBy = 'distance',
      sortOrder = 'asc'
    } = req.query;

    const isRouteAdmin = req.user && req.user.role === 'admin';

    // Read JSON files directly for accurate filtering
    const fs = await import('fs');
    const path = await import('path');
    const routesData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/routes.json'), 'utf8'));

    // Helper function to check if route serves the requested journey
    const canServeJourney = (route, startCity, endCity) => {
      if (!startCity && !endCity) return { canServe: true, direction: 'any' };
      
      // Simple matching for start and end cities
      const routeStart = route.start?.city || route.origin?.city || '';
      const routeEnd = route.destination?.city || '';
      
      // Check if route matches start/end criteria
      if (startCity && endCity) {
        // Both start and end specified - check both directions
        const forwardMatch = routeStart.toLowerCase().includes(startCity.toLowerCase()) && 
                           routeEnd.toLowerCase().includes(endCity.toLowerCase());
        const reverseMatch = routeStart.toLowerCase().includes(endCity.toLowerCase()) && 
                           routeEnd.toLowerCase().includes(startCity.toLowerCase());
        return { canServe: forwardMatch || reverseMatch, direction: forwardMatch ? 'forward' : 'reverse' };
      } else if (startCity) {
        // Only start specified
        const match = routeStart.toLowerCase().includes(startCity.toLowerCase()) || 
                     routeEnd.toLowerCase().includes(startCity.toLowerCase());
        return { canServe: match, direction: 'partial' };
      } else if (endCity) {
        // Only end specified  
        const match = routeStart.toLowerCase().includes(endCity.toLowerCase()) || 
                     routeEnd.toLowerCase().includes(endCity.toLowerCase());
        return { canServe: match, direction: 'partial' };
      }
      
      return { canServe: false, direction: 'none' };
    };

    // Filter routes from JSON data with STRICT distance filtering
    let filteredRoutes = routesData.filter(route => {
      // Distance filtering - STRICT enforcement
      if (minDistance && route.distance < parseFloat(minDistance)) return false;
      if (maxDistance && route.distance > parseFloat(maxDistance)) return false;
      
      // City filtering - use partial matching
      if (start && end) {
        const matchesStartEnd = (route.start.city.toLowerCase().includes(start.toLowerCase()) && route.destination.city.toLowerCase().includes(end.toLowerCase())) ||
                               (route.start.city.toLowerCase().includes(end.toLowerCase()) && route.destination.city.toLowerCase().includes(start.toLowerCase()));
        if (!matchesStartEnd) return false;
      } else if (start) {
        const matchesStart = route.start.city.toLowerCase().includes(start.toLowerCase()) || route.destination.city.toLowerCase().includes(start.toLowerCase());
        if (!matchesStart) return false;
      } else if (end) {
        const matchesEnd = route.start.city.toLowerCase().includes(end.toLowerCase()) || route.destination.city.toLowerCase().includes(start.toLowerCase());
        if (!matchesEnd) return false;
      }

      // Stops filtering
      if (stops) {
        const hasStop = route.stops && route.stops.some(stop => 
          stop.name.toLowerCase().includes(stops.toLowerCase())
        );
        if (!hasStop) return false;
      }

      return true;
    });

    console.log(`🔍 Routes filtered: ${filteredRoutes.length} (minDistance: ${minDistance}, maxDistance: ${maxDistance})`);

    // Add journey info to filtered routes
    let matchingRoutes = filteredRoutes.map(route => ({
      ...route,
      journeyInfo: {
        direction: 'Down line',
        canServe: true,
        matchType: (start || end || stops || minDistance || maxDistance) ? 'filtered' : 'all',
        requestedJourney: start && end ? `${start} → ${end}` : null,
        routePath: `${route.start?.city || 'Origin'} → ${route.destination?.city || 'Destination'}`,
        intermediateStops: route.stops || []
      }
    }));

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
    
    // Filter sensitive data for public users
    const publicFilteredRoutes = paginatedRoutes.map(route => {
      if (isRouteAdmin) {
        // Full data for admin
        return {
          routeId: route.routeId,
          routeNumber: route.routeNumber,
          name: route.name,
          start: route.start,
          destination: route.destination,
          distance: route.distance,
          estimatedDuration: route.estimatedDuration,
          stops: route.stops,
          journeyInfo: route.journeyInfo,
          operationalDetails: {
            frequency: route.frequency,
            operatingHours: route.operatingHours,
            isActive: route.isActive
          }
        };
      } else {
        // Minimal data for public, but include stops when searching by stops
        const publicRoute = {
          routeNumber: route.routeNumber,
          name: route.name,
          start: {
            city: route.start?.city
          },
          destination: {
            city: route.destination?.city
          },
          distance: route.distance
        };
        
        // Include intermediate stops when searching by stops parameter
        if (stops && route.stops && route.stops.length > 0) {
          publicRoute.intermediateStops = route.stops.map(stop => stop.name);
        }
        
        return publicRoute;
      }
    });
    
    res.json({
      success: true,
      data: {
        routes: publicFilteredRoutes,
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
          appliedFilters: { start, end, stops, minDistance, maxDistance },
          matchingCriteria: (start || end || stops || minDistance || maxDistance) ? 'filtered' : 'all',
          distanceFiltering: 'JSON-based strict filtering'
        }
      },
      dataLevel: isRouteAdmin ? 'full' : 'public'
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

// GET /api/search/trips - Enhanced trip filtering with date and day filters
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
      date,               // YYYY-MM-DD format (e.g., "2025-10-07")
      dayType,            // Monday, Tuesday, etc.
      page = 1,
      limit = 100,        // Increased to show more trips by default
      sortBy = 'scheduledDeparture',
      sortOrder = 'asc'
    } = req.query;

    const isAdmin = req.user && req.user.role === 'admin';

    // Read JSON files directly for accurate filtering
    const fs = await import('fs');
    const path = await import('path');
    const routesData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/routes.json'), 'utf8'));
    const tripsData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/trips.json'), 'utf8'));
    const busesData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/buses.json'), 'utf8'));

    console.log(`🔍 TRIPS JSON-ONLY Search - date: ${date}, start: ${start}, end: ${end}, limit: ${limit}`);

    // Step 1: Get all route numbers - show ALL trips by default
    let matchingRouteNumbers = routesData.map(route => route.routeNumber);
    
    // Only filter routes if specific location criteria are provided
    if (start || end) {
      matchingRouteNumbers = routesData
        .filter(route => {
          if (start && end) {
            return (route.start.city.toLowerCase().includes(start.toLowerCase()) && route.destination.city.toLowerCase().includes(end.toLowerCase())) ||
                   (route.start.city.toLowerCase().includes(end.toLowerCase()) && route.destination.city.toLowerCase().includes(start.toLowerCase()));
          } else if (start) {
            return route.start.city.toLowerCase().includes(start.toLowerCase()) || route.destination.city.toLowerCase().includes(start.toLowerCase());
          } else if (end) {
            return route.start.city.toLowerCase().includes(end.toLowerCase()) || route.destination.city.toLowerCase().includes(start.toLowerCase());
          }
          return true;
        })
        .map(route => route.routeNumber);
    }

    // Step 2: Filter trips from JSON data - SHOW ALL TRIPS by default
    let jsonFilteredTrips = tripsData.filter(trip => {
      // Date filtering FIRST - this is the main filter when no location specified
      if (date) {
        const serviceDate = trip.serviceDate;
        const tripDate = new Date(trip.scheduledDeparture).toISOString().split('T')[0];
        if (serviceDate !== date && tripDate !== date) return false;
      }

      // Fare filtering
      if (minFare && trip.fare < parseFloat(minFare)) return false;
      if (maxFare && trip.fare > parseFloat(maxFare)) return false;

      // ONLY apply route filtering if location criteria specified
      if ((start || end)) {
        return matchingRouteNumbers.includes(trip.routeNumber);
      }

      // No location filter = show ALL trips (all routes)
      return true;
    });

    console.log(`🔍 Filtered trips from JSON: ${jsonFilteredTrips.length} trips found`);
    console.log(`🔍 Route breakdown:`, jsonFilteredTrips.reduce((acc, trip) => {
      acc[trip.routeNumber] = (acc[trip.routeNumber] || 0) + 1;
      return acc;
    }, {}));

    // Step 3: Add route and bus information
    const tripsWithDetails = jsonFilteredTrips.map(trip => {
      const route = routesData.find(r => r.routeNumber === trip.routeNumber);
      const bus = busesData.find(b => b.registrationNumber === trip.busRegistration);
      return {
        ...trip,
        routeInfo: route,
        busInfo: bus
      };
    });

    // Step 4: Pagination
    const totalTrips = tripsWithDetails.length;
    const skip = (page - 1) * limit;
    const paginatedTrips = tripsWithDetails.slice(skip, skip + parseInt(limit));

    // Step 5: Format results with security filtering
    const results = paginatedTrips.map(trip => {
      const publicData = {
        tripId: trip.tripId,
        busNumber: trip.busRegistration,
        busType: trip.busInfo?.busType || 'Normal',
        route: {
          id: trip.routeInfo?.routeId || `RT-${trip.routeNumber}`,
          name: trip.routeInfo?.name || 'Unknown Route',
          routeNumber: trip.routeNumber
        },
        departureTime: trip.scheduledDeparture,
        arrivalTime: trip.scheduledArrival,
        baseFare: trip.fare,
        status: trip.status,
        date: trip.serviceDate
      };

      // Only show sensitive data to admin users
      if (isAdmin) {
        publicData.driverInfo = {
          name: trip.driver?.name,
          license: trip.driver?.licenseNumber,
          contact: trip.driver?.contactNumber
        };
        publicData.conductorInfo = {
          name: trip.conductor?.name,
          contact: trip.conductor?.contactNumber
        };
      }

      return publicData;
    });

    res.json({
      success: true,
      data: {
        trips: results,
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
      source: 'JSON files only',
      dataLevel: isAdmin ? 'full' : 'public'
    });

  } catch (error) {
    console.error('🔍 Trip search error:', error);
    res.status(500).json({
      success: false,
      message: 'Error in trip search',
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
      busType,
      minDistance,
      maxDistance,
      date,
      dayType,
      page = 1,
      limit = 5
    } = req.query;

    const isCombinedAdmin = req.user && req.user.role === 'admin';

    // Read JSON files directly for accurate filtering
    const fs = await import('fs');
    const path = await import('path');
    const routesData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/routes.json'), 'utf8'));
    const tripsData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/trips.json'), 'utf8'));
    const busesData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/buses.json'), 'utf8'));

    // Simple combined search using JSON data
    let filteredTrips = tripsData.filter(trip => {
      // Route filtering
      if (start || end) {
        const route = routesData.find(r => r.routeNumber === trip.routeNumber);
        if (!route) return false;
        
        if (start && end) {
          const matchesRoute = (route.start.city.toLowerCase().includes(start.toLowerCase()) && route.destination.city.toLowerCase().includes(end.toLowerCase())) ||
                              (route.start.city.toLowerCase().includes(end.toLowerCase()) && route.destination.city.toLowerCase().includes(start.toLowerCase()));
          if (!matchesRoute) return false;
        } else if (start) {
          const matchesStart = route.start.city.toLowerCase().includes(start.toLowerCase()) || route.destination.city.toLowerCase().includes(start.toLowerCase());
          if (!matchesStart) return false;
        } else if (end) {
          const matchesEnd = route.start.city.toLowerCase().includes(end.toLowerCase()) || route.destination.city.toLowerCase().includes(start.toLowerCase());
          if (!matchesEnd) return false;
        }
      }

      // Fare filtering
      if (minFare && trip.fare < parseFloat(minFare)) return false;
      if (maxFare && trip.fare > parseFloat(maxFare)) return false;

      // Date filtering
      if (date) {
        const tripDate = new Date(trip.scheduledDeparture).toISOString().split('T')[0];
        if (tripDate !== date) return false;
      }

      // Bus type filtering - EXACT MATCH only
      if (busType) {
        const bus = busesData.find(b => b.registrationNumber === trip.busRegistration);
        if (!bus || bus.busType !== busType) return false;
      }

      return ['Scheduled', 'In Progress'].includes(trip.status);
    });

    // Add route and bus information
    const tripsWithDetails = filteredTrips.map(trip => {
      const route = routesData.find(r => r.routeNumber === trip.routeNumber);
      const bus = busesData.find(b => b.registrationNumber === trip.busRegistration);
      return { ...trip, routeInfo: route, busInfo: bus };
    });

    // Deduplicate trips - show only one trip per unique bus
    // Priority: earliest departure time for each bus
    const uniqueTripsMap = new Map();
    
    tripsWithDetails.forEach(trip => {
      const busKey = trip.busRegistration;
      const existingTrip = uniqueTripsMap.get(busKey);
      
      if (!existingTrip || new Date(trip.scheduledDeparture) < new Date(existingTrip.scheduledDeparture)) {
        uniqueTripsMap.set(busKey, trip);
      }
    });

    // Convert map back to array and sort by departure time
    const uniqueTrips = Array.from(uniqueTripsMap.values())
      .sort((a, b) => new Date(a.scheduledDeparture) - new Date(b.scheduledDeparture));

    // Pagination
    const totalTrips = uniqueTrips.length;
    const skip = (page - 1) * limit;
    const paginatedTrips = uniqueTrips.slice(skip, skip + parseInt(limit));

    // Format results
    const combinedResults = paginatedTrips.map(trip => ({
      tripId: trip.tripId,
      busNumber: trip.busRegistration,
      busType: trip.busInfo?.busType || 'Normal',
      route: {
        id: trip.routeInfo?.routeId || `RT-${trip.routeNumber}`,
        name: trip.routeInfo?.name || 'Unknown Route',
        routeNumber: trip.routeNumber
      },
      departureTime: trip.scheduledDeparture,
      arrivalTime: trip.scheduledArrival,
      baseFare: trip.fare,
      status: trip.status,
      date: trip.serviceDate,
      ...(isCombinedAdmin && {
        driverInfo: {
          name: trip.driver?.name,
          license: trip.driver?.licenseNumber,
          contact: trip.driver?.contactNumber
        }
      })
    }));

    res.json({
      success: true,
      data: {
        results: combinedResults,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(totalTrips / limit),
          total: totalTrips
        }
      },
      source: 'JSON files only',
      dataLevel: isCombinedAdmin ? 'full' : 'public'
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

// GET /api/search/pricing - Get pricing between two stops for a specific route
router.get('/pricing', async (req, res) => {
  try {
    const { routeId, fromStop, toStop } = req.query;
    const isAdmin = req.user && req.user.role === 'admin';

    if (!routeId || !fromStop || !toStop) {
      return res.status(400).json({
        success: false,
        message: 'Please provide routeId, fromStop, and toStop parameters',
        example: '/api/search/pricing?routeId=RT-001-UP&fromStop=Colombo&toStop=Kandy'
      });
    }

    // Find the specific route
    const route = await Route.findOne({ routeId: routeId, isActive: true });

    if (!route) {
      return res.status(404).json({
        success: false,
        message: `Route ${routeId} not found`,
        suggestion: 'Check the routeId parameter (e.g., RT-001-UP)'
      });
    }

    // Get all trips for this route to get actual pricing
    const trips = await Trip.find({ 
      routeNumber: route.routeNumber,
      status: { $in: ['Scheduled', 'In Progress'] }
    }).populate('bus', 'registrationNumber busType').lean();

    if (trips.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No active trips found for route ${routeId}`,
        suggestion: 'This route may not have scheduled trips currently'
      });
    }

    // Get unique bus types from the trips
    const busTypes = [...new Set(trips.map(trip => trip.bus?.busType || 'Normal'))];
    const pricingResults = [];

    // Create simple pricing response
    for (const busType of busTypes) {
      const tripWithBusType = trips.find(trip => trip.bus?.busType === busType);
      if (tripWithBusType) {
        pricingResults.push({
          route: {
            id: route.routeId,
            name: route.name,
            routeNumber: route.routeNumber
          },
          journey: {
            from: fromStop,
            to: toStop,
            totalFare: `LKR ${tripWithBusType.fare}`,
            busType: busType
          },
          busNumber: tripWithBusType.bus?.registrationNumber || tripWithBusType.busRegistration
        });
      }
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
        journey: { from, to, busTypes: busTypes },
        availableRoutes: pricingResults,
        summary: {
          routesFound: pricingResults.length,
          busTypesAvailable: busTypes,
          totalCombinations: pricingResults.length,
          cheapestRoute: pricingResults.reduce((min, route) => {
            const minPrice = parseInt(min.journey.totalFare.replace('LKR ', ''));
            const routePrice = parseInt(route.journey.totalFare.replace('LKR ', ''));
            return routePrice < minPrice ? route : min;
          }),
          averagePrice: Math.round(
            pricingResults.reduce((sum, route) => {
              const price = parseInt(route.journey.totalFare.replace('LKR ', ''));
              return sum + price;
            }, 0) / pricingResults.length
          )
        }
      },
      message: 'Stopwise pricing retrieved successfully for all bus types',
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



// GET /api/search/advanced - STRICT JSON-ONLY SEARCH
router.get('/advanced', async (req, res) => {
  try {
    const {
      start,
      end,
      minFare,
      maxFare,
      date,
      dayType,
      page = 1,
      limit = 15
    } = req.query;

    const isAdmin = req.user && req.user.role === 'admin';
    const fs = await import('fs');
    const path = await import('path');
    
    // Read JSON files directly to ensure accuracy
    const routesData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/routes.json'), 'utf8'));
    const tripsData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/trips.json'), 'utf8'));
    const busesData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/buses.json'), 'utf8'));
    
    console.log(`🔍 JSON-ONLY Search - start: ${start}, end: ${end}, minFare: ${minFare}, maxFare: ${maxFare}`);

    // Step 1: Find EXACT matching routes from JSON
    let matchingRouteNumbers = [];
    
    if (start && end) {
      // Find routes that exactly match start->end or end->start
      matchingRouteNumbers = routesData
        .filter(route => 
          (route.start.city === start.trim() && route.destination.city === end.trim()) ||
          (route.start.city === end.trim() && route.destination.city === start.trim())
        )
        .map(route => route.routeNumber);
    } else if (start) {
      // Find routes that start or end with the specified city
      matchingRouteNumbers = routesData
        .filter(route => 
          route.start.city === start.trim() || route.destination.city === start.trim()
        )
        .map(route => route.routeNumber);
    } else if (end) {
      // Find routes that start or end with the specified city
      matchingRouteNumbers = routesData
        .filter(route => 
          route.start.city === end.trim() || route.destination.city === end.trim()
        )
        .map(route => route.routeNumber);
    } else {
      // No location filter, get all route numbers
      matchingRouteNumbers = routesData.map(route => route.routeNumber);
    }

    console.log(`🔍 Matching route numbers from JSON:`, matchingRouteNumbers);

    if (matchingRouteNumbers.length === 0) {
      console.log(`🔍 No routes found for ${start} -> ${end}`);
      return res.json({
        success: true,
        data: { trips: [], pagination: { current: 1, pages: 0, total: 0 } },
        filters: { start, end, minFare, maxFare, date, dayType },
        message: `No routes found for ${start || 'any'} to ${end || 'any'}`
      });
    }

    // Step 2: Filter trips from JSON that match the route numbers
    let filteredTrips = tripsData.filter(trip => {
      // Must match route number
      if (!matchingRouteNumbers.includes(trip.routeNumber)) {
        return false;
      }

      // Must match fare range
      if (minFare && trip.fare < parseFloat(minFare)) return false;
      if (maxFare && trip.fare > parseFloat(maxFare)) return false;

      // Must be scheduled or in progress
      if (!['Scheduled', 'In Progress'].includes(trip.status)) return false;

      return true;
    });

    console.log(`🔍 Filtered trips from JSON: ${filteredTrips.length}`);

    // Step 3: Add route and bus information to trips
    const tripsWithRoutes = filteredTrips.map(trip => {
      const route = routesData.find(r => r.routeNumber === trip.routeNumber);
      const bus = busesData.find(b => b.registrationNumber === trip.busRegistration);
      return {
        ...trip,
        routeInfo: route,
        busInfo: bus
      };
    });

    // Step 4: Apply pagination
    const totalTrips = tripsWithRoutes.length;
    const skip = (page - 1) * limit;
    const paginatedTrips = tripsWithRoutes.slice(skip, skip + parseInt(limit));

    // Step 5: Format results - HIDE SENSITIVE DATA FROM PUBLIC USERS
    const results = paginatedTrips.map(trip => {
      const publicData = {
        tripId: trip.tripId,
        busNumber: trip.busRegistration,
        busType: trip.busInfo?.busType || 'Normal',
        route: {
          id: trip.routeInfo?.routeId || `RT-${trip.routeNumber}`,
          name: trip.routeInfo?.name || 'Unknown Route',
          routeNumber: trip.routeNumber
        },
        departureTime: trip.scheduledDeparture,
        arrivalTime: trip.scheduledArrival,
        baseFare: trip.fare,
        status: trip.status,
        date: trip.serviceDate
      };

      // Only show sensitive data to admin users
      if (isAdmin) {
        publicData.driverInfo = {
          name: trip.driver?.name,
          license: trip.driver?.licenseNumber,
          contact: trip.driver?.contactNumber
        };
        publicData.conductorInfo = {
          name: trip.conductor?.name,
          contact: trip.conductor?.contactNumber
        };
      }

      return publicData;
    });

    console.log(`🔍 Returning ${results.length} JSON-verified results`);

    res.json({
      success: true,
      data: {
        trips: results,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(totalTrips / limit),
          total: totalTrips
        }
      },
      filters: { start, end, minFare, maxFare, date, dayType },
      source: 'JSON files only'
    });

  } catch (error) {
    console.error('🔍 JSON-only search error:', error);
    res.status(500).json({
      success: false,
      message: 'Error in JSON-only search',
      error: error.message
    });
  }
});

export default router;