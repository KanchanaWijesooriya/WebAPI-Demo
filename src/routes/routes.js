import express from 'express';
import RouteController from '../controllers/routeController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', RouteController.getAllRoutes);
router.get('/:id', RouteController.getRoute);
router.get('/:id/buses', RouteController.getRouteBuses);

// Protected routes (admin only)
router.use(protect); // All routes below require authentication
router.post('/', authorize('admin'), RouteController.createRoute);
router.put('/:id', authorize('admin'), RouteController.updateRoute);
router.delete('/:id', authorize('admin'), RouteController.deleteRoute);

export default router;