
# NTC Bus Tracking API

Real-Time Bus Tracking System for Sri Lanka National Transport Commission

**Student ID**: [REPLACE WITH YOUR STUDENT ID]

## Project Overview

This RESTful API provides real-time GPS-based location tracking for inter-provincial buses across Sri Lanka. The system enables the National Transport Commission (NTC), bus operators, and commuters to monitor bus movements with live status updates.

## Features

- Real-time bus location tracking
- Route management system
- Bus scheduling and trip management
- RESTful API with full CRUD operations
- JWT-based authentication
- Rate limiting and security
- MongoDB data persistence
- Comprehensive error handling
- Request validation
- API documentation

## Tech Stack

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: MongoDB Atlas
- **Authentication**: JWT
- **Validation**: Express Validator
- **Security**: Helmet, CORS, Rate Limiting
- **Testing**: Jest, Supertest
- **Code Quality**: ESLint

## Quick Start

### Prerequisites
- Node.js (v18 or higher)
- MongoDB Atlas account
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone [YOUR_REPOSITORY_URL]
cd ntc-bus-tracking-api
```

2. Install dependencies
```bash
npm install
```

3. Set up MongoDB Atlas (see docs/MONGODB_SETUP.md)

4. Configure environment variables
```bash
cp .env.example .env
# Edit .env with your MongoDB connection string
```

5. Start development server
```bash
npm run dev
```

The API will be available at `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login

### Routes
- `GET /api/routes` - Get all routes
- `POST /api/routes` - Create new route
- `GET /api/routes/:id` - Get specific route
- `PUT /api/routes/:id` - Update route
- `DELETE /api/routes/:id` - Delete route

### Buses
- `GET /api/buses` - Get all buses
- `POST /api/buses` - Create new bus
- `GET /api/buses/:id` - Get specific bus
- `PUT /api/buses/:id` - Update bus
- `DELETE /api/buses/:id` - Delete bus

### Real-time Tracking
- `GET /api/tracking/buses/:busId/location` - Get current bus location
- `POST /api/tracking/buses/:busId/location` - Update bus location
- `GET /api/tracking/routes/:routeId/buses` - Get all buses on a route

## Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues

## Project Structure

```
src/
├── config/          # Configuration files
├── controllers/     # Route controllers
├── middleware/      # Custom middleware
├── models/         # MongoDB models
├── routes/         # Route definitions
├── services/       # Business logic
├── utils/          # Utility functions
└── server.js       # Application entry point
```
