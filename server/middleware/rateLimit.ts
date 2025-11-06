import type { Request, Response, NextFunction } from 'express';
import { db } from '../api/db';

// Simple in-memory store for rate limiting (in production, use Redis or similar)
const rateLimitStore: { [key: string]: { count: number; resetTime: number } } = {};

interface RateLimitOptions {
  windowMs: number; // Window in milliseconds
  max: number; // Max requests allowed in window
  message?: string;
  keyGenerator?: (req: Request) => string; // Function to generate key for rate limiting
}

export const rateLimit = (options: RateLimitOptions) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Generate key for rate limiting
    const key = options.keyGenerator 
      ? options.keyGenerator(req) 
      : `${req.ip}-${req.path}`;
    
    const now = Date.now();
    const windowEnd = now + options.windowMs;
    
    // Get or create entry for this key
    if (!rateLimitStore[key] || rateLimitStore[key].resetTime < now) {
      // Reset the counter
      rateLimitStore[key] = {
        count: 1,
        resetTime: windowEnd
      };
      next();
      return;
    }
    
    // Check if limit exceeded
    if (rateLimitStore[key].count >= options.max) {
      res.status(429).json({
        error: options.message || 'Too many requests, please try again later.'
      });
      return;
    }
    
    // Increment the counter
    rateLimitStore[key].count++;
    next();
  };
};

// Specific rate limiters for our endpoints
export const deviceAuthRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 attempts per minute
  message: 'Too many authorization attempts, please try again later.',
  keyGenerator: (req) => {
    const devicePublicId = req.body?.device_public_id || 'unknown';
    const ip = req.ip || 'unknown';
    return `${ip}-${devicePublicId}-device-auth`;
  }
});

export const ticketScanRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 scans per minute per device
  message: 'Too many scan requests, please slow down.',
  keyGenerator: (req) => {
    // Extract device ID from token if possible
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      // In a real implementation, we'd decode the token to get the device ID
      // For now, we'll use the IP address as a proxy
      return `${req.ip}-device-scan`;
    }
    return `${req.ip}-device-scan`;
  }
});