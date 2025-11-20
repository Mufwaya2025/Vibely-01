import { deviceAuthDb as db } from './deviceAuthDb';
import { ScanLog, TicketScanResult } from '../types';

export async function handleTicketScan(req: { 
  body: {
    event_id: string;
    ticket_code: string;
    lat?: number;
    lon?: number;
    scanned_at?: string;
  };
  deviceInfo: {
    deviceId: string;
    staffUserId: string;
    devicePublicId: string;
  };
  ip?: string;
}) {
  const { event_id, ticket_code, lat, lon, scanned_at } = req.body;
  
  // Validate input
  if (!event_id || !ticket_code) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Extract device and staff info from request (set by auth middleware)
  const { deviceId, staffUserId, devicePublicId } = req.deviceInfo;
  
  try {
    // Find ticket by code
    const ticket = db.tickets.findByCode(ticket_code);
    
    let scanResult: TicketScanResult;
    let message: string;

    let updatedTicket: any = null;

    if (!ticket) {
      scanResult = 'NOT_FOUND';
      message = 'Ticket not found';
    } else if (ticket.eventId !== event_id) {
      scanResult = 'WRONG_EVENT';
      message = 'Ticket does not belong to this event';
    } else if (ticket.status === 'blocked') {
      scanResult = 'BLOCKED';
      message = 'Ticket has been blocked';
    } else if (ticket.status === 'used' || ticket.status === 'scanned') {
      scanResult = 'ALREADY_USED';
      message = 'Ticket has already been used';
    } else if (ticket.status === 'unused' || ticket.status === 'valid') {
      scanResult = 'VALID';
      message = 'Ticket accepted for entry';
      updatedTicket = db.tickets.markAsUsed(ticket.ticketId);
    } else {
      scanResult = 'EXPIRED';
      message = 'Ticket is expired or invalid';
    }

    // Extract IP address from request
    const ip = req.ip || 'unknown';

    // Implement idempotency: check if the same device scanned the same ticket within 60s
    const idempotencyWindowStart = new Date(Date.now() - 60000); // 60 seconds ago
    const recentScans = ticket ? db.scanLogs.findByTicketId(ticket.ticketId) : [];
    const recentScan = recentScans.find(log => 
      log.deviceId === deviceId && 
      log.ticketId === ticket?.ticketId && 
      new Date(log.createdAt) > idempotencyWindowStart
    );

    if (recentScan) {
      // Return the same result as the previous scan within the idempotency window
      const response = {
        result: recentScan.scanResult,
        message: recentScan.message,
        event_id,
        scanned_by: {
          device_id: deviceId,
          device_public_id: devicePublicId,
          staff_user_id: staffUserId
        },
        audit: {
          scan_log_id: recentScan.id,
          scanned_at_server: recentScan.scannedAt,
          lat: recentScan.lat,
          lon: recentScan.lon
        }
      };
      
      return new Response(
        JSON.stringify(response),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create scan log entry
    const scanLog: ScanLog = {
      id: `sl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ticketId: ticket?.ticketId || '',
      eventId: event_id,
      deviceId,
      staffUserId,
      scanResult,
      message,
      scannedAt: scanned_at || new Date().toISOString(),
      lat: lat || undefined,
      lon: lon || undefined,
      ip,
      createdAt: new Date().toISOString(),
    };

    db.scanLogs.create(scanLog);

    // Prepare response
    const response: any = {
      result: scanResult,
      message,
      event_id,
      scanned_by: {
        device_id: deviceId,
        device_public_id: devicePublicId,
        staff_user_id: staffUserId
      },
      audit: {
        scan_log_id: scanLog.id,
        scanned_at_server: new Date().toISOString(),
        lat: scanLog.lat,
        lon: scanLog.lon
      }
    };

    const ticketForResponse = updatedTicket ?? ticket ?? null;

    if (ticketForResponse) {
      response.ticket = {
        id: ticketForResponse.ticketId,
        code: ticketForResponse.code || ticketForResponse.ticketId,
        status: ticketForResponse.status,
        holder_name: ticketForResponse.holderName || ''
      };
    }

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Ticket scan error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

