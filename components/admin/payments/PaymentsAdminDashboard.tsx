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
  getPayoutRequests,
  approvePayoutRequest,
  rejectPayoutRequest,
  getPlatformBalance,
  requestPlatformPayout,
} from '../../../services/adminService';
import { GatewayTransaction, User, WebhookLog } from '../../../types';
import TransactionDetailModal from './TransactionDetailModal';
import RefundModal from './RefundModal';
import WebhookPayloadModal from './WebhookPayloadModal';
import { verifyPaymentReference } from '../../../services/paymentService';
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
import CheckCircleIcon from '../../icons/CheckCircleIcon';

type TabKey = 'dashboard' | 'transactions' | 'payouts' | 'webhooks' | 'config';

interface PaymentSummary {
  grossVolume: number;
  refunds: number;
  netRevenue: number;
  transactionCount: number;
  volumeByProvider: Record<string, number>;
  platformFees: number;
  subscriptionRevenue: number;
  platformRevenue: number;
  payoutFees: number;
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
  const [transactionsNotice, setTransactionsNotice] = useState<string | null>(null);
  const [transactionFilters, setTransactionFilters] = useState<TransactionFilters>(
    defaultTransactionFilters
  );
  const [transactionPage, setTransactionPage] = useState<number>(1);

  const [selectedTransaction, setSelectedTransaction] = useState<GatewayTransaction | null>(null);
  const [refundTarget, setRefundTarget] = useState<GatewayTransaction | null>(null);
  const [refundProcessing, setRefundProcessing] = useState<boolean>(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [verifyingReference, setVerifyingReference] = useState<string | null>(null);

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

  const [payoutRequests, setPayoutRequests] = useState<GatewayTransaction[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState<boolean>(false);
  const [payoutsError, setPayoutsError] = useState<string | null>(null);
  const [payoutsNotice, setPayoutsNotice] = useState<string | null>(null);
  const [payoutStatusFilter, setPayoutStatusFilter] = useState<'pending' | 'succeeded' | 'failed' | 'all'>('pending');
  const [payoutActionId, setPayoutActionId] = useState<string | null>(null);

  const [platformBalance, setPlatformBalance] = useState<{
    currency: string;
    totalRevenue: number;
    withdrawn: number;
    pending: number;
    available: number;
    payoutFees: {
      bankAccount: { minAmount: number; maxAmount: number | null; fee: number }[];
      mobileMoney: { minAmount: number; maxAmount: number | null; fee: number }[];
    };
  } | null>(null);
  const [platformBalanceLoading, setPlatformBalanceLoading] = useState<boolean>(false);
  const [platformMessage, setPlatformMessage] = useState<string | null>(null);
  const [platformError, setPlatformError] = useState<string | null>(null);
  const [isPlatformModalOpen, setIsPlatformModalOpen] = useState<boolean>(false);
  const [platformPayoutMethod, setPlatformPayoutMethod] = useState<'Bank' | 'MobileMoney'>('Bank');
  const [platformPayoutAmount, setPlatformPayoutAmount] = useState<string>('');
  const [platformBankName, setPlatformBankName] = useState<string>('');
  const [platformBankCode, setPlatformBankCode] = useState<string>('');
  const [platformBankAccountName, setPlatformBankAccountName] = useState<string>('');
  const [platformBankAccountNumber, setPlatformBankAccountNumber] = useState<string>('');
  const [platformMobileProvider, setPlatformMobileProvider] = useState<string>('MTN');
  const [platformMobileAccountName, setPlatformMobileAccountName] = useState<string>('');
  const [platformMobilePhone, setPlatformMobilePhone] = useState<string>('');
  const [platformPayoutProcessing, setPlatformPayoutProcessing] = useState<boolean>(false);
  const [platformPayoutModalError, setPlatformPayoutModalError] = useState<string | null>(null);

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

  const renderPayoutsTab = () => (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Manual payout approvals</h3>
            <p className="text-sm text-gray-500">Review organizer requests and trigger payouts via Lenco.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</label>
            <select
              value={payoutStatusFilter}
              onChange={(e) =>
                setPayoutStatusFilter(e.target.value as 'pending' | 'succeeded' | 'failed' | 'all')
              }
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-purple-500 focus:ring-purple-500"
            >
              <option value="pending">Pending</option>
              <option value="succeeded">Approved</option>
              <option value="failed">Rejected/Failed</option>
              <option value="all">All</option>
            </select>
            <button
              type="button"
              onClick={loadPayoutRequestsList}
              disabled={payoutsLoading}
              className="rounded-md border border-purple-200 px-3 py-1.5 text-sm font-semibold text-purple-600 hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {payoutsLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
        {payoutsNotice && (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
            {payoutsNotice}
          </div>
        )}
        {payoutsError && (
          <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            {payoutsError}
          </div>
        )}
        <div className="mt-4">
          {payoutsLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-gray-500">
              Loading payout requests…
            </div>
          ) : payoutRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-16 text-center">
              <CheckCircleIcon className="h-10 w-10 text-gray-300" />
              <p className="mt-3 text-sm font-semibold text-gray-800">No payout requests found.</p>
              <p className="text-xs text-gray-500">Requests will appear here when managers submit payouts.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-100">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Request</th>
                    <th className="px-4 py-3 text-left">Amounts</th>
                    <th className="px-4 py-3 text-left">Method</th>
                    <th className="px-4 py-3 text-left">Requested</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {payoutRequests.map((txn) => {
                    const { feeAmount, netAmount } = extractPayoutFigures(txn);
                    const methodLabel =
                      (txn.metadata?.payoutAccountLabel as string) ?? 'Saved payout method';
                    const accountHolder =
                      (txn.metadata?.payoutAccountHolder as string) ?? txn.organizerId ?? txn.userId;
                    const statusClasses =
                      txn.status === 'succeeded'
                        ? 'bg-emerald-100 text-emerald-800'
                        : txn.status === 'failed'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-amber-100 text-amber-700';
                    return (
                      <tr key={txn.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 align-top">
                          <div className="text-sm font-semibold text-gray-900">{txn.reference ?? txn.id}</div>
                          <p className="text-xs text-gray-500">Organizer: {txn.organizerId ?? txn.userId}</p>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div className="text-sm font-semibold text-gray-900">
                            {formatAmount(txn.amount, txn.currency)}
                          </div>
                          <p className="text-xs text-gray-500">
                            Fee {formatAmount(feeAmount, txn.currency)} · Net{' '}
                            {formatAmount(netAmount, txn.currency)}
                          </p>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div className="text-sm font-semibold text-gray-900">{methodLabel}</div>
                          <p className="text-xs text-gray-500">{accountHolder}</p>
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-gray-600">
                          {new Date(txn.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-4 align-top">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClasses}`}>
                            {txn.status.charAt(0).toUpperCase() + txn.status.slice(1)}
                          </span>
                          {txn.metadata?.transferError && txn.status === 'failed' && (
                            <p className="mt-1 text-[11px] text-rose-600">
                              {String(txn.metadata.transferError)}
                            </p>
                          )}
                          {txn.metadata?.rejectionReason && (
                            <p className="mt-1 text-[11px] text-gray-500">
                              {String(txn.metadata.rejectionReason)}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-4 align-top text-right">
                          {txn.status === 'pending' ? (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleApprovePayout(txn)}
                                disabled={payoutActionId === txn.id}
                                className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 disabled:opacity-60"
                              >
                                {payoutActionId === txn.id ? 'Approving…' : 'Approve'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectPayout(txn)}
                                disabled={payoutActionId === txn.id}
                                className="rounded-full bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-200 disabled:opacity-60"
                              >
                                {payoutActionId === txn.id ? 'Working…' : 'Reject'}
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">No actions</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderPlatformWithdrawModal = () => {
    if (!isPlatformModalOpen || !platformBalance) return null;
    const numericAmount = Number(platformPayoutAmount);
    const feePreview =
      Number.isFinite(numericAmount) && numericAmount > 0
        ? getPlatformFeePreview(numericAmount, platformPayoutMethod)
        : null;
    const disableSubmit =
      platformPayoutProcessing ||
      numericAmount <= 0 ||
      numericAmount > platformAvailable ||
      (platformPayoutMethod === 'Bank'
        ? !platformBankAccountName.trim() ||
          !platformBankAccountNumber.trim() ||
          !platformBankCode.trim()
        : !platformMobileAccountName.trim() || !platformMobilePhone.trim());

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
        onClick={closePlatformModal}
      >
        <div
          className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-purple-400">Platform revenue</p>
              <h2 className="text-xl font-semibold text-gray-900">Withdraw funds</h2>
              <p className="text-xs text-gray-500">
                Available: {formatAmount(platformAvailable, platformCurrency)}
              </p>
            </div>
            <button
              onClick={closePlatformModal}
              className="rounded-full border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
            >
              ✕
            </button>
          </div>
          <form onSubmit={handlePlatformWithdrawSubmit} className="space-y-5 px-6 py-6">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Amount ({platformCurrency})
              </label>
              <input
                type="number"
                min={1}
                step={0.01}
                value={platformPayoutAmount}
                onChange={(e) => setPlatformPayoutAmount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Payout method
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPlatformPayoutMethod('Bank')}
                  className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
                    platformPayoutMethod === 'Bank'
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-gray-300 text-gray-600 hover:border-purple-200'
                  }`}
                >
                  Bank account
                </button>
                <button
                  type="button"
                  onClick={() => setPlatformPayoutMethod('MobileMoney')}
                  className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
                    platformPayoutMethod === 'MobileMoney'
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-gray-300 text-gray-600 hover:border-purple-200'
                  }`}
                >
                  Mobile money
                </button>
              </div>
            </div>
            {platformPayoutMethod === 'Bank' ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-gray-500">Account name</label>
                  <input
                    type="text"
                    value={platformBankAccountName}
                    onChange={(e) => setPlatformBankAccountName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Account number</label>
                  <input
                    type="text"
                    value={platformBankAccountNumber}
                    onChange={(e) => setPlatformBankAccountNumber(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Bank / Branch</label>
                  <input
                    type="text"
                    value={platformBankName}
                    onChange={(e) => setPlatformBankName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Sort code</label>
                  <input
                    type="text"
                    value={platformBankCode}
                    onChange={(e) => setPlatformBankCode(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:ring-purple-500"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-gray-500">Provider</label>
                  <select
                    value={platformMobileProvider}
                    onChange={(e) => setPlatformMobileProvider(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:ring-purple-500"
                  >
                    <option value="MTN">MTN</option>
                    <option value="Airtel">Airtel</option>
                    <option value="Zamtel">Zamtel</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Account name</label>
                  <input
                    type="text"
                    value={platformMobileAccountName}
                    onChange={(e) => setPlatformMobileAccountName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Phone number</label>
                  <input
                    type="text"
                    value={platformMobilePhone}
                    onChange={(e) => setPlatformMobilePhone(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:ring-purple-500"
                  />
                </div>
              </div>
            )}
            <div className="rounded-xl border border-purple-100 bg-purple-50 px-4 py-3 text-sm text-purple-800">
              {feePreview ? (
                feePreview.error ? (
                  <p>{feePreview.error}</p>
                ) : (
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Payout fee</span>
                      <span className="font-semibold">
                        {formatAmount(feePreview.fee, platformCurrency)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>You will receive</span>
                      <span className="font-semibold">
                        {formatAmount(feePreview.net, platformCurrency)}
                      </span>
                    </div>
                    <p className="text-xs text-purple-700/80">
                      Charges mirror Lenco’s manual payout schedule.
                    </p>
                  </div>
                )
              ) : (
                <p className="text-xs text-purple-700/80">
                  Enter an amount to preview payout fees.
                </p>
              )}
            </div>
            {platformPayoutModalError && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {platformPayoutModalError}
              </div>
            )}
            <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={closePlatformModal}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={disableSubmit}
                className="rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-purple-300"
              >
                {platformPayoutProcessing ? 'Sending…' : 'Send payout'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };
  const loadPayoutRequestsList = useCallback(async () => {
    setPayoutsLoading(true);
    setPayoutsError(null);
    try {
      const response = await getPayoutRequests(user, payoutStatusFilter);
      setPayoutRequests(response.data ?? []);
    } catch (err) {
      console.error('Failed to load payout requests', err);
      setPayoutRequests([]);
      setPayoutsError('Unable to load payout requests.');
    } finally {
      setPayoutsLoading(false);
    }
  }, [user, payoutStatusFilter]);

  const loadPlatformBalance = useCallback(async () => {
    setPlatformBalanceLoading(true);
    setPlatformError(null);
    try {
      const balance = await getPlatformBalance(user);
      setPlatformBalance(balance);
    } catch (err) {
      console.error('Failed to load platform balance', err);
      setPlatformBalance(null);
      setPlatformError('Unable to load platform revenue balance.');
    } finally {
      setPlatformBalanceLoading(false);
    }
  }, [user]);

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
    loadPlatformBalance();
  }, [loadSummary, loadTransactions, loadConfig, loadPlatformBalance]);

  useEffect(() => {
    if (activeTab === 'webhooks' && webhookLogs.length === 0 && !webhookLoading) {
      loadWebhooks(defaultWebhookFilters);
    }
  }, [activeTab, webhookLogs.length, webhookLoading, loadWebhooks]);

  useEffect(() => {
    if (activeTab === 'payouts') {
      loadPayoutRequestsList();
    }
  }, [activeTab, loadPayoutRequestsList]);

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
  const platformCurrency = platformBalance?.currency ?? currencyForDisplay;
  const platformAvailable = platformBalance?.available ?? 0;

  const extractPayoutFigures = (txn: GatewayTransaction) => {
    const feeAmount =
      typeof txn.metadata?.payoutFeeAmount === 'number'
        ? Number(txn.metadata?.payoutFeeAmount)
        : 0;
    const netAmount =
      typeof txn.metadata?.payoutNetAmount === 'number'
        ? Number(txn.metadata?.payoutNetAmount)
        : txn.amount - feeAmount;
    return { feeAmount, netAmount };
  };

  const getPlatformFeePreview = (
    amount: number,
    method: 'Bank' | 'MobileMoney'
  ):
    | { fee: number; net: number; error?: string }
    | null => {
    if (!platformBalance || amount <= 0) return null;
    const tiers =
      method === 'Bank'
        ? platformBalance.payoutFees.bankAccount ?? []
        : platformBalance.payoutFees.mobileMoney ?? [];
    if (tiers.length === 0) {
      return null;
    }
    const sorted = [...tiers].sort((a, b) => a.minAmount - b.minAmount);
    const minTier = sorted[0];
    if (amount < minTier.minAmount) {
      return {
        fee: minTier.fee,
        net: Math.max(amount - minTier.fee, 0),
        error: `Minimum payout for ${method === 'Bank' ? 'bank accounts' : 'mobile money'} is K${minTier.minAmount}.`,
      };
    }
    const matched =
      sorted.find(
        (tier) =>
          amount >= tier.minAmount && (tier.maxAmount == null || amount <= tier.maxAmount)
      ) ?? sorted[sorted.length - 1];
    return {
      fee: matched.fee,
      net: Math.max(amount - matched.fee, 0),
    };
  };

  const handleTransactionRowClick = async (transactionId: string) => {
    try {
      const data = await getPaymentTransactionById(user, transactionId);
      setSelectedTransaction(data);
    } catch (err) {
      console.error('Failed to load transaction detail', err);
    }
  };

  const handleVerifyTransaction = useCallback(
    async (transaction: GatewayTransaction) => {
      if (!transaction.reference) {
        setTransactionsError('Selected transaction is missing a reference and cannot be verified.');
        return;
      }
      setVerifyingReference(transaction.reference);
      setTransactionsNotice(null);
      setTransactionsError(null);
      try {
        const result = await verifyPaymentReference(transaction.reference);
        await loadTransactions(transactionFilters);
        if (result.transaction) {
          setSelectedTransaction(result.transaction as GatewayTransaction);
        }
        setTransactionsNotice(
          result.success
            ? `Transaction ${transaction.reference} synced successfully.`
            : `Verification completed. Latest status: ${result.status}.`
        );
      } catch (err) {
        console.error('Failed to verify transaction', err);
        setTransactionsError(err instanceof Error ? err.message : 'Verification failed.');
      } finally {
        setVerifyingReference(null);
      }
    },
    [loadTransactions, transactionFilters]
  );

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

  const handleApprovePayout = async (txn: GatewayTransaction) => {
    const { netAmount } = extractPayoutFigures(txn);
    const label = (txn.metadata?.payoutAccountLabel as string) ?? 'saved account';
    if (
      !window.confirm(
        `Approve sending ${formatAmount(netAmount, txn.currency)} to ${label}? This will trigger the transfer via Lenco.`
      )
    ) {
      return;
    }
    setPayoutActionId(txn.id);
    setPayoutsNotice(null);
    setPayoutsError(null);
    try {
      await approvePayoutRequest(user, txn.id);
      setPayoutsNotice('Payout transfer initiated successfully.');
      await Promise.all([loadPayoutRequestsList(), loadSummary()]);
    } catch (err) {
      console.error('Failed to approve payout request', err);
      setPayoutsError(err instanceof Error ? err.message : 'Unable to approve payout.');
    } finally {
      setPayoutActionId(null);
    }
  };

  const openPlatformModal = () => {
    if (!platformBalance) {
      setPlatformError('Platform balance is unavailable.');
      return;
    }
    const defaultAmount =
      platformBalance.available > 0 ? Math.min(platformBalance.available, platformBalance.available).toString() : '';
    setPlatformPayoutAmount(defaultAmount);
    setPlatformPayoutMethod('Bank');
    setPlatformBankName('');
    setPlatformBankCode('');
    setPlatformBankAccountName('Vibely Platform');
    setPlatformBankAccountNumber('');
    setPlatformMobileProvider('MTN');
    setPlatformMobileAccountName('Vibely Platform');
    setPlatformMobilePhone('');
    setPlatformPayoutModalError(null);
    setPlatformMessage(null);
    setIsPlatformModalOpen(true);
  };

  const closePlatformModal = () => {
    if (platformPayoutProcessing) return;
    setIsPlatformModalOpen(false);
  };

  const handleRejectPayout = async (txn: GatewayTransaction) => {
    const reason = window.prompt(
      'Add a rejection note (optional)',
      'Details missing for this payout request.'
    );
    if (reason === null) return;
    setPayoutActionId(txn.id);
    setPayoutsNotice(null);
    setPayoutsError(null);
    try {
      await rejectPayoutRequest(user, txn.id, reason?.trim() || undefined);
      setPayoutsNotice('Payout request rejected.');
      await loadPayoutRequestsList();
    } catch (err) {
      console.error('Failed to reject payout request', err);
      setPayoutsError(err instanceof Error ? err.message : 'Unable to reject payout.');
    } finally {
      setPayoutActionId(null);
    }
  };

  const handlePlatformWithdrawSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!platformBalance) {
      setPlatformPayoutModalError('Platform balance is unavailable.');
      return;
    }
    const numericAmount = Number(platformPayoutAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setPlatformPayoutModalError('Enter a valid amount.');
      return;
    }
    if (numericAmount > platformBalance.available) {
      setPlatformPayoutModalError('Amount exceeds available platform revenue.');
      return;
    }

    let destination: Record<string, string>;
    if (platformPayoutMethod === 'Bank') {
      if (!platformBankAccountName.trim() || !platformBankAccountNumber.trim() || !platformBankCode.trim()) {
        setPlatformPayoutModalError('Enter bank account name, number, and sort code.');
        return;
      }
      destination = {
        type: 'bank_account',
        accountName: platformBankAccountName.trim(),
        accountNumber: platformBankAccountNumber.trim(),
        bankCode: platformBankCode.trim(),
        bankName: platformBankName.trim() || undefined,
      };
    } else {
      if (!platformMobileAccountName.trim() || !platformMobilePhone.trim()) {
        setPlatformPayoutModalError('Enter mobile money account name and phone number.');
        return;
      }
      destination = {
        type: 'mobile_money',
        accountName: platformMobileAccountName.trim(),
        phoneNumber: platformMobilePhone.trim(),
        provider: platformMobileProvider,
      };
    }

    setPlatformPayoutProcessing(true);
    setPlatformPayoutModalError(null);
    try {
      const response = await requestPlatformPayout(user, {
        amount: numericAmount,
        destination,
      });
      setPlatformMessage(response.message ?? 'Platform payout completed successfully.');
      setIsPlatformModalOpen(false);
      await Promise.all([loadPlatformBalance(), loadSummary()]);
    } catch (err) {
      console.error('Failed to withdraw platform revenue', err);
      setPlatformPayoutModalError(
        err instanceof Error ? err.message : 'Unable to withdraw platform revenue.'
      );
    } finally {
      setPlatformPayoutProcessing(false);
    }
  };

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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-purple-50 border border-purple-100 rounded-2xl p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wider font-semibold text-purple-700">Platform revenue</p>
              <p className="text-2xl font-bold text-purple-900 mt-2">
                {formatAmount(
                  summary.platformRevenue ?? summary.platformFees + summary.subscriptionRevenue,
                  platformCurrency
                )}
              </p>
              <p className="text-[11px] text-purple-700/80 mt-1">
                Subscriptions + ticket commissions
              </p>
              <div className="mt-3 flex items-center justify-between text-xs text-purple-800">
                <span>
                  Available {platformBalanceLoading ? '…' : formatAmount(platformAvailable, platformCurrency)}
                </span>
                <button
                  type="button"
                  onClick={openPlatformModal}
                  disabled={platformBalanceLoading || platformAvailable <= 0}
                  className="rounded-full bg-white/80 px-3 py-1 font-semibold text-purple-700 shadow-sm ring-1 ring-purple-200 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Withdraw
                </button>
              </div>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wider font-semibold text-gray-500">Subscription revenue</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {formatAmount(summary.subscriptionRevenue, currencyForDisplay)}
              </p>
              <p className="text-[11px] text-gray-500 mt-1">Recurring organiser plans</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wider font-semibold text-gray-500">Ticket commissions</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {formatAmount(summary.platformFees, currencyForDisplay)}
              </p>
              <p className="text-[11px] text-gray-500 mt-1">Platform fee (%) retained per sale</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wider font-semibold text-amber-700">Payout fees (Lenco)</p>
              <p className="text-2xl font-bold text-amber-800 mt-2">
                {formatAmount(summary.payoutFees, currencyForDisplay)}
              </p>
              <p className="text-[11px] text-amber-700/80 mt-1">Pass-through charges owed to Lenco</p>
            </div>
          </div>

          {platformError && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
              {platformError}
            </div>
          )}
          {platformMessage && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
              {platformMessage}
            </div>
          )}

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

        {transactionsNotice && !transactionsLoading && !transactionsError && (
          <div className="px-5 py-3 text-sm text-emerald-600 bg-emerald-50 border-b border-emerald-100">
            {transactionsNotice}
          </div>
        )}

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
            { key: 'payouts', label: 'Payouts' },
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
        {activeTab === 'payouts' && renderPayoutsTab()}
        {activeTab === 'webhooks' && renderWebhooksTab()}
        {activeTab === 'config' && renderConfigTab()}
      </div>

      {renderPlatformWithdrawModal()}

      <TransactionDetailModal
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        onRequestRefund={handleRefund}
        onVerifyTransaction={handleVerifyTransaction}
        isVerifying={Boolean(
          selectedTransaction?.reference && verifyingReference === selectedTransaction?.reference
        )}
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
