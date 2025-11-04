import { db } from './db';
import { EventCategory, EventStatus, User } from '../types';
import { requireAdmin } from './utils/auth';

interface AdminRequest {
  user: User | null;
}

export async function handleGetPlatformStats(req: AdminRequest) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  await new Promise((resolve) => setTimeout(resolve, 400));

  const allUsers = db.users.findAll();
  const allEvents = db.events.findAll();
  const allTransactions = db.gatewayTransactions.findAll();
  const allTickets = db.tickets.findAll(); // Get all tickets to calculate sales

  const usersByRole = allUsers.reduce<Record<string, number>>((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {});

  const now = new Date();
  const upcomingEvents = allEvents.filter((event) => new Date(event.date) >= now);
  const pastEvents = allEvents.length - upcomingEvents.length;

  const totalRevenue = allTransactions
    .filter((txn) => txn.status === 'succeeded')
    .reduce((sum, txn) => sum + txn.amount, 0);
  const totalTickets = allTickets.length; // Use actual tickets instead of transactions
  const averageTicketPrice =
    allTickets.length > 0
      ? totalRevenue / allTickets.length || 0
      : 0;

  const topCategories = allEvents.reduce<Record<EventCategory, number>>((acc, event) => {
    acc[event.category] = (acc[event.category] || 0) + 1;
    return acc;
  }, {} as Record<EventCategory, number>);

  const categoryStats = Object.entries(topCategories)
    .map(([category, count]) => ({ category: category as EventCategory, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Calculate ticketsSold for each event and create enriched events
  const eventsWithTicketCounts = allEvents.map(event => {
    const eventTickets = allTickets.filter(ticket => ticket.eventId === event.id);
    const ticketsSold = eventTickets.length;
    return { ...event, ticketsSold };
  });

  const recentEvents = [...eventsWithTicketCounts]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const payload = {
    totalUsers: allUsers.length,
    usersByRole,
    totalEvents: allEvents.length,
    upcomingEvents: upcomingEvents.length,
    pastEvents,
    totalTickets,
    totalRevenue,
    averageTicketPrice,
    topCategories: categoryStats,
    recentEvents,
  };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleGetAllEventsForAdmin(req: AdminRequest) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  await new Promise((resolve) => setTimeout(resolve, 200));
  
  const allEvents = db.events.findAll();
  const allTickets = db.tickets.findAll(); // Get all tickets to calculate sales
  
  // Calculate ticketsSold for each event and create enriched events
  const eventsWithTicketCounts = allEvents.map(event => {
    const eventTickets = allTickets.filter(ticket => ticket.eventId === event.id);
    const ticketsSold = eventTickets.length;
    return { ...event, ticketsSold };
  });

  const events = eventsWithTicketCounts
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return new Response(JSON.stringify(events), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleUpdateEventStatus(req: {
  user: User | null;
  body: { eventId: string; status: EventStatus };
}) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const { eventId, status } = req.body;
  if (!eventId || !status) {
    return new Response(JSON.stringify({ message: 'Invalid request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const updated = db.events.update(eventId, { status });
  if (!updated) {
    return new Response(JSON.stringify({ message: 'Event not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(updated), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleUpdateEventFeatured(req: {
  user: User | null;
  body: { eventId: string; isFeatured: boolean };
}) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const { eventId, isFeatured } = req.body;
  if (!eventId || typeof isFeatured !== 'boolean') {
    return new Response(JSON.stringify({ message: 'Invalid request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const updated = db.events.update(eventId, { isFeatured });
  if (!updated) {
    return new Response(JSON.stringify({ message: 'Event not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(updated), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

