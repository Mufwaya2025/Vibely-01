import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type QrScanner from 'qr-scanner';
import { scanTicket, TicketScanError } from '../services/ticketService';

interface TicketScannerProps {
  eventId: string;
  onClose: () => void;
  onTicketScanned?: (ticketId: string) => void;
}

type StatusType = 'info' | 'success' | 'warning' | 'error';

const statusClasses: Record<StatusType, string> = {
  info: 'border-slate-200 bg-slate-50 text-slate-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  error: 'border-red-200 bg-red-50 text-red-700',
};

const TicketScanner: React.FC<TicketScannerProps> = ({ eventId, onClose, onTicketScanned }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScanRef = useRef<{ code: string; timestamp: number } | null>(null);

  const [manualCode, setManualCode] = useState('');
  const [statusMessage, setStatusMessage] = useState('Point the camera at the ticket QR code.');
  const [statusType, setStatusType] = useState<StatusType>('info');
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stopScanner = useCallback(() => {
    try {
      // Prefer a full destroy to release resources
      // @ts-ignore destroy exists on qr-scanner instances
      scannerRef.current?.destroy?.();
    } catch {
      // Fallback to stop if destroy isn't available for any reason
      scannerRef.current?.stop();
    }
    scannerRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const processTicket = useCallback(
    async (rawCode: string, source: 'qr' | 'manual') => {
      const normalized = rawCode.trim();
      if (!normalized) return;

      const now = Date.now();
      if (
        source === 'qr' &&
        lastScanRef.current &&
        lastScanRef.current.code === normalized &&
        now - lastScanRef.current.timestamp < 3000
      ) {
        return;
      }

      lastScanRef.current = { code: normalized, timestamp: now };
      setIsProcessing(true);
      setStatusType('info');
      setStatusMessage('Verifying ticket…');

      try {
        const ticket = await scanTicket(normalized);
        setStatusType('success');
        setStatusMessage(
          `Ticket ${ticket.ticketId} accepted. ${ticket.holderName ? `Holder: ${ticket.holderName}` : 'Access granted.'}`
        );
        onTicketScanned?.(ticket.ticketId);
      } catch (error) {
        if (error instanceof TicketScanError && error.status === 409) {
          setStatusType('warning');
          setStatusMessage(error.message);
        } else if (error instanceof Error) {
          setStatusType('error');
          setStatusMessage(error.message);
        } else {
          setStatusType('error');
          setStatusMessage('Failed to process ticket. Please try again.');
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [onTicketScanned]
  );

  const startScanner = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });

      streamRef.current = stream;
      videoRef.current.srcObject = stream;

      // Lazy-load qr-scanner to avoid dev import resolution hiccups
      const { default: QrScannerLib } = await import('qr-scanner');
      try {
        // @ts-expect-error WORKER_PATH exists as a deprecated setter in qr-scanner types
        QrScannerLib.WORKER_PATH = new URL('qr-scanner/qr-scanner-worker.min.js', import.meta.url).toString();
      } catch {}

      const scanner = new QrScannerLib(
        videoRef.current,
        (result) => {
          if (result?.data) {
            void processTicket(result.data, 'qr');
          }
        },
        { returnDetailedScanResult: true }
      );

      scannerRef.current = scanner;
      await scanner.start();
      setStatusType('info');
      setStatusMessage('Camera ready. Align the QR code within the frame.');
    } catch (error) {
      console.error('Camera error:', error);
      setCameraError(error instanceof Error ? error.message : 'Unable to access camera.');
      setStatusType('error');
      setStatusMessage('Camera unavailable. Use manual entry below.');
    }
  }, [processTicket]);

  useEffect(() => {
    void startScanner();
    return () => {
      stopScanner();
    };
  }, [startScanner, stopScanner]);

  const handleManualSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!manualCode.trim()) return;
      await processTicket(manualCode, 'manual');
      setManualCode('');
    },
    [manualCode, processTicket]
  );

  const handleClose = useCallback(() => {
    stopScanner();
    onClose();
  }, [onClose, stopScanner]);

  const statusClassName = useMemo(() => statusClasses[statusType], [statusType]);

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 px-4 py-8">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-purple-400">Ticket Scanner</p>
            <h2 className="text-xl font-bold text-slate-900">Event Access Control</h2>
            <p className="text-xs text-slate-500">
              Event ID:&nbsp;
              <code className="rounded bg-slate-100 px-1 py-0.5 text-slate-700">{eventId}</code>
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close scanner"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950/80">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-64 w-full rounded-2xl object-cover"
              />
              {cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 px-6 text-center text-sm text-slate-600">
                  <p className="font-medium">Camera unavailable</p>
                  <p className="mt-1">{cameraError}</p>
                  <button
                    type="button"
                    onClick={() => void startScanner()}
                    className="mt-4 rounded-md border border-purple-200 px-3 py-1.5 text-sm font-semibold text-purple-600 hover:bg-purple-50"
                  >
                    Retry camera
                  </button>
                </div>
              )}
            </div>

            <div className={`rounded-xl border px-4 py-3 text-sm ${statusClassName}`}>
              {statusMessage}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Manual entry</h3>
              <p className="text-sm text-slate-500">Use this if the QR code is damaged or unreadable.</p>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-2">
              <label htmlFor="manual-ticket" className="text-sm font-medium text-slate-700">
                Ticket ID
              </label>
              <div className="flex rounded-lg border border-slate-200 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-200">
                <input
                  id="manual-ticket"
                  type="text"
                  value={manualCode}
                  onChange={(event) => setManualCode(event.target.value)}
                  className="flex-1 rounded-l-lg border-0 px-3 py-2 text-sm outline-none"
                  placeholder="tkt-ABC123"
                />
                <button
                  type="submit"
                  disabled={isProcessing || manualCode.trim().length === 0}
                  className="rounded-r-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isProcessing ? 'Checking…' : 'Submit'}
                </button>
              </div>
            </form>

            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">
              <p>Tips:</p>
              <ul className="mt-1 list-disc pl-4">
                <li>Ensure the QR code fills most of the frame.</li>
                <li>Hold steady until you see confirmation.</li>
                <li>Use manual entry for damaged codes.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketScanner;
