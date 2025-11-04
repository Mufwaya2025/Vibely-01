import { Event, AnalysisData } from '../types';

// This file now acts as a client for our backend analytics API.

/**
 * Fetches comprehensive analytics data from the backend API.
 * @param userId The ID of the manager.
 * @param events The list of events managed by this user.
 */
export const getAnalysisData = async (userId: string, events: Event[]): Promise<AnalysisData> => {
  console.log("Calling backend API to get analysis data...");
  // In a real app:
  // const response = await fetch(`/api/analysis?userId=${userId}`);
  // const data = await response.json();
  // return data;

  // We simulate the API call and response for this environment.
  await new Promise(resolve => setTimeout(resolve, 800));

  const topPerformingEvent = events.length > 0
    ? [...events].sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0))[0]
    : null;

  const salesByDay = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i);
    return { date: d.toISOString().split('T')[0], tickets: Math.floor(Math.random() * 50) + 10 };
  }).reverse();
  
  const salesByCategory = (['Music', 'Art', 'Food', 'Tech', 'Sports', 'Community'] as const).map(cat => ({
    category: cat,
    tickets: Math.floor(Math.random() * 200) + 20,
  }));

  const mockData: AnalysisData = {
    topPerformingEvent,
    demographics: {
      age: { '18-24': 35, '25-34': 45, '35-44': 15, '45+': 5 },
      gender: { 'Female': 58, 'Male': 40, 'Other': 2 },
    },
    salesData: { byDay: salesByDay, byCategory: salesByCategory },
  };

  return mockData;
};