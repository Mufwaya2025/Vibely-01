import { Event, AnalysisData } from '../types';
import { apiFetch } from '../utils/apiClient';

// This file now acts as a client for our backend analytics API.

/**
 * Fetches comprehensive analytics data from the backend API.
 * @param userId The ID of the manager.
 * @param events The list of events managed by this user.
 */
export const getAnalysisData = async (userId: string, events: Event[]): Promise<AnalysisData> => {
  console.log("Calling backend API to get analysis data...");
  const response = await apiFetch('/api/analysis', { query: { userId } });
  if (!response.ok) throw new Error('Failed to fetch analysis data');

  const backendData = await response.json();
  return backendData;
};