import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Authentication Middleware - Verifies JWT token and attaches user to request
 * This middleware ensures that only authenticated users can access protected routes
 * It extracts the JWT token from the Authorization header and validates it
 */
export const authenticate = async (req, res, next) => {
  try {
    // Extract token from Authorization header (format: "Bearer <token>")
    let token;
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Remove "Bearer " prefix to get just the token
      token = authHeader.substring(7);
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        statusCode: 401,
        success: false,
        message: 'Access denied. Authentication token is required.',
        error: 'NO_TOKEN_PROVIDED'
      });
    }

    // Verify JWT token using the secret key
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find the user in database to ensure they still exist and are active
    const user = await User.findById(decoded.userId).select('+permissions');
    
    if (!user) {
      return res.status(401).json({
        statusCode: 401,
        success: false,
        message: 'Access denied. User account not found.',
        error: 'USER_NOT_FOUND'
      });
    }

    // Check if user account is still active
    if (!user.isActive) {
      return res.status(401).json({
        statusCode: 401,
        success: false,
        message: 'Access denied. User account has been deactivated.',
        error: 'ACCOUNT_DEACTIVATED'
      });
    }

    // Attach user information to request object for use in subsequent middleware/routes
    req.user = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      profile: user.profile
    };

    next(); // Continue to next middleware or route handler
    
  } catch (error) {
    // Handle different types of JWT errors with specific messages
    let errorMessage = 'Access denied. Invalid authentication token.';
    let errorCode = 'INVALID_TOKEN';

    if (error.name === 'TokenExpiredError') {
      errorMessage = 'Access denied. Authentication token has expired.';
      errorCode = 'TOKEN_EXPIRED';
    } else if (error.name === 'JsonWebTokenError') {
      errorMessage = 'Access denied. Malformed authentication token.';
      errorCode = 'MALFORMED_TOKEN';
    }

    return res.status(401).json({
      statusCode: 401,
      success: false,
      message: errorMessage,
      error: errorCode
    });
  }
};

/**
 * Role-Based Authorization Middleware
 * This middleware checks if the authenticated user has the required role(s)
 * Usage: authorize(['admin', 'operator']) - allows admin OR operator
 */
export const authorize = (allowedRoles) => {
  return (req, res, next) => {
    // Ensure user is authenticated first (should have req.user from authenticate middleware)
    if (!req.user) {
      return res.status(401).json({
        statusCode: 401,
        success: false,
        message: 'Authentication required. Please log in first.',
        error: 'AUTHENTICATION_REQUIRED'
      });
    }

    // Check if user's role is in the allowed roles array
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        statusCode: 403,
        success: false,
        message: `Access forbidden. Required role(s): ${allowedRoles.join(', ')}. Your role: ${req.user.role}`,
        error: 'INSUFFICIENT_ROLE_PERMISSIONS',
        requiredRoles: allowedRoles,
        userRole: req.user.role
      });
    }

    next(); // User has required role, continue to route handler
  };
};

/**
 * Permission-Based Authorization Middleware
 * This middleware checks if the user has specific permissions for resource and action
 * Usage: requirePermission('routes', 'create') - requires create permission on routes resource
 */
export const requirePermission = (resource, action) => {
  return (req, res, next) => {
    // Ensure user is authenticated first
    if (!req.user) {
      return res.status(401).json({
        statusCode: 401,
        success: false,
        message: 'Authentication required. Please log in first.',
        error: 'AUTHENTICATION_REQUIRED'
      });
    }

    // Check if user has permissions array
    if (!req.user.permissions || !Array.isArray(req.user.permissions)) {
      return res.status(403).json({
        statusCode: 403,
        success: false,
        message: 'Access forbidden. No permissions configured for your account.',
        error: 'NO_PERMISSIONS_CONFIGURED'
      });
    }

    // Find permission for the requested resource
    const resourcePermission = req.user.permissions.find(
      perm => perm.resource === resource
    );

    // Check if user has permission for this resource
    if (!resourcePermission) {
      return res.status(403).json({
        statusCode: 403,
        success: false,
        message: `Access forbidden. You don't have permissions for resource: ${resource}`,
        error: 'RESOURCE_ACCESS_DENIED',
        resource: resource,
        action: action
      });
    }

    // Check if user has permission for the specific action
    if (!resourcePermission.actions.includes(action)) {
      return res.status(403).json({
        statusCode: 403,
        success: false,
        message: `Access forbidden. You don't have '${action}' permission for resource: ${resource}`,
        error: 'ACTION_ACCESS_DENIED',
        resource: resource,
        action: action,
        allowedActions: resourcePermission.actions
      });
    }

    next(); // User has required permission, continue to route handler
  };
};

/**
 * Admin-Only Access Middleware
 * Convenience middleware for routes that should only be accessible by administrators
 */
export const adminOnly = (req, res, next) => {
  return authorize(['admin'])(req, res, next);
};

/**
 * Operator or Admin Access Middleware  
 * Convenience middleware for routes that should be accessible by operators and admins
 */
export const operatorOrAdmin = (req, res, next) => {
  return authorize(['operator', 'admin'])(req, res, next);
};

/**
 * Self or Admin Access Middleware
 * Allows users to access their own data or admins to access any user's data
 * Checks if the requested user ID matches the authenticated user's ID or if user is admin
 */
export const selfOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      statusCode: 401,
      success: false,
      message: 'Authentication required. Please log in first.',
      error: 'AUTHENTICATION_REQUIRED'
    });
  }

  // Allow if user is admin
  if (req.user.role === 'admin') {
    return next();
  }

  // Allow if user is accessing their own data
  const requestedUserId = req.params.userId || req.params.id;
  if (requestedUserId && requestedUserId === req.user.id.toString()) {
    return next();
  }

  return res.status(403).json({
    statusCode: 403,
    success: false,
    message: 'Access forbidden. You can only access your own data.',
    error: 'SELF_ACCESS_ONLY'
  });
};