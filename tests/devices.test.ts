import { describe, it, expect, beforeEach, vi, MockedFunction } from 'vitest';
import { handleDeviceAuthorization } from '../api/devices';
import { handleTicketScan } from '../api/ticketScan';
import { db } from '../api/db';
import bcrypt from 'bcryptjs';

// Mock the database
vi.mock('../api/db', () => ({
  db: {
    staffUsers: {
      findByEmail: vi.fn(),
    },
    devices: {
      findByPublicId: vi.fn(),
      update: vi.fn(),
    },
    deviceTokens: {
      create: vi.fn(),
    },
    tickets: {
      findByCode: vi.fn(),
      update: vi.fn(),
    },
    scanLogs: {
      create: vi.fn(),
      findAll: vi.fn(),
    },
  },
}));

describe('Device Authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully authorize a device with valid credentials', async () => {
    // Mock the database responses
    (db.devices.findByPublicId as MockedFunction<any>).mockReturnValue({
      id: 'device-123',
      name: 'Test Device',
      staffUserId: 'staff-123',
      devicePublicId: 'ANDROID-XYZ-123',
      deviceSecret: '$2b$10$examplehashedpassword', // bcrypt hash
      isActive: true,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z'
    });

    (db.staffUsers.findByEmail as MockedFunction<any>).mockReturnValue({
      id: 'staff-123',
      name: 'Usher One',
      email: 'usher1@venue.com',
      password: '$2b$10$examplehashedpassword', // bcrypt hash for 'Passw0rd!'
      status: 'active',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z'
    });

    // Mock bcrypt compare to return true
    vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

    const req = {
      body: {
        device_public_id: 'ANDROID-XYZ-123',
        device_secret: 's3cr3t-issued-by-admin-or-mdm',
        staff_user_email: 'usher1@venue.com',
        staff_user_password: 'Passw0rd!',
        ip: '192.168.1.1'
      }
    };

    const response = await handleDeviceAuthorization(req);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.access_token).toBeDefined();
    expect(data.token_type).toBe('Bearer');
    expect(data.device.id).toBe('device-123');
    expect(data.staff_user.email).toBe('usher1@venue.com');
  });

  it('should return 401 for invalid device credentials', async () => {
    (db.devices.findByPublicId as MockedFunction<any>).mockReturnValue(null);

    const req = {
      body: {
        device_public_id: 'INVALID-DEVICE',
        device_secret: 'invalid-secret',
        staff_user_email: 'usher1@venue.com',
        staff_user_password: 'Passw0rd!',
      }
    };

    const response = await handleDeviceAuthorization(req);

    expect(response.status).toBe(401);
  });

  it('should return 401 for invalid staff credentials', async () => {
    (db.devices.findByPublicId as MockedFunction<any>).mockReturnValue({
      id: 'device-123',
      name: 'Test Device',
      staffUserId: 'staff-123',
      devicePublicId: 'ANDROID-XYZ-123',
      deviceSecret: '$2b$10$examplehashedpassword',
      isActive: true,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z'
    });

    (db.staffUsers.findByEmail as MockedFunction<any>).mockReturnValue({
      id: 'staff-123',
      name: 'Usher One',
      email: 'usher1@venue.com',
      password: '$2b$10$examplehashedpassword',
      status: 'active',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z'
    });

    // Mock bcrypt compare to return false
    vi.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

    const req = {
      body: {
        device_public_id: 'ANDROID-XYZ-123',
        device_secret: 's3cr3t-issued-by-admin-or-mdm',
        staff_user_email: 'usher1@venue.com',
        staff_user_password: 'wrongpassword',
      }
    };

    const response = await handleDeviceAuthorization(req);

    expect(response.status).toBe(401);
  });
});

