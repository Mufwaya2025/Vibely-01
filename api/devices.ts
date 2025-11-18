import { deviceAuthDb as db } from './deviceAuthDb';
import { Device, DeviceToken, StaffUser, User } from '../types';
import bcrypt from 'bcryptjs';
import { createDeviceToken } from '../server/utils/jwt';
import { db as mainDb } from './db';

const resolveStaffUserForOrganizer = (staffUserId: string | undefined | null, organizerId: string) => {
  if (!staffUserId || staffUserId === organizerId) {
    return { staffUserId: organizerId, staffUser: null as StaffUser | null };
  }

  const staffUser = mainDb.staffUsers.findById(staffUserId);
  if (!staffUser || !staffUser.active) {
    throw new Error('Staff user not found or inactive');
  }

  if (staffUser.organizerId && staffUser.organizerId !== organizerId) {
    throw new Error('Staff user does not belong to this organizer');
  }

  return { staffUserId: staffUser.id, staffUser };
};

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

    // Verify staff user credentials (staff) or organizer credentials (manager)
    const staffUser = db.staffUsers.findByEmail(staff_user_email);
    const managerUser = staffUser ? null : mainDb.users.findByEmail(staff_user_email);

    let userId: string | null = null;
    let userName: string | undefined;

    if (staffUser && staffUser.active) {
      const isPasswordValid = await bcrypt.compare(staff_user_password, staffUser.passwordHash);
      if (!isPasswordValid) {
        return new Response(JSON.stringify({ error: 'Invalid staff credentials' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (staffUser.organizerId && device.organizerId && staffUser.organizerId !== device.organizerId) {
        return new Response(
          JSON.stringify({ error: 'Device not assigned to this organizer' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (device.staffUserId !== staffUser.id) {
        return new Response(
          JSON.stringify({ error: 'Device not assigned to this staff user' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
      userId = staffUser.id;
      userName = staffUser.name;
    } else if (managerUser && managerUser.role === 'manager' && managerUser.status === 'active') {
      const isPasswordValid = await bcrypt.compare(staff_user_password, (managerUser as any).passwordHash);
      if (!isPasswordValid) {
        return new Response(JSON.stringify({ error: 'Invalid organizer credentials' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (device.organizerId && device.organizerId !== managerUser.id) {
        return new Response(
          JSON.stringify({ error: 'Device not assigned to this organizer' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
      userId = managerUser.id;
      userName = managerUser.name;
    } else {
      return new Response(JSON.stringify({ error: 'Invalid staff credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
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
      staff_user_id: userId,
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
          staff_user_id: staffUser.id,
          eventId: device.eventId ?? null,
          event_id: device.eventId ?? null,
        },
        staff_user: {
          id: userId,
          email: staff_user_email,
          name: userName
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

export async function handleManagerCreateDevice(req: {
  user: User | null;
  body?: { name?: string; eventId?: string | null; staffUserId?: string | null };
}) {
  if (!req.user || req.user.role !== 'manager') {
    return new Response(JSON.stringify({ message: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const name = req.body?.name?.trim() || 'Scanning device';
  const eventId = req.body?.eventId ?? null;
  const staffUserIdInput = req.body?.staffUserId ?? null;
  const devicePublicId = `dev-${Math.random().toString(36).slice(2, 10)}`;
  const deviceSecret = `sec-${Math.random().toString(36).slice(2, 14)}`;
  const now = new Date().toISOString();

  if (eventId) {
    const event = mainDb.events.findById(eventId);
    if (!event || event.organizer.id !== req.user.id) {
      return new Response(JSON.stringify({ message: 'Event not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    const { staffUserId } = resolveStaffUserForOrganizer(staffUserIdInput, req.user.id);

    const created = mainDb.devices.create({
      id: `dev-${Date.now()}`,
      name,
      staffUserId,
      organizerId: req.user.id,
      eventId: eventId || undefined,
      devicePublicId,
      deviceSecret,
      isActive: true,
    });

    return new Response(
      JSON.stringify({
        device: {
          id: created.id,
          name: created.name,
          devicePublicId: created.devicePublicId,
          organizerId: created.organizerId,
          staffUserId: created.staffUserId,
          // Return the event ID in both camelCase and snake_case for clients that expect either format
          eventId: created.eventId ?? null,
          event_id: created.eventId ?? null,
          lastSeenAt: created.lastSeenAt,
          lastIp: created.lastIp,
          isActive: created.isActive,
          createdAt: created.createdAt ?? now,
        },
        secret: deviceSecret,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to create device';
    return new Response(
      JSON.stringify({ message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function handleManagerListDevices(req: { user: User | null }) {
  if (!req.user || req.user.role !== 'manager') {
    return new Response(JSON.stringify({ message: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const devices = mainDb.devices
    .findAll?.()
    ?.filter(
      (d: any) => d.organizerId === req.user!.id || d.staffUserId === req.user!.id
    )
    .map((d: any) => ({
      id: d.id,
      name: d.name,
      organizerId: d.organizerId,
      staffUserId: d.staffUserId,
      devicePublicId: d.devicePublicId,
      eventId: d.eventId,
      isActive: d.isActive,
      lastSeenAt: d.lastSeenAt,
      lastIp: d.lastIp,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));

  return new Response(JSON.stringify({ devices: devices ?? [] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleManagerAssignDevice(req: {
  user: User | null;
  params?: { id?: string };
  body?: { eventId?: string | null; staffUserId?: string | null };
}) {
  if (!req.user || req.user.role !== 'manager') {
    return new Response(JSON.stringify({ message: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const deviceId = req.params?.id;
  if (!deviceId) {
    return new Response(JSON.stringify({ message: 'Device ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const device = mainDb.devices.findById(deviceId);
  if (!device || (device.organizerId && device.organizerId !== req.user.id && device.staffUserId !== req.user.id)) {
    return new Response(JSON.stringify({ message: 'Device not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const eventId = req.body?.eventId ?? null;
  const staffUserIdInput = req.body?.staffUserId ?? null;

  if (eventId) {
    const event = mainDb.events.findById(eventId);
    if (!event || event.organizer.id !== req.user.id) {
      return new Response(JSON.stringify({ message: 'Event not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  let staffUserIdToAssign: string | undefined = device.staffUserId;
  try {
    const targetStaff = staffUserIdInput ?? device.staffUserId ?? req.user.id;
    staffUserIdToAssign = resolveStaffUserForOrganizer(targetStaff, req.user.id).staffUserId;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Invalid staff user';
    return new Response(
      JSON.stringify({ message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const updated = mainDb.devices.update(deviceId, {
    eventId: eventId || undefined,
    staffUserId: staffUserIdToAssign,
  });
  return new Response(JSON.stringify({ device: updated }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const revokeTokensForDevice = (deviceId: string) => {
  const tokens = mainDb.deviceTokens.findByDeviceId(deviceId) ?? [];
  tokens.forEach((token) => {
    mainDb.deviceTokens.revoke(token.id);
  });
  mainDb.deviceTokens.deleteByDeviceId(deviceId);
};

export async function handleManagerUpdateDevice(req: {
  user: User | null;
  params?: { id?: string };
  body?: { isActive?: boolean | null; name?: string | null };
}) {
  if (!req.user || req.user.role !== 'manager') {
    return new Response(JSON.stringify({ message: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const deviceId = req.params?.id;
  if (!deviceId) {
    return new Response(JSON.stringify({ message: 'Device ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const device = mainDb.devices.findById(deviceId);
  if (!device || (device.organizerId && device.organizerId !== req.user.id && device.staffUserId !== req.user.id)) {
    return new Response(JSON.stringify({ message: 'Device not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const updates: any = {};
  if (typeof req.body?.isActive === 'boolean') {
    updates.isActive = req.body.isActive;
  }
  if (req.body?.name) {
    updates.name = req.body.name.trim();
  }

  const updated = mainDb.devices.update(deviceId, updates);
  if (updates.isActive === false) {
    revokeTokensForDevice(deviceId);
  }

  return new Response(JSON.stringify({ device: updated }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleManagerRegenerateDeviceSecret(req: {
  user: User | null;
  params?: { id?: string };
}) {
  if (!req.user || req.user.role !== 'manager') {
    return new Response(JSON.stringify({ message: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const deviceId = req.params?.id;
  if (!deviceId) {
    return new Response(JSON.stringify({ message: 'Device ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const device = mainDb.devices.findById(deviceId);
  if (!device || (device.organizerId && device.organizerId !== req.user.id && device.staffUserId !== req.user.id)) {
    return new Response(JSON.stringify({ message: 'Device not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const newSecret = `sec-${Math.random().toString(36).slice(2, 14)}`;
  const hashed = await bcrypt.hash(newSecret, 10);

  const updated = mainDb.devices.update(deviceId, {
    deviceSecret: hashed,
    updatedAt: new Date().toISOString(),
  });

  revokeTokensForDevice(deviceId);

  return new Response(
    JSON.stringify({
      device: updated,
      secret: newSecret,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

export async function handleManagerDeleteDevice(req: {
  user: User | null;
  params?: { id?: string };
}) {
  if (!req.user || req.user.role !== 'manager') {
    return new Response(JSON.stringify({ message: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const deviceId = req.params?.id;
  if (!deviceId) {
    return new Response(JSON.stringify({ message: 'Device ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const device = mainDb.devices.findById(deviceId);
  if (!device || (device.organizerId && device.organizerId !== req.user.id && device.staffUserId !== req.user.id)) {
    return new Response(JSON.stringify({ message: 'Device not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  revokeTokensForDevice(deviceId);
  mainDb.devices.delete(deviceId);

  return new Response(JSON.stringify({ message: 'Device deleted' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
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
