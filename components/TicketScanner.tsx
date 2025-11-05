import React, { useState } from 'react';
import { scanTicket } from '../services/ticketService';
import { QrReader } from 'react-qr-reader';

interface TicketScannerProps {
  eventId: string;
  onTicketScanned?: (ticketId: string) => void;
  onClose: () => void;
}

const TicketScanner: React.FC<TicketScannerProps> = ({ eventId, onTicketScanned, onClose }) => {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState<boolean>(true);
  const [isScanningTicket, setIsScanningTicket] = useState<boolean>(false);

  const handleScan = async (result: any) => {
    if (result && !isScanningTicket) {
      const ticketId = result.data;
      setScanResult(null);
      setError(null);
      setIsScanningTicket(true);

      try {
        const ticket = await scanTicket(ticketId);
        
        if (ticket) {
          setScanResult(`Ticket ${ticketId} successfully scanned!`);
          if (onTicketScanned) {
            onTicketScanned(ticketId);
          }
          // Automatically close the scanner after successful scan
          setTimeout(() => {
            onClose();
          }, 1500); // Close after 1.5 seconds to show success message
        } else {
          setError('Failed to scan ticket. Please try again.');
        }
      } catch (err) {
        console.error('Error scanning ticket:', err);
        setError(`Error scanning ticket: ${(err as Error).message}`);
      } finally {
        setIsScanningTicket(false);
      }
    }
  };

  const handleError = (err: any) => {
    console.error('QR Scanner Error:', err);
    setError('Error accessing camera. Please make sure you allow camera permissions.');
  };

  const toggleScanning = () => {
    setScanning(!scanning);
  };

  const scanInstructions = scanning 
    ? "Point your camera at the QR code on the ticket to scan it" 
    : "Scanning paused. Click resume to continue";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-[1000] flex justify-center items-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up flex flex-col">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Ticket Scanner</h2>
          <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 bg-gray-50 flex-grow overflow-y-auto max-h-[80vh]">
          <div className="text-center mb-4">
            <p className="text-gray-700">{scanInstructions}</p>
          </div>
          
          <div className="relative bg-black rounded-lg overflow-hidden mb-4" style={{ width: '100%', height: '70vh', maxHeight: '500px', minHeight: '300px' }}>
            <QrReader
              onResult={handleScan}
              onError={handleError}
              style={{ width: '100%', height: '100%' }}
              constraints={{ facingMode: 'environment' }}
              videoStyle={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {isScanningTicket && (
              <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center">
                <div className="text-white text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500 mb-2"></div>
                  <p>Scanning ticket...</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex flex-col space-y-4">
            <button
              onClick={toggleScanning}
              className={`px-4 py-2 rounded-lg font-medium ${
                scanning ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              {scanning ? 'Pause Scanning' : 'Resume Scanning'}
            </button>
            
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium text-gray-800"
            >
              Close Scanner
            </button>
          </div>

          {scanResult && (
            <div className="mt-4 p-3 bg-green-100 text-green-800 rounded-lg">
              {scanResult}
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-100 text-red-800 rounded-lg">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketScanner;