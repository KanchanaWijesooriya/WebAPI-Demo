# 🚌 NTC Bus Tracking API

# NTC Bus Tracking API

A comprehensive RESTful API for the National Transport Commission (NTC) bus tracking system with role-based access control, real-time data filtering, and enhanced search capabilities.

Real-Time Bus Tracking System for Sri Lanka National Transport Commission

## 🚀 Features

**Student ID**: [REPLACE WITH YOUR STUDENT ID]

### Core Functionality

- **🔐 Role-Based Access Control (RBAC)** - Admin, Operator, Driver, and Public user roles## Project Overview

- **🚍 Bus Management** - Complete fleet management with real-time tracking

- **🗺️ Route Management** - Comprehensive route planning with stopwise pricingThis RESTful API provides real-time GPS-based location tracking for inter-provincial buses across Sri Lanka. The system enables the National Transport Commission (NTC), bus operators, and commuters to monitor bus movements with live status updates.

- **🎫 Trip Management** - Scheduling and fare management

- **🔍 Advanced Search** - Multi-parameter search with bidirectional route support## Features

- **📊 Stopwise Pricing** - Dynamic fare calculation between any two stops

- **🌐 Public API** - Clean, filtered data for public consumption- Real-time bus location tracking

- Route management system

### Technical Features- Bus scheduling and trip management

- **MongoDB** with Mongoose ODM- RESTful API with full CRUD operations

- **JWT Authentication** with role-based middleware- JWT-based authentication

- **Data Filtering** - Role-specific response filtering- Rate limiting and security

- **Error Handling** - Comprehensive error management- MongoDB data persistence

- **API Documentation** - Built-in documentation endpoint- Comprehensive error handling

- **Health Monitoring** - System health checks- Request validation

- API documentation

## 📋 API Endpoints

## Tech Stack

### 🔑 Authentication

```http- **Runtime**: Node.js (v18+)

POST   /api/auth/login           # User login- **Framework**: Express.js

POST   /api/auth/register        # User registration- **Database**: MongoDB Atlas

POST   /api/auth/refresh         # Token refresh- **Authentication**: JWT

POST   /api/auth/logout          # User logout- **Validation**: Express Validator

```- **Security**: Helmet, CORS, Rate Limiting

- **Testing**: Jest, Supertest

### 🚍 Routes Management- **Code Quality**: ESLint

```http

GET    /api/routes               # List all routes (with RBAC filtering)## Quick Start

GET    /api/routes/{id}          # Get route by ID or route number

GET    /api/routes/{id}/buses    # Get buses on specific route### Prerequisites

POST   /api/routes               # Create route (Admin only)- Node.js (v18 or higher)

PUT    /api/routes/{id}          # Update route (Admin only)- MongoDB Atlas account

DELETE /api/routes/{id}          # Delete route (Admin only)- npm or yarn



# Stopwise Pricing### Installation

GET    /api/routes/pricing/{from}/{to}        # Basic stopwise pricing

GET    /api/search/pricing/{from}/{to}        # Enhanced pricing with route analysis1. Clone the repository

``````bash

git clone [YOUR_REPOSITORY_URL]

### 🚌 Bus Managementcd ntc-bus-tracking-api

```http```

GET    /api/buses                # List all buses (with RBAC filtering)

GET    /api/buses/{id}           # Get bus details2. Install dependencies

POST   /api/buses                # Create bus (Admin/Operator)```bash

PUT    /api/buses/{id}           # Update bus (Admin/Operator)npm install

DELETE /api/buses/{id}           # Delete bus (Admin only)```

```

3. Set up MongoDB Atlas (see docs/MONGODB_SETUP.md)

### 🎫 Trip Management

```http4. Configure environment variables

GET    /api/trips                # List all trips (with RBAC filtering)```bash

GET    /api/trips/{id}           # Get trip detailscp .env.example .env

POST   /api/trips                # Create trip (Admin/Operator)# Edit .env with your MongoDB connection string

PUT    /api/trips/{id}           # Update trip (Admin/Operator)```

DELETE /api/trips/{id}           # Delete trip (Admin only)

```5. Start development server

```bash

### 🔍 Enhanced Searchnpm run dev

```http```

GET    /api/search/routes        # Advanced route search with bidirectional support

GET    /api/search/trips         # Trip search with time/fare filtersThe API will be available at `http://localhost:3000`

GET    /api/search/combined      # Combined search with journey planning

GET    /api/search/pricing/{from}/{to}  # Comprehensive stopwise pricing## API Endpoints

```

### Authentication

### 👥 User Management (Admin Only)- `POST /api/auth/register` - Register new user

```http- `POST /api/auth/login` - User login

