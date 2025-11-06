import React, { useEffect, useRef } from 'react';
import L, { Map } from 'leaflet';
import 'leaflet/dist/leaflet.css';

const markerIcon2x = new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).toString();
const markerIcon = new URL('leaflet/dist/images/marker-icon.png', import.meta.url).toString();
const markerShadow = new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).toString();

const pickerIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const DEFAULT_CENTER: [number, number] = [-15.4167, 28.2833]; // Lusaka CBD

interface LocationPickerMapProps {
  selectedLocation: { lat: number; lon: number } | null;
  onSelectLocation: (lat: number, lon: number) => void;
}

const LocationPickerMap: React.FC<LocationPickerMapProps> = ({
  selectedLocation,
  onSelectLocation,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Initialize map
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: DEFAULT_CENTER,
      zoom: 12,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    map.on('click', (event) => {
      const { lat, lng } = event.latlng;
      onSelectLocation(lat, lng);
    });

    mapRef.current = map;

    return () => {
      map.off();
      map.remove();
      mapRef.current = null;
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    };
  }, [onSelectLocation]);

  // Update marker when selection changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (mapRef.current) {
      mapRef.current.invalidateSize();
    }

    if (!selectedLocation) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      map.setView(DEFAULT_CENTER, 12);
      return;
    }

    if (markerRef.current) {
      markerRef.current.setLatLng([selectedLocation.lat, selectedLocation.lon]);
    } else {
      markerRef.current = L.marker([selectedLocation.lat, selectedLocation.lon], {
        icon: pickerIcon,
        draggable: true,
      })
        .addTo(map)
        .on('dragend', (event) => {
          const { lat, lng } = (event.target as L.Marker).getLatLng();
          onSelectLocation(lat, lng);
        });
    }

    map.setView([selectedLocation.lat, selectedLocation.lon], 14, { animate: true });
  }, [selectedLocation, onSelectLocation]);

  return <div ref={mapContainerRef} className="h-64 w-full rounded-xl shadow-inner overflow-hidden" />;
};

export default LocationPickerMap;
