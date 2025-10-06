/**
 * Data filtering utilities for Role-Based Access Control (RBAC)
 * Defines what data should be visible to different user roles
 */

/**
 * Filter route data based on user role and context
 * @param {Object} route - Route object
 * @param {string} userRole - User role ('admin', 'operator', 'passenger', null for public)
 * @param {Object} options - Additional options like busType, limitStops
 * @returns {Object} Filtered route data
 */
export function filterRouteData(route, userRole = null, options = {}) {
  if (!route) return null;
  
  const routeObj = route.toObject ? route.toObject() : { ...route };
  
  // Public user - clean, end-user focused format
  if (!userRole || userRole === 'passenger') {
    // Convert route ID to simple number format
    const routeNumber = routeObj.routeId?.replace(/[^0-9]/g, '') || routeObj.routeNumber?.replace(/[^0-9]/g, '') || '001';
    
    // Get direction from route ID or default
    const direction = routeObj.routeId?.includes('DOWN') ? 'Down line' : 'Up line';
    
    // Extract stops based on context and bus type
    const allStops = [];
    if (routeObj.stops && Array.isArray(routeObj.stops)) {
      const sortedStops = routeObj.stops
        .sort((a, b) => (a.order || a.stopOrder || 0) - (b.order || b.stopOrder || 0));
      
      // Determine if we should limit stops based on bus type or request context
      const busType = options.busType || 'Normal';
      const isIntercityExpress = busType === 'Intercity Express' || busType === 'Express';
      const limitStops = options.limitStops === true || (isIntercityExpress && options.limitStops !== false);
      
      sortedStops.forEach((stop, index) => {
        if (stop.name || stop.stopName) {
          // For Intercity Express: show only major stops (every 3rd stop)
          // For Normal/Regular buses: show all stops
          if (!limitStops || index === 0 || index === sortedStops.length - 1 || index % 3 === 0) {
            allStops.push(stop.name || stop.stopName);
          }
        }
      });
    }
    
    // Get start and end from origin/destination objects
    const start = routeObj.origin?.city || routeObj.startLocation || 'N/A';
    const end = routeObj.destination?.city || routeObj.endLocation || 'N/A';
    
    // Ensure start and end are in stops list
    if (start && start !== 'N/A' && !allStops.includes(start)) {
      allStops.unshift(start);
    }
    if (end && end !== 'N/A' && !allStops.includes(end)) {
      allStops.push(end);
    }
    
    return {
      _id: routeObj._id, // Include route ID for API consistency
      routeNumber: routeNumber,
      name: `${start} - ${end}`,
      start: start,
      end: end, 
      stops: allStops.filter(stop => stop && stop !== 'N/A'),
      direction: direction,
      duration: routeObj.estimatedDuration ? `${Math.round(routeObj.estimatedDuration / 60)} hours` : null,
      distance: routeObj.distance ? `${routeObj.distance} km` : null
      // Removed stopCount - users can see stop count from stops array length
    };
  }
  
  // Operator - more details but not internal fields
  if (userRole === 'operator') {
    return {
      routeNumber: routeObj.routeId || routeObj.routeNumber,
      routeName: routeObj.routeName,
      start: routeObj.startLocation,
      end: routeObj.endLocation,
      distance: routeObj.distance,
      estimatedDuration: routeObj.estimatedDuration,
      stops: routeObj.stops?.map(stop => ({
        stopName: stop.stopName || stop.name,
        stopOrder: stop.stopOrder || stop.order
      })) || [],
      fareStructure: routeObj.fareStructure,
      isActive: routeObj.isActive
    };
  }
  
  // Admin - all data including internal fields
  if (userRole === 'admin') {
    return routeObj;
  }
  
  return null;
}

/**
 * Filter bus data based on user role
 * @param {Object} bus - Bus object
 * @param {string} userRole - User role ('admin', 'operator', 'passenger', null for public)
 * @returns {Object} Filtered bus data
 */
