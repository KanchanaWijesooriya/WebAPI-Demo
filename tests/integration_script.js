// Integration script for server.js
// Add these imports to your server.js file:

import adminEnhancedRoutes from './routes/admin_enhanced.js';
import publicLiveLocationRoutes from './routes/public_live_location.js';

// Add these route mappings after your existing routes:

// Admin enhanced routes (requires admin authentication)
app.use('/api/admin', adminEnhancedRoutes);

// Public live location routes (no authentication required)
app.use('/api/public', publicLiveLocationRoutes);

/* 
ENDPOINTS CREATED:

=== ADMIN ROUTES (Requires Admin Authentication) ===

1. GET /api/admin/bus-info/:busId
   - Get comprehensive bus information including operator contact details
   - Use bus ObjectId or registration number as busId
   - Returns: bus details, operator contacts (phones, email, address), performance metrics, trip history
   
2. GET /api/admin/operator-contacts?operator=<name>&page=1&limit=10
   - Get all operator contact details
   - Filter by operator name (optional)
   - Returns: grouped operator contacts with their buses

=== PUBLIC ROUTES (No Authentication Required) ===

1. GET /api/public/bus-location/:busId
   - Get live location of any bus (public access)
   - Use bus ObjectId or registration number as busId
   - Returns: current location, trip info, estimated arrival, occupancy status
   
2. GET /api/public/buses-near?lat=6.9271&lng=79.8612&radius=5&limit=10
   - Get buses near a specific location
   - Parameters: lat, lng (required), radius in km (default 5), limit (default 10)
   - Returns: nearby buses with their locations and current trips
   
3. GET /api/public/route-buses/:routeId
   - Get all buses currently active on a specific route
   - Use route ObjectId as routeId
   - Returns: all buses currently running on the route with live locations

=== EXAMPLE USAGE ===

// Admin getting bus details with operator contacts
GET /api/admin/bus-info/67890abcdef123456789
Authorization: Bearer <admin-jwt-token>

// Public getting live location of a bus
GET /api/public/bus-location/NA-1234
// or
GET /api/public/bus-location/67890abcdef123456789

// Public finding buses near Colombo Fort
GET /api/public/buses-near?lat=6.9271&lng=79.8612&radius=3&limit=5

// Public getting all buses on a route
GET /api/public/route-buses/67890abcdef123456789

=== FEATURES IMPLEMENTED ===

ADMIN FEATURES:
- Detailed bus information with operator contact details (phones, emails, addresses)
- Performance metrics and reliability scores
- Trip history and maintenance information
- Operator contact directory with business details
- Admin-only sensitive information access

PUBLIC FEATURES:
- Live bus location tracking
- Current trip information (route, destination, occupancy)
- Nearby buses finder with location-based search
- Route-specific bus tracking
- Estimated arrival times
- Real-time service status updates
- Privacy-friendly public information only

Both features are ready for Postman testing!
*/