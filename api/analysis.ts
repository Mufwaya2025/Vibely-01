import { db } from './db';
import { Event, AnalysisData } from '../types';

/**
 * Fetches analytics data for a specific user's events.
 */
export async function handleGetAnalysisData(req: { query?: { userId?: string } }) {
  const userId = req.query?.userId;
  if (!userId) {
    return new Response(JSON.stringify({ message: 'userId is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get all events for this user
    const events = db.events.findAll().filter(event => event.organizer.id === userId);

    if (events.length === 0) {
      return new Response(JSON.stringify({
        topPerformingEvent: null,
        demographics: {
          age: {},
          gender: {},
        },
        salesData: {
          byDay: [],
          byCategory: [],
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Find top performing event (by ticket sales or reviews)
    const topPerformingEvent = events.reduce((top, event) => {
      const topScore = (top.ticketsSold || 0) + (top.reviewCount || 0) * 5;
      const currentScore = (event.ticketsSold || 0) + (event.reviewCount || 0) * 5;
      return currentScore > topScore ? event : top;
    }, events[0]);

    // Get all tickets for all events of this user
    const allTickets = db.tickets.findAll().filter(ticket => {
      const event = events.find(e => e.id === ticket.eventId);
      return event !== undefined;
    });

    // Calculate demographics based on users who purchased tickets
    const userDemographics = db.users.findAll().filter(user => 
      allTickets.some(ticket => ticket.userId === user.id)
    );

    // Mock demographic distribution based on actual users who purchased tickets
    const ageDemographics: Record<string, number> = {
      '18-24': 0,
      '25-34': 0,
      '35-44': 0,
      '45+': 0,
    };

    const genderDemographics: Record<string, number> = {
      'Female': 0,
      'Male': 0,
      'Other': 0,
    };

    userDemographics.forEach(user => {
      // Simplified age calculation based on mock data
      // In a real implementation, we would have actual birth dates
      const ageRange = calculateAgeRange(user.id);
      ageDemographics[ageRange]++;

      // Use first letter of name to simulate gender distribution
      // In a real implementation, we would have actual gender data
      const gender = user.email.includes('f') || user.name.toLowerCase().includes('a') ? 'Female' : 
                    user.email.includes('m') || user.name.toLowerCase().includes('o') ? 'Male' : 'Other';
      genderDemographics[gender]++;
    });

    // Normalize percentages
    const totalUsers = userDemographics.length;
    if (totalUsers > 0) {
      Object.keys(ageDemographics).forEach(key => {
        ageDemographics[key] = parseFloat(((ageDemographics[key] / totalUsers) * 100).toFixed(1));
      });
      Object.keys(genderDemographics).forEach(key => {
        genderDemographics[key] = parseFloat(((genderDemographics[key] / totalUsers) * 100).toFixed(1));
      });
    }

    // Calculate sales by day (last 7 days)
    const salesByDay = getSalesByDay(allTickets);

    // Calculate sales by category
    const salesByCategory = getSalesByCategory(events, allTickets);

    const result: AnalysisData = {
      topPerformingEvent,
      demographics: {
        age: ageDemographics,
        gender: genderDemographics,
      },
      salesData: {
        byDay: salesByDay,
        byCategory: salesByCategory,
      },
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching analysis data:', error);
    return new Response(JSON.stringify({ message: 'Failed to fetch analysis data.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Helper function to simulate age ranges
function calculateAgeRange(userId: string): string {
  // In a real application, we would have actual birth dates
  // For demo purposes, we'll simulate based on user ID
  const hash = Array.from(userId).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const ageGroup = hash % 4;
  
  switch (ageGroup) {
    case 0: return '18-24';
    case 1: return '25-34';
    case 2: return '35-44';
    default: return '45+';
  }
}

// Helper function to get sales by day
function getSalesByDay(tickets: any[]): { date: string; tickets: number }[] {
  const salesByDay: Record<string, number> = {};
  
  // Initialize last 7 days
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    salesByDay[dateStr] = 0;
  }

  // Count tickets by day
  tickets.forEach(ticket => {
    const purchaseDate = new Date(ticket.purchaseDate).toISOString().split('T')[0];
    if (salesByDay[purchaseDate] !== undefined) {
      salesByDay[purchaseDate]++;
    }
  });

  return Object.entries(salesByDay).map(([date, tickets]) => ({ date, tickets }));
}

// Helper function to get sales by category
function getSalesByCategory(events: Event[], tickets: any[]): { category: string; tickets: number }[] {
  const categorySales: Record<string, number> = {};
  
  events.forEach(event => {
    categorySales[event.category] = 0;
  });

  tickets.forEach(ticket => {
    const event = events.find(e => e.id === ticket.eventId);
    if (event) {
      categorySales[event.category]++;
    }
  });

  return Object.entries(categorySales).map(([category, tickets]) => ({ 
    category: category as any, 
    tickets 
  }));
}