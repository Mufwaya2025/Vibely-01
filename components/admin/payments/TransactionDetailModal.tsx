import React from 'react';
import { GatewayTransaction } from '../../../types';

interface TransactionDetailModalProps {
  transaction: GatewayTransaction | null;
  onClose: () => void;
  onRequestRefund: (transaction: GatewayTransaction) => void;
}

const formatAmount = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);

const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  transaction,
  onClose,
  onRequestRefund,
}) => {
  if (!transaction) return null;

  const refundable = transaction.status !== 'refunded' && transaction.status !== 'failed';

  return (
    <div className="fixed inset-0 z-[1100] bg-gray-900/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Transaction Details</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close transaction details"
          >
            &times;
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 uppercase tracking-wide text-xs">External ID</p>
              <p className="text-gray-900 font-semibold break-all">{transaction.externalId}</p>
            </div>
            <div>
              <p className="text-gray-500 uppercase tracking-wide text-xs">Status</p>
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                  transaction.status === 'succeeded'
                    ? 'bg-emerald-100 text-emerald-700'
                    : transaction.status === 'refunded'
                    ? 'bg-amber-100 text-amber-700'
                    : transaction.status === 'pending'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-rose-100 text-rose-700'
                }`}
              >
                {transaction.status}
              </span>
            </div>
            <div>
              <p className="text-gray-500 uppercase tracking-wide text-xs">Amount</p>
              <p className="text-gray-900 font-semibold">
                {formatAmount(transaction.amount, transaction.currency)}
              </p>
            </div>
            <div>
              <p className="text-gray-500 uppercase tracking-wide text-xs">Payment Method</p>
              <p className="text-gray-900 font-semibold">{transaction.paymentMethod ?? '—'}</p>
            </div>
            <div>
              <p className="text-gray-500 uppercase tracking-wide text-xs">Provider</p>
              <p className="text-gray-900 font-semibold">{transaction.provider}</p>
            </div>
            <div>
              <p className="text-gray-500 uppercase tracking-wide text-xs">Created</p>
              <p className="text-gray-900 font-semibold">
                {new Date(transaction.createdAt).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-gray-500 uppercase tracking-wide text-xs">Event ID</p>
              <p className="text-gray-900 font-semibold break-all">{transaction.eventId}</p>
            </div>
            <div>
              <p className="text-gray-500 uppercase tracking-wide text-xs">User ID</p>
              <p className="text-gray-900 font-semibold break-all">{transaction.userId}</p>
            </div>
            {transaction.ticketId && (
              <div>
                <p className="text-gray-500 uppercase tracking-wide text-xs">Ticket ID</p>
                <p className="text-gray-900 font-semibold break-all">{transaction.ticketId}</p>
              </div>
            )}
          </div>

          {transaction.metadata && Object.keys(transaction.metadata).length > 0 && (
            <div>
              <p className="text-gray-500 uppercase tracking-wide text-xs mb-1.5">Metadata</p>
              <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-700 overflow-x-auto">
                {JSON.stringify(transaction.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm font-semibold text-gray-600 hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => onRequestRefund(transaction)}
            disabled={!refundable}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
              refundable
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-gray-300 text-gray-600 cursor-not-allowed'
            }`}
          >
            {refundable ? 'Refund Transaction' : 'Not Refundable'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionDetailModal;
