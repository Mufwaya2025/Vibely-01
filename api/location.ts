// This file simulates a backend proxy to call the OpenStreetMap Nominatim API.
// This is the correct architecture to bypass browser CORS restrictions.

// Configuration from environment variables or defaults
const REQUEST_TIMEOUT_MS = parseInt(process.env.LOCATION_API_TIMEOUT_MS || '10000'); // Default 10 seconds
const MAX_RETRIES = parseInt(process.env.LOCATION_API_MAX_RETRIES || '3'); // Default 3 retries
const BASE_DELAY_MS = parseInt(process.env.LOCATION_API_BASE_DELAY_MS || '1000'); // Default 1 second base delay

/**
 * Implements exponential backoff for retries
 * @param attempt - Current attempt number (0-indexed)
 * @returns Promise that resolves after the calculated delay
 */
async function delay(attempt: number): Promise<void> {
    const delayMs = BASE_DELAY_MS * Math.pow(2, attempt); // Exponential backoff: 1s, 2s, 4s, etc.
    return new Promise(resolve => setTimeout(resolve, delayMs));
}

/**
 * Performs a fetch request with retry logic
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @param retries - Number of retries remaining
 * @returns The fetch response
 */
async function fetchWithRetry(url: string, options: RequestInit, retries: number = MAX_RETRIES): Promise<Response> {
    const attemptNumber = MAX_RETRIES - retries + 1;
    console.log(`Location API request attempt ${attemptNumber}/${MAX_RETRIES + 1}: ${url}`);
    
    try {
        // Create a timeout controller for the request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        
        // Update signal in options with our controller
        const fetchOptions = {
            ...options,
            signal: controller.signal
        };
        
        const response = await fetch(url, fetchOptions);
        clearTimeout(timeoutId);
        
        // If successful, return the response
        if (response.ok) {
            console.log(`Location API request successful on attempt ${attemptNumber}`);
            return response;
        }
        
        // If it's not successful but we have retries left, throw to trigger retry
        if (retries > 0) {
            console.warn(`Location API request failed on attempt ${attemptNumber} with status ${response.status}, will retry...`);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        console.error(`Location API request failed on final attempt ${attemptNumber} with status ${response.status}`);
        return response; // Return the failed response if no retries left
    } catch (error: any) {
        // If we've exhausted retries or it's not a network error, rethrow
        if (retries <= 0) {
            console.error(`Location API request failed after ${MAX_RETRIES + 1} attempts`);
            throw error;
        }
        
        // If it's a timeout or network error, try again after delay
        if (error.name === 'AbortError' || 
            error.code === 'UND_ERR_CONNECT_TIMEOUT' || 
            error.message.includes('timeout') ||
            error.message.includes('fetch failed') ||
            error.message.includes('network')) {
            
            console.warn(`Request failed, retrying in ${BASE_DELAY_MS * Math.pow(2, MAX_RETRIES - retries)}ms... (${retries} retries left)`);
            await delay(MAX_RETRIES - retries);
            return fetchWithRetry(url, options, retries - 1);
        }
        
        // For other errors, don't retry
        console.error(`Location API request failed with non-retryable error:`, error.message);
        throw error;
    }
}

/**
 * Handles a location search request by proxying it to the Nominatim API.
 * @param {Request} req - Contains the search query.
 * @returns {Response} The search results from the external API.
 */
export async function handleSearchLocation(req: { query: { q: string } }) {
    const { q } = req.query;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&countrycodes=zm`; // Limit to Zambia

    console.log(`Location search request: ${q}`);
    
    try {
        // Use fetchWithRetry instead of direct fetch
        const response = await fetchWithRetry(url, {
            headers: { 'User-Agent': 'VibelyApp/1.0' } // Nominatim requires a user agent
        });

        if (!response.ok) {
            throw new Error(`Nominatim API failed with status: ${response.status}`);
        }

        const data = await response.json();
        console.log(`Location search completed successfully, found ${data.length} results`);
        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        // Handle timeout and network errors specifically
        if (error.name === 'AbortError') {
            console.error(`Location search request timed out for query "${q}":`, error);
            return new Response(JSON.stringify({ message: 'Location search timed out' }), { status: 408 });
        } else if (error.code === 'UND_ERR_CONNECT_TIMEOUT' || error.message.includes('timeout')) {
            console.error(`Location search connect timeout for query "${q}":`, error);
            return new Response(JSON.stringify({ message: 'Location service currently unavailable (timeout)' }), { status: 504 });
        } else if (error.message.includes('fetch failed') || error.message.includes('network')) {
            console.error(`Network error during location search for query "${q}":`, error);
            return new Response(JSON.stringify({ message: 'Network error during location search' }), { status: 502 });
        } else {
            console.error(`Failed to proxy location search for query "${q}":`, error);
            return new Response(JSON.stringify({ message: 'Location search failed' }), { status: 500 });
        }
    }
}


/**
 * Handles a reverse geocoding request by proxying it to the Nominatim API.
 * @param {Request} req - Contains latitude and longitude.
 * @returns {Response} The address details from the external API.
 */
export async function handleGetAddressFromCoordinates(req: { query: { lat: number, lon: number } }) {
    const { lat, lon } = req.query;
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;

    console.log(`Reverse geocoding request: lat=${lat}, lon=${lon}`);
    
    try {
        // Use fetchWithRetry instead of direct fetch
        const response = await fetchWithRetry(url, {
            headers: { 'User-Agent': 'VibelyApp/1.0' }
        });

        if (!response.ok) {
            throw new Error(`Nominatim API failed with status: ${response.status}`);
        }

        const data = await response.json();
        console.log(`Reverse geocoding completed successfully for coordinates: lat=${lat}, lon=${lon}`);
        return new Response(JSON.stringify({ address: data.display_name || 'Unknown Location' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error: any) {
        // Handle timeout and network errors specifically
        if (error.name === 'AbortError') {
            console.error(`Reverse geocoding request timed out for coordinates: lat=${lat}, lon=${lon}:`, error);
            return new Response(JSON.stringify({ message: 'Reverse geocoding timed out' }), { status: 408 });
        } else if (error.code === 'UND_ERR_CONNECT_TIMEOUT' || error.message.includes('timeout')) {
            console.error(`Reverse geocoding connect timeout for coordinates: lat=${lat}, lon=${lon}:`, error);
            return new Response(JSON.stringify({ message: 'Location service currently unavailable (timeout)' }), { status: 504 });
        } else if (error.message.includes('fetch failed') || error.message.includes('network')) {
            console.error(`Network error during reverse geocoding for coordinates: lat=${lat}, lon=${lon}:`, error);
            return new Response(JSON.stringify({ message: 'Network error during reverse geocoding' }), { status: 502 });
        } else {
            console.error(`Failed to proxy reverse geocoding for coordinates: lat=${lat}, lon=${lon}:`, error);
            return new Response(JSON.stringify({ message: 'Reverse geocoding failed' }), { status: 500 });
        }
    }
}