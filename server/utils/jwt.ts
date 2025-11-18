import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { deviceAuthDb as deviceDb } from '../../api/deviceAuthDb';

// Load JWT secret from environment
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_jwt_secret_for_dev';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

// Device token payload interface
interface DeviceTokenPayload {
  sub: string; // device_id
  staff_user_id: string;
  device_public_id: string;
  roles?: string[];
  exp: number;
  iat: number;
}

// Create device access token
export const createDeviceToken = (payload: Omit<DeviceTokenPayload, 'exp' | 'iat'>): string => {
  const tokenPayload: DeviceTokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + (8 * 60 * 60), // 8 hours in seconds
    iat: Math.floor(Date.now() / 1000),
  };

  return jwt.sign(tokenPayload, JWT_SECRET);
};

// Verify device access token
export const verifyDeviceToken = (token: string): DeviceTokenPayload | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as DeviceTokenPayload;
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
};

// Middleware to authenticate device using Bearer token
export const authenticateDevice = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  const decoded = verifyDeviceToken(token);

  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const tokenRecord = deviceDb.deviceTokens.findByToken(token);
  if (!tokenRecord || tokenRecord.revokedAt) {
    return res.status(401).json({ error: 'Token revoked' });
  }
  if (tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) < new Date()) {
    return res.status(401).json({ error: 'Token expired' });
  }

  const device = deviceDb.devices.findById(decoded.sub);
  if (!device || !device.isActive) {
    return res.status(403).json({ error: 'Device inactive or not found' });
  }

  // Add device info to request for use in route handlers
  (req as any).deviceInfo = {
    deviceId: decoded.sub,
    staffUserId: decoded.staff_user_id,
    devicePublicId: decoded.device_public_id,
  };

  next();
};
