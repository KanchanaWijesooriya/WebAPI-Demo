import express from 'express';
import bcrypt from 'bcryptjs';
import { 
  authenticate, 
  adminOnly, 
  selfOrAdmin,
  requirePermission 
} from '../middleware/rbac.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: User Management
 *   description: User account management operations with role-based access control
 */

/**
 * USER MANAGEMENT ROUTES WITH ROLE-BASED ACCESS CONTROL
 * These routes manage user accounts with strict permission controls
 */

// ==================== ADMIN-ONLY USER MANAGEMENT ====================

/**
 * @swagger
 * /users:
 *   get:
 *     tags: [User Management]
 *     summary: List all users
 *     description: Retrieve all system users (Admin only)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - name: role
 *         in: query
 *         description: Filter users by role
 *         schema:
 *           type: string
 *           enum: [admin, operator, driver, passenger]
 *       - name: isActive
 *         in: query
 *         description: Filter by active status
 *         schema:
 *           type: boolean
 *       - name: search
 *         in: query
 *         description: Search by name, email or phone
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/PaginatedResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         users:
 *                           type: array
 *                           items:
 *                             allOf:
 *                               - $ref: '#/components/schemas/User'
 *                               - type: object
 *                                 properties:
 *                                   password:
 *                                     type: string
 *                                     readOnly: true
 *                                     description: Password field excluded from response
 *                         statistics:
 *                           type: object
 *                           properties:
 *                             totalUsers:
 *                               type: integer
 *                             activeUsers:
 *                               type: integer
 *                             usersByRole:
 *                               type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */

/**
 * GET /api/users - List all users (Admin only)
 * Only administrators can view the complete list of system users
 * This is sensitive information that requires the highest level of access
 */
router.get('/',
  authenticate,              // Must be logged in
  adminOnly,                // Must be admin role
  async (req, res) => {
    try {
      const User = (await import('../models/User.js')).default;
      
      // Get all users but exclude sensitive password information
      const users = await User.find({})
        .select('-password -__v')
        .sort({ createdAt: -1 });
      
      // Provide statistics for admin dashboard
      const userStats = {
        total: users.length,
        active: users.filter(u => u.isActive).length,
        inactive: users.filter(u => !u.isActive).length,
        byRole: users.reduce((acc, user) => {
          acc[user.role] = (acc[user.role] || 0) + 1;
          return acc;
        }, {})
      };
      
      res.status(200).json({
        statusCode: 200,
        success: true,
        message: 'Users retrieved successfully',
        data: {
          users,
          statistics: userStats,
          requestedBy: {
            userId: req.user.id,
            username: req.user.username,
            role: req.user.role
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        statusCode: 500,
        success: false,
        message: 'Failed to retrieve users',
        error: error.message
      });
    }
  }
);

/**
 * POST /api/users - Create new user (Admin only with user creation permission)
 * Only administrators with specific user creation permissions can add new users
 * This ensures controlled access to system user creation
 */
router.post('/',
  authenticate,
  requirePermission('users', 'create'),
  async (req, res) => {
    try {
      const User = (await import('../models/User.js')).default;
      const { username, email, password, role, profile, permissions } = req.body;
      
      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email }, { username }]
      });
      
      if (existingUser) {
        return res.status(400).json({
          statusCode: 400,
          success: false,
          message: 'User with this email or username already exists',
          error: 'USER_ALREADY_EXISTS'
        });
      }
      
      // Hash password with strong encryption
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      
      // Create new user with all provided information
      const newUser = await User.create({
        username,
        email,
        password: hashedPassword,
        role,
        profile,
        permissions,
        isActive: true,
        createdBy: req.user.id,
        createdAt: new Date()
      });
      
      // Return user data without password
      const userResponse = newUser.toObject();
      delete userResponse.password;
      
      res.status(201).json({
        statusCode: 201,
        success: true,
        message: 'User created successfully',
        data: {
          user: userResponse,
          createdBy: {
            userId: req.user.id,
            username: req.user.username,
            role: req.user.role
          }
        }
      });
    } catch (error) {
      res.status(400).json({
        statusCode: 400,
        success: false,
        message: 'Failed to create user',
        error: error.message
      });
    }
  }
);

