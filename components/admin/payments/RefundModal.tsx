import React from 'react';
import { GatewayTransaction } from '../../../types';

interface RefundModalProps {
  transaction: GatewayTransaction | null;
  isProcessing: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

const RefundModal: React.FC<RefundModalProps> = ({
  transaction,
  isProcessing,
  error,
  onConfirm,
  onClose,
}) => {
  if (!transaction) return null;

  return (
    <div className="fixed inset-0 z-[1200] bg-gray-900/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Confirm Refund</h3>
          <p className="text-sm text-gray-500 mt-1">
            Refunds cannot be undone. Please verify the details before proceeding.
          </p>
        </div>

        <div className="px-6 py-5 space-y-4 text-sm text-gray-700">
          <p>
            <span className="font-semibold text-gray-900">Transaction:</span>{' '}
            <span className="break-all text-gray-800">{transaction.externalId}</span>
          </p>
          <p>
            <span className="font-semibold text-gray-900">Amount:</span>{' '}
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: transaction.currency,
              minimumFractionDigits: 2,
            }).format(transaction.amount)}
          </p>
          <p>
            <span className="font-semibold text-gray-900">Event ID:</span>{' '}
            <span className="break-all">{transaction.eventId}</span>
          </p>
          <p className="text-gray-600">
            This will mark the transaction as{' '}
            <span className="font-semibold text-amber-600">refunded</span> and notify the downstream systems.
          </p>
          {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-md p-3">{error}</p>}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm font-semibold text-gray-600 hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className={`px-4 py-2 rounded-md text-sm font-semibold text-white transition-colors ${
              isProcessing ? 'bg-purple-300 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {isProcessing ? 'Processing...' : 'Confirm Refund'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RefundModal;
