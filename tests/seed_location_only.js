import mongoose from 'mongoose';
import Bus from './src/models/Bus.js';
import LocationHistory from './src/models/LocationHistory.js';

async function seedLocationData() {
  try {
    await mongoose.connect('mongodb+srv://chanuka:256523@cluster0.xbji2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');
    console.log('Connected to MongoDB');
    
    // Clear existing location data
    await LocationHistory.deleteMany({});
    console.log('Cleared existing location data');
    
    // Get existing buses
    const buses = await Bus.find().limit(5);
    console.log(`Found ${buses.length} buses`);
    
    // Create sample location history
    const locations = [];
    const now = new Date();
    
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
    
    console.log('Location data creation completed!');
    
    // Show summary
    console.log('\n=== SUMMARY ===');
    console.log(`Total LocationHistory: ${await LocationHistory.countDocuments()}`);
    
    // Show actual bus IDs for testing
    console.log('\n=== REAL BUS IDs FOR TESTING ===');
    buses.forEach(bus => {
      console.log(`${bus._id} - ${bus.registrationNumber} (${bus.operator})`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

seedLocationData();