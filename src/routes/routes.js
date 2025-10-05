import express from 'express';
import RouteController from '../controllers/routeController.js';
import { protect, authorize, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Public routes with optional authentication for role-based filtering
router.get('/', optionalAuth, RouteController.getAllRoutes);
router.get('/:id', optionalAuth, RouteController.getRoute);
router.get('/:id/buses', optionalAuth, RouteController.getRouteBuses);

// Protected routes (admin only)
router.use(protect); // All routes below require authentication
router.post('/', authorize('admin'), RouteController.createRoute);
router.put('/:id', authorize('admin'), RouteController.updateRoute);
router.delete('/:id', authorize('admin'), RouteController.deleteRoute);

export default router;