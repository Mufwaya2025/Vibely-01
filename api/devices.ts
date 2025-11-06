import { deviceAuthDb as db } from './deviceAuthDb';
import { Device, DeviceToken, StaffUser } from '../types';
import bcrypt from 'bcryptjs';
import { createDeviceToken } from '../server/utils/jwt';

export async function handleDeviceAuthorization(req: { 
  body: {
    device_public_id: string;
    device_secret: string;
    staff_user_email: string;
    staff_user_password: string;
  };
  ip?: string;
}) {
  const { device_public_id, device_secret, staff_user_email, staff_user_password } = req.body;
  
  // Validate input
  if (!device_public_id || !device_secret || !staff_user_email || !staff_user_password) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Check if device exists and is active
    const device = db.devices.findByPublicId(device_public_id);
    if (!device || !device.isActive) {
      return new Response(
        JSON.stringify({ error: 'Invalid device credentials' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify device secret
    const isDeviceSecretValid = await bcrypt.compare(device_secret, device.deviceSecret);
    if (!isDeviceSecretValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid device credentials' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify staff user credentials
    const staffUser = db.staffUsers.findByEmail(staff_user_email);
    if (!staffUser || !staffUser.active) {
      return new Response(
        JSON.stringify({ error: 'Invalid staff credentials' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const isPasswordValid = await bcrypt.compare(staff_user_password, staffUser.passwordHash);
    if (!isPasswordValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid staff credentials' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Optional: Check if this device is assigned to this staff user
    // This would require additional logic to link devices to staff users
    // For now, we'll just verify that the device belongs to the staff user
    if (device.staffUserId !== staffUser.id) {
      return new Response(
        JSON.stringify({ error: 'Device not assigned to this staff user' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Extract IP address from request
    const ip = req.ip || 'unknown';

    // Update device last seen info
    await db.devices.update(device.id, {
      lastSeenAt: new Date().toISOString(),
      lastIp: ip
    });

    // Create JWT token payload
    const tokenPayload = {
      sub: device.id,
      staff_user_id: staffUser.id,
      device_public_id: device.devicePublicId
    };

    // Generate JWT token
    const accessToken = createDeviceToken(tokenPayload);

    // Create a record for the device token
    const deviceToken: DeviceToken = {
      id: `dt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      deviceId: device.id,
      token: accessToken, // In a real app, you'd store a hashed version
      expiresAt: new Date(Date.now() + (8 * 60 * 60 * 1000)).toISOString(), // 8 hours
      revokedAt: null,
      createdAt: new Date().toISOString(),
    };

    // Save the token
    db.deviceTokens.create(deviceToken);

    return new Response(
      JSON.stringify({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in_seconds: 8 * 60 * 60,
        device: {
          id: device.id,
          device_public_id: device.devicePublicId,
          staff_user_id: staffUser.id
        },
        staff_user: {
          id: staffUser.id,
          email: staffUser.email,
          name: staffUser.name
        }
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Device authorization error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function handleDeviceLogout(req: any) {
  try {
    // In this implementation, we assume the token is passed in the request
    // In real implementation, this would be extracted from the authorization header
    const token = req.headers?.authorization?.split(' ')[1];
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Find the token in the database and mark it as revoked
    const tokenRecord = db.deviceTokens.findByToken(token);
    if (tokenRecord) {
      db.deviceTokens.update(tokenRecord.id, {
        revokedAt: new Date().toISOString()
      });
    }

    return new Response(
      JSON.stringify({ message: 'Device logged out successfully' }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Device logout error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}