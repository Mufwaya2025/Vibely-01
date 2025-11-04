import { EventCategory } from "../types";
import { apiFetch } from "../utils/apiClient";

/**
 * Gets personalized event recommendations by calling our backend API,
 * which in turn calls the Gemini API.
 * @param interests A list of user interests.
 * @param attendedEvents A list of events the user has previously attended.
 * @returns A promise that resolves to a list of recommended event IDs.
 */
export const getAIRecommendations = async (
  interests: EventCategory[],
  attendedEvents: string[]
): Promise<string[]> => {
  try {
    const response = await apiFetch('/api/recommendations', {
      method: 'POST',
      body: { interests, attendedEvents },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch AI recommendations from backend");
    }
    return await response.json();

  } catch (error) {
    console.error("Error fetching AI recommendations from service:", error);
    // Fallback to an empty array on failure
    return [];
  }
};
