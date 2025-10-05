#!/usr/bin/env node

// Test script to verify role-based bus data filtering
async function testBusEndpoint() {
  const baseUrl = 'http://localhost:3000/api/buses';
  
  console.log(' Testing Bus Endpoint Role-Based Data Filtering\n');
  
  try {
    // Test 1: Public user (no authentication)
    console.log('1. PUBLIC USER (No Authentication):');
    console.log(`   URL: ${baseUrl}`);
    
    const publicResponse = await fetch(baseUrl);
    const publicData = await publicResponse.json();
    
    console.log(`   Status: ${publicResponse.status}`);
    console.log(`   Data Level: ${publicData.dataLevel || 'Not specified'}`);
    
    if (publicData.data && publicData.data.length > 0) {
      const bus = publicData.data[0];
      console.log('\n   Sample Bus Data:');
      console.log(`     Bus Number: ${bus.busNumber}`);
      console.log(`     Registration Number: ${bus.registrationNumber ? ' VISIBLE (SHOULD BE HIDDEN)' : '✅ HIDDEN'}`);
      console.log(`     Operator Name: ${bus.operator?.name || 'N/A'}`);
      console.log(`     Operator License: ${bus.operator?.licenseNumber ? ' VISIBLE (SHOULD BE HIDDEN)' : '✅ HIDDEN'}`);
      console.log(`     Operator Contact: ${bus.operator?.contactNumber ? ' VISIBLE (SHOULD BE HIDDEN)' : '✅ HIDDEN'}`);
      console.log(`     Bus Type: ${bus.busType}`);
      console.log(`     Capacity: ${bus.capacity}`);
      console.log(`     Status: ${bus.status}`);
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Test 2: Admin user (with authentication)
    console.log('2. ADMIN USER (With Admin Token):');
    
    // First get an admin token
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
        console.log('   ✅ Admin login successful');
        console.log(`   URL: ${baseUrl} (with admin token)`);
        
        const adminResponse = await fetch(baseUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const adminData = await adminResponse.json();
        
        console.log(`   Status: ${adminResponse.status}`);
        console.log(`   Data Level: ${adminData.dataLevel || 'Not specified'}`);
        
        if (adminData.data && adminData.data.length > 0) {
          const bus = adminData.data[0];
          console.log('\n   Sample Bus Data:');
          console.log(`     Bus Number: ${bus.busNumber}`);
          console.log(`     Registration Number: ${bus.registrationNumber ? '✅ VISIBLE (ADMIN ACCESS)' : '🔴 HIDDEN (SHOULD BE VISIBLE)'}`);
          console.log(`     Operator Name: ${bus.operator?.name || 'N/A'}`);
          console.log(`     Operator License: ${bus.operator?.licenseNumber ? '✅ VISIBLE (ADMIN ACCESS)' : '🔴 HIDDEN (SHOULD BE VISIBLE)'}`);
          console.log(`     Operator Contact: ${bus.operator?.contactNumber ? '✅ VISIBLE (ADMIN ACCESS)' : '🔴 HIDDEN (SHOULD BE VISIBLE)'}`);
          console.log(`     Bus Type: ${bus.busType}`);
          console.log(`     Capacity: ${bus.capacity}`);
          console.log(`     Status: ${bus.status}`);
        }
      } else {
        console.log('    No token received from login');
      }
    } else {
      console.log('    Admin login failed');
      console.log('   Response:', await loginResponse.text());
    }
    
  } catch (error) {
    console.error('❌ Test Error:', error.message);
  }
  
  console.log('\ Expected Behavior:');
  console.log('   • Public users: Should NOT see registrationNumber, operator.licenseNumber, operator.contactNumber');
  console.log('   • Admin users: Should see ALL fields including sensitive data');
  console.log('   • Both should see: busNumber, operator.name, busType, capacity, status, etc.');
}

testBusEndpoint().catch(console.error);