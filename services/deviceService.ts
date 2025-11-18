import { apiFetch } from '../utils/apiClient';

const parseJson = async <T>(response: Response, fallbackMessage: string): Promise<T> => {
  if (!response.ok) {
    const message = await response.text().catch(() => fallbackMessage);
    throw new Error(message || fallbackMessage);
  }
  return response.json() as Promise<T>;
};

interface DeviceAuthorizationRequest {
  device_public_id: string;
  device_secret: string;
  staff_user_email: string;
  staff_user_password: string;
}

interface DeviceAuthorizationResponse {
  access_token: string;
  token_type: string;
  expires_in_seconds: number;
  device: {
    id: string;
    device_public_id: string;
    staff_user_id: string;
    eventId: string | null;
    event_id: string | null;
  };
  staff_user: {
    id: string;
    email: string;
    name?: string;
  };
}

/**
 * Authorizes a scanning device with the backend API.
 */
export const authorizeDevice = async (
  deviceAuthData: DeviceAuthorizationRequest
): Promise<DeviceAuthorizationResponse> => {
  const response = await apiFetch('/api/devices/authorize', {
    method: 'POST',
    body: deviceAuthData,
  });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || 'Failed to authorize device');
  }
  
  return response.json();
};

interface DeviceLogoutRequest {
  token?: string; // Token can be passed explicitly or handled by API client
}

/**
 * Logs out a device and revokes its access token.
 */
export const logoutDevice = async (deviceToken?: string): Promise<void> => {
  const response = await apiFetch('/api/devices/logout', {
    method: 'POST',
    deviceToken, // Pass the device token for authentication
  });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || 'Failed to logout device');
  }
};

interface SecureTicketScanRequest {
  event_id: string;
  ticket_code: string;
  lat?: number;
  lon?: number;
  scanned_at?: string;
}

interface SecureTicketScanResponse {
  result: string; // VALID | ALREADY_USED | BLOCKED | NOT_FOUND | WRONG_EVENT | EXPIRED
  message: string;
  ticket?: {
    id: string;
    code: string;
    status: string;
    holder_name: string;
  };
  event_id: string;
  scanned_by: {
    device_id: string;
    device_public_id: string;
    staff_user_id: string;
  };
  audit: {
    scan_log_id: string;
    scanned_at_server: string;
    lat?: number;
    lon?: number;
  };
}

/**
 * Scans a ticket using the secure device-based API.
 * Requires device authentication via Authorization header.
 */
export const scanTicketWithDevice = async (
  scanData: SecureTicketScanRequest,
  deviceToken: string
): Promise<SecureTicketScanResponse> => {
  const response = await apiFetch('/api/tickets/scan-secure', {
    method: 'POST',
    body: scanData,
    deviceToken, // Pass the device token for authentication
  });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || 'Failed to scan ticket with device');
  }
  
  return response.json();
};

export const listOrganizerDevices = async (user?: any) =>
  parseJson(
    await apiFetch('/api/manager/devices', { user }),
    'Failed to load devices.'
  );

export const createOrganizerDevice = async (
  name: string,
  user?: any,
  eventId?: string | null,
  staffUserId?: string | null
) =>
  parseJson(
    await apiFetch('/api/manager/devices', {
      method: 'POST',
      user,
      body: { name, eventId, staffUserId },
    }),
    'Failed to create device.'
  );

export const assignOrganizerDevice = async (
  deviceId: string,
  eventId: string | null,
  staffUserId: string | null,
  user?: any
) =>
  parseJson(
    await apiFetch(`/api/manager/devices/${deviceId}/assign`, {
      method: 'POST',
      user,
      body: { eventId, staffUserId },
    }),
    'Failed to assign device.'
  );

export const updateOrganizerDevice = async (
  deviceId: string,
  updates: { isActive?: boolean; name?: string },
  user?: any
) =>
  parseJson(
    await apiFetch(`/api/manager/devices/${deviceId}`, {
      method: 'PATCH',
      user,
      body: updates,
    }),
    'Failed to update device.'
  );

export const deleteOrganizerDevice = async (deviceId: string, user?: any) => {
  const response = await apiFetch(`/api/manager/devices/${deviceId}`, {
    method: 'DELETE',
    user,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => 'Failed to delete device.');
    throw new Error(message || 'Failed to delete device.');
  }
};

export const regenerateOrganizerDeviceSecret = async (deviceId: string, user?: any) =>
  parseJson(
    await apiFetch(`/api/manager/devices/${deviceId}/regenerate`, {
      method: 'POST',
      user,
    }),
    'Failed to regenerate device secret.'
  );
