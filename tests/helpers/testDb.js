import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod;

/**
 * Connect to in-memory MongoDB instance for testing
 */
export const connectTestDB = async () => {
  try {
    // Create in-memory MongoDB instance
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    
    // Connect to the in-memory database
    await mongoose.connect(uri);
    
    // console.log('Connected to test database');
    return uri;
  } catch (error) {
    console.error('Test DB connection error:', error);
    throw error;
  }
};

/**
 * Disconnect and clean up test database
 */
export const disconnectTestDB = async () => {
  try {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    
    if (mongod) {
      await mongod.stop();
    }
    
    // console.log('Disconnected from test database');
  } catch (error) {
    console.error('Test DB disconnect error:', error);
    throw error;
  }
};

/**
 * Clear all test data from database
 */
export const clearTestDB = async () => {
  try {
    const collections = mongoose.connection.collections;
    
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
    
    console.log('Test database cleared');
  } catch (error) {
    console.error('Test DB clear error:', error);
    throw error;
  }
};

/**
 * Seed test database with sample data
 */
export const seedTestDB = async () => {
  try {
    // Import models using absolute paths
    const { default: User } = await import('file:///home/chanuka002/Web API CW/ntc-bus-tracking-api/src/models/User.js');
    const { default: Route } = await import('file:///home/chanuka002/Web API CW/ntc-bus-tracking-api/src/models/Route.js');
    const { default: Bus } = await import('file:///home/chanuka002/Web API CW/ntc-bus-tracking-api/src/models/Bus.js');
    const { default: Trip } = await import('file:///home/chanuka002/Web API CW/ntc-bus-tracking-api/src/models/Trip.js');
    const { default: LocationHistory } = await import('file:///home/chanuka002/Web API CW/ntc-bus-tracking-api/src/models/LocationHistory.js');
    
    // Clear existing data
    await clearTestDB();
    
    // Create test users
    const testUsers = [
      {
        name: 'Test Admin',
        email: 'admin@test.com',
        password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBaIdULgSLYA.', // password: 'testpass123'
        role: 'admin',
        isActive: true
      },
      {
        name: 'Test Operator',
        email: 'operator@test.com',
        password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBaIdULgSLYA.',
        role: 'operator',
        isActive: true
      },
      {
        name: 'Test Driver',
        email: 'driver@test.com',
        password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBaIdULgSLYA.',
        role: 'driver',
        isActive: true
      },
      {
        name: 'Test Viewer',
        email: 'viewer@test.com',
        password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBaIdULgSLYA.',
        role: 'viewer',
        isActive: true
      }
    ];
    
    const users = await User.insertMany(testUsers);
    
    // Create test routes
    const testRoutes = [
      {
        routeNumber: 'TEST-001',
        name: 'Test Route Colombo-Kandy',
        origin: {
          city: 'Colombo',
          coordinates: [79.8612, 6.9271]
        },
        destination: {
          city: 'Kandy',
          coordinates: [80.6337, 7.2906]
        },
        distance: 115,
        estimatedDuration: 180,
        stops: [
          { name: 'Colombo Fort', coordinates: [79.8612, 6.9271] },
          { name: 'Kadawatha', coordinates: [79.9553, 7.0086] },
          { name: 'Kandy Central', coordinates: [80.6337, 7.2906] }
        ],
        isActive: true
      },
      {
        routeNumber: 'TEST-002',
        name: 'Test Route Colombo-Galle',
        origin: {
          city: 'Colombo',
          coordinates: [79.8612, 6.9271]
        },
        destination: {
          city: 'Galle',
          coordinates: [80.2170, 6.0535]
        },
        distance: 119,
        estimatedDuration: 150,
        stops: [
          { name: 'Colombo Fort', coordinates: [79.8612, 6.9271] },
          { name: 'Moratuwa', coordinates: [79.8816, 6.7837] },
          { name: 'Galle Fort', coordinates: [80.2170, 6.0535] }
        ],
        isActive: true
      }
    ];
    
    const routes = await Route.insertMany(testRoutes);
    
    // Create test buses
    const testBuses = [
      {
        registrationNumber: 'TEST-001',
        operator: 'Test Transport Co',
        type: 'AC Luxury',
        capacity: 45,
        route: routes[0]._id,
        isActive: true,
        features: ['AC', 'WiFi', 'GPS'],
        operatorContact: {
          primaryPhone: '+94-11-111-1111',
          email: 'test@transport.lk',
          licenseNumber: 'LIC-TEST-001'
        }
      },
      {
        registrationNumber: 'TEST-002',
        operator: 'Test Express Ltd',
        type: 'Semi Luxury',
        capacity: 52,
        route: routes[1]._id,
        isActive: true,
        features: ['AC', 'GPS'],
        operatorContact: {
          primaryPhone: '+94-11-222-2222',
          email: 'express@transport.lk',
          licenseNumber: 'LIC-TEST-002'
        }
      }
    ];
    
    const buses = await Bus.insertMany(testBuses);
    
    // Create test trips
    const testTrips = [
      {
        tripId: 'TEST-TRIP-001',
        bus: buses[0]._id,
        route: routes[0]._id,
        scheduledDeparture: new Date('2025-10-04T08:00:00.000Z'),
        scheduledArrival: new Date('2025-10-04T11:00:00.000Z'),
        status: 'Scheduled',
        fare: 250,
        driver: {
          name: 'Test Driver 1',
          licenseNumber: 'DL-TEST-001',
          contactNumber: '+94-77-111-1111'
        },
        conductor: {
          name: 'Test Conductor 1',
          contactNumber: '+94-77-222-2222'
        }
      },
      {
        tripId: 'TEST-TRIP-002',
        bus: buses[1]._id,
        route: routes[1]._id,
        scheduledDeparture: new Date('2025-10-04T09:00:00.000Z'),
        scheduledArrival: new Date('2025-10-04T11:30:00.000Z'),
        status: 'In Progress',
        fare: 200,
        actualDeparture: new Date('2025-10-04T09:05:00.000Z'),
        driver: {
          name: 'Test Driver 2',
          licenseNumber: 'DL-TEST-002',
          contactNumber: '+94-77-333-3333'
        },
        conductor: {
          name: 'Test Conductor 2',
          contactNumber: '+94-77-444-4444'
        }
      }
    ];
    
    const trips = await Trip.insertMany(testTrips);
    
    // Create test location history
    const testLocations = [
      {
        bus: buses[0]._id,
        coordinates: [79.8612, 6.9271],
        timestamp: new Date(),
        speed: 45,
        heading: 120
      },
      {
        bus: buses[1]._id,
        coordinates: [79.9000, 6.8000],
        timestamp: new Date(),
        speed: 60,
        heading: 180
      }
    ];
    
    await LocationHistory.insertMany(testLocations);
    
    console.log('Test database seeded successfully');
    
    return {
      users,
      routes,
      buses,
      trips,
      testLocations
    };
    
  } catch (error) {
    console.error('Test DB seed error:', error);
    throw error;
  }
};
