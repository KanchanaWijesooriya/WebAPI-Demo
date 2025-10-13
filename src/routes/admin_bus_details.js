import express from 'express';
import Bus from '../models/Bus.js';
import { authenticate, authorize } from '../middleware/rbac.js';

const router = express.Router();

/**
 * Admin-only endpoint to get comprehensive bus information including operator contact details
 * GET /api/admin/bus-details/:busId
 */
router.get('/bus-details/:busId', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { busId } = req.params;
    
    // Find bus with all details including route information
    const bus = await Bus.findById(busId)
      .populate('route', 'routeNumber name start destination distance stops')
      .lean();
    
    if (!bus) {
      return res.status(404).json({
        success: false,
        message: 'Bus not found'
      });
    }

    // Get trip information for this bus
    const Trip = (await import('../models/Trip.js')).default;
    const recentTrips = await Trip.find({ bus: busId })
      .populate('route', 'routeNumber name')
      .sort({ scheduledDeparture: -1 })
      .limit(5)
      .lean();

    // Compile comprehensive bus information
    const busDetails = {
      // Basic bus information
      busInfo: {
        id: bus._id,
        busNumber: bus.busNumber,
        registrationNumber: bus.registrationNumber,
        busType: bus.busType,
        capacity: bus.capacity,
        facilities: bus.facilities,
        status: bus.status,
        isOnline: bus.isOnline,
        locationStatus: bus.locationStatus || 'Unknown'
      },
      
      // Operator contact information (main purpose of this endpoint)
      operatorDetails: {
        name: bus.operator.name,
        contactNumber: bus.operator.contactNumber,
        licenseNumber: bus.operator.licenseNumber,
        // Additional operator info that admin might need
        operatorType: bus.operator.name.includes('SLTB') ? 'Government' : 'Private'
      },
      
      // Route information
      routeInfo: bus.route ? {
        id: bus.route._id,
        routeNumber: bus.route.routeNumber,
        name: bus.route.name,
        start: bus.route.start,
        destination: bus.route.destination,
        distance: bus.route.distance,
        totalStops: bus.route.stops?.length || 0
      } : null,
      
      // Current location information
      currentLocation: {
        coordinates: bus.currentLocation.coordinates,
        lastUpdated: bus.currentLocation.lastUpdated,
        accuracy: bus.currentLocation.accuracy,
        speed: bus.currentLocation.speed,
        heading: bus.currentLocation.heading
      },
      
      // Recent trip history
      recentTrips: recentTrips.map(trip => ({
        tripId: trip.tripId,
        scheduledDeparture: trip.scheduledDeparture,
        scheduledArrival: trip.scheduledArrival,
        status: trip.status,
        fare: trip.fare,
        route: trip.route
      })),
      
      // Timestamps
      createdAt: bus.createdAt,
      updatedAt: bus.updatedAt
    };

    res.json({
      success: true,
      message: 'Bus details retrieved successfully',
      data: busDetails,
      adminNote: 'This endpoint provides comprehensive bus information including sensitive operator contact details for administrative purposes only.'
    });

  } catch (error) {
    console.error('Admin bus details error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving bus details',
      error: error.message
    });
  }
});

/**
 * Admin endpoint to get all buses with operator contact information
 * GET /api/admin/buses-with-contacts
 */
router.get('/buses-with-contacts', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { 
      operator,       // Filter by operator name
      status,         // Filter by bus status
      page = 1, 
      limit = 20 
    } = req.query;

    // Build filter
    let filter = {};
    if (operator) {
      filter['operator.name'] = { $regex: operator, $options: 'i' };
    }
    if (status) {
      filter.status = status;
    }

    // Pagination
    const skip = (page - 1) * limit;

    // Get buses with basic information and operator contacts
    const buses = await Bus.find(filter)
      .select('busNumber registrationNumber operator status isOnline busType capacity')
      .sort({ 'operator.name': 1, busNumber: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalBuses = await Bus.countDocuments(filter);

    // Format response for admin view
    const busesWithContacts = buses.map(bus => ({
      id: bus._id,
      busNumber: bus.busNumber,
      registrationNumber: bus.registrationNumber,
      operatorName: bus.operator.name,
      operatorContact: bus.operator.contactNumber,
      operatorLicense: bus.operator.licenseNumber,
      status: bus.status,
      isOnline: bus.isOnline,
      busType: bus.busType,
      capacity: bus.capacity
    }));

    res.json({
      success: true,
      message: 'Buses with operator contacts retrieved successfully',
      data: {
        buses: busesWithContacts,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(totalBuses / limit),
          total: totalBuses,
          hasNext: page * limit < totalBuses,
          hasPrev: page > 1
        }
      },
      adminNote: 'This endpoint provides operator contact information for administrative purposes only.'
    });

  } catch (error) {
    console.error('Admin buses with contacts error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving buses with contacts',
      error: error.message
    });
  }
});

/**
 * Admin endpoint to search buses by operator contact number
 * GET /api/admin/buses-by-contact/:contactNumber
 */
router.get('/buses-by-contact/:contactNumber', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { contactNumber } = req.params;
    
    // Search for buses by operator contact number
    const buses = await Bus.find({
      'operator.contactNumber': { $regex: contactNumber, $options: 'i' }
    })
    .populate('route', 'routeNumber name')
    .lean();

    if (buses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No buses found for this contact number'
      });
    }

    // Group by operator
    const operatorMap = {};
    buses.forEach(bus => {
      const operatorName = bus.operator.name;
      if (!operatorMap[operatorName]) {
        operatorMap[operatorName] = {
          operatorName,
          contactNumber: bus.operator.contactNumber,
          licenseNumber: bus.operator.licenseNumber,
          buses: []
        };
      }
      operatorMap[operatorName].buses.push({
        id: bus._id,
        busNumber: bus.busNumber,
        registrationNumber: bus.registrationNumber,
        status: bus.status,
        isOnline: bus.isOnline,
        route: bus.route
      });
    });

    res.json({
      success: true,
      message: 'Buses found by contact number',
      data: {
        operators: Object.values(operatorMap),
        totalBuses: buses.length,
        searchedContact: contactNumber
      }
    });

  } catch (error) {
    console.error('Admin search by contact error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching buses by contact',
      error: error.message
    });
  }
});

export default router;