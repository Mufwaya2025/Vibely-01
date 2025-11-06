import { apiFetch } from '../utils/apiClient';

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