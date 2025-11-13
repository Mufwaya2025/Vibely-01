import React from 'react';
import { Ticket, Event, User } from '../types';
import TicketIcon from './icons/TicketIcon';
import QrCodeIcon from './icons/QrCodeIcon';
import StarIcon from './icons/StarIcon';
import TransactionHistoryPanel from './TransactionHistoryPanel';

interface MyTicketsProps {
  user: User;
  tickets: (Ticket & { event: Event })[];
  onViewTicket: (ticket: Ticket & { event: Event }) => void;
  onLeaveReview: (ticket: Ticket & { event: Event }) => void;
  onClose: () => void;
  onTicketIssued: (ticket: Ticket) => void;
  onViewTransactions?: () => void;
}

const MyTickets: React.FC<MyTicketsProps> = ({
  user,
  tickets,
  onViewTicket,
  onLeaveReview,
  onClose,
  onTicketIssued,
  onViewTransactions,
}) => {
  const now = new Date();

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 z-[1000] flex justify-center items-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden animate-fade-in-up flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-100">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-purple-400">
                Attendee Dashboard
              </p>
              <h2 className="text-2xl font-bold text-slate-900">Tickets & Payments</h2>
              <p className="text-sm text-slate-500">
                Track your upcoming events and payment history without leaving the marketplace.
              </p>
            </div>
            <button
              onClick={onClose}
              className="self-start rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-800"
              aria-label="Close dashboard"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 bg-slate-50 overflow-hidden">
          <div className="h-full overflow-y-auto p-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr,0.7fr]">
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-5">
                  <h3 className="text-xl font-semibold text-slate-900">My Tickets</h3>
                  <p className="text-sm text-slate-500">Access QR codes, reviews, and event details.</p>
                </div>
                <div className="max-h-[55vh] overflow-y-auto p-5 space-y-4">
                  {tickets.length > 0 ? (
                    tickets.map((ticket) => {
                      const isPastEvent = new Date(ticket.event.date) < now;
                      return (
                        <div
                          key={ticket.ticketId}
                          className="rounded-xl border border-slate-200 p-4 shadow-sm transition hover:border-purple-200 hover:shadow-md"
                        >
                          <div className="flex flex-col gap-4 md:flex-row md:items-center">
                            <img
                              src={ticket.event.imageUrl}
                              alt={ticket.event.title}
                              className="h-24 w-full rounded-lg object-cover md:h-20 md:w-32"
                            />
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <h3 className="text-lg font-semibold text-slate-900">{ticket.event.title}</h3>
                                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-500">
                                  {ticket.event.category}
                                </span>
                              </div>
                              <p className="text-sm text-slate-500">
                                {new Intl.DateTimeFormat('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                }).format(new Date(ticket.event.date))}
                              </p>
                              <p className="text-xs text-slate-400">
                                Purchased:{' '}
                                {new Intl.DateTimeFormat('en-US').format(new Date(ticket.purchaseDate))}
                              </p>
                            </div>
                            <div className="flex flex-col gap-2 md:w-40">
                              <button
                                onClick={() => onViewTicket(ticket)}
                                className="flex items-center justify-center rounded-full bg-purple-50 px-3 py-1.5 text-sm font-semibold text-purple-700 transition hover:bg-purple-100"
                              >
                                <QrCodeIcon className="mr-1 h-4 w-4" />
                                View Ticket
                              </button>
                              {isPastEvent &&
                                (ticket.rating ? (
                                  <div className="flex items-center justify-center rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-600">
                                    You rated
                                    <StarIcon className="ml-1.5 mr-0.5 h-4 w-4 text-yellow-400" />
                                    <span className="font-bold">{ticket.rating}</span>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => onLeaveReview(ticket)}
                                    className="rounded-full bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                                  >
                                    Leave a Review
                                  </button>
                                ))}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-12">
                      <TicketIcon className="w-12 h-12 mx-auto text-gray-300" />
                      <h3 className="mt-2 text-lg font-medium text-gray-900">No Tickets Yet</h3>
                      <p className="mt-1 text-sm text-gray-500">Your purchased tickets will appear here.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-purple-100 bg-gradient-to-b from-white to-purple-50 shadow-sm">
                <div className="flex flex-col gap-2 border-b border-purple-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-purple-400">Payments</p>
                    <h3 className="text-xl font-semibold text-slate-900">Recent Transactions</h3>
                    <p className="text-sm text-slate-500">Sync with Lenco and see ticket issuances instantly.</p>
                  </div>
                  {onViewTransactions && (
                    <button
                      onClick={onViewTransactions}
                      className="inline-flex w-full items-center justify-center rounded-full border border-purple-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-purple-700 hover:bg-purple-50 sm:w-auto"
                    >
                      Full history
                    </button>
                  )}
                </div>
                <div className="p-5">
                  <TransactionHistoryPanel
                    user={user}
                    onTicketIssued={onTicketIssued}
                    variant="compact"
                    limit={4}
                    onViewFullHistory={onViewTransactions}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyTickets;
