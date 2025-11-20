import React, { useEffect, useMemo, useRef } from 'react';
import L, { Map } from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet marker image fixes for bundlers (Vite, CRA with ESM, etc.)
const markerIcon2x = new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).toString();
const markerIcon = new URL('leaflet/dist/images/marker-icon.png', import.meta.url).toString();
const markerShadow = new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).toString();

import { Event } from '../types';
import { formatPrice } from '../utils/tickets';

const TILE_SOURCE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const MAX_DISTANCE_METERS = 10_000;

const EVENT_MARKER_ICON = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface EventMapProps {
  events: Event[];
  userLocation: { lat: number; lon: number } | null;
  onSelectEvent: (event: Event) => void;
  onPurchase: (event: Event) => void;
  purchasedTicketIds: Set<string>;
}

/**
 * Try to read coordinates from different common shapes.
 * This is defensive because your data may not be strictly { latitude, longitude }.
 */
function extractCoords(event: any): { lat: number; lon: number } | null {
  // 1) event.latitude / event.longitude
  if (event?.latitude != null && event?.longitude != null) {
    const lat = Number(event.latitude);
    const lon = Number(event.longitude);
    if (!Number.isNaN(lat) && !Number.isNaN(lon)) return { lat, lon };
  }

  // 2) event.lat / event.lng
  if (event?.lat != null && event?.lng != null) {
    const lat = Number(event.lat);
    const lon = Number(event.lng);
    if (!Number.isNaN(lat) && !Number.isNaN(lon)) return { lat, lon };
  }

  // 3) event.lat / event.lon
  if (event?.lat != null && event?.lon != null) {
    const lat = Number(event.lat);
    const lon = Number(event.lon);
    if (!Number.isNaN(lat) && !Number.isNaN(lon)) return { lat, lon };
  }

  // 4) event.location = { lat, lng | lon | longitude, latitude }
  if (event?.location && typeof event.location === 'object') {
    const loc = event.location;
    const candLat = Number(loc.latitude ?? loc.lat);
    const candLon = Number(loc.longitude ?? loc.lng ?? loc.lon);
    if (!Number.isNaN(candLat) && !Number.isNaN(candLon)) {
      return { lat: candLat, lon: candLon };
    }
  }

  return null;
}

