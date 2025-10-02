import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import Route model
import Route from '../src/models/Route.js';

const seedRoutes = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    console.log('Database:', mongoose.connection.name);

    // Clear existing routes
    const deleteResult = await Route.deleteMany({});
    console.log(`Cleared ${deleteResult.deletedCount} existing routes`);

    // Read routes data
    const routesPath = path.join(__dirname, '../data/routes.json');
    console.log('Reading from:', routesPath);
    
    if (!fs.existsSync(routesPath)) {
      throw new Error(`Routes file not found at: ${routesPath}`);
    }
    
    const routesData = JSON.parse(fs.readFileSync(routesPath, 'utf8'));
    console.log(`Found ${routesData.length} routes in file`);

    // Validate data before inserting
    if (!Array.isArray(routesData) || routesData.length === 0) {
      throw new Error('Routes data is not a valid array or is empty');
    }

    // Insert routes
    const insertedRoutes = await Route.insertMany(routesData);
    console.log(`Inserted ${insertedRoutes.length} routes successfully`);
    
    // Verify insertion
    const verifyCount = await Route.countDocuments();
    console.log(`Verification: ${verifyCount} routes now in database`);

    // Display inserted routes
    console.log('\nInserted Routes:');
    insertedRoutes.forEach((route, index) => {
      console.log(`${index + 1}. Route ${route.routeNumber}: ${route.name}`);
    });

    console.log('\nRoutes seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding routes:', error);
    process.exit(1);
  }
};

seedRoutes();