import React from 'react';
import { Event } from '../types';
import CalendarIcon from './icons/CalendarIcon';
import LocationPinIcon from './icons/LocationPinIcon';
import TicketIcon from './icons/TicketIcon';
import { formatPrice } from '../utils/tickets';
import HeartIcon from './icons/HeartIcon';
import HeartSolidIcon from './icons/HeartSolidIcon';

interface EventCardProps {
  event: Event;
  onSelect: (event: Event) => void;
  onPurchase: (event: Event) => void;
  isFavorite: boolean;
  onToggleFavorite: (eventId: string) => void;
  isPurchased: boolean;
}

const EventCard: React.FC<EventCardProps> = ({ event, onSelect, onPurchase, isFavorite, onToggleFavorite, isPurchased }) => {
  const isSoldOut = event.ticketsSold !== undefined && event.ticketsSold >= event.ticketQuantity;
  
  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click when favoriting
    onToggleFavorite(event.id);
  };

  return (
    <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden flex flex-col group cursor-pointer h-full" onClick={() => onSelect(event)}>
      <div className="relative">
        <img src={event.imageUrl} alt={event.title} className="w-full h-36 object-cover group-hover:scale-105 transition-transform duration-300" />
        <div className="absolute top-2 right-2">
          <button
            onClick={handleFavoriteClick}
            className="p-1.5 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white transition-colors"
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            {isFavorite ? (
              <HeartSolidIcon className="w-5 h-5 text-red-500" />
            ) : (
              <HeartIcon className="w-5 h-5 text-gray-700" />
            )}
          </button>
        </div>
        <div className="absolute bottom-0 left-0 bg-gradient-to-t from-black/60 to-transparent w-full p-3">
           <h3 className="text-white text-sm font-bold truncate">{event.title}</h3>
        </div>
      </div>
      <div className="p-3 flex-grow flex flex-col">
        <div className="flex-grow space-y-1 text-xs text-gray-600">
           <div className="flex items-center">
            <CalendarIcon className="w-3 h-3 mr-1.5 text-gray-400" />
            <span className="truncate">{new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          </div>
          <div className="flex items-center">
            <LocationPinIcon className="w-3 h-3 mr-1.5 text-gray-400" />
            <span className="truncate text-xs">{event.location}</span>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between items-center">
          <div className="flex items-center">
             <TicketIcon className="w-4 h-4 mr-1.5 text-purple-600" />
            <span className="text-sm font-bold text-purple-600">{formatPrice(event.price)}</span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); isPurchased ? onSelect(event) : onPurchase(event); }}
            disabled={isSoldOut}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-300 ${
              isSoldOut 
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
              : isPurchased
              ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
              : 'bg-purple-600 text-white hover:bg-purple-700 shadow-sm hover:shadow'
            }`}
          >
            {isSoldOut ? 'Sold Out' : (isPurchased ? 'View' : 'Get')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventCard;
