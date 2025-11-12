import React from 'react';
import { Ticket, User } from '../types';
import TransactionHistoryPanel from './TransactionHistoryPanel';

interface TransactionHistoryModalProps {
  user: User;
  onClose: () => void;
  onTicketIssued: (ticket: Ticket) => void;
}

const TransactionHistoryModal: React.FC<TransactionHistoryModalProps> = ({
  user,
  onClose,
  onTicketIssued,
}) => (
  <div
    className="fixed inset-0 z-[1050] flex items-center justify-center bg-black/70 px-4 py-8"
    onClick={onClose}
  >
    <div
      className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-purple-400">Payments</p>
          <h2 className="text-2xl font-bold text-gray-900">Transaction History</h2>
          <p className="text-xs text-gray-500">Verified with Lenco for {user.name}</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
          aria-label="Close transaction history"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
        <TransactionHistoryPanel user={user} onTicketIssued={onTicketIssued} variant="full" />
      </div>
    </div>
  </div>
);

export default TransactionHistoryModal;
