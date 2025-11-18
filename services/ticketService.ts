import { Ticket, Event, User } from '../types';
import { apiFetch } from '../utils/apiClient';

/**
 * Fetches all tickets for a specific user from the API.
 */
export const getTicketsForUser = async (userId: string): Promise<(Ticket & { event?: Event })[]> => {
  const response = await apiFetch('/api/tickets', { query: { userId } });
  if (!response.ok) throw new Error('Failed to fetch user tickets');
  return response.json();
};

/**
 * Creates a new ticket via the API.
 */
export const createTicket = async (event: Event, user: User, ticketTierId?: string): Promise<Ticket> => {
  const response = await apiFetch('/api/tickets', {
    method: 'POST',
    body: { event, user, ticketTierId },
  });
  if (!response.ok) throw new Error('Failed to create ticket');
  return response.json();
};

/**
 * Submits a review for a ticket via the API.
 */
export const submitReview = async (ticketId: string, rating: number, reviewText: string): Promise<Ticket> => {
  const response = await apiFetch('/api/tickets/review', {
    method: 'POST',
    body: { ticketId, rating, reviewText },
  });
  if (!response.ok) throw new Error('Failed to submit review');
  return response.json();
};

// Fix: Add a function to get tickets for a specific event, which was missing.
/**
 * Gets all tickets for a given event from the API.
 */
export const getTicketsForEvent = async (eventId: string): Promise<Ticket[]> => {
  const response = await apiFetch(`/api/tickets/event/${eventId}`);
  if (!response.ok) throw new Error('Failed to fetch tickets for event');
  return response.json();
};

/**
 * Gets all reviews for a given event from the API.
 */
export const getReviewsForEvent = async (eventId: string): Promise<Ticket[]> => {
  const response = await apiFetch('/api/reviews', { query: { eventId } });
  if (!response.ok) throw new Error('Failed to fetch reviews');
  return response.json();
};

/**
 * Scans/redeems a ticket via the API (for organizer/manager interface).
 */
export class TicketScanError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'TicketScanError';
    this.status = status;
  }
}

const parseJsonSafe = (text: string) => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export const scanTicket = async (ticketId: string): Promise<Ticket> => {
  const response = await apiFetch('/api/tickets/scan', {
    method: 'POST',
    body: { ticketId },
  });

  const text = await response.text();
  const payload = parseJsonSafe(text);

  if (!response.ok) {
    throw new TicketScanError(
      (payload as { message?: string } | null)?.message ?? 'Failed to scan ticket.',
      response.status
    );
  }

  return payload as Ticket;
};

/**
 * Scans a ticket via the secure device-based API (for dedicated scanning devices).
 */
export const scanTicketSecure = async (
  eventId: string, 
  ticketCode: string, 
  deviceToken: string,
  lat?: number, 
  lon?: number
): Promise<any> => {
  const scanData = {
    event_id: eventId,
    ticket_code: ticketCode,
    lat,
    lon,
    scanned_at: new Date().toISOString()
  };

  const response = await apiFetch('/api/tickets/scan-secure', {
    method: 'POST',
    body: scanData,
    deviceToken, // Pass the device token for authentication
  });

  if (!response.ok) {
    throw new Error(`Failed to scan ticket: ${response.statusText}`);
  }
  return response.json();
}

// NOTE: getAllTickets is no longer needed on the frontend, as calculations like
// ticketsSold are now handled by the backend. We keep it here in case it's needed
// for a future admin panel.
export const getAllTickets = async (): Promise<Ticket[]> => {
    // This would call a protected admin endpoint.
    console.warn("getAllTickets is now a protected backend operation.");
    return [];
}
