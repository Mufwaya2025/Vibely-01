import React from 'react';
import QRCode from "react-qr-code";
import { Ticket, Event } from '../types';
import NavigationIcon from './icons/NavigationIcon';

interface TicketViewModalProps {
  ticket: (Ticket & { event: Event }) | null;
  onClose: () => void;
  userLocation: { lat: number; lon: number } | null;
}

const TicketViewModal: React.FC<TicketViewModalProps> = ({ ticket, onClose, userLocation }) => {
  if (!ticket) return null;
  
  const isScanned = ticket.status === 'scanned';

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date(ticket.event.date));
  
  const googleMapsUrl = new URL('https://www.google.com/maps/dir/');
  googleMapsUrl.searchParams.append('api', '1');
  googleMapsUrl.searchParams.append('destination', `${ticket.event.latitude},${ticket.event.longitude}`);

  if (userLocation) {
    googleMapsUrl.searchParams.append('origin', `${userLocation.lat},${userLocation.lon}`);
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 z-[1000] flex justify-center items-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-up flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`p-6 text-white text-center transition-colors duration-300 ${isScanned ? 'bg-gray-500' : 'bg-purple-600'}`}>
          <h2 className="text-2xl font-bold">{ticket.event.title}</h2>
          <p className="opacity-80">{formattedDate}</p>
        </div>
        <div className="p-8 flex flex-col items-center">
          <div className="bg-white p-4 rounded-lg shadow-inner relative">
            <QRCode
              value={ticket.ticketId}
              size={192}
              fgColor={isScanned ? "#D1D5DB" : "#000000"} // gray-300 if scanned
              bgColor="#FFFFFF"
              level="H"
            />
            {isScanned && (
                <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center text-center p-2">
                    <p className="text-xl font-bold text-gray-700">TICKET SCANNED</p>
                    {ticket.scanTimestamp && (
                        <p className="text-xs text-gray-500 mt-1">{new Date(ticket.scanTimestamp).toLocaleString()}</p>
                    )}
                </div>
            )}
          </div>
          <p className="mt-4 text-gray-600 text-center">
            {isScanned ? 'This ticket has been used.' : 'Show this QR code at the event entrance.'}
          </p>
          
          <div className="mt-6 text-center border-t pt-4 w-full">
            <p className="text-sm text-gray-500">Location</p>
            <p className="font-semibold text-gray-800 mb-2">{ticket.event.location}</p>
            <a
              href={googleMapsUrl.toString()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
            >
              <NavigationIcon className="w-5 h-5 mr-2" />
              Navigate with Google Maps
            </a>
          </div>

          <div className="mt-6 text-center border-t pt-4 w-full">
            <p className="text-sm text-gray-500">Ticket ID</p>
            <p className="font-mono text-gray-800 tracking-wider break-all">{ticket.ticketId}</p>
          </div>
        </div>
        <div className="p-4 bg-gray-50 border-t">
          <button
            onClick={onClose}
            className="w-full bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TicketViewModal;