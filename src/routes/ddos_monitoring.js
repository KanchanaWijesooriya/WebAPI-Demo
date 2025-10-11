import express from 'express';
import { authenticate, authorize } from '../middleware/rbac.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: DDoS Monitoring
 *   description: DDoS protection monitoring and statistics (Admin only)
 */

// In-memory stats (in production, use Redis or database)
let ddosStats = {
  totalRequests: 0,
  blockedRequests: 0,
  suspiciousRequests: 0,
  topIPs: new Map(),
  rateLimitHits: {
    general: 0,
    auth: 0,
    search: 0,
    admin: 0,
    suspicious: 0
  },
  lastReset: new Date(),
  emergencyMode: false
};

/**
 * @swagger
 * /admin/ddos-status:
 *   get:
 *     tags: [DDoS Monitoring]
 *     summary: Get DDoS protection status
 *     description: Retrieve comprehensive DDoS protection statistics and monitoring data (Admin only)
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: DDoS protection status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         totalRequests:
 *                           type: integer
 *                           description: Total requests processed
 *                         blockedRequests:
 *                           type: integer
 *                           description: Requests blocked by DDoS protection
 *                         suspiciousRequests:
 *                           type: integer
 *                           description: Requests flagged as suspicious
 *                         blockingRate:
 *                           type: number
 *                           description: Percentage of blocked requests
 *                         topIPs:
 *                           type: object
 *                           description: Most active IP addresses
 *                         rateLimitHits:
 *                           type: object
 *                           properties:
 *                             general:
 *                               type: integer
 *                             auth:
 *                               type: integer
 *                             search:
 *                               type: integer
 *                             admin:
 *                               type: integer
 *                             suspicious:
 *                               type: integer
 *                         uptime:
 *                           type: integer
 *                           description: Monitoring uptime in milliseconds
 *                         emergencyMode:
 *                           type: boolean
 *                           description: Whether emergency mode is active
 *                         protectionLevel:
 *                           type: string
 *                           enum: [normal, elevated, high, critical]
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */

/**
 * GET /api/admin/ddos-status - Get DDoS protection status
 * Admin only endpoint to monitor security status
 */
router.get('/ddos-status', authenticate, authorize(['admin']), (req, res) => {
  const uptime = Date.now() - ddosStats.lastReset.getTime();
  
  // Convert Map to object for JSON response
  const topIPsArray = Array.from(ddosStats.topIPs.entries())
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([ip, count]) => ({ ip, requests: count }));
  
  res.json({
    success: true,
    message: 'DDoS protection status retrieved',
    data: {
      status: ddosStats.emergencyMode ? 'EMERGENCY' : 'ACTIVE',
      uptime: Math.floor(uptime / 1000), // seconds
      statistics: {
        totalRequests: ddosStats.totalRequests,
        blockedRequests: ddosStats.blockedRequests,
        suspiciousRequests: ddosStats.suspiciousRequests,
        blockRate: ddosStats.totalRequests > 0 
          ? ((ddosStats.blockedRequests / ddosStats.totalRequests) * 100).toFixed(2) + '%'
          : '0%'
      },
      rateLimits: {
        general: {
          name: 'General API',
          limit: '100 requests/15min',
          hits: ddosStats.rateLimitHits.general
        },
        authentication: {
          name: 'Authentication',
          limit: '10 requests/15min',
          hits: ddosStats.rateLimitHits.auth
        },
        search: {
          name: 'Search API',
          limit: '30 requests/1min',
          hits: ddosStats.rateLimitHits.search
        },
        admin: {
          name: 'Admin API',
          limit: '50 requests/5min',
          hits: ddosStats.rateLimitHits.admin
        },
        suspicious: {
          name: 'Suspicious Activity',
          limit: '3 requests/5min',
          hits: ddosStats.rateLimitHits.suspicious
        }
      },
      topIPs: topIPsArray,
      configuration: {
        advancedProtection: true,
        requestSizeLimit: '10MB',
        suspiciousPatternDetection: true,
        geoRateLimiting: false,
        emergencyMode: ddosStats.emergencyMode
      },
      lastReset: ddosStats.lastReset
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/admin/ddos-reset - Reset DDoS statistics
 * Admin only endpoint to reset monitoring stats
 */
router.post('/ddos-reset', authenticate, authorize(['admin']), (req, res) => {
  ddosStats = {
    totalRequests: 0,
    blockedRequests: 0,
    suspiciousRequests: 0,
    topIPs: new Map(),
    rateLimitHits: {
      general: 0,
      auth: 0,
      search: 0,
      admin: 0,
      suspicious: 0
    },
    lastReset: new Date(),
    emergencyMode: false
  };
  
  res.json({
    success: true,
    message: 'DDoS protection statistics reset successfully',
    data: {
      resetBy: req.user.username,
      resetAt: new Date().toISOString()
    }
  });
});

/**
 * POST /api/admin/emergency-mode - Toggle emergency mode
 * Ultra-strict rate limiting during attacks
 */
router.post('/emergency-mode', authenticate, authorize(['admin']), (req, res) => {
  const { enable } = req.body;
  
  ddosStats.emergencyMode = enable === true;
  
  console.log(`EMERGENCY: Emergency mode ${ddosStats.emergencyMode ? 'ACTIVATED' : 'DEACTIVATED'} by ${req.user.username}`);
  
  res.json({
    success: true,
    message: `Emergency mode ${ddosStats.emergencyMode ? 'activated' : 'deactivated'}`,
    data: {
      emergencyMode: ddosStats.emergencyMode,
      changedBy: req.user.username,
      timestamp: new Date().toISOString(),
      effectiveRates: ddosStats.emergencyMode ? {
        general: '5 requests/15min',
        auth: '3 requests/15min',
        search: '5 requests/5min',
        admin: '10 requests/5min'
      } : {
        general: '100 requests/15min',
        auth: '10 requests/15min',
        search: '30 requests/1min',
        admin: '50 requests/5min'
      }
    }
  });
});

// Export stats updater functions for use in middleware
export const updateDDoSStats = {
  incrementTotal: () => ddosStats.totalRequests++,
  incrementBlocked: () => ddosStats.blockedRequests++,
  incrementSuspicious: () => ddosStats.suspiciousRequests++,
  incrementRateLimit: (type) => {
    if (ddosStats.rateLimitHits[type] !== undefined) {
      ddosStats.rateLimitHits[type]++;
    }
  },
  trackIP: (ip) => {
    const current = ddosStats.topIPs.get(ip) || 0;
    ddosStats.topIPs.set(ip, current + 1);
  },
  isEmergencyMode: () => ddosStats.emergencyMode
};

export default router;