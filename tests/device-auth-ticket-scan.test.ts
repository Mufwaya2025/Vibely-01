import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleDeviceAuthorization, handleDeviceLogout } from '../api/devices';
import { handleTicketScan } from '../api/ticketScan';
import { db } from '../api/db';
import bcrypt from 'bcryptjs';

// Mock the database functions
vi.mock('../api/db', () => ({
  db: {
    devices: {
      findByPublicId: vi.fn(),
      update: vi.fn(),
    },
    staffUsers: {
      findByEmail: vi.fn(),
    },
    deviceTokens: {
      create: vi.fn(),
      findByToken: vi.fn(),
      update: vi.fn(),
    },
    tickets: {
      findByCode: vi.fn(),
      markAsUsed: vi.fn(),
    },
    scanLogs: {
      create: vi.fn(),
      findByTicketId: vi.fn(),
    }
  }
}));

describe('Device Authorization Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully authorize a device with valid credentials', async () => {
    const mockDevice = {
      id: 'device123',
      name: 'Test Device',
      staffUserId: 'staff123',
      devicePublicId: 'ANDROID-XYZ-123',
      deviceSecret: await bcrypt.hash('s3cr3t-issued-by-admin-or-mdm', 10),
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockStaffUser = {
      id: 'staff123',
      email: 'usher1@venue.com',
      passwordHash: await bcrypt.hash('Passw0rd!', 10),
      name: 'Usher One',
      active: true,
      createdAt: new Date().toISOString(),
    };

    vi.mocked(db.devices.findByPublicId).mockReturnValue(mockDevice);
    vi.mocked(db.staffUsers.findByEmail).mockReturnValue(mockStaffUser);

    const mockRequest = {
      body: {
        device_public_id: 'ANDROID-XYZ-123',
        device_secret: 's3cr3t-issued-by-admin-or-mdm',
        staff_user_email: 'usher1@venue.com',
        staff_user_password: 'Passw0rd!',
      },
      ip: '192.168.1.1'
    };

    const result = await handleDeviceAuthorization(mockRequest);

    expect(result.status).toBe(200);
    expect(result.body).toHaveProperty('access_token');
    expect(result.body).toHaveProperty('device');
    expect(result.body).toHaveProperty('staff_user');
    expect(result.body.device.device_public_id).toBe('ANDROID-XYZ-123');
    expect(result.body.staff_user.email).toBe('usher1@venue.com');
  });

  it('should return 401 for invalid device credentials', async () => {
    vi.mocked(db.devices.findByPublicId).mockReturnValue(null);

    const mockRequest = {
      body: {
        device_public_id: 'NONEXISTENT-DEVICE',
        device_secret: 'wrong-secret',
        staff_user_email: 'usher1@venue.com',
        staff_user_password: 'Passw0rd!',
      },
      ip: '192.168.1.1'
    };

    const result = await handleDeviceAuthorization(mockRequest);

    expect(result.status).toBe(401);
    expect(result.body).toEqual({ error: 'Invalid device credentials' });
  });

  it('should return 401 for invalid staff credentials', async () => {
    const mockDevice = {
      id: 'device123',
      name: 'Test Device',
      staffUserId: 'staff123',
      devicePublicId: 'ANDROID-XYZ-123',
      deviceSecret: await bcrypt.hash('s3cr3t-issued-by-admin-or-mdm', 10),
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.mocked(db.devices.findByPublicId).mockReturnValue(mockDevice);
    vi.mocked(db.staffUsers.findByEmail).mockReturnValue(null);

    const mockRequest = {
      body: {
        device_public_id: 'ANDROID-XYZ-123',
        device_secret: 's3cr3t-issued-by-admin-or-mdm',
        staff_user_email: 'nonexistent@venue.com',
        staff_user_password: 'Passw0rd!',
      },
      ip: '192.168.1.1'
    };

    const result = await handleDeviceAuthorization(mockRequest);

    expect(result.status).toBe(401);
    expect(result.body).toEqual({ error: 'Invalid staff credentials' });
  });
});

