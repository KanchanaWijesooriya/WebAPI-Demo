import express from 'express';
import TripController from '../controllers/tripController.js';
import { protect, authorize, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * /trips:
 *   get:
 *     tags: [Trips]
 *     summary: Get all trips
 *     description: Retrieve all scheduled trips with optional role-based filtering
 *     security:
 *       - BearerAuth: []
 *       - {}
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - name: status
 *         in: query
 *         description: Filter by trip status
 *         schema:
 *           type: string
 *           enum: [Scheduled, In Progress, Completed, Cancelled, Delayed]
 *       - name: date
 *         in: query
 *         description: Filter by trip date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Trips retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/PaginatedResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         trips:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Trip'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 *   post:
 *     tags: [Trips]
 *     summary: Create new trip
 *     description: Schedule a new bus trip (Admin only)
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [routeId, busId, scheduledDeparture, scheduledArrival]
 *             properties:
 *               routeId:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439011"
 *               busId:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439012"
 *               scheduledDeparture:
 *                 type: string
 *                 format: date-time
 *                 example: "2023-12-01T08:00:00.000Z"
 *               scheduledArrival:
 *                 type: string
 *                 format: date-time
 *                 example: "2023-12-01T11:30:00.000Z"
 *               fare:
 *                 type: number
 *                 example: 150.00
 *               dayType:
 *                 type: string
 *                 enum: [weekday, weekend]
 *     responses:
 *       201:
 *         description: Trip created successfully
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
 *                         trip:
 *                           $ref: '#/components/schemas/Trip'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */

/**
 * @swagger
 * /trips/live:
 *   get:
 *     tags: [Trips]
 *     summary: Get live trips
 *     description: Retrieve currently active/in-progress trips
 *     security:
 *       - BearerAuth: []
 *       - {}
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - name: routeNumber
 *         in: query
 *         description: Filter by route number
 *         schema:
 *           type: string
 *       - name: busType
 *         in: query
 *         description: Filter by bus type
 *         schema:
 *           type: string
 *           enum: [Normal, Semi-Luxury, Luxury, Express, Intercity]
 *     responses:
 *       200:
 *         description: Live trips retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/PaginatedResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         liveTrips:
 *                           type: array
 *                           items:
 *                             allOf:
 *                               - $ref: '#/components/schemas/Trip'
 *                               - type: object
 *                                 properties:
 *                                   currentLocation:
 *                                     type: object
 *                                     properties:
 *                                       coordinates:
 *                                         type: array
 *                                         items:
 *                                           type: number
 *                                       timestamp:
 *                                         type: string
 *                                         format: date-time
 *                         totalLiveTrips:
 *                           type: integer
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */

/**
 * @swagger
 * /trips/date/{date}:
 *   get:
 *     tags: [Trips]
 *     summary: Get trips by date
 *     description: Retrieve all trips scheduled for a specific date
 *     security:
 *       - BearerAuth: []
 *       - {}
 *     parameters:
 *       - name: date
 *         in: path
 *         required: true
 *         description: Date in YYYY-MM-DD format
 *         schema:
 *           type: string
 *           format: date
 *           example: "2023-12-01"
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *     responses:
 *       200:
 *         description: Trips for date retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/PaginatedResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         date:
 *                           type: string
 *                           format: date
 *                         trips:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Trip'
 *                         dayType:
 *                           type: string
 *                           enum: [weekday, weekend]
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */

/**
 * @swagger
 * /trips/route/{routeId}:
 *   get:
 *     tags: [Trips]
 *     summary: Get trips by route
 *     description: Retrieve all trips for a specific route
 *     security:
 *       - BearerAuth: []
 *       - {}
 *     parameters:
 *       - name: routeId
 *         in: path
 *         required: true
 *         description: Route ID
 *         schema:
 *           type: string
 *           example: "507f1f77bcf86cd799439011"
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - name: date
 *         in: query
 *         description: Filter by specific date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Route trips retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/PaginatedResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         route:
 *                           type: object
 *                           properties:
 *                             routeNumber:
 *                               type: string
 *                             startLocation:
 *                               type: string
 *                             endLocation:
 *                               type: string
 *                         trips:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Trip'
 *       404:
 *         description: Route not found
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */

/**
 * @swagger
 * /trips/stats:
 *   get:
 *     tags: [Trips]
 *     summary: Get trip statistics
 *     description: Retrieve comprehensive trip statistics (Admin/Operator only)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: period
 *         in: query
 *         description: Statistics period
 *         schema:
 *           type: string
 *           enum: [today, week, month, year]
 *           default: today
 *       - name: routeId
 *         in: query
 *         description: Filter stats by specific route
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Trip statistics retrieved successfully
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
 *                         period:
 *                           type: string
 *                         totalTrips:
 *                           type: integer
 *                         completedTrips:
 *                           type: integer
 *                         cancelledTrips:
 *                           type: integer
 *                         activeTrips:
 *                           type: integer
 *                         averageOccupancy:
 *                           type: number
 *                         onTimePerformance:
 *                           type: number
 *                         revenueStats:
 *                           type: object
 *                           properties:
 *                             totalRevenue:
 *                               type: number
 *                             averageFare:
 *                               type: number
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */

/**
 * @swagger
 * /trips/{id}:
 *   get:
 *     tags: [Trips]
 *     summary: Get trip by ID
 *     description: Retrieve detailed information about a specific trip (Admin only)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Trip ID
 *         schema:
 *           type: string
 *           example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Trip details retrieved successfully
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
 *                         trip:
 *                           $ref: '#/components/schemas/Trip'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Trip not found
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 *   put:
 *     tags: [Trips]
 *     summary: Update trip
 *     description: Update an existing trip (Admin only)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Trip ID to update
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               scheduledDeparture:
 *                 type: string
 *                 format: date-time
 *               scheduledArrival:
 *                 type: string
 *                 format: date-time
 *               fare:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [Scheduled, In Progress, Completed, Cancelled, Delayed]
 *     responses:
 *       200:
 *         description: Trip updated successfully
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
 *                         trip:
 *                           $ref: '#/components/schemas/Trip'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Trip not found
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 *   delete:
 *     tags: [Trips]
 *     summary: Delete trip
 *     description: Delete a scheduled trip (Admin only)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Trip ID to delete
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Trip deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Trip not found
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */

// Public routes with optional authentication for role-based filtering
router.get('/', optionalAuth, TripController.getAllTrips);
router.get('/live', optionalAuth, TripController.getLiveTrips);
router.get('/date/:date', optionalAuth, TripController.getTripsByDate);
router.get('/route/:routeId', optionalAuth, TripController.getTripsByRoute);

// Admin-only individual resource access
router.get('/:id', protect, authorize('admin'), TripController.getTrip);

// Protected routes (admin/operator)
router.get('/stats', protect, authorize('admin', 'operator'), TripController.getTripStats);

// Admin only routes
router.use(protect); // All routes below require authentication
router.post('/', authorize('admin'), TripController.createTrip);
router.put('/:id', authorize('admin'), TripController.updateTrip);
router.delete('/:id', authorize('admin'), TripController.deleteTrip);

export default router;