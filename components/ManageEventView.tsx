import React, { useState, useEffect, useMemo } from 'react';
import { Event, Ticket } from '../types';
import { getTicketsForEvent, scanTicket } from '../services/ticketService';
import { formatPrice } from '../utils/tickets';
import TicketScanHistoryModal from './TicketScanHistoryModal';

interface ManageEventViewProps {
  event: Event;
  onBack: () => void;
}

interface ManageEventViewProps {
  event: Event;
  onBack: () => void;
  onEdit?: (event: Event) => void; // Optional prop to enable editing
}

const ManageEventView: React.FC<ManageEventViewProps> = ({ event, onBack, onEdit }) => {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [scanInput, setScanInput] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [scanResult, setScanResult] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

    useEffect(() => {
        const fetchTickets = async () => {
            setIsLoading(true);
            const eventTickets = await getTicketsForEvent(event.id);
            setTickets(eventTickets);
            setIsLoading(false);
        };
        fetchTickets();
    }, [event.id]);
    
    const stats = useMemo(() => {
        const sold = tickets.length;
        const scanned = tickets.filter(t => t.status === 'scanned').length;
        const revenue = sold * event.price;
        const scanRate = sold > 0 ? (scanned / sold) * 100 : 0;
        return { sold, scanned, revenue, scanRate };
    }, [tickets, event.price]);

    const handleScanSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!scanInput.trim()) return;

        setIsScanning(true);
        setScanResult(null);
        
        const ticketToScan = tickets.find(t => t.ticketId === scanInput.trim());
        
        if (!ticketToScan) {
            setScanResult({ message: `Ticket ID "${scanInput}" not found for this event.`, type: 'error' });
            setIsScanning(false);
            return;
        }
        
        if (ticketToScan.status === 'scanned') {
             setScanResult({ message: `Ticket ID "${scanInput}" has already been scanned.`, type: 'warning' });
             setIsScanning(false);
             return;
        }

        try {
            const updatedTicket = await scanTicket(scanInput.trim());
            if (updatedTicket) {
                setTickets(prevTickets => prevTickets.map(t => t.ticketId === updatedTicket.ticketId ? updatedTicket : t));
                setScanResult({ message: `Ticket ID "${scanInput}" successfully scanned!`, type: 'success' });
            }
        } catch (error) {
             setScanResult({ message: `An error occurred while scanning.`, type: 'error' });
        } finally {
            setIsScanning(false);
            setScanInput('');
        }
    };

    const scannedTickets = useMemo(() => tickets.filter(t => t.status === 'scanned'), [tickets]);

    return (
        <div>
            <button onClick={onBack} className="mb-6 text-purple-600 hover:text-purple-800 font-semibold flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Back to Dashboard
            </button>
            
            <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-8">
                <img src={event.imageUrl} alt={event.title} className="w-full h-48 object-cover" />
                <div className="p-6 relative">
                    <h1 className="text-3xl font-bold text-gray-900">{event.title}</h1>
                    <p className="text-gray-600 mt-1">{new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(event.date))}</p>
                    {onEdit && (
                        <button
                            onClick={() => onEdit(event)}
                            className="absolute top-6 right-6 bg-white rounded-full p-2 shadow-md hover:bg-gray-100 transition-colors"
                            aria-label="Edit event"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard title="Tickets Sold" value={stats.sold} />
                <StatCard title="Revenue" value={formatPrice(stats.revenue)} />
                <StatCard title="Tickets Scanned" value={stats.scanned} />
                <StatCard title="Scan Rate" value={`${stats.scanRate.toFixed(1)}%`} />
            </div>

            {/* Ticket Scanner */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-xl shadow-sm">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Ticket Scanner</h2>
                    <form onSubmit={handleScanSubmit}>
                        <label htmlFor="ticketId" className="block text-sm font-medium text-gray-700">Enter Ticket ID</label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                            <input
                                type="text"
                                id="ticketId"
                                value={scanInput}
                                onChange={e => setScanInput(e.target.value)}
                                className="flex-1 block w-full rounded-none rounded-l-md px-3 py-2 border border-gray-300 focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                                placeholder="tkt-..."
                            />
                            <button
                                type="submit"
                                disabled={isScanning}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-r-md text-white bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400"
                            >
                                {isScanning ? 'Scanning...' : 'Scan'}
                            </button>
                        </div>
                    </form>
                    {scanResult && (
                        <div className={`mt-4 p-3 rounded-md text-sm ${
                            scanResult.type === 'success' ? 'bg-green-100 text-green-800' : 
                            scanResult.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                        }`}>
                            {scanResult.message}
                        </div>
                    )}
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-gray-800">Recent Scans ({scannedTickets.length})</h2>
                        {scannedTickets.length > 0 && 
                            <button onClick={() => setIsHistoryModalOpen(true)} className="text-sm text-purple-600 font-semibold hover:underline">View All</button>
                        }
                    </div>
                    {scannedTickets.length > 0 ? (
                        <ul className="space-y-2">
                           {scannedTickets.slice(0, 3).map(ticket => (
                               <li key={ticket.ticketId} className="text-sm text-gray-600 font-mono p-2 bg-gray-50 rounded">
                                   {ticket.ticketId} - Scanned at {new Date(ticket.scanTimestamp!).toLocaleTimeString()}
                               </li>
                           ))}
                        </ul>
                    ) : (
                        <p className="text-gray-500 text-sm mt-2">No tickets scanned yet.</p>
                    )}
                </div>
            </div>

            {isHistoryModalOpen && 
                <TicketScanHistoryModal tickets={scannedTickets} onClose={() => setIsHistoryModalOpen(false)} />
            }
        </div>
    );
};

const StatCard: React.FC<{ title: string; value: string | number }> = ({ title, value }) => (
    <div className="bg-white p-6 rounded-xl shadow-sm">
        <p className="text-sm font-medium text-gray-500 truncate">{title}</p>
        <p className="mt-1 text-3xl font-semibold text-gray-900">{value}</p>
    </div>
);

export default ManageEventView;
