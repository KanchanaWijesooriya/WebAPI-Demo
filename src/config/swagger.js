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
      `,
      contact: {
        name: 'NTC Development Team',
        email: 'dev@ntc.gov.lk',
        url: 'https://ntc.gov.lk'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      },
      termsOfService: 'https://ntc.gov.lk/terms'
    },
    servers: [
      {
        url: 'https://localhost:3443/api',
        description: 'Development HTTPS Server'
      },
      {
        url: 'http://localhost:3000/api',
        description: 'Development HTTP Server'
      },
      {
        url: 'https://ntc-bustracking.me/api',
        description: 'Production Server'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Authorization header using the Bearer scheme.'
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
              enum: ['Normal', 'Semi-Luxury', 'Luxury', 'Express', 'Intercity'],
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
    ]
  },
  apis: [
    './src/routes/*.js',
    './src/controllers/*.js',
    './src/models/*.js'
  ]
};

const specs = swaggerJsdoc(options);

export default { options, specs, swaggerUi };