/**
 * PUT /api/users/:id/role - Update user role (Admin only)
 * Only administrators can change user roles
 * This is a critical security operation that affects user permissions
 */
router.put('/:id/role',
  authenticate,
  adminOnly,
  async (req, res) => {
    try {
      const User = (await import('../models/User.js')).default;
      const { role, permissions } = req.body;
      
      // Prevent admin from changing their own role (security measure)
      if (req.params.id === req.user.id.toString()) {
        return res.status(403).json({
          statusCode: 403,
          success: false,
          message: 'You cannot change your own role for security reasons',
          error: 'SELF_ROLE_CHANGE_FORBIDDEN'
        });
      }
      
      const updatedUser = await User.findByIdAndUpdate(
        req.params.id,
        { 
          role, 
          permissions,
          updatedBy: req.user.id,
          updatedAt: new Date()
        },
        { new: true, runValidators: true }
      ).select('-password');
      
      if (!updatedUser) {
        return res.status(404).json({
          statusCode: 404,
          success: false,
          message: 'User not found'
        });
      }
      
      res.status(200).json({
        statusCode: 200,
        success: true,
        message: 'User role updated successfully',
        data: {
          user: updatedUser,
          updatedBy: {
            userId: req.user.id,
            username: req.user.username,
            role: req.user.role
          }
        }
      });
    } catch (error) {
      res.status(400).json({
        statusCode: 400,
        success: false,
        message: 'Failed to update user role',
        error: error.message
      });
    }
  }
);

/**
 * PUT /api/users/:id/status - Activate/Deactivate user (Admin only)
 * Only administrators can activate or deactivate user accounts
 * This is used for account suspension without deleting user data
 */
router.put('/:id/status',
  authenticate,
  adminOnly,
  async (req, res) => {
    try {
      const User = (await import('../models/User.js')).default;
      const { isActive } = req.body;
      
      // Prevent admin from deactivating their own account
      if (req.params.id === req.user.id.toString() && !isActive) {
        return res.status(403).json({
          statusCode: 403,
          success: false,
          message: 'You cannot deactivate your own account',
          error: 'SELF_DEACTIVATION_FORBIDDEN'
        });
      }
      
      const updatedUser = await User.findByIdAndUpdate(
        req.params.id,
        { 
          isActive,
          updatedBy: req.user.id,
          updatedAt: new Date()
        },
        { new: true }
      ).select('-password');
      
      if (!updatedUser) {
        return res.status(404).json({
          statusCode: 404,
          success: false,
          message: 'User not found'
        });
      }
      
      res.status(200).json({
        statusCode: 200,
        success: true,
        message: `User account ${isActive ? 'activated' : 'deactivated'} successfully`,
        data: {
          user: updatedUser,
          action: isActive ? 'activated' : 'deactivated',
          updatedBy: {
            userId: req.user.id,
            username: req.user.username,
            role: req.user.role
          }
        }
      });
    } catch (error) {
      res.status(400).json({
        statusCode: 400,
        success: false,
        message: 'Failed to update user status',
        error: error.message
      });
    }
  }
);

// ==================== SELF OR ADMIN ACCESS ====================

/**
 * GET /api/users/:id - Get user details (Self or Admin)
 * Users can view their own profile, administrators can view any user's profile
 * This implements the principle of users having access to their own data
 */
