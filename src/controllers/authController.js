import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';

class AuthController {
  // Generate JWT token
  static generateToken(userId) {
    return jwt.sign({ userId }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || '7d'
    });
  }

  // POST /api/auth/register - User registration
  static async register(req, res, next) {
    try {
      const { username, email, password, role, profile } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email }, { username }]
      });

      if (existingUser) {
        return next(new ApiError(400, 'User with this email or username already exists'));
      }

      // Create user
      const user = await User.create({
        username,
        email,
        password,
        role: role || 'viewer',
        profile
      });

      // Generate token
      const token = AuthController.generateToken(user._id);

      // Remove password from response
      user.password = undefined;

      res.status(201).json(new ApiResponse(201, {
        user,
        token
      }, 'User registered successfully'));
    } catch (error) {
      if (error.name === 'ValidationError') {
        return next(new ApiError(400, error.message));
      }
      next(new ApiError(500, 'Error during registration'));
    }
  }

  // POST /api/auth/login - User login
  static async login(req, res, next) {
    try {
      const { email, password } = req.body;

      // Validate input
      if (!email || !password) {
        return next(new ApiError(400, 'Please provide email and password'));
      }

      // Find user and include password for comparison
      const user = await User.findOne({ email }).select('+password');

      if (!user || !(await bcrypt.compare(password, user.password))) {
        return next(new ApiError(401, 'Invalid email or password'));
      }

      // Check if user is active
      if (!user.isActive) {
        return next(new ApiError(401, 'Account is deactivated. Please contact administrator'));
      }

      // Generate token
      const token = AuthController.generateToken(user._id);

      // Update last login
      user.lastLogin = new Date();
      await user.save({ validateBeforeSave: false });

      // Remove password from response
      user.password = undefined;

      res.status(200).json(new ApiResponse(200, {
        user,
        token
      }, 'Login successful'));
    } catch (error) {
      next(new ApiError(500, 'Error during login'));
    }
  }

  // GET /api/auth/profile - Get user profile
  static async getProfile(req, res, next) {
    try {
      const user = await User.findById(req.user.id);
      
      if (!user) {
        return next(new ApiError(404, 'User not found'));
      }

      res.status(200).json(new ApiResponse(200, user, 'Profile retrieved successfully'));
    } catch (error) {
      next(new ApiError(500, 'Error retrieving profile'));
    }
  }

  // PUT /api/auth/profile - Update user profile
  static async updateProfile(req, res, next) {
    try {
      const { profile } = req.body;
      
      const user = await User.findByIdAndUpdate(
        req.user.id,
        { profile },
        { new: true, runValidators: true }
      );

      if (!user) {
        return next(new ApiError(404, 'User not found'));
      }

      res.status(200).json(new ApiResponse(200, user, 'Profile updated successfully'));
    } catch (error) {
      if (error.name === 'ValidationError') {
        return next(new ApiError(400, error.message));
      }
      next(new ApiError(500, 'Error updating profile'));
    }
  }

  // POST /api/auth/change-password - Change password
  static async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return next(new ApiError(400, 'Please provide current and new password'));
      }

      // Get user with password
      const user = await User.findById(req.user.id).select('+password');

      // Check current password
      if (!(await bcrypt.compare(currentPassword, user.password))) {
        return next(new ApiError(400, 'Current password is incorrect'));
      }

      // Update password
      user.password = newPassword;
      await user.save();

      res.status(200).json(new ApiResponse(200, null, 'Password changed successfully'));
    } catch (error) {
      next(new ApiError(500, 'Error changing password'));
    }
  }
}

export default AuthController;