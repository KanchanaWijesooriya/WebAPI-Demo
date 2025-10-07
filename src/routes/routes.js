import express from 'express';
import RouteController from '../controllers/routeController.js';
import { protect, authorize, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

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