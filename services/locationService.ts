import { NominatimResult } from '../types';
import { apiFetch } from '../utils/apiClient';

/**
 * Gets the user's current geolocation (falls back to Lusaka CBD if unavailable).
 */
const FALLBACK_LOCATION = { lat: -15.4167, lon: 28.2833 }; // Lusaka CBD

// Check if geolocation permission has been granted
export const checkGeolocationPermission = async (): Promise<PermissionState> => {
  if (!navigator.permissions) {
    // Fallback for browsers that don't support the Permissions API
    return 'prompt';
  }

  try {
    const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    return permission.state;
  } catch (error) {
    // If permissions API is not supported, return 'prompt' as default
    console.warn('Permissions API not supported, defaulting to prompt', error);
    return 'prompt';
  }
};

export const getCurrentLocation = (): Promise<{ lat: number; lon: number } | null> => {
  return new Promise(async (resolve) => {
    if (!navigator.geolocation) {
      console.warn('Geolocation API unavailable. Falling back to Lusaka coordinates.');
      resolve(FALLBACK_LOCATION);
      return;
    }

    // Check current permission state
    const permissionState = await checkGeolocationPermission();
    console.log('Geolocation permission state:', permissionState);

    // Request location regardless - this will prompt if not already granted
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('Successfully retrieved location:', {
          lat: position.coords.latitude,
          lon: position.coords.longitude
        });
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      (error) => {
        console.warn('Failed to retrieve geolocation, using fallback coordinates.', error);
        // Different error handling based on the error code
        switch (error.code) {
          case error.PERMISSION_DENIED:
            console.warn('User denied geolocation request.');
            break;
          case error.POSITION_UNAVAILABLE:
            console.warn('Location information is unavailable.');
            break;
          case error.TIMEOUT:
            console.warn('The request to get user location timed out.');
            break;
          default:
            console.warn('An unknown error occurred.');
            break;
        }
        resolve(FALLBACK_LOCATION);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000, // Increase timeout to 10 seconds
        maximumAge: 300000, // Accept cached position up to 5 minutes old
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
