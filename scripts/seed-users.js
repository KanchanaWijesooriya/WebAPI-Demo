import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import User model
import User from '../src/models/User.js';

/**
 * Seed Users with Role-Based Access Control
 * This script creates the 4 predefined users with their specific roles and permissions
 * All passwords are properly hashed for security
 */
const seedUsers = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing users
    await User.deleteMany({});
    console.log('Cleared existing users');

    // Read users data from JSON file
    const usersPath = path.join(__dirname, '../data/users.json');
    const usersData = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

    console.log(`Found ${usersData.length} users in data file`);
    console.log('Hashing passwords and creating users...');

    // Process each user and hash their password
    const processedUsers = [];
    const saltRounds = 12; // Strong encryption for password hashing

    for (const userData of usersData) {
      console.log(`   Processing user: ${userData.username} (${userData.role})`);
      
      // Hash the password for security
      const hashedPassword = await bcrypt.hash(userData.password, saltRounds);
      
      // Create user object with hashed password
      const processedUser = {
        username: userData.username,
        email: userData.email,
        password: hashedPassword,
        role: userData.role,
        profile: userData.profile,
        permissions: userData.permissions,
        isActive: userData.isActive,
        createdAt: new Date(),
        createdBy: null // System created
      };
      
      processedUsers.push(processedUser);
    }

    // Insert all users into database
    const insertedUsers = await User.insertMany(processedUsers);
    console.log(`Inserted ${insertedUsers.length} users successfully`);

    // Display created users with their roles and permissions
    console.log('\nCreated Users Summary:');
    console.log('=' .repeat(80));
    
    for (const user of insertedUsers) {
      console.log(`${user.username} (${user.role})`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Organization: ${user.profile.organization}`);
      console.log(`   Permissions:`);
      user.permissions.forEach(perm => {
        console.log(`      • ${perm.resource}: ${perm.actions.join(', ')}`);
      });
      console.log(`   Status: ${user.isActive ? 'Active' : 'Inactive'}`);
      console.log('   ' + '-'.repeat(70));
    }

    console.log('\nLogin Credentials for Testing:');
    console.log('=' .repeat(50));
    
    // Show original passwords for testing (only during development)
    usersData.forEach(user => {
      console.log(`${user.role.toUpperCase().padEnd(10)} | ${user.email.padEnd(25)} | ${user.password}`);
    });

    console.log('\nUsers seeding completed successfully!');
    console.log('You can now test authentication with the credentials above');
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding users:', error);
    process.exit(1);
  }
};

seedUsers();