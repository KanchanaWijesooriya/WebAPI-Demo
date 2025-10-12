import express from 'express';
import RouteController from '../controllers/routeController.js';
import { protect, authorize, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * /routes:
 *   get:
 *     tags: [Routes]
 *     summary: Get all routes
 *     description: Retrieve all bus routes with optional role-based filtering
 *     security:
 *       - BearerAuth: []
 *       - {}
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - name: search
 *         in: query
 *         description: Search term for route filtering
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Routes retrieved successfully
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
 *                         routes:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Route'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 *   post:
 *     tags: [Routes]
 *     summary: Create new route
 *     description: Create a new bus route (Admin only)
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [routeNumber, startLocation, endLocation, stops]
 *             properties:
 *               routeNumber:
 *                 type: string
 *                 example: "001-A"
 *               startLocation:
 *                 type: string
 *                 example: "Colombo Fort"
 *               endLocation:
 *                 type: string
 *                 example: "Kandy Central"
 *               stops:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     sequence:
 *                       type: integer
 *                     fare:
 *                       type: number
 *               distance:
 *                 type: number
 *                 example: 115.5
 *               estimatedDuration:
 *                 type: string
 *                 example: "3h 30m"
 *     responses:
 *       201:
 *         description: Route created successfully
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
 *                         route:
 *                           $ref: '#/components/schemas/Route'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       409:
 *         description: Route number already exists
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */

/**
 * @swagger
 * /routes/pricing/{from}/{to}:
 *   get:
 *     tags: [Routes]
 *     summary: Get stopwise pricing
 *     description: Calculate fare between two stops on any route
 *     security:
 *       - BearerAuth: []
 *       - {}
 *     parameters:
 *       - name: from
 *         in: path
 *         required: true
 *         description: Starting stop name
 *         schema:
 *           type: string
 *           example: "Colombo"
 *       - name: to
 *         in: path
 *         required: true
 *         description: Destination stop name
 *         schema:
 *           type: string
 *           example: "Kandy"
 *       - name: busType
 *         in: query
 *         description: Bus type for specific pricing
 *         schema:
 *           type: string
 *           enum: [Normal, Semi-Luxury, Luxury, Express, Intercity]
 *     responses:
 *       200:
 *         description: Pricing calculated successfully
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
 *                         from:
 *                           type: string
 *                         to:
 *                           type: string
 *                         baseFare:
 *                           type: number
 *                         routes:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               routeNumber:
 *                                 type: string
 *                               fare:
 *                                 type: number
 *                               distance:
 *                                 type: number
 *       404:
 *         description: No routes found between specified stops
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */

/**
 * @swagger
 * /routes/{id}:
 *   get:
 *     tags: [Routes]
 *     summary: Get route by ID
 *     description: Retrieve detailed information about a specific route (Admin only)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Route ID
 *         schema:
 *           type: string
 *           example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Route details retrieved successfully
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
 *                         route:
 *                           $ref: '#/components/schemas/Route'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Route not found
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 *   put:
 *     tags: [Routes]
 *     summary: Update route
 *     description: Update an existing route (Admin only)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Route ID to update
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               routeNumber:
 *                 type: string
 *               startLocation:
 *                 type: string
 *               endLocation:
 *                 type: string
 *               stops:
 *                 type: array
 *                 items:
 *                   type: object
 *               distance:
 *                 type: number
 *               estimatedDuration:
 *                 type: string
 *     responses:
 *       200:
 *         description: Route updated successfully
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
 *                         route:
 *                           $ref: '#/components/schemas/Route'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Route not found
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 *   delete:
 *     tags: [Routes]
 *     summary: Delete route
 *     description: Delete a route (Admin only)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Route ID to delete
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Route deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Route not found
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */

/**
 * @swagger
 * /routes/{id}/buses:
 *   get:
 *     tags: [Routes]
 *     summary: Get buses on route
 *     description: Retrieve all buses operating on a specific route
 *     security:
 *       - BearerAuth: []
 *       - {}
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Route ID
 *         schema:
 *           type: string
 *       - name: status
 *         in: query
 *         description: Filter buses by status
 *         schema:
 *           type: string
 *           enum: [Active, Maintenance, Out of Service]
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *     responses:
 *       200:
 *         description: Route buses retrieved successfully
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
 *                         buses:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Bus'
 *       404:
 *         description: Route not found
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */

// Public routes with optional authentication for role-based filtering
router.get('/', optionalAuth, RouteController.getAllRoutes);
router.get('/pricing/:from/:to', optionalAuth, RouteController.getStopwisePricing);

// Public relational endpoints
router.get('/:id/buses', optionalAuth, RouteController.getRouteBuses);

// Admin-only individual resource access
router.get('/:id', protect, authorize('admin'), RouteController.getRoute);

// Protected routes (admin only)
router.use(protect); // All routes below require authentication
router.post('/', authorize('admin'), RouteController.createRoute);
router.put('/:id', authorize('admin'), RouteController.updateRoute);
router.delete('/:id', authorize('admin'), RouteController.deleteRoute);

export default router;