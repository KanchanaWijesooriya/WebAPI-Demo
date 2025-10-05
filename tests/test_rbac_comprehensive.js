#!/usr/bin/env node

/**
 * Comprehensive RBAC Testing Script
 * Tests all endpoints to ensure proper role-based data filtering
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/api';

// Test accounts
const TEST_ACCOUNTS = {
  public: null, // No authentication
  admin: {
    email: 'admin@ntc.lk',
    password: 'Admin123!@#'
  }
};

let adminToken = null;

// Helper function to make authenticated requests
async function makeRequest(endpoint, token = null, method = 'GET') {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }
  
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json();
    return { status: response.status, data };
  } catch (error) {
    return { status: 500, error: error.message };
  }
}

// Login to get admin token
async function loginAdmin() {
  console.log('\n🔐 Logging in as admin...');
  
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(TEST_ACCOUNTS.admin)
  });
  
  if (response.ok) {
    const data = await response.json();
    adminToken = data.token;
    console.log('✅ Admin login successful');
    return true;
  } else {
    console.log('❌ Admin login failed');
    return false;
  }
}

// Test endpoint with both public and admin access
async function testEndpoint(endpoint, description) {
  console.log(`\n📊 Testing: ${description}`);
  console.log(`   Endpoint: ${endpoint}`);
  
  // Test public access
  console.log('   👤 Public access:');
  const publicResponse = await makeRequest(endpoint);
  console.log(`      Status: ${publicResponse.status}`);
  
  if (publicResponse.data) {
    const hasInternalFields = JSON.stringify(publicResponse.data).includes('"_id"') || 
                             JSON.stringify(publicResponse.data).includes('"registrationNumber"') ||
                             JSON.stringify(publicResponse.data).includes('"licenseNumber"');
    console.log(`      Data level: ${publicResponse.data.dataLevel || 'not specified'}`);
    console.log(`      Has sensitive fields: ${hasInternalFields ? '❌ YES (BAD)' : '✅ NO (GOOD)'}`);
  }
  
  // Test admin access
  if (adminToken) {
    console.log('   👑 Admin access:');
    const adminResponse = await makeRequest(endpoint, adminToken);
    console.log(`      Status: ${adminResponse.status}`);
    
    if (adminResponse.data) {
      const hasInternalFields = JSON.stringify(adminResponse.data).includes('"_id"') || 
                               JSON.stringify(adminResponse.data).includes('"registrationNumber"');
      console.log(`      Data level: ${adminResponse.data.dataLevel || 'not specified'}`);
      console.log(`      Has internal fields: ${hasInternalFields ? '✅ YES (GOOD)' : '❌ NO (BAD)'}`);
    }
  }
}

// Test data filtering for specific fields
function analyzeDataFields(data, userType) {
  const dataStr = JSON.stringify(data);
  const sensitiveFields = {
    '_id': dataStr.includes('"_id"'),
    '__v': dataStr.includes('"__v"'),
    'registrationNumber': dataStr.includes('"registrationNumber"'),
    'licenseNumber': dataStr.includes('"licenseNumber"'),
    'contactNumber': dataStr.includes('"contactNumber"'),
    'driver': dataStr.includes('"driver"'),
    'createdAt': dataStr.includes('"createdAt"'),
    'updatedAt': dataStr.includes('"updatedAt"')
  };
  
  console.log(`      Sensitive fields analysis (${userType}):`);
  Object.entries(sensitiveFields).forEach(([field, present]) => {
    const shouldBePresent = userType === 'admin';
    const status = present === shouldBePresent ? '✅' : '❌';
    console.log(`        ${field}: ${present ? 'Present' : 'Hidden'} ${status}`);
  });
}

// Main test function
async function runComprehensiveRBACTests() {
  console.log('🚀 Starting Comprehensive RBAC Testing');
  console.log('=' .repeat(60));
  
  // Login admin
  const adminLoggedIn = await loginAdmin();
  if (!adminLoggedIn) {
    console.log('⚠️  Continuing with public tests only');
  }
  
  // Test all endpoints
  const endpoints = [
    // Routes endpoints
    { endpoint: '/routes', description: 'Get all routes' },
    { endpoint: '/routes/6716ec3c82a7cb59c6a8f4e5', description: 'Get single route' },
    
    // Bus endpoints
    { endpoint: '/buses', description: 'Get all buses' },
    { endpoint: '/buses/6716ec3c82a7cb59c6a8f4f0', description: 'Get single bus' },
    { endpoint: '/buses/6716ec3c82a7cb59c6a8f4f0/location', description: 'Get bus location' },
    { endpoint: '/buses/6716ec3c82a7cb59c6a8f4f0/trips', description: 'Get bus trips' },
    
    // Route buses
    { endpoint: '/routes/6716ec3c82a7cb59c6a8f4e5/buses', description: 'Get buses on route' },
    
    // Trips endpoints
    { endpoint: '/trips', description: 'Get all trips' },
    { endpoint: '/trips/6716ec3c82a7cb59c6a8f509', description: 'Get single trip' },
    
    // Search endpoints
    { endpoint: '/search/routes?start=Colombo&end=Kandy', description: 'Search routes' },
    { endpoint: '/search/trips?start=Colombo&end=Kandy', description: 'Search trips' },
    { endpoint: '/search/combined?start=Colombo&end=Kandy', description: 'Combined search' }
  ];
  
  for (const { endpoint, description } of endpoints) {
    await testEndpoint(endpoint, description);
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('🏁 RBAC Testing Complete');
  console.log('\n📋 Summary:');
  console.log('   ✅ Public users should see clean data without internal fields');
  console.log('   ✅ Admin users should see complete data including sensitive information');
  console.log('   ✅ All endpoints should indicate dataLevel (public/full)');
  console.log('   ❌ Any sensitive data visible to public users indicates a security issue');
}

// Run the tests
runComprehensiveRBACTests().catch(console.error);