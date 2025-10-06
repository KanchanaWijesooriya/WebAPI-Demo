#!/usr/bin/env node

// Test script to verify role-based data filtering for search endpoints
async function testSearchFiltering() {
  const baseUrl = 'http://localhost:3000/api/search';
  
  console.log('Testing Search Endpoints Role-Based Data Filtering\n');
  
  try {
    // Test 1: Public user - Combined search
    console.log('1. PUBLIC USER - Combined Search:');
    const publicUrl = `${baseUrl}/combined?start=Colombo&end=Kandy&minFare=150&maxFare=250`;
    console.log(`   URL: ${publicUrl}`);
    
    const publicResponse = await fetch(publicUrl);
    const publicData = await publicResponse.json();
    
    console.log(`   Status: ${publicResponse.status}`);
    console.log(`   Data Level: ${publicData.dataLevel || 'Not specified'}`);
    
    if (publicData.data?.results && publicData.data.results.length > 0) {
      const result = publicData.data.results[0];
      console.log('\n   Route Data Fields:');
      Object.keys(result).forEach(key => {
        if (key === 'availableTrips') return; // Handle separately
        const isInternal = ['_id', '__v', 'createdAt', 'updatedAt', 'isActive'].includes(key);
        console.log(`     ${key}: ${isInternal ? '[ERROR] VISIBLE (SHOULD BE HIDDEN)' : '[OK] VISIBLE'}`);
      });
      
      if (result.availableTrips && result.availableTrips.length > 0) {
        const trip = result.availableTrips[0];
        console.log('\n   Trip Data Fields:');
        Object.keys(trip).forEach(key => {
          const isInternal = ['_id', '__v', 'createdAt', 'updatedAt'].includes(key);
          const isSensitive = ['driver', 'passengers', 'actualArrival', 'actualDeparture', 'delay', 'weatherCondition'].includes(key);
          const shouldBeHidden = isInternal || isSensitive;
          console.log(`     ${key}: ${shouldBeHidden ? '[ERROR] VISIBLE (SHOULD BE HIDDEN)' : '[OK] VISIBLE'}`);
        });
        
        // Check bus data
        if (trip.bus) {
          console.log('\n   Bus Data Fields:');
          Object.keys(trip.bus).forEach(key => {
            const isInternal = ['_id', '__v', 'createdAt', 'updatedAt'].includes(key);
            const isSensitive = ['registrationNumber'].includes(key);
            const shouldBeHidden = isInternal || isSensitive;
            console.log(`     ${key}: ${shouldBeHidden ? '[ERROR] VISIBLE (SHOULD BE HIDDEN)' : '[OK] VISIBLE'}`);
          });
        }
      }
    }
    
    console.log('\n' + '='.repeat(80) + '\n');
    
    // Test 2: Admin user - Combined search
    console.log('2. ADMIN USER - Combined Search:');
    
    // Get admin token
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@ntc.gov.lk',
        password: 'admin123'
      })
    });
    
    if (loginResponse.ok) {
      const loginData = await loginResponse.json();
      const token = loginData.data?.token;
      
      if (token) {
        console.log('   [OK] Admin login successful');
        console.log(`   URL: ${publicUrl} (with admin token)`);
        
        const adminResponse = await fetch(publicUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const adminData = await adminResponse.json();
        
        console.log(`   Status: ${adminResponse.status}`);
        console.log(`   Data Level: ${adminData.dataLevel || 'Not specified'}`);
        
        if (adminData.data?.results && adminData.data.results.length > 0) {
          const result = adminData.data.results[0];
          console.log('\n   Route Data Fields:');
          Object.keys(result).forEach(key => {
            console.log(`     ${key}: [OK] VISIBLE (ADMIN ACCESS)`);
          });
          
          if (result.availableTrips && result.availableTrips.length > 0) {
            const trip = result.availableTrips[0];
            console.log('\n   Trip Data Fields:');
            Object.keys(trip).forEach(key => {
              console.log(`     ${key}: [OK] VISIBLE (ADMIN ACCESS)`);
            });
            
            if (trip.bus) {
              console.log('\n   Bus Data Fields:');
              Object.keys(trip.bus).forEach(key => {
                console.log(`     ${key}: [OK] VISIBLE (ADMIN ACCESS)`);
              });
            }
          }
        }
      } else {
        console.log('   [ERROR] No token received from login');
      }
    } else {
      console.log('   [ERROR] Admin login failed');
    }
    
    console.log('\n' + '='.repeat(80) + '\n');
    
    // Test 3: Public Routes Search
    console.log('3. PUBLIC USER - Routes Search:');
    const routesUrl = `${baseUrl}/routes?start=Colombo&end=Kandy`;
    const routesResponse = await fetch(routesUrl);
    const routesData = await routesResponse.json();
    
    console.log(`   Status: ${routesResponse.status}`);
    console.log(`   Data Level: ${routesData.dataLevel || 'Not specified'}`);
    
    if (routesData.data?.routes && routesData.data.routes.length > 0) {
      const route = routesData.data.routes[0];
      console.log('\n   Route Fields:');
      Object.keys(route).forEach(key => {
        const isInternal = ['_id', '__v', 'createdAt', 'updatedAt', 'isActive'].includes(key);
        console.log(`     ${key}: ${isInternal ? '[ERROR] VISIBLE (SHOULD BE HIDDEN)' : '[OK] VISIBLE'}`);
      });
    }
    
  } catch (error) {
    console.error('[ERROR] Test Error:', error.message);
  }
  
  console.log('\nExpected Behavior:');
  console.log('   PUBLIC USERS should NOT see:');
  console.log('   • Internal fields: _id, __v, createdAt, updatedAt, isActive');
  console.log('   • Sensitive trip data: driver, passengers, actualArrival, actualDeparture, delay, weatherCondition');
  console.log('   • Sensitive bus data: registrationNumber, operator.licenseNumber, operator.contactNumber');
  console.log('');
  console.log('   ADMIN USERS should see:');
  console.log('   • ALL fields including internal and sensitive data');
}

testSearchFiltering().catch(console.error);