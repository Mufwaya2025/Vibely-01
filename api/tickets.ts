import { db } from './db';
import { Ticket, Event, User } from '../types';

/**
 * Handles fetching all tickets for a specific user.
 * @param {Request} req - Contains userId in the query params.
 * @returns {Response} A list of tickets enriched with event details.
 */
export async function handleGetTicketsForUser(req: { query: { userId: string } }) {
    const { userId } = req.query;
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const userTickets = db.tickets.findByUser(userId);
    const allEvents = db.events.findAll();

    const enrichedTickets = userTickets.map(ticket => {
        const event = allEvents.find(e => e.id === ticket.eventId);
        return { ...ticket, event: event! };
    }).sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());

    return new Response(JSON.stringify(enrichedTickets), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * Handles fetching all reviews for a specific event.
 * @param {Request} req - Contains eventId in the query params.
 * @returns {Response} A list of tickets that contain reviews.
 */
export async function handleGetReviewsForEvent(req: { query: { eventId: string } }) {
    const { eventId } = req.query;
    await new Promise(resolve => setTimeout(resolve, 250));

    const eventTickets = db.tickets.findByEvent(eventId);
    const reviews = eventTickets.filter(t => t.rating && !!t.reviewText);

    return new Response(JSON.stringify(reviews), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

// Fix: Add a handler to get all tickets for a specific event.
/**
 * Handles fetching all tickets for a specific event.
 * @param {Request} req - Contains eventId in the query params.
 * @returns {Response} A list of all tickets for the event.
 */
export async function handleGetTicketsForEvent(req: { query: { eventId: string } }) {
    const { eventId } = req.query;
    await new Promise(resolve => setTimeout(resolve, 250));

    const eventTickets = db.tickets.findByEvent(eventId);

    return new Response(JSON.stringify(eventTickets), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}


/**
 * Handles the creation of a new ticket.
 * @param {Request} req - Contains the event and user details in the body.
 * @returns {Response} The newly created ticket object.
 */
export async function handleCreateTicket(req: { body: { event: Event, user: User } }) {
    const { event, user } = req.body;
    await new Promise(resolve => setTimeout(resolve, 200));

    const newTicket: Ticket = {
        ticketId: `tkt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        eventId: event.id,
        userId: user.id,
        purchaseDate: new Date().toISOString(),
        status: 'valid',
    };

    const createdTicket = db.tickets.create(newTicket);
    return new Response(JSON.stringify(createdTicket), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * Handles submitting a review for a ticket.
 * @param {Request} req - Contains ticketId, rating, and reviewText in the body.
 * @returns {Response} The updated ticket object.
 */
export async function handleSubmitReview(req: { body: { ticketId: string, rating: number, reviewText: string } }) {
    const { ticketId, rating, reviewText } = req.body;
    await new Promise(resolve => setTimeout(resolve, 600));

    const updatedTicket = db.tickets.update(ticketId, { rating, reviewText });

    if (updatedTicket) {
        return new Response(JSON.stringify(updatedTicket), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    return new Response(JSON.stringify({ message: 'Ticket not found' }), { status: 404 });
}

/**
 * Handles scanning/redeeming a ticket.
 * @param {Request} req - Contains ticketId in the body.
 * @returns {Response} The updated ticket object.
 */
export async function handleScanTicket(req: { body: { ticketId: string } }) {
    const { ticketId } = req.body;
    await new Promise(res => setTimeout(res, 500));
    
    const ticket = db.tickets.findById(ticketId);

    if (!ticket) {
        return new Response(JSON.stringify({ message: 'Ticket not found' }), { status: 404 });
    }
    if (ticket.status === 'scanned') {
         return new Response(JSON.stringify({ message: 'Ticket already scanned' }), { status: 409 }); // 409 Conflict
    }

    const updatedTicket = db.tickets.update(ticketId, {
        status: 'scanned',
        scanTimestamp: new Date().toISOString(),
    });
    
     return new Response(JSON.stringify(updatedTicket), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}