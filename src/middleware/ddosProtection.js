/**
 * Advanced DDoS Protection Middleware
 * Provides additional layers of protection against sophisticated attacks
 */

import rateLimit from 'express-rate-limit';

// Import monitoring functions (will be imported after module loads)
let updateStats = null;
setTimeout(async () => {
  try {
    const monitoring = await import('../routes/ddos_monitoring.js');
    updateStats = monitoring.updateDDoSStats;
  } catch (error) {
    console.warn('DDoS monitoring not available:', error.message);
  }
}, 1000);

/**
 * IP Whitelist for trusted sources (can be configured via environment)
 */
const TRUSTED_IPS = (process.env.TRUSTED_IPS || '127.0.0.1,::1').split(',');

/**
 * Suspicious patterns that might indicate an attack
 */
const SUSPICIOUS_PATTERNS = [
  /bot|crawler|spider|scraper/i,
  /attack|hack|exploit/i,
  /\.\.|\/\/|\\\\/, // Directory traversal attempts
  /<script|javascript:|vbscript:/i, // XSS attempts
];

/**
 * Advanced request analysis middleware
 */
export const advancedDDoSProtection = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || '';
  const requestPath = req.path;
  const requestMethod = req.method;
  
  // Update monitoring stats
  if (updateStats) {
    updateStats.incrementTotal();
    updateStats.trackIP(clientIP);
  }
  
  // Skip protection for trusted IPs
  if (TRUSTED_IPS.includes(clientIP)) {
    return next();
  }
  
  // Analyze request for suspicious patterns
  const suspiciousScore = calculateSuspiciousScore(req, userAgent, requestPath);
  
  // If highly suspicious, apply strict rate limiting
  if (suspiciousScore >= 3) {
    console.warn(`ALERT: Suspicious request detected from ${clientIP}:`, {
      userAgent,
      path: requestPath,
      method: requestMethod,
      score: suspiciousScore,
      timestamp: new Date().toISOString()
    });
    
    // Update monitoring stats
    if (updateStats) {
      updateStats.incrementSuspicious();
    }
    
    // Apply immediate strict rate limiting
    return applyStrictLimiting(req, res, next);
  }
  
  // Log moderate suspicious activity
  if (suspiciousScore >= 2) {
    console.log(`WARNING: Moderately suspicious request from ${clientIP}:`, {
      userAgent,
      path: requestPath,
      score: suspiciousScore
    });
    
    if (updateStats) {
      updateStats.incrementSuspicious();
    }
  }
  
  next();
};

/**
 * Calculate suspicious score based on various factors
 */
const calculateSuspiciousScore = (req, userAgent, requestPath) => {
  let score = 0;
  
  // Check user agent for suspicious patterns
  SUSPICIOUS_PATTERNS.forEach(pattern => {
    if (pattern.test(userAgent)) score += 1;
  });
  
  // Check for missing or unusual user agent
  if (!userAgent || userAgent.length < 10) score += 1;
  
  // Check for unusual request patterns
  if (requestPath.includes('..') || requestPath.includes('//')) score += 2;
  
  // Check for rapid sequential requests (basic fingerprinting)
  const clientIP = req.ip;
  if (isRapidRequests(clientIP)) score += 1;
  
  // Check for unusual headers
  const unusualHeaders = ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip'];
  let headerCount = 0;
  unusualHeaders.forEach(header => {
    if (req.get(header)) headerCount++;
  });
  if (headerCount > 2) score += 1;
  
  return score;
};

/**
 * Simple rapid request detection (in production, use Redis or similar)
 */
const requestHistory = new Map();

const isRapidRequests = (clientIP) => {
  const now = Date.now();
  const history = requestHistory.get(clientIP) || [];
  
  // Add current request
  history.push(now);
  
  // Keep only requests from last 10 seconds
  const recentRequests = history.filter(time => now - time < 10000);
  requestHistory.set(clientIP, recentRequests);
  
  // More than 10 requests in 10 seconds is suspicious
  return recentRequests.length > 10;
};

/**
 * Apply strict rate limiting for suspicious requests
 */
const applyStrictLimiting = (req, res, next) => {
  const strictLimit = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 3, // Only 3 requests per 5 minutes for suspicious IPs
    message: {
      success: false,
      error: 'Access temporarily restricted due to suspicious activity.',
      retryAfter: 300,
      type: 'SECURITY_RATE_LIMIT',
      contact: 'If you believe this is an error, contact support.'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  
  strictLimit(req, res, next);
};

/**
 * Cleanup old request history periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [ip, history] of requestHistory.entries()) {
    const recentRequests = history.filter(time => now - time < 300000); // 5 minutes
    if (recentRequests.length === 0) {
      requestHistory.delete(ip);
    } else {
      requestHistory.set(ip, recentRequests);
    }
  }
}, 60000); // Cleanup every minute

/**
 * Request size monitoring middleware
 */
export const requestSizeProtection = (req, res, next) => {
  const maxSize = parseInt(process.env.MAX_REQUEST_SIZE) || 10 * 1024 * 1024; // 10MB
  
  if (req.get('content-length') && parseInt(req.get('content-length')) > maxSize) {
    console.warn(`ALERT: Large request detected from ${req.ip}: ${req.get('content-length')} bytes`);
    return res.status(413).json({
      success: false,
      error: 'Request too large',
      maxSize: `${maxSize / (1024 * 1024)}MB`,
      type: 'PAYLOAD_TOO_LARGE'
    });
  }
  
  next();
};

/**
 * Geographic rate limiting (basic implementation)
 * In production, integrate with MaxMind or similar service
 */
export const geoRateLimit = (req, res, next) => {
  // This is a simplified implementation
  // In production, you would use actual geolocation services
  const suspiciousCountries = (process.env.RATE_LIMIT_COUNTRIES || '').split(',');
  
  if (suspiciousCountries.length > 0) {
    // Placeholder for actual geo-IP lookup
    // const country = getCountryFromIP(req.ip);
    // Apply stricter limits for certain regions if needed
  }
  
  next();
};

export default {
  advancedDDoSProtection,
  requestSizeProtection,
  geoRateLimit
};