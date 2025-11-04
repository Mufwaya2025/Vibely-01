import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Event,
  FunnelMetrics,
  RefundCase,
  RefundStatus,
  RevenueTrendPoint,
  RevenueTrendResponse,
  User,
} from '../../../types';
import {
  getRevenueTrends,
  getFunnelMetrics,
  getRefundCases,
  updateRefundCase,
} from '../../../services/adminService';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from 'recharts';

interface OperationalMetricsPanelProps {
  currentUser: User;
  events: Event[];
}

type RevenueFilters = {
  range: '7d' | '30d' | '90d' | '365d';
  category: string;
  organizerId: string;
};

type RefundFilter = RefundStatus | 'all';

const RANGE_OPTIONS: { label: string; value: RevenueFilters['range'] }[] = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'Last 12 months', value: '365d' },
];

const REFUND_STATUS_OPTIONS: { label: string; value: RefundFilter }[] = [
  { label: 'All cases', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'In review', value: 'in_review' },
  { label: 'Escalated', value: 'escalated' },
  { label: 'Resolved', value: 'resolved' },
];

const STATUS_LABELS: Record<RefundStatus, string> = {
  open: 'Open',
  in_review: 'In review',
  resolved: 'Resolved',
  escalated: 'Escalated',
};

const STATUS_COLORS: Record<RefundStatus, string> = {
  open: 'bg-amber-100 text-amber-700',
  in_review: 'bg-blue-100 text-blue-700',
  resolved: 'bg-emerald-100 text-emerald-700',
  escalated: 'bg-rose-100 text-rose-700',
};