GET    /api/users                # List all users

POST   /api/users                # Create user### Routes

PUT    /api/users/{id}           # Update user- `GET /api/routes` - Get all routes

DELETE /api/users/{id}           # Delete user- `POST /api/routes` - Create new route

PUT    /api/users/{id}/role      # Update user role- `GET /api/routes/:id` - Get specific route

PUT    /api/users/{id}/status    # Activate/deactivate user- `PUT /api/routes/:id` - Update route

```- `DELETE /api/routes/:id` - Delete route



### 🔧 System### Buses

```http- `GET /api/buses` - Get all buses

GET    /api/health               # System health check- `POST /api/buses` - Create new bus

GET    /api/docs                 # API documentation- `GET /api/buses/:id` - Get specific bus

```- `PUT /api/buses/:id` - Update bus

- `DELETE /api/buses/:id` - Delete bus

## 🔐 Authentication & Authorization

### Real-time Tracking

### User Roles- `GET /api/tracking/buses/:busId/location` - Get current bus location

- **🔑 Admin** - Full system access, user management, all CRUD operations- `POST /api/tracking/buses/:busId/location` - Update bus location

- **👔 Operator** - Bus and trip management, route reading, operational data- `GET /api/tracking/routes/:routeId/buses` - Get all buses on a route

- **🚗 Driver** - Trip updates, location tracking, limited access

- **👀 Viewer/Public** - Read-only access to public transport information## Scripts



### Authentication Flow- `npm start` - Start production server

1. **Login** with credentials to receive JWT token- `npm run dev` - Start development server with nodemon

2. **Include token** in Authorization header: `Bearer <token>`- `npm test` - Run tests

3. **Token-based** role verification for protected endpoints- `npm run lint` - Run ESLint

4. **Optional authentication** for public endpoints (enhanced data for authenticated users)- `npm run lint:fix` - Fix ESLint issues



## 📊 RBAC Data Filtering## Project Structure



### Public Users (No Token)```

```jsonsrc/

{├── config/          # Configuration files

  "routeNumber": "002-1",├── controllers/     # Route controllers

  "start": "Galle",├── middleware/      # Custom middleware

  "end": "Colombo Fort",├── models/         # MongoDB models

  "stops": ["Galle", "Kalutara", "Colombo Fort"],├── routes/         # Route definitions

  "direction": "Down line"├── services/       # Business logic

}├── utils/          # Utility functions

```└── server.js       # Application entry point

```

### Admin Users (With Token)
```json
{
  "routeNumber": "002-1",
  "routeName": "Galle - Colombo Express",
  "start": "Galle",
  "end": "Colombo Fort",
  "distance": 115,
  "estimatedDuration": 120,
  "stops": [...],
  "isActive": true,
  "pricingInfo": {...},
  "createdAt": "2025-10-06T10:53:49.821Z"
}
```

## 🎯 Usage Examples

### Basic Route Search
```bash
curl "http://localhost:3000/api/routes"
```

### Get Specific Route (supports both ObjectId and route numbers)
```bash
curl "http://localhost:3000/api/routes/002-1"
curl "http://localhost:3000/api/routes/670285dd5674fa4576f5f571"
```

### Stopwise Pricing Between Cities
```bash
curl "http://localhost:3000/api/search/pricing/Galle/Colombo"
curl "http://localhost:3000/api/routes/pricing/Kandy/Colombo?busType=Intercity Express"
```

### Advanced Route Search
```bash
curl "http://localhost:3000/api/search/routes?start=Colombo&end=Kandy&page=1&limit=5"
```

### Authenticated Request (Admin)
```bash
curl -H "Authorization: Bearer <jwt_token>" "http://localhost:3000/api/routes"
```

### Trip Search with Filters
```bash
curl "http://localhost:3000/api/search/trips?start=Colombo&minFare=100&maxFare=500&departureTime=08:30"
```

## 🗄️ Database Structure

### Sample Users
- **Admin**: `ntc_admin` / `admin123`
- **Operator**: `bus_operator` / `operator123`
- **Driver**: `driver_nimal` / `driver123`
- **Public**: `public_user` / `public123`

### Route Format
```json
{
  "routeId": "RT-002-1-DOWN",
  "routeNumber": "002-1",
  "name": "Galle - Colombo Express",
  "start": {
    "city": "Galle",
    "coordinates": { "latitude": 6.0535, "longitude": 80.221 }
  },
  "destination": {
    "city": "Colombo Fort",
    "coordinates": { "latitude": 6.9344, "longitude": 79.8428 }
  },
  "stops": [
    {
      "name": "Kalutara",
      "order": 1,
      "coordinates": { "latitude": 6.5854, "longitude": 79.9607 }
    }
  ],
  "distance": 115,
  "pricingInfo": {
    "baseFare": 50,
    "pricePerKm": 4
  }
}
```

## ⚙️ Installation & Setup

### Prerequisites
- Node.js (18+)
- MongoDB (Local or Atlas)
- npm/yarn

### Installation
```bash
# Clone repository
git clone <repository-url>
cd ntc-bus-tracking-api

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your MongoDB connection and JWT secret