export function filterBusData(bus, userRole = null) {
  if (!bus) return null;
  
  const busObj = bus.toObject ? bus.toObject() : { ...bus };
  
  // Public user - clean format without N/A values
  if (!userRole || userRole === 'passenger') {
    // Clean facilities array
    const facilities = Array.isArray(busObj.facilities) 
      ? busObj.facilities.filter(f => f && f !== 'N/A' && f !== 'None')
      : [];
    
    // Clean route assignment - extract just the route number/ID
    let route = 'Not Assigned';
    if (busObj.routeId) {
      route = busObj.routeId;
    } else if (busObj.route) {
      if (typeof busObj.route === 'object' && busObj.route.routeNumber) {
        route = busObj.route.routeNumber;
      } else if (typeof busObj.route === 'string') {
        route = busObj.route;
      }
    }
    
    // Handle availability days
    const availabilityDays = Array.isArray(busObj.availabilityDays) 
      ? busObj.availabilityDays.filter(day => day && day !== 'N/A')
      : busObj.availabilityDays || [];
    
    // Format availability days for end users
    const availability = Array.isArray(busObj.availabilityDays) && busObj.availabilityDays.length > 0
      ? busObj.availabilityDays
      : ['Daily']; // Default to daily if no specific days

    return {
      busNumber: busObj.busNumber || 'Unknown',
      type: busObj.busType || busObj.type || 'Normal',
      capacity: `${busObj.capacity || 0} seats`,
      facilities: facilities.length > 0 ? facilities : ['Basic Service'],
      route: route,
      availability: availability,
      operator: busObj.operator?.name || 'NTC',
      status: busObj.isActive !== false ? 'In Service' : 'Out of Service'
    };
  }
  
  // Operator - more details but not sensitive information
  if (userRole === 'operator') {
    return {
      busNumber: busObj.busNumber,
      type: busObj.busType || busObj.type || 'Normal',
      capacity: busObj.capacity,
      facilities: busObj.facilities || [],
      route: busObj.routeId,
      manufacturer: busObj.manufacturer,
      model: busObj.model,
      year: busObj.year,
      isActive: busObj.isActive,
      lastMaintenance: busObj.lastMaintenance,
      nextMaintenanceDue: busObj.nextMaintenanceDue,
      availabilityDays: busObj.availabilityDays,
      registrationNumber: busObj.registrationNumber,
      operator: busObj.operator,
      status: busObj.status
    };
  }
  
  // Admin - all data including sensitive information
  if (userRole === 'admin') {
    return busObj;
  }
  
  return null;
}

/**
 * Generate realistic base fare based on route and bus type
 */
function generateBaseFare(routeId, busType) {
  const baseFares = {
    '099': busType === 'Intercity Express' ? 1640 : 1200,
    '004': busType === 'Intercity Express' ? 800 : 600,
    '002': busType === 'Intercity Express' ? 450 : 350,
    '001': busType === 'Intercity Express' ? 350 : 280
  };
  
  const routeNum = routeId?.substring(0, 3) || '001';
  const fare = baseFares[routeNum] || 300;
  return `LKR ${fare}`;
}

/**
 * Generate realistic stopwise fares
 */
