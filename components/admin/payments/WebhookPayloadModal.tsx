import React from 'react';
import { WebhookLog } from '../../../types';

interface WebhookPayloadModalProps {
  log: WebhookLog | null;
  onClose: () => void;
}

const WebhookPayloadModal: React.FC<WebhookPayloadModalProps> = ({ log, onClose }) => {
  if (!log) return null;

  return (
    <div className="fixed inset-0 z-[1100] bg-gray-900/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Webhook Payload</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close webhook payload"
          >
            &times;
          </button>
        </div>
        <div className="px-6 py-5 space-y-3 text-sm text-gray-700 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-500 uppercase tracking-wide text-xs">Provider</p>
              <p className="text-gray-900 font-semibold">{log.provider}</p>
            </div>
            <div>
              <p className="text-gray-500 uppercase tracking-wide text-xs">Event</p>
              <p className="text-gray-900 font-semibold">{log.eventType}</p>
            </div>
            <div>
              <p className="text-gray-500 uppercase tracking-wide text-xs">Status</p>
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                  log.status === 'processed'
                    ? 'bg-emerald-100 text-emerald-700'
                    : log.status === 'failed'
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                {log.status}
              </span>
            </div>
            <div>
              <p className="text-gray-500 uppercase tracking-wide text-xs">Received</p>
              <p className="text-gray-900 font-semibold">{new Date(log.createdAt).toLocaleString()}</p>
            </div>
            {log.responseMessage && (
              <div className="col-span-2">
                <p className="text-gray-500 uppercase tracking-wide text-xs">Response</p>
                <p className="text-gray-800">{log.responseMessage}</p>
              </div>
            )}
          </div>
          <div>
            <p className="text-gray-500 uppercase tracking-wide text-xs mb-1.5">Payload</p>
            <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-700 overflow-x-auto">
              {JSON.stringify(log.payload, null, 2)}
            </pre>
          </div>
        </div>
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm font-semibold text-gray-600 hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default WebhookPayloadModal;
