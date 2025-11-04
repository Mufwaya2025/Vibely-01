import React from 'react';
import { Ticket, Event } from '../types';
import TicketIcon from './icons/TicketIcon';
import QrCodeIcon from './icons/QrCodeIcon';
import StarIcon from './icons/StarIcon';

interface MyTicketsProps {
  tickets: (Ticket & { event: Event })[];
  onViewTicket: (ticket: Ticket & { event: Event }) => void;
  onLeaveReview: (ticket: Ticket & { event: Event }) => void;
  onClose: () => void;
}

const MyTickets: React.FC<MyTicketsProps> = ({ tickets, onViewTicket, onLeaveReview, onClose }) => {
  const now = new Date();

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 z-[1000] flex justify-center items-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">My Tickets</h2>
          <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 bg-gray-50 flex-grow overflow-y-auto max-h-[70vh]">
          {tickets.length > 0 ? (
            <div className="space-y-4">
              {tickets.map((ticket) => {
                const isPastEvent = new Date(ticket.event.date) < now;
                return (
                  <div key={ticket.ticketId} className="bg-white p-4 rounded-lg shadow-sm border flex flex-col sm:flex-row sm:items-center">
                    <img src={ticket.event.imageUrl} alt={ticket.event.title} className="w-full sm:w-20 h-24 sm:h-20 rounded-md object-cover mr-4 mb-3 sm:mb-0" />
                    <div className="flex-grow">
                      <h3 className="font-bold text-gray-800">{ticket.event.title}</h3>
                      <p className="text-sm text-gray-600">
                        {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(ticket.event.date))}
                      </p>
                      <p className="text-xs text-gray-500">Purchased: {new Intl.DateTimeFormat('en-US').format(new Date(ticket.purchaseDate))}</p>
                    </div>
                    <div className="mt-3 sm:mt-0 sm:ml-4 flex flex-col items-stretch sm:items-end space-y-2 shrink-0">
                      <button onClick={() => onViewTicket(ticket)} className="flex items-center justify-center px-3 py-1.5 text-sm font-medium text-purple-600 bg-purple-50 rounded-md hover:bg-purple-100 w-full sm:w-auto">
                        <QrCodeIcon className="w-5 h-5 mr-1" />
                        View Ticket
                      </button>
                       {isPastEvent && (
                        ticket.rating ? (
                          <div className="flex items-center justify-center px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-md">
                            You rated: 
                            <StarIcon className="w-4 h-4 text-yellow-400 ml-1.5 mr-0.5" />
                            <span className="font-bold">{ticket.rating}</span>
                          </div>
                        ) : (
                          <button onClick={() => onLeaveReview(ticket)} className="flex items-center justify-center px-3 py-1.5 text-sm font-medium text-white bg-gray-700 rounded-md hover:bg-gray-800 w-full sm:w-auto">
                            Leave a Review
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <TicketIcon className="w-12 h-12 mx-auto text-gray-300" />
              <h3 className="mt-2 text-lg font-medium text-gray-900">No Tickets Yet</h3>
              <p className="mt-1 text-sm text-gray-500">Your purchased tickets will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyTickets;