import express from 'express';
import BusController from '../controllers/busController.js';
import { protect, authorize, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * /buses:
 *   get:
 *     tags: [Buses]
 *     summary: Get all buses
 *     description: Retrieve list of all buses with optional filtering and pagination
 *     security: 
 *       - BearerAuth: []
 *       - {}
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - name: status
 *         in: query
 *         description: Filter by bus status
 *         schema:
 *           type: string
 *           enum: [Active, Maintenance, Out of Service]
 *       - name: busType
 *         in: query
 *         description: Filter by bus type
 *         schema:
 *           type: string
 *           enum: [Normal, Semi-Luxury, Luxury, Express, Intercity]
 *       - name: operator
 *         in: query
 *         description: Filter by operator name
 *         schema:
 *           type: string
 *       - name: route
 *         in: query
 *         description: Filter by route number
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of buses retrieved successfully
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
 *                         buses:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Bus'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */

/**
 * @swagger
 * /buses/{id}:
 *   get:
 *     tags: [Buses]
 *     summary: Get bus by ID
 *     description: Retrieve detailed information about a specific bus (Admin only)
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Bus details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Bus'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */

/**
 * @swagger
 * /buses/{id}/location:
 *   get:
 *     tags: [Buses]
 *     summary: Get bus current location
 *     description: Get real-time location of a specific bus
 *     security: 
 *       - BearerAuth: []
 *       - {}
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
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
 *                         busId:
 *                           type: string
 *                         registrationNumber:
 *                           type: string
 *                         currentLocation:
 *                           $ref: '#/components/schemas/Location'
 *                         isOnline:
 *                           type: boolean
 *                         lastUpdate:
 *                           type: string
 *                           format: date-time
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */

/**
 * @swagger
 * /buses/{id}/trips:
 *   get:
 *     tags: [Buses]
 *     summary: Get bus trip history
 *     description: Get list of trips for a specific bus
 *     security: 
 *       - BearerAuth: []
 *       - {}
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - name: status
 *         in: query
 *         description: Filter trips by status
 *         schema:
 *           type: string
 *           enum: [Scheduled, In Progress, Completed, Cancelled, Delayed]
 *       - name: date
 *         in: query
 *         description: Filter trips by date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Bus trips retrieved successfully
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
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */

/**
 * @swagger
 * /buses:
 *   post:
 *     tags: [Buses]
 *     summary: Create new bus
 *     description: Add a new bus to the fleet (Admin/Operator only)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - busNumber
 *               - registrationNumber
 *               - busType
 *               - capacity
 *             properties:
 *               busNumber:
 *                 type: string
 *                 example: "NB-1501"
 *               registrationNumber:
 *                 type: string
 *                 pattern: '^[A-Z]{2,3}-\\d{4}$'
 *                 example: "CAA-5678"
 *               busType:
 *                 type: string
 *                 enum: [Normal, Semi-Luxury, Luxury, Express, Intercity]
 *                 example: "Express"
 *               capacity:
 *                 type: integer
 *                 minimum: 10
 *                 maximum: 100
 *                 example: 50
 *               operator:
 *                 $ref: '#/components/schemas/BusOperator'
 *               facilities:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [AC, WiFi, USB Charging, Reclining Seats, Entertainment]
 *                 example: ["AC", "WiFi"]
 *     responses:
 *       201:
 *         description: Bus created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Bus'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */

/**
 * @swagger
 * /buses/{id}:
 *   put:
 *     tags: [Buses]
 *     summary: Update bus
 *     description: Update bus information (Admin/Operator only)
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               busType:
 *                 type: string
 *                 enum: [Normal, Semi-Luxury, Luxury, Express, Intercity]
 *               capacity:
 *                 type: integer
 *                 minimum: 10
 *                 maximum: 100
 *               status:
 *                 type: string
 *                 enum: [Active, Maintenance, Out of Service]
 *               facilities:
 *                 type: array
 *                 items:
 *                   type: string
 *               operator:
 *                 $ref: '#/components/schemas/BusOperator'
 *     responses:
 *       200:
 *         description: Bus updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *   delete:
 *     tags: [Buses]
 *     summary: Delete bus
 *     description: Remove bus from fleet (Admin only)
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Bus deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */

// Public routes with optional authentication for role-based filtering
router.get('/', optionalAuth, BusController.getAllBuses);

// Public relational endpoints
router.get('/:id/location', optionalAuth, BusController.getBusLocation);
router.get('/:id/trips', optionalAuth, BusController.getBusTrips);

// Admin-only individual resource access
router.get('/:id', protect, authorize('admin'), BusController.getBus);

// Protected routes
router.use(protect); // All routes below require authentication
router.post('/', authorize('admin', 'operator'), BusController.createBus);
router.put('/:id', authorize('admin', 'operator'), BusController.updateBus);
router.delete('/:id', authorize('admin'), BusController.deleteBus);

export default router;