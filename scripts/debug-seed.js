#!/usr/bin/env node

import DataSeeder from '../src/services/dataSeeder.js';
import connectDB from '../src/config/database.js';

async function testSeeding() {
  try {
    console.log('Starting manual seed test...');
    
    // Connect to MongoDB  
    await connectDB();
    console.log('Database connected successfully');
    
    // Create seeder instance
    const seeder = new DataSeeder();
    console.log('DataSeeder instance created');
    
    // Test loading JSON data first
    console.log('Testing JSON data loading...');
    const routesData = seeder.loadJsonData('routes.json');
    console.log(`Routes JSON loaded: ${routesData.length} items`);
    
    const busesData = seeder.loadJsonData('buses.json');
    console.log(`Buses JSON loaded: ${busesData.length} items`);
    
    const tripsData = seeder.loadJsonData('trips.json');
    console.log(`Trips JSON loaded: ${tripsData.length} items`);
    
    const usersData = seeder.loadJsonData('users.json');
    console.log(`Users JSON loaded: ${usersData.length} items`);
    
    // Try seeding routes only first
    console.log('Attempting to seed routes...');
    const routes = await seeder.seedRoutes();
    console.log(`✅ Routes seeded successfully: ${routes.length}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

testSeeding();