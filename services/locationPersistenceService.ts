/**
 * Service to handle location persistence in localStorage
 */

const LOCATION_STORAGE_KEY = 'vibely:user:location';

interface LocationData {
  lat: number;
  lon: number;
  timestamp: number; // Unix timestamp in milliseconds
}

/**
 * Save user location to localStorage with a timestamp
 */
export const saveLocationToStorage = (lat: number, lon: number): void => {
  if (typeof window === 'undefined') {
    console.warn('Cannot save location: running outside browser environment');
    return;
  }
  
  try {
    const locationData: LocationData = {
      lat,
      lon,
      timestamp: Date.now()
    };
    
    window.localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(locationData));
    console.log(`Location saved to localStorage: [${lat}, ${lon}]`);
  } catch (error) {
    console.error('Failed to save location to localStorage', error);
  }
};

/**
 * Load user location from localStorage
 * @param maxAge Maximum age of the location data in milliseconds (default: 24 hours)
 * @returns Location object if available and not expired, null otherwise
 */
export const loadLocationFromStorage = (maxAge: number = 24 * 60 * 60 * 1000): { lat: number; lon: number } | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  
  try {
    const raw = window.localStorage.getItem(LOCATION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    
    const locationData: LocationData = JSON.parse(raw);
    
    // Check if the location data is too old
    if (Date.now() - locationData.timestamp > maxAge) {
      console.log('Location data is too old, removing from storage');
      removeLocationFromStorage();
      return null;
    }
    
    console.log(`Location loaded from localStorage: [${locationData.lat}, ${locationData.lon}]`);
    return { lat: locationData.lat, lon: locationData.lon };
  } catch (error) {
    console.error('Failed to load location from localStorage', error);
    return null;
  }
};

/**
 * Remove user location from localStorage
 */
export const removeLocationFromStorage = (): void => {
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    window.localStorage.removeItem(LOCATION_STORAGE_KEY);
    console.log('Location removed from localStorage');
  } catch (error) {
    console.error('Failed to remove location from localStorage', error);
  }
};

/**
 * Get the timestamp of when the location was last saved
 */
export const getLocationTimestamp = (): number | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  
  try {
    const raw = window.localStorage.getItem(LOCATION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    
    const locationData: LocationData = JSON.parse(raw);
    return locationData.timestamp;
  } catch (error) {
    console.error('Failed to get location timestamp from localStorage', error);
    return null;
  }
};