// This file simulates a backend proxy to call the OpenStreetMap Nominatim API.
// This is the correct architecture to bypass browser CORS restrictions.

/**
 * Handles a location search request by proxying it to the Nominatim API.
 * @param {Request} req - Contains the search query.
 * @returns {Response} The search results from the external API.
 */
export async function handleSearchLocation(req: { query: { q: string } }) {
    const { q } = req.query;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&countrycodes=zm`; // Limit to Zambia

    try {
        // In a real backend, you'd use a library like 'node-fetch' or 'axios'.
        // We simulate the fetch call here.
        const response = await fetch(url, {
            headers: { 'User-Agent': 'VibelyApp/1.0' } // Nominatim requires a user agent
        });

        if (!response.ok) {
            throw new Error(`Nominatim API failed with status: ${response.status}`);
        }

        const data = await response.json();
        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Failed to proxy location search:", error);
        return new Response(JSON.stringify({ message: 'Location search failed' }), { status: 500 });
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

    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'VibelyApp/1.0' }
        });

        if (!response.ok) {
            throw new Error(`Nominatim API failed with status: ${response.status}`);
        }

        const data = await response.json();
         return new Response(JSON.stringify({ address: data.display_name || 'Unknown Location' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("Failed to proxy reverse geocoding:", error);
        return new Response(JSON.stringify({ message: 'Reverse geocoding failed' }), { status: 500 });
    }
}