import { db } from './db';
import { Event } from '../types';

/**
 * Handles fetching all events.
 * It also calculates and injects the 'ticketsSold' count for each event.
 * @returns {Response} A list of all events with their sales count.
 */
export async function handleGetAllEvents() {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const allEvents = db.events.findAll();
    const allTickets = db.tickets.findAll();

    const eventsWithCounts = allEvents.map(event => {
        const ticketsSold = allTickets.filter(t => t.eventId === event.id).length;
        return { ...event, ticketsSold };
    });

    return new Response(JSON.stringify(eventsWithCounts), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}


/**
 * Handles the creation of a new event, including subscription checks.
 * @param {Request} req - Contains event data and organizer details.
 * @returns {Response} The newly created event or an error.
 */
export async function handleCreateEvent(req: { body: { eventData: Omit<Event, 'id' | 'organizer'>, organizer: { id: string; name: string } } }) {
    const { eventData, organizer } = req.body;
    
    // --- Subscription Check ---
    const user = db.users.findById(organizer.id);
    if (!user) {
        return new Response(JSON.stringify({ message: 'Organizer not found.' }), { status: 404 });
    }

    if (user.subscriptionTier === 'Regular') {
        const userEvents = db.events.findByOrganizer(user.id);
        if (userEvents.length >= 3) {
            return new Response(JSON.stringify({ message: 'Event limit reached for Regular plan. Please upgrade to Pro.' }), { status: 403 }); // 403 Forbidden
        }
    }
    // --- End Subscription Check ---
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const newEventData = { ...eventData, organizer };
    const newEvent = db.events.create(newEventData);

    // Return the event with ticketsSold initialized
    const eventWithCount = { ...newEvent, ticketsSold: 0 };

    return new Response(JSON.stringify(eventWithCount), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * Handles the update of an existing event, validating ownership.
 * @param {Request} req - Contains event data, event ID and user ID
 * @returns {Response} The updated event or an error
 */
export async function handleUpdateEvent(req: { body: { eventData: Event, userId: string } }) {
    const { eventData, userId } = req.body;
    
    // Verify the user is the organizer of the event
    const existingEvent = db.events.findById(eventData.id);
    if (!existingEvent) {
        return new Response(JSON.stringify({ message: 'Event not found.' }), { status: 404 });
    }
    
    if (existingEvent.organizer.id !== userId) {
        return new Response(JSON.stringify({ message: 'Unauthorized: You are not the organizer of this event.' }), { status: 403 });
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Update the event with new data while preserving original organizer
    const updatedEvent = db.events.update(eventData.id, {
        ...eventData,
        organizer: existingEvent.organizer // Preserve original organizer
    });

    return new Response(JSON.stringify(updatedEvent), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * Handles the deletion of an event, validating ownership.
 * @param {Request} req - Contains event ID and user ID
 * @returns {Response} Success or error message
 */
export async function handleDeleteEvent(req: { params: { id: string }, body: { userId: string } }) {
    const { id: eventId } = req.params;
    const { userId } = req.body;
    
    // Verify the user is the organizer of the event
    const existingEvent = db.events.findById(eventId);
    if (!existingEvent) {
        return new Response(JSON.stringify({ message: 'Event not found.' }), { status: 404 });
    }
    
    if (existingEvent.organizer.id !== userId) {
        return new Response(JSON.stringify({ message: 'Unauthorized: You are not the organizer of this event.' }), { status: 403 });
    }
    
    // Check if event has any tickets sold - if so, prevent deletion
    const eventTickets = db.tickets.findByEvent(eventId);
    if (eventTickets.length > 0) {
        return new Response(JSON.stringify({ message: 'Cannot delete event with existing tickets.' }), { status: 400 });
    }
    
    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate processing time
    
    const deleted = db.events.delete(eventId);
    if (deleted) {
        return new Response(JSON.stringify({ message: 'Event deleted successfully.' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } else {
        return new Response(JSON.stringify({ message: 'Failed to delete event.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}