/**
 * Swagger API Documentation Configuration
 * Comprehensive documentation for NTC Bus Tracking API
 */

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'NTC Bus Tracking API',
      version: '1.0.0',
      description: `
        Comprehensive REST API for National Transport Commission Bus Tracking System.
        
        **Features:**
        - Real-time bus location tracking
        - Route and trip management
        - Advanced search and filtering
        - User authentication and authorization
        - Role-based access control (RBAC)
        - DDoS protection with rate limiting
        - Admin monitoring and management
        
        **Security:**
        - JWT-based authentication
        - Multi-layer rate limiting
        - Advanced threat detection
        - Request size monitoring
        - Suspicious pattern recognition
        
        **Academic Project Information:**
        - **Developer:** Chanuka Wijesooriya
        - **Student ID:** COBSCCOMP24.1P - 020
        - **Institution:** Coventry University
        - **Course:** Web API CW - Academic Project
        - **System:** NTC Bus Tracking API
        - **Rights:** All rights reserved
      `,

    },
    servers: [
      {
        url: 'https://ntc-bustracking.me/api',
        description: 'Production Server'
      },
      {
        url: 'https://localhost:3443/api',
        description: 'Development HTTPS Server'
      },
      {
        url: 'http://localhost:3000/api',
        description: 'Development HTTP Server'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Authorization header using the Bearer scheme.'
        },
        sessionAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'ntc.sid',
          description: 'Session authentication using ntc.sid cookie. Paste your session cookie value here.'
        }
      },
      schemas: {
        // User Schemas
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'ObjectId',
              description: 'Unique user identifier'
            },
            username: {
              type: 'string',
              minLength: 3,
              maxLength: 30,
              description: 'Unique username'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            role: {
              type: 'string',
              enum: ['admin', 'operator', 'driver', 'passenger'],
              description: 'User role for access control'
            },
            profile: {
              $ref: '#/components/schemas/UserProfile'
            },
            isActive: {
              type: 'boolean',
              default: true,
              description: 'Account status'
            },
            permissions: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Permission'
              }
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          },
          required: ['username', 'email', 'role']
        },
        
        UserProfile: {
          type: 'object',
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            contactNumber: { type: 'string' },
            organization: { type: 'string' },
            address: { type: 'string' }
          }
        },
        
        Permission: {
          type: 'object',
          properties: {
            resource: {
              type: 'string',
              enum: ['routes', 'buses', 'trips', 'tracking', 'users']
            },
            actions: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['create', 'read', 'update', 'delete']
              }
            }
          }
        },

        // Bus Schemas
        Bus: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'ObjectId' },
            busNumber: { type: 'string', description: 'Bus identification number' },
            registrationNumber: { 
              type: 'string', 
              pattern: '^[A-Z]{2,3}-\\d{4}$',
              description: 'Sri Lankan vehicle registration format'
            },
            busType: {
              type: 'string',
              enum: ['Normal', 'Express', 'Intercity Express'],
              description: 'Type of bus service'
            },
            capacity: {
              type: 'integer',
              minimum: 10,
              maximum: 100,
              description: 'Maximum passenger capacity'
            },
            operator: {
              $ref: '#/components/schemas/BusOperator'
            },
            facilities: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['AC', 'WiFi', 'USB Charging', 'Reclining Seats', 'Entertainment']
              }
            },
            status: {
              type: 'string',
              enum: ['Active', 'Maintenance', 'Out of Service'],
              description: 'Current operational status'
            },
            isOnline: {
              type: 'boolean',
              description: 'Real-time tracking status'
            },
            currentLocation: {
              $ref: '#/components/schemas/Location'
            },
            lastMaintenance: {
              type: 'string',
              format: 'date'
            }
          },
          required: ['busNumber', 'registrationNumber', 'busType', 'capacity']
        },

        BusOperator: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            contactNumber: { type: 'string' },
            licenseNumber: { type: 'string' },
            email: { type: 'string', format: 'email' },
            officeAddress: { type: 'string' }
          }
        },

        // Route Schemas
        Route: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'ObjectId' },
            routeNumber: {
              type: 'string',
              pattern: '^\\d{1,4}[A-Z]?$',
              description: 'Route identification number'
            },
            name: { 
              type: 'string',
              description: 'Route name or description' 
            },
            start: {
              $ref: '#/components/schemas/Location'
            },
            destination: {
              $ref: '#/components/schemas/Location'
            },
            distance: {
              type: 'number',
              minimum: 0,
              description: 'Route distance in kilometers'
            },
            estimatedDuration: {
              type: 'integer',
              minimum: 0,
              description: 'Estimated travel time in minutes'
            },
            stops: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/BusStop'
              }
            },
            operatingHours: {
              $ref: '#/components/schemas/OperatingHours'
            },
            isActive: {
              type: 'boolean',
              default: true
            }
          },
          required: ['routeNumber', 'name', 'start', 'destination']
        },

        Location: {
          type: 'object',
          properties: {
            city: { type: 'string' },
            area: { type: 'string' },
            coordinates: {
              type: 'object',
              properties: {
                latitude: {
                  type: 'number',
                  minimum: -90,
                  maximum: 90
                },
                longitude: {
                  type: 'number',
                  minimum: -180,
                  maximum: 180
                }
              }
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            }
          }
        },

        BusStop: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            location: { $ref: '#/components/schemas/Location' },
            sequence: { type: 'integer', minimum: 1 },
            estimatedArrival: { type: 'string' }
          }
        },

        OperatingHours: {
          type: 'object',
          properties: {
            start: {
              type: 'string',
              pattern: '^([01]?\\d|2[0-3]):[0-5]\\d$',
              example: '06:00'
            },
            end: {
              type: 'string',
              pattern: '^([01]?\\d|2[0-3]):[0-5]\\d$',
              example: '22:00'
            }
          }
        },

        // Trip Schemas
        Trip: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'ObjectId' },
            tripId: { 
              type: 'string',
              description: 'Unique trip identifier'
            },
            bus: {
              type: 'string',
              format: 'ObjectId',
              description: 'Reference to bus'
            },
            route: {
              type: 'string',
              format: 'ObjectId',
              description: 'Reference to route'
            },
            serviceDate: {
              type: 'string',
              format: 'date',
              description: 'Date of service'
            },
            scheduledDeparture: {
              type: 'string',
              format: 'date-time'
            },
            scheduledArrival: {
              type: 'string',
              format: 'date-time'
            },
            actualDeparture: {
              type: 'string',
              format: 'date-time'
            },
            actualArrival: {
              type: 'string',
              format: 'date-time'
            },
            status: {
              type: 'string',
              enum: ['Scheduled', 'In Progress', 'Completed', 'Cancelled', 'Delayed'],
              description: 'Current trip status'
            },
            fare: {
              type: 'number',
              minimum: 0,
              description: 'Trip fare in LKR'
            },
            driver: {
              $ref: '#/components/schemas/Driver'
            },
            conductor: {
              $ref: '#/components/schemas/Conductor'
            },
            passengers: {
              $ref: '#/components/schemas/PassengerInfo'
            },
            delay: {
              type: 'integer',
              description: 'Delay in minutes'
            },
            weatherCondition: {
              type: 'string',
              enum: ['Clear', 'Rainy', 'Cloudy', 'Stormy']
            }
          },
          required: ['tripId', 'bus', 'route', 'serviceDate', 'scheduledDeparture']
        },

        Driver: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            licenseNumber: { type: 'string' },
            contactNumber: { type: 'string' },
            experience: { type: 'string' }
          }
        },

        Conductor: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            employeeId: { type: 'string' },
            contactNumber: { type: 'string' }
          }
        },

        PassengerInfo: {
          type: 'object',
          properties: {
            current: {
              type: 'integer',
              minimum: 0,
              description: 'Current passenger count'
            },
            boarding: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  stop: { type: 'string' },
                  count: { type: 'integer' },
                  timestamp: { type: 'string', format: 'date-time' }
                }
              }
            },
            alighting: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  stop: { type: 'string' },
                  count: { type: 'integer' },
                  timestamp: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        },

        // Response Schemas
        ApiResponse: {
          type: 'object',
          properties: {
            statusCode: {
              type: 'integer',
              description: 'HTTP status code'
            },
            success: {
              type: 'boolean',
              description: 'Request success status'
            },
            message: {
              type: 'string',
              description: 'Response message'
            },
            data: {
              type: 'object',
              description: 'Response data'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Response timestamp'
            }
          },
          required: ['statusCode', 'success', 'message']
        },

        PaginatedResponse: {
          allOf: [
            { $ref: '#/components/schemas/ApiResponse' },
            {
              type: 'object',
              properties: {
                pagination: {
                  type: 'object',
                  properties: {
                    current: { type: 'integer' },
                    pages: { type: 'integer' },
                    total: { type: 'integer' },
                    hasNext: { type: 'boolean' },
                    hasPrev: { type: 'boolean' }
                  }
                }
              }
            }
          ]
        },

        ErrorResponse: {
          type: 'object',
          properties: {
            statusCode: {
              type: 'integer',
              description: 'HTTP error status code'
            },
            success: {
              type: 'boolean',
              default: false
            },
            message: {
              type: 'string',
              description: 'Error message'
            },
            error: {
              type: 'string',
              description: 'Detailed error information'
            },
            type: {
              type: 'string',
              description: 'Error type classification'
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            }
          },
          required: ['statusCode', 'success', 'message']
        },

        // Rate Limiting Schemas
        RateLimitResponse: {
          allOf: [
            { $ref: '#/components/schemas/ErrorResponse' },
            {
              type: 'object',
              properties: {
                retryAfter: {
                  type: 'integer',
                  description: 'Seconds until rate limit resets'
                },
                type: {
                  type: 'string',
                  enum: [
                    'RATE_LIMIT_EXCEEDED',
                    'AUTH_RATE_LIMIT_EXCEEDED', 
                    'SEARCH_RATE_LIMIT_EXCEEDED',
                    'ADMIN_RATE_LIMIT_EXCEEDED',
                    'SECURITY_RATE_LIMIT'
                  ]
                }
              }
            }
          ]
        },

        // DDoS Monitoring Schemas
        DDoSStatus: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['ACTIVE', 'EMERGENCY']
            },
            statistics: {
              type: 'object',
              properties: {
                totalRequests: { type: 'integer' },
                blockedRequests: { type: 'integer' },
                suspiciousRequests: { type: 'integer' },
                blockRate: { type: 'string' }
              }
            },
            rateLimits: {
              type: 'object',
              additionalProperties: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  limit: { type: 'string' },
                  hits: { type: 'integer' }
                }
              }
            },
            topIPs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  ip: { type: 'string' },
                  requests: { type: 'integer' }
                }
              }
            }
          }
        }
      },
      
      responses: {
        UnauthorizedError: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              },
              example: {
                statusCode: 401,
                success: false,
                message: 'Authentication required',
                error: 'No token provided'
              }
            }
          }
        },
        
        ForbiddenError: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              },
              example: {
                statusCode: 403,
                success: false,
                message: 'Access denied',
                error: 'Insufficient permissions for this operation'
              }
            }
          }
        },
        
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              },
              example: {
                statusCode: 404,
                success: false,
                message: 'Resource not found'
              }
            }
          }
        },
        
        ValidationError: {
          description: 'Invalid request data',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              },
              example: {
                statusCode: 400,
                success: false,
                message: 'Validation failed',
                error: 'Invalid input parameters'
              }
            }
          }
        },
        
        RateLimitError: {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RateLimitResponse'
              }
            }
          },
          headers: {
            'RateLimit-Limit': {
              description: 'Request limit per time window',
              schema: { type: 'integer' }
            },
            'RateLimit-Remaining': {
              description: 'Remaining requests in current window',
              schema: { type: 'integer' }
            },
            'RateLimit-Reset': {
              description: 'Time when rate limit resets (Unix timestamp)',
              schema: { type: 'integer' }
            }
          }
        }
      },
      
      parameters: {
        PageParam: {
          name: 'page',
          in: 'query',
          description: 'Page number for pagination',
          required: false,
          schema: {
            type: 'integer',
            minimum: 1,
            default: 1
          }
        },
        
        LimitParam: {
          name: 'limit',
          in: 'query',
          description: 'Number of items per page',
          required: false,
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 10
          }
        },
        
        IdParam: {
          name: 'id',
          in: 'path',
          description: 'Resource ID',
          required: true,
          schema: {
            type: 'string',
            pattern: '^[a-fA-F0-9]{24}$'
          }
        }
      }
    },
    
    security: [
      {
        BearerAuth: []
      }
    ],
    
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints'
      },
      {
        name: 'Users',
        description: 'User management operations (Admin only)'
      },
      {
        name: 'Buses',
        description: 'Bus fleet management and tracking'
      },
      {
        name: 'Routes',
        description: 'Route planning and management'
      },
      {
        name: 'Trips',
        description: 'Trip scheduling and tracking'
      },
      {
        name: 'Location Management',
        description: 'Real-time GPS location tracking and history for buses'
      },
      {
        name: 'Search',
        description: 'Advanced search and filtering capabilities'
      },
      {
        name: 'Admin',
        description: 'Administrative operations and monitoring'
      },
      {
        name: 'Public',
        description: 'Public access endpoints (no authentication required)'
      },
      {
        name: 'System',
        description: 'System health and utility endpoints'
      }
    ],
    
    paths: {
      // Admin Endpoints
      '/admin/operator-contacts': {
        get: {
          tags: ['Admin'],
          summary: 'Get operator contacts',
          security: [{ BearerAuth: [] }, { sessionAuth: [] }],
          responses: {
            200: { description: 'Success', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
            401: { $ref: '#/components/responses/UnauthorizedError' }
          }
        }
      },
      '/admin/bus-info/{id}': {
        get: {
          tags: ['Admin'],
          summary: 'Get bus information by ID or registration number',
          security: [{ BearerAuth: [] }, { sessionAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: 'Bus ObjectId or registration number (e.g., 68e4c9d45ffe5feaaf9ed2b9 or CAA-5678)',
              schema: { type: 'string' }
            }
          ],
          responses: {
            200: { description: 'Success', content: { 'application/json': { schema: { $ref: '#/components/schemas/Bus' } } } },
            401: { $ref: '#/components/responses/UnauthorizedError' },
            404: { $ref: '#/components/responses/NotFoundError' }
          }
        }
      },
      
      // User Management Endpoints
      '/users/{id}': {
        get: {
          tags: ['Users'],
          summary: 'Get user by ID',
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: 'User ObjectId',
              schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' }
            }
          ],
          responses: {
            200: { description: 'Success', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
            401: { $ref: '#/components/responses/UnauthorizedError' },
            404: { $ref: '#/components/responses/NotFoundError' }
          }
        }
      },
      '/users/{id}/profile': {
        put: {
          tags: ['Users'],
          summary: 'Update user profile',
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: 'User ObjectId',
              schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' }
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UserProfile' }
              }
            }
          },
          responses: {
            200: { description: 'Profile updated successfully' },
            401: { $ref: '#/components/responses/UnauthorizedError' },
            400: { $ref: '#/components/responses/ValidationError' }
          }
        }
      },
      '/users': {
        post: {
          tags: ['Users'],
          summary: 'Create new user',
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    username: { type: 'string', example: 'john_doe' },
                    email: { type: 'string', format: 'email', example: 'john@example.com' },
                    password: { type: 'string', example: 'password123' },
                    role: { type: 'string', enum: ['admin', 'operator', 'driver', 'passenger'], example: 'passenger' }
                  },
                  required: ['username', 'email', 'password', 'role']
                }
              }
            }
          },
          responses: {
            201: { description: 'User created successfully' },
            400: { $ref: '#/components/responses/ValidationError' },
            401: { $ref: '#/components/responses/UnauthorizedError' }
          }
        }
      },
      
      // Authentication Endpoints
      '/auth/login': {
        post: {
          tags: ['Authentication', 'Public'],
          summary: 'User login (JWT)',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    email: { type: 'string', format: 'email', example: 'user@example.com' },
                    password: { type: 'string', example: 'password123' }
                  },
                  required: ['email', 'password']
                }
              }
            }
          },
          responses: {
            200: { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
            401: { description: 'Invalid credentials' }
          }
        }
      },
      '/auth/login-session': {
        post: {
          tags: ['Authentication', 'Session Management', 'Public'],
          summary: 'Session-based login',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    email: { type: 'string', format: 'email', example: 'user@example.com' },
                    password: { type: 'string', example: 'password123' }
                  },
                  required: ['email', 'password']
                }
              }
            }
          },
          responses: {
            200: { 
              description: 'Session login successful',
              headers: {
                'Set-Cookie': {
                  schema: { type: 'string' },
                  example: 'ntc.sid=s%3A...; Path=/; HttpOnly; Secure; SameSite=Strict'
                }
              }
            },
            401: { description: 'Invalid credentials' }
          }
        }
      },
      '/auth/logout-session': {
        post: {
          tags: ['Authentication', 'Session Management'],
          summary: 'Session logout',
          security: [{ sessionAuth: [] }],
          responses: {
            200: { description: 'Logout successful' },
            401: { description: 'No active session' }
          }
        }
      },
      '/auth/session-status': {
        get: {
          tags: ['Authentication', 'Session Management'],
          summary: 'Check session status',
          security: [{ sessionAuth: [] }],
          responses: {
            200: { description: 'Session status retrieved' },
            401: { description: 'No active session' }
          }
        }
      },
      '/register': {
        post: {
          tags: ['Authentication', 'Public'],
          summary: 'User registration',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    username: { type: 'string', example: 'john_doe' },
                    email: { type: 'string', format: 'email', example: 'john@example.com' },
                    password: { type: 'string', example: 'password123' }
                  },
                  required: ['username', 'email', 'password']
                }
              }
            }
          },
          responses: {
            201: { description: 'Registration successful' },
            400: { $ref: '#/components/responses/ValidationError' }
          }
        }
      },
      
      // Bus Endpoints
      '/buses': {
        get: {
          tags: ['Buses'],
          summary: 'Get all buses',
          security: [{ BearerAuth: [] }],
          parameters: [
            { $ref: '#/components/parameters/PageParam' },
            { $ref: '#/components/parameters/LimitParam' }
          ],
          responses: {
            200: { description: 'Success', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } }
          }
        },
        post: {
          tags: ['Buses'],
          summary: 'Create new bus',
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Bus' }
              }
            }
          },
          responses: {
            201: { description: 'Bus created successfully' },
            400: { $ref: '#/components/responses/ValidationError' }
          }
        }
      },
      
      // Route Endpoints
      '/routes': {
        get: {
          tags: ['Routes'],
          summary: 'Get all routes',
          security: [{ BearerAuth: [] }],
          parameters: [
            { $ref: '#/components/parameters/PageParam' },
            { $ref: '#/components/parameters/LimitParam' }
          ],
          responses: {
            200: { description: 'Success', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } }
          }
        },
        post: {
          tags: ['Routes'],
          summary: 'Create new route',
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Route' }
              }
            }
          },
          responses: {
            201: { description: 'Route created successfully' },
            400: { $ref: '#/components/responses/ValidationError' }
          }
        },
        delete: {
          tags: ['Routes'],
          summary: 'Delete routes (bulk operation)',
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ids: { type: 'array', items: { type: 'string' } }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Routes deleted successfully' },
            400: { $ref: '#/components/responses/ValidationError' }
          }
        }
      },
      '/routes/{routeNumber}/buses': {
        get: {
          tags: ['Routes'],
          summary: 'Get buses operating on specific route',
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: 'routeNumber',
              in: 'path',
              required: true,
              description: 'Route number (e.g., 001, 138)',
              schema: { type: 'string' }
            }
          ],
          responses: {
            200: { description: 'Success', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
            404: { $ref: '#/components/responses/NotFoundError' }
          }
        }
      },
      
      // Trip Endpoints
      '/trips/{id}': {
        get: {
          tags: ['Trips'],
          summary: 'Get trip by ID',
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: 'Trip ObjectId',
              schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' }
            }
          ],
          responses: {
            200: { description: 'Success', content: { 'application/json': { schema: { $ref: '#/components/schemas/Trip' } } } },
            404: { $ref: '#/components/responses/NotFoundError' }
          }
        }
      },
      
      // Search Endpoints
      '/search/combined': {
        get: {
          tags: ['Search', 'Public'],
          summary: 'Combined search with advanced filters',
          security: [],
          parameters: [
            { name: 'start', in: 'query', required: true, schema: { type: 'string', enum: ['Colombo Fort', 'Kandy', 'Galle', 'Matara', 'Badulla', 'Anuradhapura'] }, example: 'Colombo Fort' },
            { name: 'end', in: 'query', required: false, schema: { type: 'string', enum: ['Colombo Fort', 'Kandy', 'Galle', 'Matara', 'Badulla', 'Anuradhapura'] }, example: 'Kandy' },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 10 } },
            { name: 'minFare', in: 'query', required: false, schema: { type: 'number', minimum: 460, maximum: 2100 }, example: 500 },
            { name: 'maxFare', in: 'query', required: false, schema: { type: 'number', minimum: 460, maximum: 2100 }, example: 2000 },
            { name: 'date', in: 'query', required: false, schema: { type: 'string', format: 'date' }, example: '2025-10-10' },
            { name: 'busType', in: 'query', required: false, schema: { type: 'string', enum: ['Normal', 'Express', 'Intercity Express'] }, example: 'Express' }
          ],
          responses: {
            200: { description: 'Search results', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
          }
        }
      },
      '/search/routes': {
        get: {
          tags: ['Search', 'Public'],
          summary: 'Search routes with filters',
          security: [],
          parameters: [
            { name: 'page', in: 'query', required: false, schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 10 } },
            { name: 'start', in: 'query', required: false, schema: { type: 'string', enum: ['Colombo Fort', 'Kandy', 'Galle', 'Matara', 'Badulla', 'Anuradhapura'] }, example: 'Colombo Fort' },
            { name: 'minDistance', in: 'query', required: false, schema: { type: 'number', minimum: 0, maximum: 500 }, example: 100 },
            { name: 'maxDistance', in: 'query', required: false, schema: { type: 'number', minimum: 0, maximum: 500 }, example: 200 },
            { name: 'sortBy', in: 'query', required: false, schema: { type: 'string', enum: ['distance', 'duration', 'name'] }, example: 'distance' },
            { name: 'sortOrder', in: 'query', required: false, schema: { type: 'string', enum: ['asc', 'desc'] }, example: 'desc' },
            { name: 'stops', in: 'query', required: false, schema: { type: 'string', enum: ['Haputale', 'Kadugannawa', 'Gampaha', 'Aluthgama', 'Hikkaduwa', 'Balangoda', 'Dambulla', 'Avissawella'] }, example: 'Haputale' }
          ],
          responses: {
            200: { description: 'Route search results', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } }
          }
        }
      },
      '/search/advanced': {
        get: {
          tags: ['Search', 'Public'],
          summary: 'Advanced search with multiple criteria',
          security: [],
          parameters: [
            { name: 'start', in: 'query', required: true, schema: { type: 'string', enum: ['Colombo Fort', 'Kandy', 'Galle', 'Matara', 'Badulla', 'Anuradhapura'] }, example: 'Colombo Fort' },
            { name: 'end', in: 'query', required: true, schema: { type: 'string', enum: ['Colombo Fort', 'Kandy', 'Galle', 'Matara', 'Badulla', 'Anuradhapura'] }, example: 'Kandy' },
            { name: 'minFare', in: 'query', required: false, schema: { type: 'number', minimum: 460, maximum: 2100 }, example: 500 },
            { name: 'maxFare', in: 'query', required: false, schema: { type: 'number', minimum: 460, maximum: 2100 }, example: 2000 }
          ],
          responses: {
            200: { description: 'Advanced search results', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
          }
        }
      },
      '/search/trips': {
        get: {
          tags: ['Search', 'Public'],
          summary: 'Search trips with filters',
          security: [],
          parameters: [
            { name: 'date', in: 'query', required: false, schema: { type: 'string', format: 'date' }, example: '2025-10-10' },
            { name: 'minFare', in: 'query', required: false, schema: { type: 'number', minimum: 460, maximum: 2100 }, example: 500 },
            { name: 'maxFare', in: 'query', required: false, schema: { type: 'number', minimum: 460, maximum: 2100 }, example: 2000 }
          ],
          responses: {
            200: { description: 'Trip search results', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
          }
        }
      },
      
      // Location Endpoints
      '/locations/update': {
        post: {
          tags: ['Location Management'],
          summary: 'Update bus location (Driver/Operator)',
          description: 'Allows drivers and operators to update real-time GPS coordinates for their assigned buses',
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['busId', 'latitude', 'longitude'],
                  properties: {
                    busId: {
                      type: 'string',
                      format: 'ObjectId',
                      description: 'MongoDB ObjectId of the bus',
                      example: '60d21b4667d0d8992e610c85'
                    },
                    latitude: {
                      type: 'number',
                      minimum: -90,
                      maximum: 90,
                      description: 'GPS latitude coordinate',
                      example: 6.9271
                    },
                    longitude: {
                      type: 'number',
                      minimum: -180,
                      maximum: 180,
                      description: 'GPS longitude coordinate',
                      example: 79.8612
                    }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Location updated successfully',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ApiResponse'
                  },
                  example: {
                    statusCode: 200,
                    success: true,
                    message: 'Location updated successfully',
                    data: {
                      locationId: '60d21b4667d0d8992e610c86',
                      busId: '60d21b4667d0d8992e610c85',
                      coordinates: {
                        latitude: 6.9271,
                        longitude: 79.8612
                      },
                      timestamp: '2024-01-15T10:30:00.000Z',
                      updatedBy: '60d21b4667d0d8992e610c84'
                    },
                    timestamp: '2024-01-15T10:30:00.000Z'
                  }
                }
              }
            },
            400: {
              description: 'Invalid request data',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse'
                  },
                  example: {
                    statusCode: 400,
                    success: false,
                    message: 'Validation failed',
                    error: 'Invalid coordinates provided'
                  }
                }
              }
            },
            401: {
              $ref: '#/components/responses/UnauthorizedError'
            },
            403: {
              description: 'Insufficient permissions',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse'
                  },
                  example: {
                    statusCode: 403,
                    success: false,
                    message: 'Access denied',
                    error: 'Only drivers and operators can update locations'
                  }
                }
              }
            },
            404: {
              description: 'Bus not found',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse'
                  },
                  example: {
                    statusCode: 404,
                    success: false,
                    message: 'Bus not found'
                  }
                }
              }
            },
            500: {
              description: 'Server error',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse'
                  }
                }
              }
            }
          }
        }
      },
      '/locations/{busId}/history': {
        get: {
          tags: ['Location Management'],
          summary: 'Get bus location history',
          description: 'Retrieve historical location data for a specific bus',
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: 'busId',
              in: 'path',
              required: true,
              description: 'Bus MongoDB ObjectId',
              schema: {
                type: 'string',
                format: 'ObjectId',
                pattern: '^[a-fA-F0-9]{24}$'
              },
              example: '60d21b4667d0d8992e610c85'
            },
            {
              name: 'limit',
              in: 'query',
              required: false,
              description: 'Number of records to return',
              schema: {
                type: 'integer',
                minimum: 1,
                maximum: 100,
                default: 50
              }
            },
            {
              name: 'startDate',
              in: 'query',
              required: false,
              description: 'Start date for filtering (ISO 8601)',
              schema: {
                type: 'string',
                format: 'date-time'
              },
              example: '2024-01-15T00:00:00.000Z'
            },
            {
              name: 'endDate',
              in: 'query',
              required: false,
              description: 'End date for filtering (ISO 8601)',
              schema: {
                type: 'string',
                format: 'date-time'
              },
              example: '2024-01-15T23:59:59.999Z'
            }
          ],
          responses: {
            200: {
              description: 'Location history retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ApiResponse'
                  },
                  example: {
                    statusCode: 200,
                    success: true,
                    message: 'Location history retrieved successfully',
                    data: [
                      {
                        _id: '60d21b4667d0d8992e610c86',
                        bus: '60d21b4667d0d8992e610c85',
                        coordinates: {
                          latitude: 6.9271,
                          longitude: 79.8612
                        },
                        timestamp: '2024-01-15T10:30:00.000Z',
                        updatedBy: '60d21b4667d0d8992e610c84'
                      }
                    ],
                    count: 1,
                    timestamp: '2024-01-15T10:30:00.000Z'
                  }
                }
              }
            },
            401: {
              $ref: '#/components/responses/UnauthorizedError'
            },
            404: {
              description: 'Bus not found',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse'
                  }
                }
              }
            }
          }
        }
      },
      '/locations/current': {
        get: {
          tags: ['Location Management', 'Public'],
          summary: 'Get current locations of all buses',
          description: 'Public endpoint to retrieve latest location data for all active buses',
          security: [],
          responses: {
            200: {
              description: 'Current locations retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ApiResponse'
                  },
                  example: {
                    statusCode: 200,
                    success: true,
                    message: 'Current locations retrieved successfully',
                    data: [
                      {
                        busId: '60d21b4667d0d8992e610c85',
                        busNumber: 'NTC-001',
                        coordinates: {
                          latitude: 6.9271,
                          longitude: 79.8612
                        },
                        lastUpdated: '2024-01-15T10:30:00.000Z'
                      }
                    ],
                    count: 1,
                    timestamp: '2024-01-15T10:30:00.000Z'
                  }
                }
              }
            },
            500: {
              description: 'Server error',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse'
                  }
                }
              }
            }
          }
        }
      },

      // System Endpoints
      '/health': {
        get: {
          tags: ['System', 'Public'],
          summary: 'Health check endpoint',
          security: [],
          responses: {
            200: { 
              description: 'Service is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'OK' },
                      timestamp: { type: 'string', format: 'date-time' },
                      uptime: { type: 'number' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/docs': {
        get: {
          tags: ['System', 'Public'],
          summary: 'API Documentation',
          security: [],
          responses: {
            200: { description: 'API documentation page' }
          }
        }
      }
    }
  },
  apis: []
};

const specs = swaggerJsdoc(options);

export default { options, specs, swaggerUi };