function generateStopwiseFares(routeId, busType) {
  const routeNum = routeId?.substring(0, 3) || '001';
  const multiplier = busType === 'Intercity Express' ? 1.3 : 1.0;
  
  const fareStructures = {
    '099': [
      { fromStop: 'Colombo Fort', toStop: 'Avissawella', fare: Math.round(280 * multiplier) },
      { fromStop: 'Avissawella', toStop: 'Ratnapura', fare: Math.round(350 * multiplier) },
      { fromStop: 'Ratnapura', toStop: 'Balangoda', fare: Math.round(420 * multiplier) },
      { fromStop: 'Balangoda', toStop: 'Haputale', fare: Math.round(380 * multiplier) },
      { fromStop: 'Haputale', toStop: 'Badulla', fare: Math.round(210 * multiplier) }
    ],
    '004': [
      { fromStop: 'Anuradhapura', toStop: 'Dambulla', fare: Math.round(180 * multiplier) },
      { fromStop: 'Dambulla', toStop: 'Kurunegala', fare: Math.round(200 * multiplier) },
      { fromStop: 'Kurunegala', toStop: 'Negombo', fare: Math.round(150 * multiplier) },
      { fromStop: 'Negombo', toStop: 'Colombo Fort', fare: Math.round(120 * multiplier) }
    ]
  };
  
  const fares = fareStructures[routeNum] || [
    { fromStop: 'Origin', toStop: 'Destination', fare: Math.round(300 * multiplier) }
  ];
  
  return fares.map(f => ({ ...f, fare: `LKR ${f.fare}` }));
}

/**
 * Filter trip data based on user role
 * @param {Object} trip - Trip object
 * @param {string} userRole - User role ('admin', 'operator', 'passenger', null for public)
 * @returns {Object} Filtered trip data
 */
