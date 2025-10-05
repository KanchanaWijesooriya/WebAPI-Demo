# Tests Directory Organization

This directory contains all test scripts, utilities, and temporary development files.

## Directory Structure

### Core Test Files (Jest)
- `*.test.js` - Jest test suites for automated testing
- `setup.js` - Test setup configuration
- `helpers/` - Test helper utilities
- `utils/` - Test utility functions

### Development & Manual Test Scripts
- `test_bus_auth.js` - Manual RBAC testing for bus endpoints
- `test_rbac_comprehensive.js` - Comprehensive role-based access control testing
- `test_search_filtering.js` - Search endpoint data filtering tests

### Data Management Scripts
- `seed_location_only.js` - Seed script for location data
- `seed_missing_data.js` - Seed script for missing data
- `check_data.js` - Data validation utility
- `integration_script.js` - Integration testing script

## Guidelines

### ✅ Always Use This Directory For:
- All test scripts (temporary or permanent)
- Seed/migration scripts
- Data validation utilities
- Development helper scripts
- API testing scripts
- Any utility scripts

### ❌ Never Place In Root Directory:
- Test files
- Temporary scripts
- Seed scripts
- Development utilities
- API testing tools

## Usage

```bash
# Run Jest tests
npm test

# Run manual test scripts
node tests/test_rbac_comprehensive.js

# Run seed scripts
node tests/seed_missing_data.js

# Run utilities
node tests/check_data.js
```

This organization keeps the project root clean and makes all testing-related code easy to find and manage.