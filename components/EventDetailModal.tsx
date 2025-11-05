import React, { useState, useEffect } from "react";
import { Event, Ticket, User } from "../types";
import CalendarIcon from "./icons/CalendarIcon";
import LocationPinIcon from "./icons/LocationPinIcon";
import TicketIcon from "./icons/TicketIcon";
import UsersIcon from "./icons/UsersIcon";
import ShareIcon from "./icons/ShareIcon";
import { formatPrice } from "../utils/tickets";
import { getReviewsForEvent } from "../services/ticketService";
import ReviewsList from "./ReviewsList";

interface EventDetailModalProps {
  event: Event | null;
  onClose: () => void;
  onPurchase: (event: Event) => void;
  isPurchased: boolean;
  onMessageOrganizer?: (organizer: User) => void; // Optional prop to enable messaging
}

const EventDetailModal: React.FC<EventDetailModalProps> = ({ event, onClose, onPurchase, isPurchased, onMessageOrganizer }) => {
  const [reviews, setReviews] = useState<Ticket[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);

  useEffect(() => {
    if (event) {
      setIsLoadingReviews(true);
      getReviewsForEvent(event.id)
        .then(setReviews)
        .catch((err) => console.error("Failed to fetch reviews:", err))
        .finally(() => setIsLoadingReviews(false));
    }
  }, [event]);

  if (!event) return null;

  const isSoldOut = event.ticketsSold !== undefined && event.ticketsSold >= event.ticketQuantity;

  const handleShare = async () => {
    if (!event) return;
    const shareUrl = `${window.location.origin}/events/${event.id}`;
    const shareText = `${event.title} @ ${event.location} on ${new Intl.DateTimeFormat("en-US", {
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date(event.date))}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: event.title, text: shareText, url: shareUrl });
      } catch (err) {
        console.error("Share cancelled", err);
      }
    } else if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(`${event.title} - ${shareUrl}`);
        alert("Event link copied to clipboard!");
      } catch (err) {
        console.error("Failed to copy", err);
      }
    } else {
      alert("Sharing is not supported on this device");
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 z-[1000] flex justify-center items-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <img src={event.imageUrl} alt={event.title} className="w-full h-64 object-cover" />
          <div className="absolute top-4 right-4 flex items-center space-x-2">
            <button
              onClick={handleShare}
              className="p-2 bg-white/80 rounded-full hover:bg-white transition-colors"
              aria-label="Share event"
            >
              <ShareIcon className="w-5 h-5 text-purple-600" />
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-white/70 rounded-full hover:bg-white transition-colors"
              aria-label="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-gray-800"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="p-6 md:p-8 flex-grow overflow-y-auto">
          <span className="inline-block bg-purple-100 text-purple-700 text-xs font-semibold px-2.5 py-1 rounded-full mb-2">
            {event.category}
          </span>
          <h1 className="text-3xl font-extrabold text-gray-900">{event.title}</h1>
          <p className="mt-4 text-gray-600 leading-relaxed">{event.description}</p>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-gray-700">
            <div className="flex items-start">
              <CalendarIcon className="w-6 h-6 mr-3 text-purple-500 shrink-0 mt-1" />
              <div>
                <p className="font-semibold">Date & Time</p>
                <p className="text-gray-600">
                  {new Intl.DateTimeFormat("en-US", { dateStyle: 'full', timeStyle: 'short' }).format(new Date(event.date))}
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <LocationPinIcon className="w-6 h-6 mr-3 text-purple-500 shrink-0 mt-1" />
              <div>
                <p className="font-semibold">Location</p>
                <p className="text-gray-600">{event.location}</p>
              </div>
            </div>
            <div className="flex items-start">
              <TicketIcon className="w-6 h-6 mr-3 text-purple-500 shrink-0 mt-1" />
              <div>
                <p className="font-semibold">Price</p>
                <p className="text-gray-600">{formatPrice(event.price)}</p>
              </div>
            </div>
            <div className="flex items-start">
              <UsersIcon className="w-6 h-6 mr-3 text-purple-500 shrink-0 mt-1" />
              <div>
                <p className="font-semibold">Organizer</p>
                <p className="text-gray-600">{event.organizer.name}</p>
              </div>
            </div>
            <div className="flex items-start">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 mr-3 text-purple-500 shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <div>
                <p className="font-semibold">Contact</p>
                <button 
                  onClick={() => {
                    // Create a temporary user object for the organizer
                    const organizerUser: User = {
                      id: event.organizer.id,
                      name: event.organizer.name,
                      email: 'organizer@example.com', // Default email since organizer doesn't have email in the event object
                      role: 'manager' as const,
                      status: 'active' as const,
                      interests: [],
                      attendedEvents: []
                      // authProviders is optional according to the User interface
                    };
                    if (onMessageOrganizer) {
                      onMessageOrganizer(organizerUser);
                    }
                  }}
                  className="text-purple-600 hover:text-purple-800 font-semibold"
                >
                  Message Organizer
                </button>
              </div>
            </div>
          </div>

          <ReviewsList reviews={reviews} isLoading={isLoadingReviews} />
        </div>
        <div className="p-6 bg-gray-50 border-t flex justify-end items-center">
          <button
            onClick={() => onPurchase(event)}
            disabled={isSoldOut || isPurchased}
            className={`w-full sm:w-auto px-8 py-3 text-base font-bold rounded-lg transition-all duration-300 ${
              isSoldOut
                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                : isPurchased
                ? 'bg-green-600 text-white cursor-default'
                : 'bg-purple-600 text-white hover:bg-purple-700 shadow-lg hover:shadow-purple-300'
            }`}
          >
            {isSoldOut ? 'Sold Out' : isPurchased ? 'Ticket Purchased ?' : 'Get Ticket'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventDetailModal;
