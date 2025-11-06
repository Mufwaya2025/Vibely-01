# Device Authorization and Ticket Scanning Feature

This document outlines the implementation of secure device authorization and ticket scanning functionality for event organizers and venue staff.

## Overview

The feature provides two core endpoints:
1. **Device Authorization**: Allows scanning devices to authenticate and receive short-lived access tokens
2. **Ticket Scanning**: Enables authorized devices to validate tickets and record scan logs

## Environment Variables

The following environment variables need to be configured:

```env
# JWT Secret for device authentication tokens
JWT_SECRET=your_jwt_secret_key_here

# JWT token expiry duration (defaults to 8 hours if not specified)
JWT_EXPIRES_IN=8h
```

These should be added to your `.env` file alongside the existing variables.

## Database Schema

The following JSON files are created to store the entities:
- `data/devices.json` - Device registration information
- `data/deviceTokens.json` - Active/inactive device tokens
- `data/tickets.json` - Ticket information with status
- `data/scanLogs.json` - Audit trail of all scan attempts
- `data/staffUsers.json` - Staff user credentials

## Endpoints

### 1. Device Authorization
- **URL**: `POST /api/devices/authorize`
- **Purpose**: Exchange device credentials for a JWT access token
- **Rate Limit**: 5 requests per minute per IP+device combination

#### Request Body:
```json
{
  "device_public_id": "ANDROID-XYZ-123",
  "device_secret": "s3cr3t-issued-by-admin-or-mdm",
  "staff_user_email": "usher1@venue.com",
  "staff_user_password": "••••••••"
}
```

#### Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
  "token_type": "Bearer",
  "expires_in_seconds": 28800,
  "device": {
    "id": "uuid",
    "device_public_id": "ANDROID-XYZ-123",
    "staff_user_id": "uuid"
  },
  "staff_user": {
    "id": "uuid",
    "email": "usher1@venue.com",
    "name": "Usher One"
  }
}
```

### 2. Ticket Scanning
- **URL**: `POST /api/tickets/scan-secure`
- **Auth**: `Authorization: Bearer <device_access_token>`
- **Purpose**: Validate tickets and record scan logs
- **Rate Limit**: 60 requests per minute per device

#### Request Body:
```json
{
  "event_id": "uuid-of-event",
  "ticket_code": "QR-123-ABC",
  "lat": -15.416,
  "lon": 28.283,
  "scanned_at": "2025-11-05T19:47:22Z"
}
```

#### Response:
```json
{
  "result": "VALID",
  "message": "Ticket accepted for entry.",
  "ticket": {
    "id": "uuid",
    "code": "QR-123-ABC",
    "status": "USED",
    "holder_name": "Jane Doe"
  },
  "event_id": "uuid-of-event",
  "scanned_by": {
    "device_id": "uuid",
    "device_public_id": "ANDROID-XYZ-123",
    "staff_user_id": "uuid"
  },
  "audit": {
    "scan_log_id": "uuid",
    "scanned_at_server": "2025-11-05T19:47:23Z",
    "lat": -15.416,
    "lon": 28.283
  }
}
```

## Rate Limits

Rate limiting is implemented at two levels:

1. **Device Authorization Endpoint**:
   - Limit: 5 requests per minute
   - Applied per IP + device_public_id combination
   - Purpose: Prevent brute force attacks on device credentials

2. **Ticket Scanning Endpoint**:
   - Limit: 60 requests per minute
   - Applied per authenticated device
   - Purpose: Prevent excessive scanning requests

## Security Features

1. **JWT Token Authentication**: Device tokens are short-lived (8 hours by default)
2. **Password Hashing**: All secrets (device secrets, passwords) are hashed using bcrypt
3. **Rate Limiting**: Prevents abuse of endpoints
4. **Audit Trail**: All scan attempts are logged in scanLogs
5. **Device Binding**: Ensures devices can only scan for their authorized events
6. **Idempotency**: Same scan within 60s window returns same result without duplicate processing

## Business Rules

1. Tickets change status from `UNUSED` to `USED` on first successful scan
2. Subsequent scans of the same ticket return `ALREADY_USED`
3. Tickets for wrong events return `WRONG_EVENT`
4. Blocked tickets return `BLOCKED`
5. Non-existent tickets return `NOT_FOUND`
6. Each scan attempt is logged regardless of success/failure

## Error Responses

- `401`: Invalid/missing authorization credentials
- `403`: Token revoked or device inactive
- `404`: Ticket not found (for domain result use 200 with appropriate result)
- `422`: Validation errors
- `429`: Rate limit exceeded