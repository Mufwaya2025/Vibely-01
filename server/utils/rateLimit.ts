import { Request, Response, NextFunction } from 'express';

// Simple in-memory rate limiter for demo purposes
// In production, you'd want to use Redis or similar for distributed rate limiting
interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number; // timestamp in milliseconds
  };
}

const rateLimitStore: RateLimitStore = {};

// Rate limiting middleware
export const rateLimit = (windowMs: number, max: number, keyGenerator: (req: Request) => string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const now = Date.now();

    if (!rateLimitStore[key]) {
      rateLimitStore[key] = {
        count: 1,
        resetTime: now + windowMs,
      };
      return next();
    }

    // If the window has passed, reset the counter
    if (now > rateLimitStore[key].resetTime) {
      rateLimitStore[key] = {
        count: 1,
        resetTime: now + windowMs,
      };
      return next();
    }

    // If count is less than max, increment and continue
    if (rateLimitStore[key].count < max) {
      rateLimitStore[key].count++;
      return next();
    }

    // Otherwise, rate limit exceeded
    const retryAfter = Math.floor((rateLimitStore[key].resetTime - now) / 1000);
    res.set('Retry-After', retryAfter.toString());
    res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Retry after ${retryAfter} seconds.`,
    });
  };
};

// Specific rate limiters for our endpoints
export const deviceAuthRateLimiter = rateLimit(
  60 * 1000, // 1 minute
  5, // 5 requests per minute
  (req) => {
    // Key by IP + device public ID to rate limit per device per IP
    const devicePublicId = req.body?.device_public_id || 'unknown';
    const ip = req.ip || '0.0.0.0';
    return `device_auth:${ip}:${devicePublicId}`;
  }
);

export const ticketScanRateLimiter = rateLimit(
  60 * 1000, // 1 minute
  60, // 60 requests per minute
  (req) => {
    // Key by device ID to rate limit per device
    const deviceId = (req as any).deviceInfo?.deviceId || req.ip || 'unknown';
    return `ticket_scan:${deviceId}`;
  }
);

// General auth limiter for /api/auth/* endpoints
export const authRateLimiter = rateLimit(
  60 * 1000, // 1 minute
  10, // 10 requests per minute per IP
  (req) => {
    const ip = req.ip || 'unknown';
    return `auth:${ip}`;
  }
);

// Webhook limiter for /api/webhooks/* endpoints
export const webhookRateLimiter = rateLimit(
  60 * 1000, // 1 minute
  30, // 30 requests per minute per IP
  (req) => {
    const ip = req.ip || 'unknown';
    return `webhook:${ip}`;
  }
);
