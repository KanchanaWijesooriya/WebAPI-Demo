#!/usr/bin/env node

import mongoose from 'mongoose';
import DataSeeder from '../src/services/dataSeeder.js';
import connectDB from '../src/config/database.js';

async function runSeeder() {
  try {
    console.log('NTC Bus Tracking API - Data Seeder');
    console.log('=====================================');
    
    // Connect to MongoDB
    await connectDB();
    
    // Create seeder instance
    const seeder = new DataSeeder();
    
    // Check command line arguments
    const args = process.argv.slice(2);
    const command = args[0] || 'seed';
    
    switch (command) {
      case 'seed':
        console.log('Full database seeding (clears existing data)...');
        await seeder.seedAll(true);
        break;
        
      case 'quick':
        console.log('Quick seeding (preserves existing data)...');
        await seeder.quickSeed();
        break;
        
      case 'clear':
        console.log('Clearing database...');
        await seeder.clearDatabase();
        console.log('Database cleared successfully');
        break;
        
      default:
        console.log('Unknown command. Available commands:');
        console.log('   - seed  : Full seeding (default)');
        console.log('   - quick : Quick seeding');
        console.log('   - clear : Clear database');
        break;
    }
    
  } catch (error) {
    console.error('Seeder failed:', error.message);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSeeder();
}

export default runSeeder;