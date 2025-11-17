import { Event, User } from '../types';
import { apiFetch, apiFetchJson } from '../utils/apiClient';

/**
 * Fetches all events from the backend API.
 */
export const getAllEvents = async (user?: User | null): Promise<Event[]> => {
  try {
    return await apiFetchJson<Event[]>('/api/events', user ? { user } : undefined);
  } catch (error) {
    console.error('Error fetching all events:', error);
    return [];
  }
};

/**
 * Creates a new event by calling the backend API.
 * @param eventData The data for the new event.
 * @param organizer The user creating the event.
 * @returns The newly created event.
 */
export const createEvent = async (
  eventData: Omit<Event, 'id' | 'organizer'>,
  organizer: { id: string; name: string }
): Promise<Event> => {
  const response = await apiFetch('/api/events', {
    method: 'POST',
    body: { eventData, organizer },
  });
  if (!response.ok) {
    const message = await response.text().catch(() => 'Failed to create event');
    throw new Error(message || 'Failed to create event');
  }
  return response.json();
};

/**
 * Updates an existing event by calling the backend API.
 * @param eventData The updated event data
 * @param user The user making the request (to verify ownership)
 * @returns The updated event
 */
export const updateEvent = async (
  eventData: Event,
  user: User
): Promise<Event> => {
  const response = await apiFetch(`/api/events/${eventData.id}`, {
    method: 'PUT',
    body: { eventData, userId: user.id },
  });
  if (!response.ok) {
    const message = await response.text().catch(() => 'Failed to update event');
    throw new Error(message || 'Failed to update event');
  }
  return response.json();
};