const OperationalMetricsPanel: React.FC<OperationalMetricsPanelProps> = ({ currentUser, events }) => {
  const [filters, setFilters] = useState<RevenueFilters>({ range: '30d', category: 'all', organizerId: 'all' });
  const [refundFilter, setRefundFilter] = useState<RefundFilter>('all');
  const [revenueData, setRevenueData] = useState<RevenueTrendResponse | null>(null);
  const [funnelMetrics, setFunnelMetrics] = useState<FunnelMetrics | null>(null);
  const [refundCases, setRefundCases] = useState<RefundCase[]>([]);
  const [loadingRevenue, setLoadingRevenue] = useState(false);
  const [loadingFunnel, setLoadingFunnel] = useState(false);
  const [loadingRefunds, setLoadingRefunds] = useState(false);
  const [updatingRefundId, setUpdatingRefundId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const categoryOptions = useMemo(() => {
    const categories = Array.from(new Set(events.map((event) => event.category))).sort();
    return ['all', ...categories];
  }, [events]);

  const organizerOptions = useMemo(() => {
    const organizers = Array.from(
      new Map(events.map((event) => [event.organizer.id, event.organizer.name])).entries()
    ).sort((a, b) => a[1].localeCompare(b[1]));
    return [{ id: 'all', name: 'All organizers' }, ...organizers.map(([id, name]) => ({ id, name }))];
  }, [events]);

  const resetMessages = () => {
    setFeedbackMessage(null);
    setErrorMessage(null);
  };

  const fetchRevenue = useCallback(async () => {
    try {
      setLoadingRevenue(true);
      const query: Record<string, string> = { range: filters.range };
      if (filters.category !== 'all') query.category = filters.category;
      if (filters.organizerId !== 'all') query.organizerId = filters.organizerId;
      const data = await getRevenueTrends(currentUser, query);
      setRevenueData(data);
    } catch (err) {
      console.error('Failed to load revenue trends', err);
      setErrorMessage('Unable to load revenue metrics.');
    } finally {
      setLoadingRevenue(false);
    }
  }, [currentUser, filters]);

  const fetchFunnel = useCallback(async () => {
    try {
      setLoadingFunnel(true);
      const query: Record<string, string> = { range: filters.range };
      if (filters.category !== 'all') query.category = filters.category;
      if (filters.organizerId !== 'all') query.organizerId = filters.organizerId;
      const data = await getFunnelMetrics(currentUser, query);
      setFunnelMetrics(data);
    } catch (err) {
      console.error('Failed to load funnel metrics', err);
      setErrorMessage('Unable to load funnel statistics.');
    } finally {
      setLoadingFunnel(false);
    }
  }, [currentUser, filters]);

  const fetchRefunds = useCallback(async () => {
    try {
      setLoadingRefunds(true);
      const response = await getRefundCases(currentUser, refundFilter === 'all' ? undefined : refundFilter);
      setRefundCases(response.data ?? []);
    } catch (err) {
      console.error('Failed to load refund dashboard', err);
      setErrorMessage('Unable to load refund dashboard.');
    } finally {
      setLoadingRefunds(false);
    }
  }, [currentUser, refundFilter]);

  useEffect(() => {
    resetMessages();
    fetchRevenue();
    fetchFunnel();
  }, [fetchRevenue, fetchFunnel]);

  useEffect(() => {
    resetMessages();
    fetchRefunds();
  }, [fetchRefunds]);

  const handleRefundStatusUpdate = async (caseId: string, status: RefundStatus) => {
    if (updatingRefundId) return;
    try {
      setUpdatingRefundId(caseId);
      await updateRefundCase(currentUser, { caseId, status });
      setFeedbackMessage('Refund case updated successfully.');
      await fetchRefunds();
    } catch (err) {
      console.error('Failed to update refund case', err);
      setErrorMessage('Unable to update refund case.');
    } finally {
      setUpdatingRefundId(null);
    }
  };

  const revenuePoints = revenueData?.points ?? [];
  const revenueSummary = revenueData?.summary ?? {
    totalGross: 0,
    totalRefunds: 0,
    totalNet: 0,
  };
  const formatCurrency = (value: number) => `K${value.toLocaleString()}`;

  const funnelSteps = funnelMetrics
    ? [
        { label: 'Page views', value: funnelMetrics.pageViews },
        { label: 'Event detail views', value: funnelMetrics.eventDetailViews },
        { label: 'Add to cart', value: funnelMetrics.addToCart },
        { label: 'Tickets sold', value: funnelMetrics.ticketsPurchased },
      ]
    : [];

  const isSlaBreached = (slaDueAt: string) => new Date(slaDueAt).getTime() < Date.now();
  const slaWindowLabel = (slaDueAt: string) => {
    const due = new Date(slaDueAt);
    const diffHours = Math.floor((due.getTime() - Date.now()) / (60 * 60 * 1000));
    if (diffHours < 0) return `${Math.abs(diffHours)}h overdue`;
    if (diffHours < 24) return `${diffHours}h remaining`;
    return `${Math.ceil(diffHours / 24)}d remaining`;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-end md:space-x-4 space-y-4 md:space-y-0">
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">
              Time range
            </label>
            <select
              value={filters.range}
              onChange={(event) => setFilters((prev) => ({ ...prev, range: event.target.value as RevenueFilters['range'] }))}
              className="w-full md:w-44 rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">
              Category
            </label>
            <select
              value={filters.category}
              onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category === 'all' ? 'All categories' : category}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">
              Organizer
            </label>
            <select
              value={filters.organizerId}
              onChange={(event) => setFilters((prev) => ({ ...prev, organizerId: event.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {organizerOptions.map((organizer) => (
                <option key={organizer.id} value={organizer.id}>
                  {organizer.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {(feedbackMessage || errorMessage) && (
          <div
            className={`rounded-lg px-4 py-3 text-sm ${
              feedbackMessage
                ? 'bg-emerald-50 border border-emerald-100 text-emerald-700'
                : 'bg-rose-50 border border-rose-100 text-rose-700'
            }`}
          >
            {feedbackMessage ?? errorMessage}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-md border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Revenue trends</h3>
          <button
            onClick={fetchRevenue}
            className="text-xs font-semibold text-gray-500 hover:text-gray-700"
          >
            Refresh
          </button>
        </div>
        {loadingRevenue ? (
          <div className="p-10 text-center text-gray-500">Loading revenue metrics…</div>
        ) : revenuePoints.length === 0 ? (
          <div className="p-10 text-center text-gray-500">No revenue data available for this range.</div>
        ) : (
          <div className="px-6 py-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-3">
                <p className="text-xs uppercase tracking-wider font-semibold text-purple-600">Gross revenue</p>
                <p className="text-2xl font-bold text-purple-700 mt-1">{formatCurrency(revenueSummary.totalGross)}</p>
              </div>
              <div className="bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">
                <p className="text-xs uppercase tracking-wider font-semibold text-rose-600">Refunds</p>
                <p className="text-2xl font-bold text-rose-700 mt-1">{formatCurrency(revenueSummary.totalRefunds)}</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                <p className="text-xs uppercase tracking-wider font-semibold text-emerald-600">Net revenue</p>
                <p className="text-2xl font-bold text-emerald-700 mt-1">{formatCurrency(revenueSummary.totalNet)}</p>
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenuePoints}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="date" stroke="#6B7280" fontSize={12} tickLine={false} />
                  <YAxis stroke="#6B7280" fontSize={12} tickLine={false} width={80} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="gross" stroke="#7C3AED" strokeWidth={3} dot={false} name="Gross" />
                  <Line type="monotone" dataKey="refunds" stroke="#F87171" strokeWidth={2} dot={false} name="Refunds" />
                  <Line type="monotone" dataKey="net" stroke="#10B981" strokeWidth={3} dot={false} name="Net" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-md border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Conversion funnel</h3>
          <button
            onClick={fetchFunnel}
            className="text-xs font-semibold text-gray-500 hover:text-gray-700"
          >
            Refresh
          </button>
        </div>
        {loadingFunnel ? (
          <div className="p-10 text-center text-gray-500">Calculating funnel metrics…</div>
        ) : funnelMetrics ? (
          <div className="px-6 py-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                  <p className="text-xs uppercase tracking-wider font-semibold text-gray-500">Page view → purchase</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{funnelMetrics.conversionRate}%</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                  <p className="text-xs uppercase tracking-wider font-semibold text-gray-500">Drop-off</p>
                  <p className="text-2xl font-bold text-rose-600 mt-1">{funnelMetrics.dropOffRate}%</p>
                </div>
              </div>
              <ul className="space-y-2">
                {funnelSteps.map((step) => (
                  <li key={step.label} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
                    <span className="text-sm font-semibold text-gray-600">{step.label}</span>
                    <span className="text-sm font-bold text-gray-900">{step.value.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:col-span-3 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelSteps}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="label" stroke="#6B7280" fontSize={12} tickLine={false} />
                  <YAxis stroke="#6B7280" fontSize={12} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#7C3AED" radius={[12, 12, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="p-10 text-center text-gray-500">No funnel data available.</div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-md border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Refund & chargeback queue</h3>
            <p className="text-xs text-gray-500">Monitor outstanding cases and keep SLAs on track.</p>
          </div>
          <div className="flex items-center space-x-3">
            <select
              value={refundFilter}
              onChange={(event) => setRefundFilter(event.target.value as RefundFilter)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {REFUND_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              onClick={fetchRefunds}
              className="px-3 py-1.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
        {loadingRefunds ? (
          <div className="p-10 text-center text-gray-500">Loading refund cases…</div>
        ) : refundCases.length === 0 ? (
          <div className="p-10 text-center text-gray-500">No refund cases to review.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Event</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">SLA</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {refundCases.map((refundCase) => (
                  <tr key={refundCase.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{refundCase.customerName}</p>
                      <p className="text-xs text-gray-500">Transaction {refundCase.transactionId}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{events.find((event) => event.id === refundCase.eventId)?.title ?? refundCase.eventId}</td>
                    <td className="px-4 py-3 text-gray-900 font-semibold">
                      {refundCase.currency} {refundCase.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[refundCase.status]}`}>
                        {STATUS_LABELS[refundCase.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold ${isSlaBreached(refundCase.slaDueAt) ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {slaWindowLabel(refundCase.slaDueAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {(['open', 'in_review', 'escalated', 'resolved'] as RefundStatus[])
                          .filter((status) => status !== refundCase.status)
                          .slice(0, 2)
                          .map((status) => (
                            <button
                              key={status}
                              onClick={() => handleRefundStatusUpdate(refundCase.id, status)}
                              disabled={updatingRefundId === refundCase.id}
                              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                                status === 'resolved'
                                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                  : status === 'escalated'
                                  ? 'bg-rose-600 text-white hover:bg-rose-700'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              } ${updatingRefundId === refundCase.id ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                              {STATUS_LABELS[status]}
                            </button>
                          ))}
                      </div>
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
};

export default OperationalMetricsPanel;