const EventMap: React.FC<EventMapProps> = ({
  events,
  userLocation,
  onSelectEvent,
  onPurchase,
  purchasedTicketIds,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const radiusCircleRef = useRef<L.Circle | null>(null);

  /**
   * 1. Parse events and keep only those with *valid* coordinates.
   * For this diagnostic version, we are NOT filtering by distance — we want to see *something*.
   */
  const eventsWithCoords = useMemo(() => {
    if (import.meta.env.DEV) {
      console.log('[EventMap] Total events received:', events.length);
      console.log('[EventMap] Raw events data:', events);
    }
    
    const result: Array<{ event: Event; lat: number; lon: number }> = [];

    events.forEach((ev, idx) => {
      const coords = extractCoords(ev);
      if (!coords) {
        if (import.meta.env.DEV) {
          console.warn(`[EventMap] Event ${idx} "${ev?.title || 'Unknown'}" has NO valid coords. Event data:`, ev);
        }
        return;
      }
      if (import.meta.env.DEV) {
        console.log(`[EventMap] Event ${idx} "${ev.title}" HAS coords:`, coords);
      }
      result.push({ event: ev, lat: coords.lat, lon: coords.lon });
    });

    if (import.meta.env.DEV) {
      console.log('[EventMap] Final parsed events with coords:', result.length, result);
    }
    return result;
  }, [events]);

  /**
   * 2. Initialize the map once.
   */
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: true,
    });

    L.tileLayer(TILE_SOURCE, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
      userMarkerRef.current = null;
      if (radiusCircleRef.current) {
        radiusCircleRef.current.remove();
        radiusCircleRef.current = null;
      }
    };
  }, []);

  /**
   * 3. Show / update user location marker when available.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyUserLocation = () => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }

      if (!userLocation) {
        if (userMarkerRef.current) {
          userMarkerRef.current.remove();
          userMarkerRef.current = null;
        }
        if (radiusCircleRef.current) {
          radiusCircleRef.current.remove();
          radiusCircleRef.current = null;
        }
        return;
      }

      if (radiusCircleRef.current) {
        radiusCircleRef.current.remove();
        radiusCircleRef.current = null;
      }

      radiusCircleRef.current = L.circle([userLocation.lat, userLocation.lon], {
        radius: MAX_DISTANCE_METERS,
        color: '#8B5CF6',
        fillColor: '#8B5CF6',
        fillOpacity: 0.1,
        weight: 2,
      }).addTo(map);

      const circleBounds = radiusCircleRef.current.getBounds();
      if (circleBounds.isValid()) {
        map.fitBounds(circleBounds, { padding: [32, 32], animate: false });
      }

      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
      }

      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lon], {
        icon: L.divIcon({
          className: '',
          html: `
            <div class="relative flex h-6 w-6 items-center justify-center">
              <div class="absolute inset-0 rounded-full bg-blue-400 opacity-50 animate-ping"></div>
              <div class="relative h-4 w-4 rounded-full bg-blue-600 border-2 border-white shadow"></div>
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      })
        .addTo(map)
        .bindPopup('<strong>Your Location</strong>');
    };

    if (!map._loaded) {
      const handleLoad = () => {
        applyUserLocation();
        map.off('load', handleLoad);
      };
      map.on('load', handleLoad);
      return () => map.off('load', handleLoad);
    }

    applyUserLocation();
  }, [userLocation]);

  /**
   * 4. Draw event markers.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.invalidateSize();

    // init or clear layer group
    if (markersRef.current) {
      markersRef.current.clearLayers();
    } else {
      markersRef.current = L.layerGroup().addTo(map);
    }

    const bounds = L.latLngBounds([]);
    if (userLocation) {
      if (radiusCircleRef.current) {
        bounds.extend(radiusCircleRef.current.getBounds());
      } else {
        bounds.extend([userLocation.lat, userLocation.lon]);
      }
    }

    if (import.meta.env.DEV) {
      console.log('[EventMap] Drawing markers for:', eventsWithCoords.length, 'events');
    }
    
    eventsWithCoords.forEach(({ event, lat, lon }, idx) => {
      if (import.meta.env.DEV) {
        console.log(`[EventMap] Creating marker ${idx} at [${lat}, ${lon}] for "${event.title}"`);
      }
      const marker = L.marker([lat, lon], { icon: EVENT_MARKER_ICON }).addTo(markersRef.current!);

      bounds.extend([lat, lon]);

      const truncatedDescription =
        event.description && event.description.length > 80
          ? `${event.description.slice(0, 80)}...`
          : event.description || '';

      const isPurchased = purchasedTicketIds.has(event.id);

      const popupContent = document.createElement('div');
      popupContent.className = 'w-64';
      popupContent.innerHTML = `
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <h3 class="font-semibold text-sm">${event.title}</h3>
            <span class="text-xs text-purple-600 font-semibold">${formatPrice(event.price)}</span>
          </div>
          <p class="text-xs text-gray-600">${truncatedDescription}</p>
          <div class="flex items-center justify-between">
            <button class="view-btn px-3 py-1 text-xs rounded-md bg-purple-600 text-white hover:bg-purple-700 transition">Details</button>
            ${
              isPurchased
                ? '<span class="text-xs font-semibold text-green-600">Already booked</span>'
                : '<button class="buy-btn px-3 py-1 text-xs rounded-md bg-gray-200 text-gray-800 hover:bg-gray-300 transition">Get Ticket</button>'
            }
          </div>
        </div>
      `;

      popupContent.querySelector<HTMLButtonElement>('.view-btn')?.addEventListener('click', () => {
        onSelectEvent(event);
        marker.closePopup();
      });

      if (!isPurchased) {
        popupContent.querySelector<HTMLButtonElement>('.buy-btn')?.addEventListener('click', () => {
          onPurchase(event);
          marker.closePopup();
        });
      }

      // Bind the popup content for click
      marker.bindPopup(popupContent, { closeButton: false });
      
      // Add tooltip for hover
      const tooltipContent = `
        <div class="font-semibold text-sm">${event.title}</div>
        <div class="text-xs text-gray-600">${formatPrice(event.price)}</div>
        <div class="text-xs text-gray-500">${event.location}</div>
      `;
      marker.bindTooltip(tooltipContent, { 
        permanent: false, 
        direction: 'top',
        className: 'event-tooltip'
      });
      
      // Add interactivity for hover effects
      marker.on('mouseover', function () {
        this.openTooltip();
      });
      
      marker.on('mouseout', function () {
        this.closeTooltip();
      });
    });

    // If we have any events, fit to them
    if (eventsWithCoords.length > 0) {
      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.3));
      }
    } else if (userLocation) {
      // fallback to user location
      map.setView([userLocation.lat, userLocation.lon], 13);
    }
  }, [eventsWithCoords, onPurchase, onSelectEvent, purchasedTicketIds, userLocation]);

  /**
   * 5. UI
   */
  return (
    <>
      <style>{`
        .event-tooltip.leaflet-tooltip {
          background: rgba(255, 255, 255, 0.95);
          color: #1e293b;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          padding: 0.5rem;
          min-width: 150px;
          text-align: center;
        }
        .event-tooltip.leaflet-tooltip:before {
          background: rgba(255, 255, 255, 0.95);
          border: 1px solid #e2e8f0;
        }
      `}</style>
      <div className="bg-white rounded-2xl shadow-lg h-[500px] overflow-hidden relative">
        {eventsWithCoords.length === 0 ? (
          <div className="absolute inset-x-4 top-4 z-20 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 shadow">
            No events with valid coordinates were found.
            <br />
            Open DevTools → Console to see which events were skipped and what fields they had.
          </div>
        ) : (
          <div className="absolute left-4 top-4 z-20 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-purple-700 shadow">
            {eventsWithCoords.length} event{eventsWithCoords.length === 1 ? '' : 's'} on map
          </div>
        )}
        {!userLocation && (
          <div className="absolute right-4 top-4 z-20 rounded-lg bg-white/90 px-3 py-2 text-xs text-gray-700 shadow">
            Location access is off – showing events only.
          </div>
        )}
        <div ref={mapContainerRef} className="h-full w-full" />
      </div>
    </>
  );
};

export default EventMap;
