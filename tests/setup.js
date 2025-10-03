import { connectTestDB, disconnectTestDB } from './helpers/testDb.js';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing';

// Global test setup
beforeAll(async () => {
  // console.log('Setting up test environment...');
  
  try {
    await connectTestDB();
    // console.log('Test database connected');
  } catch (error) {
    console.error('Failed to connect to test database:', error);
    process.exit(1);
  }
});

// Global test teardown
afterAll(async () => {
  // console.log('Cleaning up test environment...');
  
  try {
    await disconnectTestDB();
    // console.log('Test database disconnected');
  } catch (error) {
    console.error('Failed to disconnect test database:', error);
  }
});

// Timeout will be set in jest.config.js instead
