#!/usr/bin/env node

import mongoose from 'mongoose';
import Route from '../src/models/Route.js';
import Bus from '../src/models/Bus.js';
import Trip from '../src/models/Trip.js';
import User from '../src/models/User.js';
import LocationHistory from '../src/models/LocationHistory.js';
import connectDB from '../src/config/database.js';

async function verifyData() {
  try {
    console.log('Verifying Database Data');
    console.log('========================');
    
    // Connect to MongoDB
    await connectDB();
    
    // Count documents in each collection
    const routeCount = await Route.countDocuments();
    const busCount = await Bus.countDocuments();
    const tripCount = await Trip.countDocuments();
    const userCount = await User.countDocuments();
    const locationCount = await LocationHistory.countDocuments();
    
    console.log('Database Statistics:');
    console.log(`   Routes: ${routeCount}`);
    console.log(`   Buses: ${busCount}`);
    console.log(`   Trips: ${tripCount}`);
    console.log(`   Users: ${userCount}`);
    console.log(`   Location Records: ${locationCount}`);
    console.log('');
    
    // Show sample data
    if (routeCount > 0) {
      console.log('Sample Route:');
      const sampleRoute = await Route.findOne().select('routeNumber startLocation endLocation distance');
      console.log(`   ${sampleRoute.routeNumber}: ${sampleRoute.startLocation} → ${sampleRoute.endLocation} (${sampleRoute.distance}km)`);
      console.log('');
    }
    
    if (busCount > 0) {
      console.log('Sample Bus:');
      const sampleBus = await Bus.findOne().populate('assignedRoute', 'routeNumber').select('registrationNumber type capacity status');
      console.log(`   ${sampleBus.registrationNumber}: ${sampleBus.type} (${sampleBus.capacity} seats) - ${sampleBus.status}`);
      if (sampleBus.assignedRoute) {
        console.log(`   Assigned to Route: ${sampleBus.assignedRoute.routeNumber}`);
      }
      console.log('');
    }
    
    if (tripCount > 0) {
      console.log('Sample Trip:');
      const sampleTrip = await Trip.findOne()
        .populate('route', 'routeNumber startLocation endLocation')
        .populate('bus', 'registrationNumber')
        .select('tripId status scheduledDeparture fare');
      console.log(`   ${sampleTrip.tripId}: ${sampleTrip.status}`);
      if (sampleTrip.route) {
        console.log(`   Route: ${sampleTrip.route.routeNumber} (${sampleTrip.route.startLocation} → ${sampleTrip.route.endLocation})`);
      }
      if (sampleTrip.bus) {
        console.log(`   Bus: ${sampleTrip.bus.registrationNumber}`);
      }
      console.log(`   Departure: ${sampleTrip.scheduledDeparture.toLocaleString()}`);
      console.log(`   Fare: LKR ${sampleTrip.fare}`);
      console.log('');
    }
    
    if (userCount > 0) {
      console.log('Sample Users:');
      const sampleUsers = await User.find().select('username role profile.firstName profile.lastName').limit(3);
      sampleUsers.forEach(user => {
        console.log(`   ${user.username} (${user.role}): ${user.profile?.firstName} ${user.profile?.lastName}`);
      });
      console.log('');
    }
    
    // Check data relationships
    console.log('Data Relationship Check:');
    const tripsWithRelations = await Trip.countDocuments({
      $and: [
        { route: { $ne: null } },
        { bus: { $ne: null } }
      ]
    });
    console.log(`   Trips with proper relationships: ${tripsWithRelations}/${tripCount}`);
    
    const busesWithRoutes = await Bus.countDocuments({ assignedRoute: { $ne: null } });
    console.log(`   Buses assigned to routes: ${busesWithRoutes}/${busCount}`);
    
    console.log('');
    console.log(routeCount > 0 && busCount > 0 && tripCount > 0 && userCount > 0 
      ? '✅ Database verification successful! All data seeded properly.' 
      : '❌ Database verification failed! Some collections are empty.');
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run verification
verifyData();