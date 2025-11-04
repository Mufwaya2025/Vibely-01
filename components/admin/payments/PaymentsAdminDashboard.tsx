import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getPaymentSummary,
  getPaymentTransactions,
  getPaymentTransactionById,
  refundTransaction,
  getWebhookLogs,
  replayWebhook,
  getPaymentConfig,
  upsertPaymentConfig,
  testPaymentConfig,
} from '../../../services/adminService';
import { GatewayTransaction, User, WebhookLog } from '../../../types';
import TransactionDetailModal from './TransactionDetailModal';
import RefundModal from './RefundModal';
import WebhookPayloadModal from './WebhookPayloadModal';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from 'recharts';

type TabKey = 'dashboard' | 'transactions' | 'webhooks' | 'config';

interface PaymentSummary {
  grossVolume: number;
  refunds: number;
  netRevenue: number;
  transactionCount: number;
  volumeByProvider: Record<string, number>;
}

interface TransactionFilters {
  q: string;
  status: string;
  provider: string;
  dateFrom: string;
  dateTo: string;
}

interface WebhookFilters {
  status: string;
  provider: string;
}

interface PaymentConfigForm {
  provider: string;
  publicKey: string;
  secretKey: string;
  isLiveMode: boolean;
  secretKeyOnFile: boolean;
}

const PAGE_SIZE = 8;

const defaultTransactionFilters: TransactionFilters = {
  q: '',
  status: 'all',
  provider: 'all',
  dateFrom: '',
  dateTo: '',
};

const defaultWebhookFilters: WebhookFilters = {
  status: 'all',
  provider: 'all',
};

const formatAmount = (amount: number, currency = 'ZMW') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);

