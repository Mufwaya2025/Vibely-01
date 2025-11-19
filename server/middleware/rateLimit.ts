import type { Request, Response, NextFunction } from 'express';

// Simple in-memory store for rate limiting (acceptable for single-server setup)
const rateLimitStore: { [key: string]: { count: number; resetTime: number } } = {};

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

export const rateLimit = (options: RateLimitOptions) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = options.keyGenerator
      ? options.keyGenerator(req)
      : `${req.ip}-${req.path}`;

    const now = Date.now();

    if (!rateLimitStore[key] || rateLimitStore[key].resetTime < now) {
      rateLimitStore[key] = {
        count: 1,
        resetTime: now + options.windowMs
      };
      return next();
    }

    if (rateLimitStore[key].count >= options.max) {
      return res.status(429).json({
        error: options.message || 'Too many requests, please try again later.'
      });
    }

    rateLimitStore[key].count++;
    return next();
  };
};

// -----------------------------
//  DEVICE AUTH RATE LIMITER
//  Production-safe configuration
// -----------------------------

export const deviceAuthRateLimiter = rateLimit({
  windowMs: 30 * 1000,  // 30-second window
  max: 20,              // Up to 20 attempts per device/IP in 30s (very safe)
  message: 'Too many authorization attempts, please try again shortly.',

  keyGenerator: (req) => {
    const ip = req.ip || 'unknown-ip';
    const devicePublicId =
      req.body?.device_public_id ||
      req.headers['x-device-id'] ||
      req.headers['x-device-public-id'] ||
      'no-device-id';

    // If no device ID is supplied → limit by IP only (still safe)
    if (devicePublicId === 'no-device-id') {
      return `auth-ip-only-${ip}`;
    }

    // Normally limit by BOTH: device ID + IP
    return `auth-${ip}-${devicePublicId}`;
  }
});

// -----------------------------
//  TICKET SCAN RATE LIMITER
// -----------------------------

export const ticketScanRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,            // 120 scans per minute per device/IP
  message: 'Too many scan requests, please slow down.',

  keyGenerator: (req) => {
    const ip = req.ip || 'unknown-ip';
    const deviceHeader =
      req.headers['x-device-id'] ||
      req.headers['x-device-public-id'] ||
      'device-unknown';

    return `scan-${ip}-${deviceHeader}`;
  }
});
