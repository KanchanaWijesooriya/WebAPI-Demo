import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import Route from '../models/Route.js';
import Bus from '../models/Bus.js';
import Trip from '../models/Trip.js';
import User from '../models/User.js';
import LocationHistory from '../models/LocationHistory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DataSeeder {
  constructor() {
    this.dataPath = path.join(__dirname, '../../data');
  }

  // Load JSON data from files
  loadJsonData(filename) {
    try {
      const filePath = path.join(this.dataPath, filename);
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error loading ${filename}:`, error.message);
      return [];
    }
  }

  // Clear all collections
  async clearDatabase() {
    try {
      console.log('Clearing existing data...');
      await Route.deleteMany({});
      await Bus.deleteMany({});
      await Trip.deleteMany({});
      await User.deleteMany({});
      await LocationHistory.deleteMany({});
      console.log('✅ Database cleared successfully');
    } catch (error) {
      console.error('❌ Error clearing database:', error.message);
      throw error;
    }
  }

  // Seed routes
  async seedRoutes() {
    try {
      console.log('Seeding routes...');
      const routesData = this.loadJsonData('routes.json');
      
      if (routesData.length === 0) {
        console.log('No routes data found');
        return [];
      }

      const routes = await Route.insertMany(routesData);
      console.log(`✅ Seeded ${routes.length} routes`);
      return routes;
    } catch (error) {
      console.error('❌ Error seeding routes:', error.message);
      throw error;
    }
  }

  // Seed buses with route references
  async seedBuses(routes) {
    try {
      console.log('Seeding buses...');
      const busesData = this.loadJsonData('buses.json');
      
      if (busesData.length === 0) {
        console.log('No buses data found');
        return [];
      }

      // Map route numbers to ObjectIds
      const routeMap = {};
      routes.forEach(route => {
        routeMap[route.routeNumber] = route._id;
      });

      // Update buses with proper route ObjectIds
      const busesWithRouteIds = busesData.map(bus => ({
        ...bus,
        route: routeMap[bus.routeNumber] || null
      }));

      const buses = await Bus.insertMany(busesWithRouteIds);
      console.log(`✅ Seeded ${buses.length} buses`);
      return buses;
    } catch (error) {
      console.error('❌ Error seeding buses:', error.message);
      throw error;
    }
  }

  // Seed users with hashed passwords
  async seedUsers() {
    try {
      console.log('Seeding users...');
      const usersData = this.loadJsonData('users.json');
      
      if (usersData.length === 0) {
        console.log('No users data found');
        return [];
      }

      // Hash passwords for all users
      const usersWithHashedPasswords = await Promise.all(
        usersData.map(async (user) => ({
          ...user,
          password: await bcrypt.hash(user.password, 12)
        }))
      );

      const users = await User.insertMany(usersWithHashedPasswords);
      console.log(`✅ Seeded ${users.length} users`);
      return users;
    } catch (error) {
      console.error('❌ Error seeding users:', error.message);
      throw error;
    }
  }

  // Seed trips with proper references
  async seedTrips(routes, buses, users) {
    try {
      console.log('Seeding trips...');
      const tripsData = this.loadJsonData('trips.json');
      
      if (tripsData.length === 0) {
        console.log('No trips data found');
        return [];
      }

      // Create lookup maps
      const routeMap = {};
      routes.forEach(route => {
        routeMap[route.routeNumber] = route._id;
      });

      const busMap = {};
      buses.forEach(bus => {
        busMap[bus.registrationNumber] = bus._id;
      });

      const userMap = {};
      users.forEach(user => {
        userMap[user.username] = user._id;
      });

      // Update trips with proper ObjectId references
      const tripsWithIds = tripsData.map(trip => ({
        ...trip,
        route: routeMap[trip.routeNumber] || null,
        bus: busMap[trip.busRegistration] || null,
        scheduledDeparture: new Date(trip.scheduledDeparture),
        scheduledArrival: new Date(trip.scheduledArrival),
        actualDeparture: trip.actualDeparture ? new Date(trip.actualDeparture) : null,
        actualArrival: trip.actualArrival ? new Date(trip.actualArrival) : null
      }));

      const trips = await Trip.insertMany(tripsWithIds);
      console.log(`✅ Seeded ${trips.length} trips`);
      return trips;
    } catch (error) {
      console.error('❌ Error seeding trips:', error.message);
      throw error;
    }
  }

  // Generate sample location history for active trips
  async seedLocationHistory(trips, buses) {
    try {
      console.log('Seeding location history...');
      
      const activeTrips = trips.filter(trip => 
        trip.status === 'in-progress' || trip.status === 'departed'
      );

      if (activeTrips.length === 0) {
        console.log('No active trips found for location history');
        return [];
      }

      const locationHistories = [];
      const now = new Date();

      for (const trip of activeTrips) {
        const bus = buses.find(b => b._id.toString() === trip.bus.toString());
        if (!bus) continue;

        // Generate 5 location points for each active trip (last 2 hours)
        for (let i = 0; i < 5; i++) {
          const timestamp = new Date(now.getTime() - (i * 30 * 60 * 1000)); // 30 min intervals
          
          locationHistories.push({
            bus: bus._id,
            trip: trip._id,
            coordinates: {
              type: 'Point',
              coordinates: [
                80.0 + (Math.random() * 2), // Random longitude around Sri Lanka
                6.0 + (Math.random() * 4)   // Random latitude around Sri Lanka
              ]
            },
            speed: Math.floor(Math.random() * 80) + 20, // 20-100 km/h
            heading: Math.floor(Math.random() * 360),
            accuracy: Math.floor(Math.random() * 20) + 3, // 3-23 meters
            timestamp
          });
        }
      }

      if (locationHistories.length > 0) {
        const locations = await LocationHistory.insertMany(locationHistories);
        console.log(`✅ Seeded ${locations.length} location history records`);
        return locations;
      }

      return [];
    } catch (error) {
      console.error('❌ Error seeding location history:', error.message);
      throw error;
    }
  }

  // Main seeding function
  async seedAll(clearFirst = true) {
    try {
      console.log('Starting database seeding...');
      console.log('='.repeat(50));

      if (clearFirst) {
        await this.clearDatabase();
      }

      // Seed in proper order to maintain relationships
      const routes = await this.seedRoutes();
      const buses = await this.seedBuses(routes);
      const users = await this.seedUsers();
      const trips = await this.seedTrips(routes, buses, users);
      const locations = await this.seedLocationHistory(trips, buses);

      console.log('='.repeat(50));
      console.log('✅ Database seeding completed successfully!');
      console.log(`Summary:`);
      console.log(`   - Routes: ${routes.length}`);
      console.log(`   - Buses: ${buses.length}`);
      console.log(`   - Users: ${users.length}`);
      console.log(`   - Trips: ${trips.length}`);
      console.log(`   - Location Records: ${locations.length}`);

      return {
        routes,
        buses,
        users,
        trips,
        locations
      };
    } catch (error) {
      console.error('❌ Database seeding failed:', error.message);
      throw error;
    }
  }

  // Quick seed (without clearing)
  async quickSeed() {
    return this.seedAll(false);
  }
}

export default DataSeeder;