router.get('/:id',
  authenticate,
  selfOrAdmin,
  async (req, res) => {
    try {
      const User = (await import('../models/User.js')).default;
      
      const user = await User.findById(req.params.id).select('-password -__v');
      
      if (!user) {
        return res.status(404).json({
          statusCode: 404,
          success: false,
          message: 'User not found'
        });
      }
      
      res.status(200).json({
        statusCode: 200,
        success: true,
        message: 'User details retrieved successfully',
        data: {
          user,
          accessType: req.user.role === 'admin' ? 'admin_access' : 'self_access',
          requestedBy: {
            userId: req.user.id,
            username: req.user.username,
            role: req.user.role
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        statusCode: 500,
        success: false,
        message: 'Failed to retrieve user details',
        error: error.message
      });
    }
  }
);

/**
 * PUT /api/users/:id/profile - Update user profile (Self or Admin)
 * Users can update their own profile information
 * Administrators can update any user's profile
 */
router.put('/:id/profile',
  authenticate,
  selfOrAdmin,
  async (req, res) => {
    try {
      const User = (await import('../models/User.js')).default;
      
      // Handle both wrapped profile object and direct profile fields
      const profileData = req.body.profile || req.body;
      
      // Build update object with profile fields
      const updateData = {
        updatedBy: req.user.id,
        updatedAt: new Date()
      };
      
      // Add profile fields with dot notation for partial updates
      Object.keys(profileData).forEach(key => {
        if (['firstName', 'lastName', 'contactNumber', 'organization', 'licenseNumber', 'employeeId', 'department'].includes(key)) {
          updateData[`profile.${key}`] = profileData[key];
        }
      });
      
      const updatedUser = await User.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      ).select('-password -__v');
      
      if (!updatedUser) {
        return res.status(404).json({
          statusCode: 404,
          success: false,
          message: 'User not found'
        });
      }
      
      res.status(200).json({
        statusCode: 200,
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: updatedUser,
          updatedBy: {
            userId: req.user.id,
            username: req.user.username,
            role: req.user.role
          }
        }
      });
    } catch (error) {
      res.status(400).json({
        statusCode: 400,
        success: false,
        message: 'Failed to update profile',
        error: error.message
      });
    }
  }
);

/**
 * PUT /api/users/:id/password - Change password (Self or Admin)
 * Users can change their own password
 * Administrators can reset any user's password
 */
router.put('/:id/password',
  authenticate,
  selfOrAdmin,
  async (req, res) => {
    try {
      const User = (await import('../models/User.js')).default;
      const { currentPassword, newPassword } = req.body;
      
      const user = await User.findById(req.params.id).select('+password');
      
      if (!user) {
        return res.status(404).json({
          statusCode: 404,
          success: false,
          message: 'User not found'
        });
      }
      
      // If user is changing their own password, verify current password
      if (req.params.id === req.user.id.toString()) {
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
          return res.status(400).json({
            statusCode: 400,
            success: false,
            message: 'Current password is incorrect',
            error: 'INVALID_CURRENT_PASSWORD'
          });
        }
      }
      // Admin can reset password without knowing current password
      
      // Hash new password
      const saltRounds = 12;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
      
      await User.findByIdAndUpdate(req.params.id, {
        password: hashedNewPassword,
        updatedBy: req.user.id,
        updatedAt: new Date()
      });
      
      res.status(200).json({
        statusCode: 200,
        success: true,
        message: 'Password updated successfully',
        data: {
          action: req.params.id === req.user.id.toString() ? 'password_changed' : 'password_reset',
          updatedBy: {
            userId: req.user.id,
            username: req.user.username,
            role: req.user.role
          }
        }
      });
    } catch (error) {
      res.status(400).json({
        statusCode: 400,
        success: false,
        message: 'Failed to update password',
        error: error.message
      });
    }
  }
);

/**
 * DELETE /api/users/:id - Delete user account (Admin only)
 * Permanently removes a user account from the system
 */
router.delete('/:id',
  authenticate,              // Must be logged in
  adminOnly,                // Must be admin role
  async (req, res) => {
    try {
      const User = (await import('../models/User.js')).default;
      const { id } = req.params;
      
      // Find the user to be deleted
      const userToDelete = await User.findById(id).select('-password');
      
      if (!userToDelete) {
        return res.status(404).json({
          statusCode: 404,
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        });
      }
      
      // Prevent admin from deleting themselves
      if (userToDelete._id.toString() === req.user.id.toString()) {
        return res.status(400).json({
          statusCode: 400,
          success: false,
          message: 'Cannot delete your own account',
          error: 'CANNOT_DELETE_SELF'
        });
      }
      
      // Delete the user
      await User.findByIdAndDelete(id);
      
      res.status(200).json({
        statusCode: 200,
        success: true,
        message: 'User account deleted successfully',
        data: {
          deletedUser: {
            id: userToDelete._id,
            username: userToDelete.username,
            email: userToDelete.email,
            role: userToDelete.role
          },
          deletedBy: {
            userId: req.user.id,
            username: req.user.username,
            role: req.user.role
          },
          deletedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(500).json({
        statusCode: 500,
        success: false,
        message: 'Failed to delete user account',
        error: error.message
      });
    }
  }
);

export default router;