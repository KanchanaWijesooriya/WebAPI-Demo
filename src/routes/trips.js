import express from 'express';
import TripController from '../controllers/tripController.js';
import { protect, authorize, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Public routes with optional authentication for role-based filtering
router.get('/', optionalAuth, TripController.getAllTrips);
router.get('/live', optionalAuth, TripController.getLiveTrips);
router.get('/date/:date', optionalAuth, TripController.getTripsByDate);
router.get('/route/:routeId', optionalAuth, TripController.getTripsByRoute);
router.get('/:id', optionalAuth, TripController.getTrip);

// Protected routes (admin/operator)
router.get('/stats', protect, authorize('admin', 'operator'), TripController.getTripStats);

// Admin only routes
router.use(protect); // All routes below require authentication
router.post('/', authorize('admin'), TripController.createTrip);
router.put('/:id', authorize('admin'), TripController.updateTrip);
router.delete('/:id', authorize('admin'), TripController.deleteTrip);

export default router;