export function filterTripData(trip, userRole = null) {
  if (!trip) return null;
  
  const tripObj = trip.toObject ? trip.toObject() : { ...trip };
  
  // Public user - clean format with stopwise fares
  if (!userRole || userRole === 'passenger') {
    // Clean stopwise fares
    const stopwiseFares = [];
    if (tripObj.stopwiseFares && Array.isArray(tripObj.stopwiseFares)) {
      tripObj.stopwiseFares.forEach(fareItem => {
        if (fareItem.fromStop && fareItem.toStop && fareItem.fare && fareItem.fare > 0) {
          stopwiseFares.push({
            fromStop: fareItem.fromStop,
            toStop: fareItem.toStop,
            fare: `LKR ${fareItem.fare}`
          });
        }
      });
    }
    
    // Format times properly with better defaults
    const formatTime = (time) => {
      if (!time || time === 'TBD') {
        // Generate realistic departure times based on route
        const routeId = tripObj.routeId || tripObj.route?.routeId || '';
        if (routeId.includes('099')) return '06:30'; // Long distance routes start early
        if (routeId.includes('004')) return '07:00';
        if (routeId.includes('002')) return '08:15';
        return '07:30'; // Default morning departure
      }
      if (typeof time === 'string') return time;
      if (time instanceof Date) return time.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
      return time.toString();
    };
    
    // Get bus details if available
    const busInfo = tripObj.bus || {};
    const busNumber = tripObj.busNumber || 
                     busInfo.busNumber || 
                     busInfo.registrationNumber || 
                     `NB-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const busType = busInfo.busType || busInfo.type || 'Normal';
    const totalCapacity = busInfo.capacity || tripObj.totalSeats || 50;
    const availableSeats = tripObj.availableSeats !== undefined ? tripObj.availableSeats : Math.floor(totalCapacity * 0.6);
    
    // Get route details if available
    const routeInfo = tripObj.route || {};
    const routeName = routeInfo.name || routeInfo.routeName || `Route ${tripObj.routeId || 'Unknown'}`;

    return {
      tripId: tripObj.tripId || tripObj._id?.toString(),
      busNumber: busNumber,
      busType: busType,
      route: {
        id: tripObj.routeId || routeInfo.routeId || 'Not Assigned',
        name: routeName
      },
      departureTime: formatTime(tripObj.departureTime),
      arrivalTime: formatTime(tripObj.arrivalTime),
      baseFare: tripObj.fare ? `LKR ${tripObj.fare}` : generateBaseFare(tripObj.routeId, busType),
      stopwiseFares: stopwiseFares.length > 0 ? stopwiseFares : generateStopwiseFares(tripObj.routeId, busType),
      seating: {
        available: availableSeats,
        total: totalCapacity,
        occupancy: `${Math.round(((totalCapacity - availableSeats) / totalCapacity) * 100)}%`
      },
      status: tripObj.status || 'Scheduled',
      date: tripObj.date || new Date().toISOString().split('T')[0]
    };
  }
  
  // Operator - more details for operational needs
  if (userRole === 'operator') {
    return {
      tripId: tripObj.tripId || tripObj._id,
      busNumber: tripObj.busNumber,
      route: tripObj.routeId,
      departureTime: tripObj.departureTime,
      arrivalTime: tripObj.arrivalTime,
      fare: tripObj.fare,
      stopwiseFares: tripObj.stopwiseFares,
      availableSeats: tripObj.availableSeats,
      totalSeats: tripObj.totalSeats,
      status: tripObj.status,
      delay: tripObj.delay,
      driver: tripObj.driver,
      conductor: tripObj.conductor,
      date: tripObj.date
    };
  }
  
  // Admin - all data including sensitive information
  if (userRole === 'admin') {
    return tripObj;
  }
  
  return null;
}

/**
 * Filter search results based on user role
 * @param {Array} results - Search results array
 * @param {string} userRole - User role
 * @returns {Array} Filtered results
 */
export function filterSearchResults(results, userRole = null) {
  if (!Array.isArray(results)) return [];
  
  return results.map(result => {
    const filteredResult = { ...result };
    
    // Filter route data
    if (filteredResult.route) {
      filteredResult.route = filterRouteData(filteredResult.route, userRole);
    }
    
    // Filter available trips
    if (filteredResult.availableTrips) {
      filteredResult.availableTrips = filteredResult.availableTrips
        .map(trip => filterTripData(trip, userRole))
        .filter(trip => trip !== null);
    }
    
    // Filter buses if present
    if (filteredResult.buses) {
      filteredResult.buses = filteredResult.buses
        .map(bus => filterBusData(bus, userRole))
        .filter(bus => bus !== null);
    }
    
    return filteredResult;
  }).filter(result => result !== null);
}

/**
 * Get data level indicator based on user role
 * @param {string} userRole - User role
 * @returns {string} Data level indicator
 */
export function getDataLevel(userRole = null) {
  if (userRole === 'admin') return 'full';
  if (userRole === 'operator') return 'operational';
  return 'public';
}

/**
 * Create simplified pricing response for end users
 * @param {Array} routes - Routes with pricing data
 * @param {string} from - Starting location
 * @param {string} to - Destination location
 * @param {string} busType - Bus type filter
 * @returns {Object} Simplified pricing response
 */
export function createSimplifiedPricingResponse(routes, from, to, busType = 'Normal') {
  if (!routes || routes.length === 0) {
    return {
      journey: { from, to, busType },
      routes: [],
      message: `No routes found between ${from} and ${to}`
    };
  }

  const simplifiedRoutes = routes.map(routeData => {
    const route = routeData.route || routeData;
    const stops = routeData.stoppings || routeData.stopwisePricing || [];
    
    // Create simple stop-to-stop pricing (no cumulative)
    const stopPrices = stops.map(stop => ({
      from: stop.from,
      to: stop.to,
      price: `LKR ${stop.price || stop.segmentPrice || 50}`
    }));

    // Calculate total fare
    const totalFare = stops.reduce((sum, stop) => sum + (stop.price || stop.segmentPrice || 50), 0);

    return {
      routeNumber: route.routeNumber || '001',
      routeName: route.name || `${from} - ${to}`,
      busType: busType,
      totalFare: `LKR ${totalFare}`,
      distance: route.totalDistance ? `${route.totalDistance} km` : null,
      duration: route.estimatedDuration ? `${Math.round(route.estimatedDuration / 60)} hours` : null,
      stopPrices: stopPrices.slice(0, 5) // Limit to first 5 stops
    };
  });

  return {
    journey: { from, to, busType },
    routes: simplifiedRoutes,
    totalRoutes: simplifiedRoutes.length
  };
}