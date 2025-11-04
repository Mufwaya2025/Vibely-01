import React from 'react';
import { Ticket } from '../types';

interface TicketScanHistoryModalProps {
  tickets: Ticket[];
  onClose: () => void;
}

const TicketScanHistoryModal: React.FC<TicketScanHistoryModalProps> = ({ tickets, onClose }) => {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 z-[1000] flex justify-center items-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-lg w-full max-w-2xl overflow-hidden animate-fade-in-up flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">Ticket Scan History</h2>
          <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-100">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
             </svg>
          </button>
        </div>
        <div className="p-6 bg-gray-50 flex-grow overflow-y-auto max-h-[60vh]">
          {tickets.length > 0 ? (
            <div className="flow-root">
              <ul className="-my-4 divide-y divide-gray-200">
                {tickets.slice().sort((a,b) => new Date(b.scanTimestamp!).getTime() - new Date(a.scanTimestamp!).getTime()).map((ticket) => (
                  <li key={ticket.ticketId} className="flex items-center py-4 space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                         <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                         </svg>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">Ticket Scanned</p>
                      <p className="text-sm text-gray-500 truncate font-mono">{ticket.ticketId}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 text-right">
                        {new Date(ticket.scanTimestamp!).toLocaleTimeString()}
                      </p>
                       <p className="text-xs text-gray-400 text-right">
                        {new Date(ticket.scanTimestamp!).toLocaleDateString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-gray-500">No tickets have been scanned yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketScanHistoryModal;