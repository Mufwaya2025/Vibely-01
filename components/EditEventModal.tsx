import React, { useEffect, useMemo, useRef, useState } from 'react';
import L, { Map } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Event, EventCategory, TicketTier, User, NominatimResult } from '../types';
import { EVENT_CATEGORIES } from '../constants';
import {
  getAddressFromCoordinates,
  getCurrentLocation,
  searchLocation,
} from '../services/locationService';

const markerIcon2x = new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).toString();
const markerIcon = new URL('leaflet/dist/images/marker-icon.png', import.meta.url).toString();
const markerShadow = new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).toString();

const DEFAULT_MARKER_ICON = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const TILE_SOURCE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const DEFAULT_COORDS = { lat: -15.4167, lon: 28.2833 }; // Lusaka CBD fallback

interface EditEventModalProps {
  user: User;
  event: Event;
  onClose: () => void;
  onEditEvent: (eventData: Event) => Promise<void>;
}

interface FormState {
  title: string;
  description: string;
  date: string;
  category: EventCategory;
  location: string;
}

interface TicketTierInput {
  id: string;
  name: string;
  price: string;
  quantity: string;
  benefits: string;
}

const createEmptyTier = (label?: string): TicketTierInput => ({
  id: `tier-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: label ?? '',
  price: '',
  quantity: '',
  benefits: '',
});

const MAX_IMAGE_BYTES = 900_000; // ~0.9MB to stay within 1MB request limit
const MAX_IMAGE_DIMENSION = 1280;

const loadImageBitmap = async (file: File): Promise<{ image: CanvasImageSource; width: number; height: number }> => {
  if (typeof window.createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return { image: bitmap, width: bitmap.width, height: bitmap.height };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ image: img, width: img.width, height: img.height });
    img.onerror = (err) => reject(err);
    img.src = URL.createObjectURL(file);
  });
};

const compressImageFile = async (file: File): Promise<string> => {
  const { image, width, height } = await loadImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to obtain canvas context.');
  }
  ctx.clearRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

  let quality = 0.9;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length * 0.75 > MAX_IMAGE_BYTES && quality > 0.5) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  return dataUrl;
};

const EditEventModal: React.FC<EditEventModalProps> = ({ onClose, onEditEvent, user, event }) => {
  const [formState, setFormState] = useState<FormState>({
    title: event.title,
    description: event.description,
    date: new Date(event.date).toISOString().slice(0, 16),
    category: event.category,
    location: event.location,
  });
  const [locationQuery, setLocationQuery] = useState(event.location);
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [ticketTiers, setTicketTiers] = useState<TicketTierInput[]>(
    event.ticketTiers.map(tier => ({
      id: tier.id,
      name: tier.name,
      price: tier.price.toString(),
      quantity: tier.quantity.toString(),
      benefits: tier.benefits || '',
    }))
  );
  const [selectedPosition, setSelectedPosition] = useState<{ lat: number; lon: number } | null>({
    lat: event.latitude,
    lon: event.longitude,
  });
  const [imagePreview, setImagePreview] = useState<string>(event.imageUrl);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isImageProcessing, setIsImageProcessing] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([selectedPosition?.lat || DEFAULT_COORDS.lat, selectedPosition?.lon || DEFAULT_COORDS.lon], 13);

    L.tileLayer(TILE_SOURCE, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map);

    map.on('click', async (event) => {
      const { lat, lng } = event.latlng;
      setSelectedPosition({ lat, lon: lng });
      setError(null);
      setIsReverseGeocoding(true);
      try {
        const address = await getAddressFromCoordinates(lat, lng);
        setFormState((prev) => ({ ...prev, location: address }));
        setLocationQuery(address);
      } catch (err) {
        console.error('Reverse geocoding failed', err);
      } finally {
        setIsReverseGeocoding(false);
      }
    });

    mapRef.current = map;

    // Leaflet needs a tick to compute layout inside modals
    setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 200);

    return () => {
      map.off();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !selectedPosition) return;

    const { lat, lon } = selectedPosition;
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lon]);
    } else {
      markerRef.current = L.marker([lat, lon], {
        icon: DEFAULT_MARKER_ICON,
        draggable: true,
      }).addTo(mapRef.current);

      markerRef.current.on('moveend', async (event) => {
        const position = event.target.getLatLng();
        setSelectedPosition({ lat: position.lat, lon: position.lng });
        setIsReverseGeocoding(true);
        try {
          const address = await getAddressFromCoordinates(position.lat, position.lng);
          setFormState((prev) => ({ ...prev, location: address }));
          setLocationQuery(address);
        } catch (err) {
          console.error('Reverse geocoding failed', err);
        } finally {
          setIsReverseGeocoding(false);
        }
      });
    }

    mapRef.current.setView([lat, lon], Math.max(mapRef.current.getZoom(), 13), {
      animate: true,
    });
  }, [selectedPosition]);

  useEffect(() => {
    if (!locationQuery || locationQuery.length < 3) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    setIsSearching(true);

    const timer = setTimeout(async () => {
      try {
        const results = await searchLocation(locationQuery);
        if (!cancelled) {
          setSearchResults(results.slice(0, 5));
        }
      } catch (err) {
        console.error('Location search failed', err);
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      setIsSearching(false);
    };
  }, [locationQuery]);

  const totalTicketQuantity = useMemo(() => {
    return ticketTiers.reduce((sum, tier) => {
      const quantity = Number.parseInt(tier.quantity, 10);
      return Number.isFinite(quantity) && quantity > 0 ? sum + quantity : sum;
    }, 0);
  }, [ticketTiers]);

  const lowestPrice = useMemo(() => {
    const prices = ticketTiers
      .map((tier) => Number.parseFloat(tier.price))
      .filter((value) => Number.isFinite(value) && value >= 0);
    if (!prices.length) return 0;
    return Math.min(...prices);
  }, [ticketTiers]);

  const handleInputChange = (
    field: keyof FormState,
    value: string | EventCategory
  ) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleTierChange = (id: string, field: keyof TicketTierInput, value: string) => {
    setTicketTiers((prev) =>
      prev.map((tier) => (tier.id === id ? { ...tier, [field]: value } : tier))
    );
  };

  const handleAddTier = () => {
    setTicketTiers((prev) => [...prev, createEmptyTier()]);
  };

  const handleRemoveTier = (id: string) => {
    if (ticketTiers.length === 1) return;
    setTicketTiers((prev) => prev.filter((tier) => tier.id !== id));
  };

  const handleSelectSearchResult = (result: NominatimResult) => {
    const lat = Number.parseFloat(result.lat);
    const lon = Number.parseFloat(result.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return;
    setSelectedPosition({ lat, lon });
    setFormState((prev) => ({ ...prev, location: result.display_name }));
    setLocationQuery(result.display_name);
    setSearchResults([]);
    setError(null);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isImageProcessing) return;
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file.');
      return;
    }

    setIsImageProcessing(true);
    setError(null);
    try {
      const dataUrl = await compressImageFile(file);
      if (dataUrl.length * 0.75 > MAX_IMAGE_BYTES) {
        throw new Error('Image is too large even after compression. Please choose a smaller image.');
      }
      setImagePreview(dataUrl);
    } catch (err) {
      console.error('Image processing failed', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to process the image. Please try a smaller file.'
      );
    } finally {
      setIsImageProcessing(false);
    }
  };

  const validateAndTransformTiers = (): TicketTier[] | null => {
    if (!ticketTiers.length) {
      setError('Please add at least one ticket tier.');
      return null;
    }

    const transformed: TicketTier[] = [];
    for (const tier of ticketTiers) {
      const name = tier.name.trim();
      if (!name) {
        setError('Ticket tier names cannot be empty.');
        return null;
      }

      const price = Number.parseFloat(tier.price);
      if (!Number.isFinite(price) || price < 0) {
        setError(`Ticket tier "${name}" has an invalid price.`);
        return null;
      }

      const quantity = Number.parseInt(tier.quantity, 10);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        setError(`Ticket tier "${name}" must have a quantity of at least 1.`);
        return null;
      }

      transformed.push({
        id: tier.id,
        name,
        price,
        quantity,
        benefits: tier.benefits.trim() ? tier.benefits.trim() : undefined,
      });
    }

    return transformed;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!formState.title.trim()) {
      setError('Please provide an event title.');
      return;
    }

    if (!formState.description.trim()) {
      setError('Please provide a short event description.');
      return;
    }

    if (!formState.date) {
      setError('Please select the event date and time.');
      return;
    }

    if (!selectedPosition) {
      setError('Please pick a location from search or drop a pin on the map.');
      return;
    }

    if (!formState.location.trim()) {
      setError('Please confirm the event address.');
      return;
    }

    if (!imagePreview) {
      setError('Please upload a cover image for your event.');
      return;
    }

    const tiers = validateAndTransformTiers();
    if (!tiers) return;

    const totalQuantity = tiers.reduce((sum, tier) => sum + tier.quantity, 0);
    const lowestTierPrice =
      tiers.length > 0 ? Math.min(...tiers.map((tier) => tier.price)) : 0;

    let eventDateIso: string;
    try {
      const parsed = new Date(formState.date);
      if (Number.isNaN(parsed.getTime())) {
        throw new Error('Invalid date');
      }
      eventDateIso = parsed.toISOString();
    } catch {
      setError('Please provide a valid event date.');
      return;
    }

    const updatedEvent: Event = {
      ...event,
      title: formState.title.trim(),
      description: formState.description.trim(),
      date: eventDateIso,
      location: formState.location.trim(),
      latitude: selectedPosition.lat,
      longitude: selectedPosition.lon,
      price: lowestTierPrice,
      category: formState.category,
      imageUrl: imagePreview,
      ticketQuantity: totalQuantity,
      ticketTiers: tiers,
    };

    setIsSubmitting(true);
    try {
      await onEditEvent(updatedEvent);
      onClose();
    } catch (err) {
      console.error('Event update failed', err);
      setError('Failed to update event. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black bg-opacity-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl mx-auto max-h-[90vh] flex flex-col overflow-hidden">
        <header className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Edit Event</h2>
            <p className="text-sm text-gray-500">
              Update your event details, ticket tiers, and location.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 8.586L4.707 3.293 3.293 4.707 8.586 10l-5.293 5.293 1.414 1.414L10 11.414l5.293 5.293 1.414-1.414L11.414 10l5.293-5.293-1.414-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {error && (
            <div className="border border-red-200 bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Event Title</label>
                <input
                  type="text"
                  value={formState.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="E.g. Lusaka Jazz Night"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                <textarea
                  value={formState.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={4}
                  placeholder="Give attendees a reason to get excited."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
                <select
                  value={formState.category}
                  onChange={(e) => handleInputChange('category', e.target.value as EventCategory)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {EVENT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Date &amp; Time</label>
                <input
                  type="datetime-local"
                  value={formState.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Cover Image</label>
                <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center">
                  <input
                    id="event-image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="event-image-upload"
                    className={`cursor-pointer text-sm font-semibold ${isImageProcessing ? 'text-gray-400 cursor-not-allowed' : 'text-purple-600 hover:text-purple-700'}`}
                  >
                    {imagePreview ? 'Change uploaded image' : 'Upload image'}
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    JPEG or PNG. Images are automatically resized to keep uploads under 1MB.
                  </p>
                  {isImageProcessing && (
                    <p className="mt-2 text-xs text-purple-600 flex items-center justify-center gap-2">
                      <svg
                        className="h-3 w-3 animate-spin text-purple-600"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Processing image…
                    </p>
                  )}
                  {imagePreview && (
                    <div className="mt-4">
                      <img
                        src={imagePreview}
                        alt="Event preview"
                        className="rounded-lg w-full max-h-48 object-cover shadow-sm"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Search Address</label>
                <input
                  type="text"
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  placeholder="Start typing an address or venue name"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                {isSearching && (
                  <p className="text-xs text-gray-500 mt-1">Searching...</p>
                )}
                {!isSearching && searchResults.length > 0 && (
                  <ul className="mt-2 border border-gray-200 rounded-lg max-h-40 overflow-y-auto divide-y divide-gray-100">
                    {searchResults.map((result) => (
                      <li key={result.place_id}>
                        <button
                          type="button"
                          onClick={() => handleSelectSearchResult(result)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50"
                        >
                          {result.display_name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {isReverseGeocoding && (
                  <p className="text-xs text-gray-500 mt-1">Fetching address for selected location...</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Confirmed Address
                </label>
                <input
                  type="text"
                  value={formState.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  placeholder="Address that will appear on the event page"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </section>

          <section>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Drop a pin or click to set the venue location
            </label>
            <div
              ref={mapContainerRef}
              className="w-full h-64 rounded-xl overflow-hidden border border-gray-200"
            />
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Ticket Tiers</h3>
                <p className="text-sm text-gray-500">
                  Create different experiences like VIP, Early Bird, or General Admission.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddTier}
                className="inline-flex items-center px-3 py-2 text-sm font-semibold text-purple-600 hover:text-purple-700"
              >
                + Add tier
              </button>
            </div>

            <div className="space-y-4">
              {ticketTiers.map((tier, index) => (
                <div
                  key={tier.id}
                  className="border border-gray-200 rounded-lg p-4 shadow-sm bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-800">Tier {index + 1}</h4>
                    {ticketTiers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTier(tier.id)}
                        className="text-sm text-red-500 hover:text-red-600"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Tier Name
                      </label>
                      <input
                        type="text"
                        value={tier.name}
                        onChange={(e) => handleTierChange(tier.id, 'name', e.target.value)}
                        placeholder="VIP, General Admission, Early Bird..."
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Price (ZMW)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={tier.price}
                        onChange={(e) => handleTierChange(tier.id, 'price', e.target.value)}
                        placeholder="250"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Quantity
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={tier.quantity}
                        onChange={(e) => handleTierChange(tier.id, 'quantity', e.target.value)}
                        placeholder="100"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        required
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Perks (optional)
                    </label>
                    <input
                      type="text"
                      value={tier.benefits}
                      onChange={(e) => handleTierChange(tier.id, 'benefits', e.target.value)}
                      placeholder="E.g. Backstage access, complimentary drink..."
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-600">
              <div className="bg-purple-50 border border-purple-100 rounded-lg px-4 py-3">
                <span className="font-semibold text-purple-700">Total capacity:</span>{' '}
                {totalTicketQuantity > 0 ? totalTicketQuantity : '—'}
              </div>
              <div className="bg-purple-50 border border-purple-100 rounded-lg px-4 py-3">
                <span className="font-semibold text-purple-700">Starting price:</span>{' '}
                {lowestPrice > 0 ? `ZMW ${lowestPrice.toFixed(2)}` : 'Free'}
              </div>
            </div>
          </section>

          <footer className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t">
            <div className="text-xs text-gray-500">
              Signed in as <span className="font-semibold text-gray-700">{user.email}</span>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isImageProcessing}
                className="px-5 py-2 rounded-lg text-white font-semibold bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Updating...' : 'Update Event'}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default EditEventModal;