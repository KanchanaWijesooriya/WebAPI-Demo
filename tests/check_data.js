import mongoose from 'mongoose';
import Bus from './src/models/Bus.js';
import Route from './src/models/Route.js';
import Trip from './src/models/Trip.js';
import LocationHistory from './src/models/LocationHistory.js';

async function checkData() {
  try {
    await mongoose.connect('mongodb+srv://chanuka:256523@cluster0.xbji2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');
    console.log('Connected to MongoDB');
    
    // Check Buses
    const buses = await Bus.find().limit(5);
    console.log('\n=== BUSES ===');
    buses.forEach(bus => {
      console.log(`ID: ${bus._id}`);
      console.log(`RegNo: ${bus.registrationNumber}`);
      console.log(`Operator: ${bus.operator?.name || bus.operator}`);
      console.log('---');
    });
    
    // Check Routes
    const routes = await Route.find().limit(3);
    console.log('\n=== ROUTES ===');
    routes.forEach(route => {
      console.log(`ID: ${route._id}`);
      console.log(`Route: ${route.routeNumber} - ${route.name}`);
      console.log(`${route.origin?.city} -> ${route.destination?.city}`);
      console.log('---');
    });
    
    // Check Trips
    const trips = await Trip.find().limit(3);
    console.log('\n=== TRIPS ===');
    trips.forEach(trip => {
      console.log(`ID: ${trip._id}`);
      console.log(`TripID: ${trip.tripId}`);
      console.log(`Fare: ${trip.fare}`);
      console.log(`Bus: ${trip.bus}`);
      console.log(`Route: ${trip.route}`);
      console.log('---');
    });
    
    // Check LocationHistory
    const locations = await LocationHistory.find().limit(2);
    console.log('\n=== LOCATION HISTORY ===');
    locations.forEach(loc => {
      console.log(`Bus: ${loc.bus}`);
      console.log(`Lat: ${loc.latitude}, Lng: ${loc.longitude}`);
      console.log(`Time: ${loc.timestamp}`);
      console.log('---');
    });
    
    // Check counts
    console.log('\n=== COUNTS ===');
    console.log(`Total Buses: ${await Bus.countDocuments()}`);
    console.log(`Total Routes: ${await Route.countDocuments()}`);
    console.log(`Total Trips: ${await Trip.countDocuments()}`);
    console.log(`Total LocationHistory: ${await LocationHistory.countDocuments()}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkData();