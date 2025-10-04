export default {
  // Test environment
  testEnvironment: 'node',
  
  // Enable ES6 modules
  preset: null,
  transform: {},
  transformIgnorePatterns: [
    'node_modules/(?!(supertest|mongodb-memory-server)/)'
  ],
  
  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  
  // Coverage configuration
  collectCoverage: false,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    // Well-tested route files
    'src/routes/buses.js',
    'src/routes/search_filter.js',
    'src/routes/search_filter_backup.js',
    'src/routes/routes.js',
    'src/routes/auth.js',
    
    // Essential model files
    'src/models/Bus.js',
    'src/models/Trip.js',
    
    // Well-tested middleware and utilities
    'src/middleware/validation.js',
    'src/middleware/rbac.js',
    'src/utils/ApiError.js',
    'src/utils/ApiFeatures.js',
    'src/utils/ApiResponse.js'
  ],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Test timeout
  testTimeout: 30000,
  
  // Verbose output - enabled to show individual test case results
  verbose: true,
  
  // Silent mode - suppress console.log/error output during tests but keep test results
  silent: true,
  
  // Module file extensions
  moduleFileExtensions: ['js', 'json'],
  
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true
};