const PaymentsAdminDashboard: React.FC<{ user: User }> = ({ user }) => {
  // State
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState<boolean>(false);

  const [transactions, setTransactions] = useState<GatewayTransaction[]>([]);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [transactionsLoading, setTransactionsLoading] = useState<boolean>(false);
  const [transactionFilters, setTransactionFilters] = useState<TransactionFilters>(
    defaultTransactionFilters
  );
  const [transactionPage, setTransactionPage] = useState<number>(1);

  const [selectedTransaction, setSelectedTransaction] = useState<GatewayTransaction | null>(null);
  const [refundTarget, setRefundTarget] = useState<GatewayTransaction | null>(null);
  const [refundProcessing, setRefundProcessing] = useState<boolean>(false);
  const [refundError, setRefundError] = useState<string | null>(null);

  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [webhookLoading, setWebhookLoading] = useState<boolean>(false);
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [webhookFilters, setWebhookFilters] = useState<WebhookFilters>(defaultWebhookFilters);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookLog | null>(null);
  const [webhookMessage, setWebhookMessage] = useState<string | null>(null);

  const [configForm, setConfigForm] = useState<PaymentConfigForm>({
    provider: '',
    publicKey: '',
    secretKey: '',
    isLiveMode: false,
    secretKeyOnFile: false,
  });
  const [configLoading, setConfigLoading] = useState<boolean>(false);
  const [configSaving, setConfigSaving] = useState<boolean>(false);
  const [configMessage, setConfigMessage] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configTesting, setConfigTesting] = useState<boolean>(false);

  // Data loaders (implementations added later)

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const data = await getPaymentSummary(user);
      setSummary(data);
    } catch (err) {
      console.error('Failed to load payment summary', err);
      setSummary(null);
      setSummaryError('Unable to load payment summary.');
    } finally {
      setSummaryLoading(false);
    }
  }, [user]);

  const loadTransactions = useCallback(
    async (filters: TransactionFilters) => {
      setTransactionsLoading(true);
      setTransactionsError(null);
      try {
        const query: Record<string, string> = {};
        if (filters.q) query.q = filters.q;
        if (filters.status && filters.status !== 'all') query.status = filters.status;
        if (filters.provider && filters.provider !== 'all') query.provider = filters.provider;
        if (filters.dateFrom) query.dateFrom = filters.dateFrom;
        if (filters.dateTo) query.dateTo = filters.dateTo;
        const response = await getPaymentTransactions(user, query);
        setTransactions(response.data ?? []);
        setTransactionPage(1);
      } catch (err) {
        console.error('Failed to load transactions', err);
        setTransactions([]);
        setTransactionsError('Unable to load transactions.');
      } finally {
        setTransactionsLoading(false);
      }
    },
    [user]
  );

  const loadWebhooks = useCallback(
    async (filters: WebhookFilters) => {
      setWebhookLoading(true);
      setWebhookError(null);
      try {
        const query: Record<string, string> = {};
        if (filters.status && filters.status !== 'all') query.status = filters.status;
        if (filters.provider && filters.provider !== 'all') query.provider = filters.provider;
        const response = await getWebhookLogs(user, query);
        setWebhookLogs(response.data ?? []);
      } catch (err) {
        console.error('Failed to load webhook logs', err);
        setWebhookLogs([]);
        setWebhookError('Unable to load webhook logs.');
      } finally {
        setWebhookLoading(false);
      }
    },
    [user]
  );

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    setConfigError(null);
    try {
      const config = await getPaymentConfig(user);
      setConfigForm({
        provider: config.provider ?? '',
        publicKey: config.publicKey ?? '',
        secretKey: '',
        isLiveMode: !!config.isLiveMode,
        secretKeyOnFile: !!config.secretKeyAvailable,
      });
    } catch (err) {
      console.error('Failed to load payment configuration', err);
      setConfigError('Unable to load payment configuration.');
    } finally {
      setConfigLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadSummary();
    loadTransactions(defaultTransactionFilters);
    loadConfig();
  }, [loadSummary, loadTransactions, loadConfig]);

  useEffect(() => {
    if (activeTab === 'webhooks' && webhookLogs.length === 0 && !webhookLoading) {
      loadWebhooks(defaultWebhookFilters);
    }
  }, [activeTab, webhookLogs.length, webhookLoading, loadWebhooks]);

  // Derived state (populated later)
  const paginatedTransactions = useMemo(() => {
    const start = (transactionPage - 1) * PAGE_SIZE;
    return transactions.slice(start, start + PAGE_SIZE);
  }, [transactions, transactionPage]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(transactions.length / PAGE_SIZE)), [transactions.length]);

  const providerOptions = useMemo(() => {
    const providers = new Set<string>();
    transactions.forEach((txn) => providers.add(txn.provider));
    if (summary?.volumeByProvider) {
      Object.keys(summary.volumeByProvider).forEach((p) => providers.add(p));
    }
    return Array.from(providers);
  }, [transactions, summary]);

  const dashboardSeries = useMemo(() => {
    const map = new Map<string, number>();
    transactions
      .filter((txn) => txn.status === 'succeeded')
      .forEach((txn) => {
        const key = new Date(txn.createdAt).toISOString().split('T')[0];
        map.set(key, (map.get(key) ?? 0) + txn.amount);
      });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({ date, amount }));
  }, [transactions]);

  const paymentMethodBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    transactions
      .filter((txn) => txn.status === 'succeeded')
      .forEach((txn) => {
        const key = txn.paymentMethod ?? 'Unknown';
        map.set(key, (map.get(key) ?? 0) + txn.amount);
      });
    return Array.from(map.entries()).map(([method, amount]) => ({ method, amount }));
  }, [transactions]);

  const currencyForDisplay = useMemo(() => transactions[0]?.currency ?? 'ZMW', [transactions]);

  const handleTransactionRowClick = async (transactionId: string) => {
    try {
      const data = await getPaymentTransactionById(user, transactionId);
      setSelectedTransaction(data);
    } catch (err) {
      console.error('Failed to load transaction detail', err);
    }
  };

  const handleRefund = (transaction: GatewayTransaction) => {
    setRefundTarget(transaction);
    setRefundError(null);
  };

  const confirmRefund = useCallback(async () => {
    if (!refundTarget) return;
    setRefundProcessing(true);
    setRefundError(null);
    try {
      const updated = await refundTransaction(user, refundTarget.id);
      setRefundTarget(null);
      setSelectedTransaction(updated);
      await Promise.all([loadTransactions(transactionFilters), loadSummary()]);
    } catch (err) {
      console.error('Failed to refund transaction', err);
      setRefundError('Refund failed. Please try again.');
    } finally {
      setRefundProcessing(false);
    }
  }, [refundTarget, user, loadTransactions, transactionFilters, loadSummary]);

  const handleReplayWebhook = async (id: string) => {
    try {
      setWebhookMessage(null);
      await replayWebhook(user, id);
      setWebhookMessage('Webhook replay queued successfully.');
      await loadWebhooks(webhookFilters);
    } catch (err) {
      console.error('Failed to replay webhook', err);
      setWebhookMessage('Failed to replay webhook.');
    }
  };

  const handleConfigSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setConfigSaving(true);
    setConfigError(null);
    setConfigMessage(null);
    try {
      const payload = {
        provider: configForm.provider,
        publicKey: configForm.publicKey,
        isLiveMode: configForm.isLiveMode,
      } as { provider: string; publicKey: string; isLiveMode: boolean; secretKey?: string };
      if (configForm.secretKey.trim()) {
        payload.secretKey = configForm.secretKey.trim();
      }
      const updated = await upsertPaymentConfig(user, payload);
      setConfigForm((prev) => ({
        ...prev,
        provider: updated.provider ?? prev.provider,
        publicKey: updated.publicKey ?? prev.publicKey,
        isLiveMode: !!updated.isLiveMode,
        secretKey: '',
        secretKeyOnFile: !!updated.secretKeyAvailable,
      }));
      setConfigMessage('Configuration saved successfully.');
      await loadSummary();
    } catch (err) {
      console.error('Failed to save payment configuration', err);
      setConfigError('Unable to save configuration.');
    } finally {
      setConfigSaving(false);
    }
  };

  const handleTestConfig = async () => {
    setConfigTesting(true);
    setConfigError(null);
    setConfigMessage(null);
    try {
      const result = await testPaymentConfig(user);
      setConfigMessage(result.message ?? 'Connection successful.');
    } catch (err) {
      console.error('Failed to test payment configuration', err);
      setConfigError('Connection test failed.');
    } finally {
      setConfigTesting(false);
    }
  };

  const renderDashboardTab = () => (
    <div className="space-y-6">
      {summaryLoading ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center text-gray-500 shadow-sm">
          Loading payment metrics...
        </div>
      ) : summaryError ? (
        <div className="bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl p-6 shadow-sm">
          {summaryError}
        </div>
      ) : summary ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wider font-semibold text-gray-500">Gross Volume</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {formatAmount(summary.grossVolume, currencyForDisplay)}
              </p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wider font-semibold text-gray-500">Net Revenue</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {formatAmount(summary.netRevenue, currencyForDisplay)}
              </p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wider font-semibold text-gray-500">Refunds</p>
              <p className="text-2xl font-bold text-amber-600 mt-2">
                {formatAmount(summary.refunds, currencyForDisplay)}
              </p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wider font-semibold text-gray-500">Transactions</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{summary.transactionCount}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Revenue Over Time</h3>
                <span className="text-xs uppercase tracking-wider text-gray-500">Last activity</span>
              </div>
              {dashboardSeries.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-10">
                  No transactions yet. Sales activity will appear here once payments are processed.
                </div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dashboardSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="amount" stroke="#7c3aed" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">By Payment Method</h3>
                <span className="text-xs uppercase tracking-wider text-gray-500">Successful only</span>
              </div>
              {paymentMethodBreakdown.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-10">
                  Processed transactions will appear as soon as payments complete.
                </div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={paymentMethodBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="method" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="amount" fill="#a855f7" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Volume by Provider</h3>
            {summary.volumeByProvider && Object.keys(summary.volumeByProvider).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(summary.volumeByProvider).map(([provider, amount]) => (
                  <div key={provider} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{provider}</p>
                      <p className="text-xs text-gray-500">Total processed</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatAmount(amount, currencyForDisplay)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                Configure your payment provider and process transactions to see insights here.
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm text-gray-500">
          No payment data available yet.
        </div>
      )}
    </div>
  );

  const renderTransactionsTab = () => (
    <div className="space-y-6">
      <form
        className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          loadTransactions(transactionFilters);
        }}
      >
        <div className="lg:col-span-2">
          <label className="text-xs uppercase tracking-wider font-semibold text-gray-500 block mb-1">
            Search
          </label>
          <input
            type="text"
            placeholder="Transaction ID, event, payment method..."
            value={transactionFilters.q}
            onChange={(e) => setTransactionFilters((prev) => ({ ...prev, q: e.target.value }))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider font-semibold text-gray-500 block mb-1">
            Status
          </label>
          <select
            value={transactionFilters.status}
            onChange={(e) => setTransactionFilters((prev) => ({ ...prev, status: e.target.value }))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All</option>
            <option value="succeeded">Succeeded</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider font-semibold text-gray-500 block mb-1">
            Provider
          </label>
          <select
            value={transactionFilters.provider}
            onChange={(e) => setTransactionFilters((prev) => ({ ...prev, provider: e.target.value }))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All</option>
            {providerOptions.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>
        </div>
        <div className="lg:col-span-1 flex items-end space-x-2">
          <button
            type="submit"
            className="w-full bg-purple-600 text-white font-semibold rounded-lg px-3 py-2 hover:bg-purple-700 transition-colors"
          >
            Apply
          </button>
        </div>
        <div className="md:col-span-1">
          <label className="text-xs uppercase tracking-wider font-semibold text-gray-500 block mb-1">
            From
          </label>
          <input
            type="date"
            value={transactionFilters.dateFrom}
            onChange={(e) => setTransactionFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div className="md:col-span-1">
          <label className="text-xs uppercase tracking-wider font-semibold text-gray-500 block mb-1">
            To
          </label>
          <input
            type="date"
            value={transactionFilters.dateTo}
            onChange={(e) => setTransactionFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div className="md:col-span-1 flex items-end">
          <button
            type="button"
            onClick={() => {
              setTransactionFilters(defaultTransactionFilters);
              loadTransactions(defaultTransactionFilters);
            }}
            className="w-full text-sm skład font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-2 transition-colors"
          >
            Reset
          </button>
        </div>
      </form>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Transactions</h3>
          <span className="text-sm text-gray-500">
            Showing {paginatedTransactions.length} of {transactions.length}
          </span>
        </div>

        {transactionsLoading ? (
          <div className="p-10 text-center text-gray-500">Loading transactions...</div>
        ) : transactionsError ? (
          <div className="p-6 text-rose-600 bg-rose-50 border-t border-rose-100">{transactionsError}</div>
        ) : transactions.length === 0 ? (
          <div className="p-10 text-center text-gray-500">No transactions found.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">External ID</th>
                    <th className="px-4 py-3 text-left font-semibold">Event</th>
                    <th className="px-4 py-3 text-left font-semibold">Amount</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold">Provider</th>
                    <th className="px-4 py-3 text-left font-semibold">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {paginatedTransactions.map((txn) => (
                    <tr
                      key={txn.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleTransactionRowClick(txn.id)}
                    >
                      <td className="px-4 py-3 font-semibold text-gray-900 break-all">{txn.externalId}</td>
                      <td className="px-4 py-3 text-gray-600 break-all">{txn.eventId}</td>
                      <td className="px-4 py-3 text-gray-900 font-semibold">
                        {formatAmount(txn.amount, txn.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            txn.status === 'succeeded'
                              ? 'bg-emerald-100 text-emerald-700'
                              : txn.status === 'refunded'
                              ? 'bg-amber-100 text-amber-700'
                              : txn.status === 'pending'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {txn.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{txn.provider}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(txn.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Page {transactionPage} of {totalPages}
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={() => setTransactionPage((prev) => Math.max(1, prev - 1))}
                  disabled={transactionPage === 1}
                  className="px-3 py-1.5 rounded-md border border-gray-200 text-sm font-semibold text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  Previous
                </button>
                <button
                  onClick={() => setTransactionPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={transactionPage === totalPages}
                  className="px-3 py-1.5 rounded-md border border-gray-200 text-sm font-semibold text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  const renderWebhooksTab = () => (
    <div className="space-y-6">
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-xs uppercase tracking-wider font-semibold text-gray-500 block mb-1">
            Status
          </label>
          <select
            value={webhookFilters.status}
            onChange={(e) => setWebhookFilters((prev) => ({ ...prev, status: e.target.value }))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All</option>
            <option value="processed">Processed</option>
            <option value="failed">Failed</option>
            <option value="received">Received</option>
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider font-semibold text-gray-500 block mb-1">
            Provider
          </label>
          <input
            type="text"
            placeholder="MockPay..."
            value={webhookFilters.provider}
            onChange={(e) => setWebhookFilters((prev) => ({ ...prev, provider: e.target.value }))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div className="flex items-end space-x-2">
          <button
            onClick={() => loadWebhooks(webhookFilters)}
            className="flex-1 bg-purple-600 text-white font-semibold rounded-lg px-3 py-2 hover:bg-purple-700 transition-colors"
          >
            Apply
          </button>
          <button
            onClick={() => {
              setWebhookFilters(defaultWebhookFilters);
              loadWebhooks(defaultWebhookFilters);
            }}
            className="px-3 py-2 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {webhookMessage && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-2xl px-4 py-3 text-sm">
          {webhookMessage}
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Webhook Logs</h3>
          <span className="text-sm text-gray-500">{webhookLogs.length} entries</span>
        </div>

        {webhookLoading ? (
          <div className="p-10 text-center text-gray-500">Loading webhook logs...</div>
        ) : webhookError ? (
          <div className="p-6 text-rose-600 bg-rose-50 border-t border-rose-100">{webhookError}</div>
        ) : webhookLogs.length === 0 ? (
          <div className="p-10 text-center text-gray-500">No webhook events recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Event Type</th>
                  <th className="px-4 py-3 text-left font-semibold">Provider</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Received</th>
                  <th className="px-4 py-3 text-left font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {webhookLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td
                      className="px-4 py-3 text-gray-900 font-semibold cursor-pointer"
                      onClick={() => setSelectedWebhook(log)}
                    >
                      {log.eventType}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{log.provider}</td>
                    <td className="px-4 py-3">
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
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleReplayWebhook(log.id)}
                        disabled={log.status !== 'failed'}
                        className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                          log.status === 'failed'
                            ? 'bg-purple-600 text-white hover:bg-purple-700'
                            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        Replay
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const renderConfigTab = () => (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 max-w-3xl">
      {configLoading ? (
        <p className="text-gray-500">Loading configuration...</p>
      ) : (
        <form className="space-y-6" onSubmit={handleConfigSubmit}>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Gateway Configuration</h3>
            <p className="text-sm text-gray-500 mt-1">
              Update API credentials and toggle between test/live environments.
            </p>
          </div>
          {configError && (
            <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
              {configError}
            </div>
          )}
          {configMessage && (
            <div className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              {configMessage}
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Provider</label>
            <input
              type="text"
              value={configForm.provider}
              onChange={(e) => setConfigForm((prev) => ({ ...prev, provider: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="MockPay"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Public API Key</label>
            <input
              type="text"
              value={configForm.publicKey}
              onChange={(e) => setConfigForm((prev) => ({ ...prev, publicKey: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="pk_live_..."
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Secret Key</label>
            <input
              type="password"
              value={configForm.secretKey}
              onChange={(e) => setConfigForm((prev) => ({ ...prev, secretKey: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder={configForm.secretKeyOnFile ? '•••••••••• (on file)' : 'sk_test_...'}
            />
            <p className="text-xs text-gray-500 mt-1">
              {configForm.secretKeyOnFile
                ? 'A secret key is already stored. Provide a new value to rotate it.'
                : 'Enter the secret key from your payment provider.'}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm font-semibold text-gray-700">Live Mode</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={configForm.isLiveMode}
                onChange={(e) => setConfigForm((prev) => ({ ...prev, isLiveMode: e.target.checked }))}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600" />
            </label>
            <span className="text-sm text-gray-500">
              {configForm.isLiveMode ? 'Transactions will use live credentials.' : 'Currently in test mode.'}
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleTestConfig}
              disabled={configTesting}
              className={`px-4 py-2 rounded-md text-sm font-semibold border ${
                configTesting
                  ? 'border-purple-200 text-purple-400 cursor-not-allowed'
                  : 'border-purple-200 text-purple-700 hover:bg-purple-50'
              }`}
            >
              {configTesting ? 'Testing...' : 'Test Connection'}
            </button>
            <button
              type="submit"
              disabled={configSaving}
              className={`px-5 py-2.5 rounded-md text-sm font-semibold text-white ${
                configSaving ? 'bg-purple-300 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              {configSaving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      )}
    </div>
  );

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-md">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Payments</h2>
          <p className="text-sm text-gray-500">
            Monitor gateway performance, review transactions, and manage configuration.
          </p>
        </div>
        {configForm.provider && (
          <span className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-sm font-semibold">
            {configForm.provider} {configForm.isLiveMode ? '· Live' : '· Test'}
          </span>
        )}
      </div>

      <div className="px-6 border-b border-gray-100 bg-gray-50">
        <nav className="flex space-x-6">
          {[
            { key: 'dashboard', label: 'Dashboard' },
            { key: 'transactions', label: 'Transactions' },
            { key: 'webhooks', label: 'Webhooks' },
            { key: 'config', label: 'Configuration' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabKey)}
              className={`relative py-4 text-sm font-semibold transition-colors ${
                activeTab === tab.key ? 'text-purple-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute inset-x-0 -bottom-px h-1 bg-purple-600 rounded-t-full" />
              )}
            </button>
          ))}
        </nav>
      </div>
      <div className="px-6 py-6 bg-gray-50">
        {activeTab === 'dashboard' && renderDashboardTab()}
        {activeTab === 'transactions' && renderTransactionsTab()}
        {activeTab === 'webhooks' && renderWebhooksTab()}
        {activeTab === 'config' && renderConfigTab()}
      </div>

      <TransactionDetailModal
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        onRequestRefund={handleRefund}
      />

      <RefundModal
        transaction={refundTarget}
        isProcessing={refundProcessing}
        error={refundError}
        onConfirm={confirmRefund}
        onClose={() => {
          if (!refundProcessing) {
            setRefundTarget(null);
          }
        }}
      />

      <WebhookPayloadModal log={selectedWebhook} onClose={() => setSelectedWebhook(null)} />
    </div>
  );
};

export default PaymentsAdminDashboard;