describe('Ticket Scan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully scan a valid unused ticket', async () => {
    const mockTicket = {
      ticketId: 'ticket-123',
      eventId: 'event-456',
      userId: 'user-789',
      purchaseDate: '2023-01-01T00:00:00Z',
      status: 'unused',
      code: 'QR-123-ABC',
      holderName: 'John Doe'
    };

    // Mock the ticket scan function
    (db.tickets.findByCode as MockedFunction<any>).mockReturnValue(mockTicket);

    const mockToken = {
      sub: 'device-123',
      staff_user_id: 'staff-123',
      device_public_id: 'ANDROID-XYZ-123'
    };

    const req = {
      body: {
        event_id: 'event-456',
        ticket_code: 'QR-123-ABC',
        lat: -15.416,
        lon: 28.283,
        scanned_at: '2025-11-05T19:47:22Z'
      },
      headers: {
        authorization: 'Bearer valid-token'
      }
    };

    // Simulate token verification by creating a mock function
    const mockVerifyToken = vi.fn(() => mockToken);
    vi.mock('../server/utils/jwt', async () => {
      const actual = await vi.importActual('../server/utils/jwt');
      return {
        ...actual,
        verifyToken: mockVerifyToken,
      };
    });

    const response = await handleTicketScan(req);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.result).toBe('VALID');
    expect(data.ticket.status).toBe('used');
    expect(data.scanned_by.device_id).toBe('device-123');
    expect(data.audit.lat).toBe(-15.416);
  });

  it('should return ALREADY_USED for a previously scanned ticket', async () => {
    const mockTicket = {
      ticketId: 'ticket-123',
      eventId: 'event-456',
      userId: 'user-789',
      purchaseDate: '2023-01-01T00:00:00Z',
      status: 'used',
      code: 'QR-123-ABC',
      holderName: 'John Doe'
    };

    (db.tickets.findByCode as MockedFunction<any>).mockReturnValue(mockTicket);

    const mockToken = {
      sub: 'device-123',
      staff_user_id: 'staff-123',
      device_public_id: 'ANDROID-XYZ-123'
    };

    const req = {
      body: {
        event_id: 'event-456',
        ticket_code: 'QR-123-ABC',
        scanned_at: '2025-11-05T19:47:22Z'
      },
      headers: {
        authorization: 'Bearer valid-token'
      }
    };

    const mockVerifyToken = vi.fn(() => mockToken);
    vi.mock('../server/utils/jwt', async () => {
      const actual = await vi.importActual('../server/utils/jwt');
      return {
        ...actual,
        verifyToken: mockVerifyToken,
      };
    });

    const response = await handleTicketScan(req);

    expect(response.status).toBe(200); // 200 for domain result
    const data = await response.json();
    expect(data.result).toBe('ALREADY_USED');
  });

  it('should return WRONG_EVENT for ticket mismatch', async () => {
    const mockTicket = {
      ticketId: 'ticket-123',
      eventId: 'different-event',
      userId: 'user-789',
      purchaseDate: '2023-01-01T00:00:00Z',
      status: 'unused',
      code: 'QR-123-ABC',
      holderName: 'John Doe'
    };

    (db.tickets.findByCode as MockedFunction<any>).mockReturnValue(mockTicket);

    const mockToken = {
      sub: 'device-123',
      staff_user_id: 'staff-123',
      device_public_id: 'ANDROID-XYZ-123'
    };

    const req = {
      body: {
        event_id: 'event-456', // Different event
        ticket_code: 'QR-123-ABC',
        scanned_at: '2025-11-05T19:47:22Z'
      },
      headers: {
        authorization: 'Bearer valid-token'
      }
    };

    const mockVerifyToken = vi.fn(() => mockToken);
    vi.mock('../server/utils/jwt', async () => {
      const actual = await vi.importActual('../server/utils/jwt');
      return {
        ...actual,
        verifyToken: mockVerifyToken,
      };
    });

    const response = await handleTicketScan(req);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.result).toBe('WRONG_EVENT');
  });
});