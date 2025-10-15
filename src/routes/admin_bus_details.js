import express from 'express';
import Bus from '../models/Bus.js';
import { authenticate, authorize } from '../middleware/rbac.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Admin Bus Details
 *   description: Detailed bus information for administrative purposes
 */

/**
 * @swagger
 * /admin/bus-details/{busId}:
 *   get:
 *     tags: [Admin Bus Details]
 *     summary: Get comprehensive bus details
 *     description: Retrieve detailed bus information including operator contacts and maintenance history (Admin only)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: busId
 *         in: path
 *         required: true
 *         description: Bus ID
 *         schema:
 *           type: string
 *           example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Comprehensive bus details retrieved successfully
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
 *                           allOf:
 *                             - $ref: '#/components/schemas/Bus'
 *                             - type: object
 *                               properties:
 *                                 route:
 *                                   $ref: '#/components/schemas/Route'
 *                         operatorDetails:
 *                           type: object
 *                           properties:
 *                             name:
 *                               type: string
 *                             licenseNumber:
 *                               type: string
 *                             contactInfo:
 *                               type: object
 *                               properties:
 *                                 primary:
 *                                   type: string
 *                                 secondary:
 *                                   type: string
 *                                 emergency:
 *                                   type: string
 *                                 email:
 *                                   type: string
 *                         maintenanceHistory:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               date:
 *                                 type: string
 *                                 format: date
 *                               type:
 *                                 type: string
 *                               description:
 *                                 type: string
 *                               cost:
 *                                 type: number
 *                               nextServiceDue:
 *                                 type: string
 *                                 format: date
 *                         performanceMetrics:
 *                           type: object
 *                           properties:
 *                             totalTrips:
 *                               type: integer
 *                             onTimePerformance:
 *                               type: number
 *                             fuelEfficiency:
 *                               type: number
 *                             customerRating:
 *                               type: number
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Bus not found
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */

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

/**
 * @swagger
 * /admin/operator-contacts:
 *   get:
 *     tags: [Admin]
 *     summary: Get all operator contacts
 *     description: Retrieve all bus operator contact information (Admin only)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         description: Page number
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: limit
 *         in: query
 *         description: Items per page
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Operator contacts retrieved successfully
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
 *                         operators:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               operatorName:
 *                                 type: string
 *                               contactNumber:
 *                                 type: string
 *                               licenseNumber:
 *                                 type: string
 *                               busNumber:
 *                                 type: string
 *                               registrationNumber:
 *                                 type: string
 *                               totalBuses:
 *                                 type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */

/**
 * Admin endpoint to get all operator contacts with bus numbers
 * GET /api/admin/operator-contacts
 */
router.get('/operator-contacts', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    // Get all buses with operator information
    const buses = await Bus.find({})
      .select('busNumber registrationNumber operator status')
      .sort({ 'operator.name': 1, busNumber: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalBuses = await Bus.countDocuments({});

    // Group by operator and include bus numbers
    const operatorMap = {};
    buses.forEach(bus => {
      const operatorName = bus.operator.name;
      if (!operatorMap[operatorName]) {
        operatorMap[operatorName] = {
          operatorName,
          contactNumber: bus.operator.contactNumber,
          licenseNumber: bus.operator.licenseNumber,
          buses: [],
          totalBuses: 0
        };
      }
      operatorMap[operatorName].buses.push({
        busNumber: bus.busNumber,
        registrationNumber: bus.registrationNumber,
        status: bus.status
      });
      operatorMap[operatorName].totalBuses++;
    });

    res.json({
      success: true,
      message: 'Operator contacts retrieved successfully',
      data: {
        operators: Object.values(operatorMap),
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(totalBuses / limit),
          total: totalBuses,
          hasNext: page * limit < totalBuses,
          hasPrev: page > 1
        }
      },
      adminNote: 'This endpoint provides operator contact information including bus numbers for administrative purposes only.'
    });

  } catch (error) {
    console.error('Admin operator contacts error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving operator contacts',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /admin/bus-info/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Get bus information by ID or registration number
 *     description: Retrieve bus information using MongoDB ObjectId or registration number (Admin only)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Bus ObjectId or registration number (e.g., 68e4c9d45ffe5feaaf9ed2b9 or CAA-5678)
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Bus information retrieved successfully
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
 *                           $ref: '#/components/schemas/Bus'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Bus not found
 */

/**
 * Admin endpoint to get bus information by ID or registration number
 * GET /api/admin/bus-info/:id
 */
router.get('/bus-info/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    let bus;
    
    // Check if id is a valid MongoDB ObjectId format
    const isObjectId = /^[a-fA-F0-9]{24}$/.test(id);
    
    if (isObjectId) {
      // Search by MongoDB ObjectId
      bus = await Bus.findById(id)
        .populate('route', 'routeNumber name start destination distance')
        .lean();
    } else {
      // Search by registration number
      bus = await Bus.findOne({ registrationNumber: id.toUpperCase() })
        .populate('route', 'routeNumber name start destination distance')
        .lean();
    }

    if (!bus) {
      return res.status(404).json({
        success: false,
        message: 'Bus not found',
        searchedFor: id,
        searchType: isObjectId ? 'ObjectId' : 'Registration Number'
      });
    }

    // Generate consistent bus number
    const busNumber = bus.busNumber || (() => {
      const regNum = bus.registrationNumber || 'DEFAULT';
      const hash = regNum.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
      return `NB-${Math.abs(hash % 9000) + 1000}`;
    })();

    // Format response for admin
    const busInfo = {
      id: bus._id,
      busNumber: busNumber,
      registrationNumber: bus.registrationNumber,
      busType: bus.busType,
      capacity: bus.capacity,
      status: bus.status,
      isOnline: bus.isOnline,
      
      // Operator information
      operator: {
        name: bus.operator?.name,
        contactNumber: bus.operator?.contactNumber,
        licenseNumber: bus.operator?.licenseNumber,
        email: bus.operator?.email
      },
      
      // Route information
      route: bus.route ? {
        id: bus.route._id,
        routeNumber: bus.route.routeNumber,
        name: bus.route.name,
        start: bus.route.start?.city,
        destination: bus.route.destination?.city,
        distance: bus.route.distance
      } : null,
      
      // Additional admin details
      facilities: bus.facilities,
      lastMaintenance: bus.lastMaintenance,
      currentLocation: bus.currentLocation,
      
      // Timestamps
      createdAt: bus.createdAt,
      updatedAt: bus.updatedAt
    };

    res.json({
      success: true,
      message: 'Bus information retrieved successfully',
      data: {
        bus: busInfo
      },
      searchInfo: {
        searchedFor: id,
        searchType: isObjectId ? 'MongoDB ObjectId' : 'Registration Number',
        found: true
      },
      adminNote: 'This endpoint supports both MongoDB ObjectId and registration number searches for administrative access.'
    });

  } catch (error) {
    console.error('Admin bus info error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving bus information',
      error: error.message
    });
  }
});

export default router;