
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Ticket, User } from '../types';
import {
  fetchUserTransactions,
  UserTransactionSummary,
  verifyPaymentReference,
} from '../services/paymentService';

type PanelVariant = 'full' | 'compact';

interface TransactionHistoryPanelProps {
  user: User;
  onTicketIssued?: (ticket: Ticket) => void;
  variant?: PanelVariant;
  limit?: number;
  onViewFullHistory?: () => void;
  className?: string;
}

const formatAmount = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);

const statusBadgeClass = (status: string) => {
  switch (status) {
    case 'succeeded':
      return 'bg-emerald-100 text-emerald-700';
    case 'pending':
      return 'bg-amber-100 text-amber-700';
    case 'failed':
    default:
      return 'bg-rose-100 text-rose-700';
  }
};

const prettifyPurpose = (purpose: string | null | undefined) => {
  if (!purpose) return 'Other Transactions';
  if (purpose === 'ticket') return 'Ticket Purchases';
  if (purpose === 'subscription') return 'Subscription Payments';
  return purpose.charAt(0).toUpperCase() + purpose.slice(1);
};

const TransactionHistoryPanel: React.FC<TransactionHistoryPanelProps> = ({
  user,
  onTicketIssued,
  variant = 'full',
  limit,
  onViewFullHistory,
  className,
}) => {
  const [transactions, setTransactions] = useState<UserTransactionSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verifyingReference, setVerifyingReference] = useState<string | null>(null);

  const loadTransactions = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    setError(null);
    setNotice(null);
    try {
      const data = await fetchUserTransactions(user.id);
      setTransactions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const handleVerify = async (transaction: UserTransactionSummary) => {
    if (!transaction.reference) return;
    setVerifyingReference(transaction.reference);
    setNotice(null);
    setError(null);
    try {
      const result = await verifyPaymentReference(transaction.reference);
      if (result.issuedTicket && onTicketIssued) {
        onTicketIssued(result.issuedTicket);
      }
      await loadTransactions();
      if (result.success) {
        setNotice(`Transaction ${transaction.reference} synced successfully.`);
      } else {
        setNotice(`Verification completed: status is ${result.status}.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setVerifyingReference(null);
    }
  };

  const summary = useMemo(() => {
    const completed = transactions.filter((txn) => txn.status === 'succeeded');
    const pending = transactions.filter((txn) => txn.status === 'pending');
    const failed = transactions.filter((txn) => txn.status === 'failed');
    const currency = completed[0]?.currency ?? transactions[0]?.currency ?? 'ZMW';
    const totalSpent = completed.reduce((sum, txn) => sum + txn.amount, 0);
    const lastTransaction = transactions[0]?.updatedAt ?? null;

    return {
      totalSpent,
      currency,
      completed: completed.length,
      pending: pending.length,
      failed: failed.length,
      lastTransaction,
    };
  }, [transactions]);

  const grouped = useMemo(() => {
    return transactions.reduce<Record<string, UserTransactionSummary[]>>((acc, txn) => {
      const key = txn.purpose ?? 'other';
      if (!acc[key]) acc[key] = [];
      acc[key].push(txn);
      return acc;
    }, {});
  }, [transactions]);

  const compactTransactions = useMemo(() => {
    if (variant !== 'compact') return transactions;
    if (typeof limit === 'number') {
      return transactions.slice(0, limit);
    }
    return transactions.slice(0, 5);
  }, [transactions, variant, limit]);

  const renderActionRow = () => (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void loadTransactions()}
        disabled={isLoading}
        className="inline-flex items-center rounded-full border border-purple-200 px-3 py-1.5 text-xs font-semibold text-purple-600 transition hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? 'Refreshing…' : 'Refresh'}
      </button>
      {notice && (
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
          {notice}
        </span>
      )}
      {error && (
        <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600">
          {error}
        </span>
      )}
    </div>
  );

  const renderFull = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-16 text-sm text-gray-500">
          Loading transactions…
        </div>
      );
    }

    if (transactions.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center text-gray-500">
          No transactions found yet.
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {Object.entries(grouped).map(([purpose, txnList]) => (
          <div key={purpose} className="space-y-4">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  {prettifyPurpose(purpose)}
                </p>
                <p className="text-xs text-gray-400">
                  {txnList.length} {txnList.length === 1 ? 'transaction' : 'transactions'}
                </p>
              </div>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Reference</th>
                    <th className="px-4 py-3 text-left font-semibold">Label</th>
                    <th className="px-4 py-3 text-left font-semibold">Amount</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold">Updated</th>
                    <th className="px-4 py-3 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {txnList.map((txn) => (
                    <tr key={txn.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-600 break-all">
                        {txn.reference ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-800">
                        {txn.label}
                        {txn.eventTitle && (
                          <p className="text-xs text-gray-500">{txn.eventTitle}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        {formatAmount(txn.amount, txn.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(
                            txn.status
                          )}`}
                        >
                          {txn.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(txn.updatedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <button
                            type="button"
                            onClick={() => void handleVerify(txn)}
                            disabled={
                              !txn.reference ||
                              verifyingReference === txn.reference ||
                              txn.status === 'succeeded'
                            }
                            className="inline-flex items-center rounded-full border border-purple-200 px-3 py-1.5 text-xs font-semibold text-purple-600 hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {verifyingReference === txn.reference ? 'Verifying…' : 'Verify'}
                          </button>
                          {txn.ticketId && (
                            <span className="text-xs text-gray-500">Ticket: {txn.ticketId}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderCompact = () => {
    if (isLoading) {
      return (
        <div className="space-y-4">
          {[...Array(3)].map((_, idx) => (
            <div
              // eslint-disable-next-line react/no-array-index-key
              key={idx}
              className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className="h-4 w-24 rounded bg-slate-200" />
              <div className="mt-3 h-3 w-40 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      );
    }

    if (transactions.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-slate-500">
          No transactions yet. Purchases you make will show up here.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {compactTransactions.map((txn) => (
          <div key={txn.id} className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{txn.label}</p>
                {txn.eventTitle && <p className="text-xs text-slate-500">{txn.eventTitle}</p>}
                <p className="text-[11px] font-mono text-slate-400 mt-1">
                  Ref: {txn.reference ?? '—'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-slate-900">
                  {formatAmount(txn.amount, txn.currency)}
                </p>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusBadgeClass(
                    txn.status
                  )}`}
                >
                  {txn.status}
                </span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>Updated {new Date(txn.updatedAt).toLocaleString()}</span>
              <div className="flex items-center gap-2">
                {txn.ticketId && <span className="font-semibold text-slate-600">#{txn.ticketId}</span>}
                <button
                  type="button"
                  onClick={() => void handleVerify(txn)}
                  disabled={
                    !txn.reference ||
                    verifyingReference === txn.reference ||
                    txn.status === 'succeeded'
                  }
                  className="inline-flex items-center rounded-full border border-purple-200 px-3 py-1 text-[11px] font-semibold text-purple-600 hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {verifyingReference === txn.reference ? 'Verifying…' : 'Sync'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={`space-y-6 ${className ?? ''}`}>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white/60 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
            Total Spent
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatAmount(summary.totalSpent, summary.currency)}
          </p>
          <p className="text-[11px] text-slate-500">
            {summary.lastTransaction
              ? `Updated ${new Date(summary.lastTransaction).toLocaleDateString()}`
              : 'No purchases yet'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/60 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
            Completed
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{summary.completed}</p>
          <p className="text-[11px] text-slate-500">Successful payments</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/60 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Pending</p>
          <p className="mt-2 text-2xl font-bold text-amber-600">{summary.pending}</p>
          <p className="text-[11px] text-slate-500">
            {summary.failed > 0 ? `${summary.failed} failed` : 'Awaiting confirmation'}
          </p>
        </div>
      </div>

      {renderActionRow()}

      {variant === 'compact' ? renderCompact() : renderFull()}

      {variant === 'compact' &&
        typeof limit === 'number' &&
        transactions.length > limit &&
        onViewFullHistory && (
          <div className="text-center">
            <button
              type="button"
              onClick={onViewFullHistory}
              className="inline-flex items-center rounded-full border border-purple-300 bg-white px-4 py-2 text-sm font-semibold text-purple-700 transition hover:bg-purple-50"
            >
              View full history
            </button>
          </div>
        )}
    </div>
  );
};

export default TransactionHistoryPanel;
