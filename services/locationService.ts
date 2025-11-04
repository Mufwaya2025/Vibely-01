import { NominatimResult } from '../types';
import { apiFetch } from '../utils/apiClient';

/**
 * Gets the user's current geolocation (falls back to Lusaka CBD if unavailable).
 */
const FALLBACK_LOCATION = { lat: -15.4167, lon: 28.2833 }; // Lusaka CBD

export const getCurrentLocation = (): Promise<{ lat: number; lon: number } | null> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn('Geolocation API unavailable. Falling back to Lusaka coordinates.');
      resolve(FALLBACK_LOCATION);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      (error) => {
        console.warn('Failed to retrieve geolocation, using fallback coordinates.', error);
        resolve(FALLBACK_LOCATION);
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0,
      }
    );
  });
};

/**
 * Searches for a location using the backend proxy to Nominatim.
 * @param query The search string.
 * @returns A promise that resolves to an array of search results.
 */
export const searchLocation = async (query: string): Promise<NominatimResult[]> => {
  if (query.length < 3) return []; // Don't search for very short strings
  try {
    const response = await apiFetch('/api/location/search', { query: { q: query } });
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error("Error searching location:", error);
    return [];
  }
};

/**
 * Gets a display address from coordinates using the backend proxy.
 * @param lat The latitude.
 * @param lon The longitude.
 * @returns A promise that resolves to the address string.
 */
export const getAddressFromCoordinates = async (lat: number, lon: number): Promise<string> => {
    try {
        const response = await apiFetch('/api/location/reverse', { query: { lat, lon } });
        if (!response.ok) return 'Unknown Location';
        const data = await response.json();
        return data.address;
    } catch (error) {
        console.error("Error getting address from coordinates:", error);
        return 'Unknown Location';
    }
};
