import express from 'express';
import BusController from '../controllers/busController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', BusController.getAllBuses);
router.get('/:id', BusController.getBus);
router.get('/:id/location', BusController.getBusLocation);
router.get('/:id/trips', BusController.getBusTrips);

// Protected routes
router.use(protect); // All routes below require authentication
router.post('/', authorize('admin', 'operator'), BusController.createBus);
router.put('/:id', authorize('admin', 'operator'), BusController.updateBus);
router.delete('/:id', authorize('admin'), BusController.deleteBus);

export default router;