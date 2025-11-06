import type { Request, RequestHandler } from 'express';
import type { User } from '../../types';
import { sendFetchResponse } from './sendFetchResponse';
import { authenticateDevice } from '../utils/jwt';
import { deviceAuthRateLimiter, ticketScanRateLimiter } from '../utils/rateLimit';

type HandlerRequest = {
  body?: any;
  query?: Record<string, any>;
  params?: Record<string, string>;
  headers?: Record<string, string | undefined>;
  user?: User | null;
  // For device authentication
  deviceInfo?: {
    deviceId: string;
    staffUserId: string;
    devicePublicId: string;
  };
  ip?: string;
};

type ApiHandler = (req: HandlerRequest) => Promise<Response> | Response;

const normalizeHeaders = (headers: Request['headers']): Record<string, string | undefined> => {
  const normalized: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      normalized[key] = value.join(', ');
    } else if (typeof value === 'string') {
      normalized[key] = value;
    } else {
      normalized[key] = undefined;
    }
  }
  return normalized;
};

// Creates a handler with rate limiting for device authorization
export const createDeviceAuthRateLimitedHandler = (handler: ApiHandler): RequestHandler => {
  return async (req, res, next) => {
    // Apply rate limiting first
    deviceAuthRateLimiter(req, res, (err) => {
      if (err) {
        return res.status(429).json({ error: 'Rate limit exceeded' });
      }
      
      // Then call the actual handler
      createHandler(handler)(req, res, next);
    });
  };
};

// Creates a handler with rate limiting for ticket scanning
export const createTicketScanRateLimitedHandler = (handler: ApiHandler): RequestHandler => {
  return async (req, res, next) => {
    // Apply rate limiting first
    ticketScanRateLimiter(req, res, (err) => {
      if (err) {
        return res.status(429).json({ error: 'Rate limit exceeded' });
      }
      
      // Then apply device authentication
      authenticateDevice(req as Request, res, (authErr) => {
        if (authErr) {
          return res.status(401).json({ error: 'Authentication failed' });
        }
        
        // Get the device info that was added to the request by authenticateDevice
        const deviceInfo = (req as any).deviceInfo;
        if (!deviceInfo) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        // Call the handler with device info
        handler({
          body: req.body,
          query: req.query,
          params: req.params,
          headers: normalizeHeaders(req.headers),
          user: req.user ?? null,
          deviceInfo,
          ip: req.ip,
        })
        .then(response => {
          sendFetchResponse(res, response);
        })
        .catch(next);
      });
    });
  };
};

// Original handler to maintain compatibility
export const createHandler = (handler: ApiHandler): RequestHandler => {
  return async (req, res, next) => {
    try {
      const response = await handler({
        body: req.body,
        query: req.query,
        params: req.params,
        headers: normalizeHeaders(req.headers),
        user: req.user ?? null,
      });
      await sendFetchResponse(res, response);
    } catch (err) {
      next(err);
    }
  };
};