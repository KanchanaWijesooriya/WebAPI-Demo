import mongoose from 'mongoose';
import Bus from './src/models/Bus.js';
import Route from './src/models/Route.js';
import Trip from './src/models/Trip.js';
import LocationHistory from './src/models/LocationHistory.js';

async function seedMissingData() {
  try {
    await mongoose.connect('mongodb+srv://chanuka:256523@cluster0.xbji2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');
    console.log('Connected to MongoDB');
    
    // Get existing buses and routes
    const buses = await Bus.find().limit(5);
    const routes = await Route.find().limit(3);
    
    console.log(`Found ${buses.length} buses and ${routes.length} routes`);
    
    // Create sample trips
    const trips = [];
    const now = new Date();
    
    for (let i = 0; i < buses.length && i < routes.length; i++) {
      const bus = buses[i];
      const route = routes[i % routes.length];
      
      // Create multiple trips per bus
      for (let j = 0; j < 3; j++) {
        const tripDate = new Date(now.getTime() + (j * 24 * 60 * 60 * 1000)); // Next few days
        const trip = {
          tripId: `TRIP-${bus.registrationNumber}-${String(j + 1).padStart(3, '0')}`,
          bus: bus._id,
          route: route._id,
          scheduledDeparture: new Date(tripDate.setHours(8 + j * 4, 0, 0, 0)),
          scheduledArrival: new Date(tripDate.setHours(8 + j * 4 + 3, 0, 0, 0)),
          driver: {
            name: `Driver ${i + 1}`,
            licenseNumber: `DL-${Math.floor(Math.random() * 90000) + 10000}`,
            contactNumber: `+94-77-${Math.floor(Math.random() * 9000000) + 1000000}`
          },
          status: j === 0 ? 'In Progress' : 'Scheduled',
          fare: Math.floor(Math.random() * 300) + 50, // 50-350 fare range
          passengers: {
            current: j === 0 ? Math.floor(Math.random() * 40) + 10 : 0,
            boardings: Math.floor(Math.random() * 50),
            alightings: Math.floor(Math.random() * 30)
          },
          weatherCondition: 'Clear'
        };
        trips.push(trip);
      }
    }
    
    // Insert trips
    const insertedTrips = await Trip.insertMany(trips);
    console.log(`Created ${insertedTrips.length} trips`);
    
    // Create sample location history
    const locations = [];
    
    for (let i = 0; i < buses.length; i++) {
      const bus = buses[i];
      
      // Create location history for last few hours
      for (let j = 0; j < 10; j++) {
        const location = {
          bus: bus._id,
          coordinates: {
            latitude: 6.9271 + (Math.random() - 0.5) * 0.2, // Around Colombo area
            longitude: 79.8612 + (Math.random() - 0.5) * 0.2
          },
          speed: Math.floor(Math.random() * 80) + 10, // 10-90 km/h
          heading: Math.floor(Math.random() * 360),
          timestamp: new Date(now.getTime() - (j * 10 * 60 * 1000)), // Every 10 minutes back
          accuracy: Math.floor(Math.random() * 20) + 5 // 5-25 meters
        };
        locations.push(location);
      }
    }
    
    // Insert location history
    const insertedLocations = await LocationHistory.insertMany(locations);
    console.log(`Created ${insertedLocations.length} location records`);
    
    console.log('Sample data creation completed!');
    
    // Show summary
    console.log('\n=== SUMMARY ===');
    console.log(`Total Buses: ${await Bus.countDocuments()}`);
    console.log(`Total Routes: ${await Route.countDocuments()}`);
    console.log(`Total Trips: ${await Trip.countDocuments()}`);
    console.log(`Total LocationHistory: ${await LocationHistory.countDocuments()}`);
    
    // Show sample trip with fare range
    const sampleTrips = await Trip.find().limit(3);
    console.log('\n=== SAMPLE TRIPS WITH FARES ===');
    sampleTrips.forEach(trip => {
      console.log(`${trip.tripId}: Fare ${trip.fare}, Status: ${trip.status}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

seedMissingData();