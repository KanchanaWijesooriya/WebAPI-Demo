#!/usr/bin/env node

import DataSeeder from '../src/services/dataSeeder.js';
import connectDB from '../src/config/database.js';
import mongoose from 'mongoose';

async function forceFullSeed() {
  try {
    console.log('NTC Bus Tracking API - Force Full Seeding');
    console.log('==========================================');
    
    // Connect to MongoDB  
    await connectDB();
    
    // Create seeder instance
    const seeder = new DataSeeder();
    
    // Force full seeding with detailed output
    console.log('Starting full database seeding...');
    const result = await seeder.seedAll(true);
    
    console.log('==========================================');
    console.log('✅ Full seeding completed successfully!');
    console.log('Final Summary:');
    console.log(`   - Routes: ${result.routes.length}`);
    console.log(`   - Buses: ${result.buses.length}`);
    console.log(`   - Users: ${result.users.length}`);
    console.log(`   - Trips: ${result.trips.length}`);
    console.log(`   - Location Records: ${result.locations.length}`);
    
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  }
}

forceFullSeed();