# Seed database (optional)
npm run seed

# Start server
npm start
```

### Environment Variables
```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/ntc_bus_tracking
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRE=7d
```

## 🔍 Search Capabilities

### Route Search Features
- **Bidirectional Search** - Find routes in both directions
- **Partial Journey Support** - Search for routes serving intermediate stops
- **Stop-based Search** - Find routes passing through specific stops
- **Distance Filtering** - Filter by route distance
- **Pagination** - Efficient result pagination

### Pricing Features
- **Stopwise Calculation** - Fare calculation between any two stops
- **Bus Type Multipliers** - Different fares for Normal, Intercity Express, Super Intercity Express
- **Multiple Route Options** - Compare fares across different routes
- **Distance-based Pricing** - Accurate distance calculations using coordinates

### Trip Search Features
- **Time-based Search** - Find trips by departure time
- **Date Filtering** - Search trips for specific dates
- **Fare Range Filtering** - Find trips within budget
- **Day Type Filtering** - Weekday/weekend/specific day searches

## 🛠️ API Response Format

### Success Response
```json
{
  "status": "success",
  "statusCode": 200,
  "data": {
    "routes": [...],
    "pagination": {
      "current": 1,
      "pages": 5,
      "total": 50
    },
    "dataLevel": "public"
  },
  "message": "Routes retrieved successfully"
}
```

### Error Response
```json
{
  "status": "error",
  "statusCode": 404,
  "message": "Route not found",
  "timestamp": "2025-10-06T18:30:36.466Z"
}
```

## 🚀 Advanced Features

### Intelligent Route Matching
- **Fuzzy Search** - Partial city name matching
- **Route Direction Detection** - Automatic UP/DOWN line detection
- **Multi-stop Journey Planning** - Complex journey route finding

### Dynamic Pricing
- **Real-time Calculations** - Live fare calculations
- **Route-specific Pricing** - Custom pricing per route
- **Bus Type Variations** - Multiple fare tiers

### Data Optimization
- **Lazy Loading** - Efficient data loading
- **Smart Caching** - Response optimization
- **Minimal Data Transfer** - Role-based data filtering

## 📈 Performance Features

- **Indexed Database Queries** - Optimized MongoDB indexes
- **Pagination** - Efficient result pagination
- **Data Filtering** - Minimal data transfer
- **Error Boundaries** - Graceful error handling
- **Connection Pooling** - Efficient database connections

## 🔒 Security Features

- **JWT Authentication** - Secure token-based auth
- **Role-based Authorization** - Granular permissions
- **Data Sanitization** - Input validation and cleaning
- **Error Masking** - Secure error responses
- **Rate Limiting** - API abuse protection (planned)

## 📝 Development

### Available Scripts
```bash
npm start          # Start production server
npm run dev        # Start development server with nodemon
npm run seed       # Seed database with sample data
npm test           # Run tests (planned)
npm run docs       # Generate API documentation
```

### Project Structure
```
src/
├── controllers/    # Route handlers
├── middleware/     # Authentication & validation
├── models/         # MongoDB schemas
├── routes/         # API route definitions
├── utils/          # Helper functions
├── config/         # Configuration files
└── server.js       # Application entry point
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push start feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## 🆘 Support

- **API Documentation**: `GET /api/docs`
- **Health Check**: `GET /api/health`
- **Issues**: Create GitHub issues for bugs/features
- **Email**: Support via repository maintainers

---

### 🎉 Ready to Use!

Your NTC Bus Tracking API is now ready with:
- ✅ **Fixed Route Endpoints** - `/api/routes/002-1` now works perfectly
- ✅ **Working Stopwise Pricing** - Admin users get comprehensive pricing data
- ✅ **RBAC Data Filtering** - Role-based response filtering active
- ✅ **Enhanced Search** - Bidirectional route search with pricing
- ✅ **Complete Documentation** - This comprehensive README

**Base URL**: `http://localhost:3000`  
**Test Route**: `GET /api/routes/002-1`  
**Test Pricing**: `GET /api/search/pricing/Galle/Colombo`