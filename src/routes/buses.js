import express from 'express';
import BusController from '../controllers/busController.js';
import { protect, authorize, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

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