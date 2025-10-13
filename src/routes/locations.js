import express from 'express';
import LocationController from '../controllers/locationController.js';
import { authenticate, authorize } from '../middleware/rbac.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Location Management
 *   description: Real-time location tracking and management endpoints
 */

/**
 * @swagger
 * /locations/update:
 *   post:
 *     tags: [Location Management]
 *     summary: Update bus location
 *     description: Allows drivers and operators to update real-time bus location with GPS coordinates
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - busRegistration
 *               - latitude
 *               - longitude
 *             properties:
 *               busRegistration:
 *                 type: string
 *                 description: Bus registration number
 *                 example: "CAA-5678"
 *               latitude:
 *                 type: number
 *                 minimum: -90
 *                 maximum: 90
 *                 description: GPS latitude coordinate
 *                 example: 6.9271
 *               longitude:
 *                 type: number
 *                 minimum: -180
 *                 maximum: 180
 *                 description: GPS longitude coordinate
 *                 example: 79.8612
 *               speed:
 *                 type: number
 *                 minimum: 0
 *                 description: Current speed in km/h
 *                 example: 45
 *               heading:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 360
 *                 description: Direction heading in degrees
 *                 example: 180
 *     responses:
 *       200:
 *         description: Location updated successfully
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
 *                         location:
 *                           type: object
 *                           properties:
 *                             coordinates:
 *                               type: object
 *                               properties:
 *                                 latitude:
 *                                   type: number
 *                                 longitude:
 *                                   type: number
 *                             timestamp:
 *                               type: string
 *                               format: date-time
 *                             speed:
 *                               type: number
 *                             heading:
 *                               type: number
 *                         bus:
 *                           type: object
 *                           properties:
 *                             registrationNumber:
 *                               type: string
 *                             isOnline:
 *                               type: boolean
 *                         updatedBy:
 *                           type: object
 *                           properties:
 *                             userId:
 *                               type: string
 *                             role:
 *                               type: string
 *                             username:
 *                               type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Bus not found
 */
router.post('/update', authenticate, authorize(['driver', 'operator', 'admin']), LocationController.updateLocation);

/**
 * @swagger
 * /locations/{busId}/history:
 *   get:
 *     tags: [Location Management]
 *     summary: Get bus location history
 *     description: Retrieve historical location data for a specific bus
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: busId
 *         in: path
 *         required: true
 *         description: Bus ID (ObjectId) or registration number
 *         schema:
 *           type: string
 *           example: "CAA-5678"
 *       - name: limit
 *         in: query
 *         description: Number of records to return
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *       - name: page
 *         in: query
 *         description: Page number for pagination
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *     responses:
 *       200:
 *         description: Location history retrieved successfully
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
 *                         locations:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               coordinates:
 *                                 type: object
 *                                 properties:
 *                                   latitude:
 *                                     type: number
 *                                   longitude:
 *                                     type: number
 *                               timestamp:
 *                                 type: string
 *                                 format: date-time
 *                               speed:
 *                                 type: number
 *                               heading:
 *                                 type: number
 *                               updatedBy:
 *                                 type: object
 *                                 properties:
 *                                   userId:
 *                                     type: string
 *                                   role:
 *                                     type: string
 *                                   username:
 *                                     type: string
 *                         bus:
 *                           type: object
 *                           properties:
 *                             registrationNumber:
 *                               type: string
 *                             currentLocation:
 *                               $ref: '#/components/schemas/Location'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Bus not found
 */
router.get('/:busId/history', authenticate, authorize(['driver', 'operator', 'admin']), LocationController.getLocationHistory);

/**
 * @swagger
 * /locations/current:
 *   get:
 *     tags: [Location Management, Public]
 *     summary: Get current locations of all buses
 *     description: Retrieve current GPS locations of all buses in the system
 *     parameters:
 *       - name: online
 *         in: query
 *         description: Filter by online status
 *         schema:
 *           type: boolean
 *           example: true
 *     responses:
 *       200:
 *         description: Current bus locations retrieved successfully
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
 *                         locations:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               busRegistration:
 *                                 type: string
 *                               type:
 *                                 type: string
 *                               capacity:
 *                                 type: integer
 *                               location:
 *                                 type: object
 *                                 properties:
 *                                   coordinates:
 *                                     type: object
 *                                     properties:
 *                                       latitude:
 *                                         type: number
 *                                       longitude:
 *                                         type: number
 *                                   lastUpdated:
 *                                     type: string
 *                                     format: date-time
 *                                   speed:
 *                                     type: number
 *                                   heading:
 *                                     type: number
 *                               isOnline:
 *                                 type: boolean
 *                         totalBuses:
 *                           type: integer
 *                         onlineBuses:
 *                           type: integer
 */
router.get('/current', LocationController.getCurrentLocations);

export default router;