describe('Ticket Scan Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully scan a valid ticket', async () => {
    const mockTicket = {
      id: 'ticket123',
      eventId: 'event123',
      code: 'QR-123-ABC',
      status: 'UNUSED',
      holderName: 'Jane Doe',
      holderEmail: 'jane@example.com',
      createdAt: new Date().toISOString(),
    };

    const mockDeviceInfo = {
      deviceId: 'device123',
      staffUserId: 'staff123',
      devicePublicId: 'ANDROID-XYZ-123',
    };

    vi.mocked(db.tickets.findByCode).mockReturnValue(mockTicket);
    vi.mocked(db.tickets.markAsUsed).mockReturnValue({
      ...mockTicket,
      status: 'USED',
    });
    vi.mocked(db.scanLogs.findByTicketId).mockReturnValue([]);
    
    const mockRequest = {
      body: {
        event_id: 'event123',
        ticket_code: 'QR-123-ABC',
        lat: -15.416,
        lon: 28.283,
        scanned_at: '2025-11-05T19:47:22Z'
      },
      deviceInfo: mockDeviceInfo,
      ip: '192.168.1.1'
    };

    const result = await handleTicketScan(mockRequest);

    expect(result.status).toBe(200);
    expect(result.body.result).toBe('VALID');
    expect(result.body.message).toBe('Ticket accepted for entry');
    expect(result.body.ticket.status).toBe('USED');
  });

  it('should return ALREADY_USED for a ticket that has already been used', async () => {
    const mockTicket = {
      id: 'ticket123',
      eventId: 'event123',
      code: 'QR-123-ABC',
      status: 'USED',
      holderName: 'Jane Doe',
      holderEmail: 'jane@example.com',
      createdAt: new Date().toISOString(),
    };

    const mockDeviceInfo = {
      deviceId: 'device123',
      staffUserId: 'staff123',
      devicePublicId: 'ANDROID-XYZ-123',
    };

    vi.mocked(db.tickets.findByCode).mockReturnValue(mockTicket);
    vi.mocked(db.scanLogs.findByTicketId).mockReturnValue([]);

    const mockRequest = {
      body: {
        event_id: 'event123',
        ticket_code: 'QR-123-ABC',
        lat: -15.416,
        lon: 28.283,
        scanned_at: '2025-11-05T19:47:22Z'
      },
      deviceInfo: mockDeviceInfo,
      ip: '192.168.1.1'
    };

    const result = await handleTicketScan(mockRequest);

    expect(result.status).toBe(200);
    expect(result.body.result).toBe('ALREADY_USED');
    expect(result.body.message).toBe('Ticket has already been used');
  });

  it('should return NOT_FOUND for a non-existent ticket', async () => {
    vi.mocked(db.tickets.findByCode).mockReturnValue(null);

    const mockDeviceInfo = {
      deviceId: 'device123',
      staffUserId: 'staff123',
      devicePublicId: 'ANDROID-XYZ-123',
    };

    const mockRequest = {
      body: {
        event_id: 'event123',
        ticket_code: 'NON-EXISTENT-TICKET',
        lat: -15.416,
        lon: 28.283,
        scanned_at: '2025-11-05T19:47:22Z'
      },
      deviceInfo: mockDeviceInfo,
      ip: '192.168.1.1'
    };

    const result = await handleTicketScan(mockRequest);

    expect(result.status).toBe(200); // According to spec, return 200 with domain result
    expect(result.body.result).toBe('NOT_FOUND');
    expect(result.body.message).toBe('Ticket not found');
  });
});

describe('Device Logout Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully revoke a device token', async () => {
    // This test is more complex as it depends on how the token is passed
    // For now, we'll test the success case
    const mockToken = 'valid-device-token';
    const mockTokenRecord = {
      id: 'token123',
      deviceId: 'device123',
      token: mockToken,
      createdAt: new Date().toISOString(),
    };
    
    vi.mocked(db.deviceTokens.findByToken).mockReturnValue(mockTokenRecord);

    const mockRequest = {
      headers: {
        authorization: `Bearer ${mockToken}`
      }
    };

    const result = await handleDeviceLogout(mockRequest);

    expect(result.status).toBe(200);
    expect(result.body.message).toBe('Device logged out successfully');
    expect(db.deviceTokens.update).toHaveBeenCalledWith('token123', {
      revokedAt: expect.any(String)
    });
  });
});