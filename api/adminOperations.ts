import { db } from './db';
import { requireAdmin } from './utils/auth';
import {
  Event,
  RevenueRange,
  RevenueTrendPoint,
  RevenueTrendResponse,
  FunnelMetrics,
  RefundStatus,
  User,
} from '../types';

interface AdminRequest<T = unknown> {
  user: User | null;
  query?: Record<string, string | undefined>;
  body?: T;
}

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const parseRange = (value: string | undefined): RevenueRange => {
  if (value === '7d' || value === '30d' || value === '90d' || value === '365d') {
    return value;
  }
  return '30d';
};

const RANGE_TO_DAYS: Record<RevenueRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '365d': 365,
};

const matchesFilters = (
  event: Event | undefined,
  category?: string,
  organizerId?: string
) => {
  if (!event) return false;
  const categoryMatch = !category || category === 'all' || event.category === category;
  const organizerMatch = !organizerId || organizerId === 'all' || event.organizer.id === organizerId;
  return categoryMatch && organizerMatch;
};

export async function handleAdminGetRevenueTrends(req: AdminRequest) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const range = parseRange(req.query?.range);
  const category = req.query?.category;
  const organizerId = req.query?.organizerId;

  const events = db.events.findAll();
  const transactions = db.gatewayTransactions.findAll();

  const eventMap = new Map(events.map((event) => [event.id, event]));
  const now = new Date();
  const start = new Date(now.getTime() - RANGE_TO_DAYS[range] * 24 * 60 * 60 * 1000);

  const dayKey = (date: Date) => {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy.toISOString().split('T')[0];
  };

  const pointsMap = new Map<string, { gross: number; refunds: number }>();
  let totalGross = 0;
  let totalRefunds = 0;

  for (const txn of transactions) {
    const createdAt = new Date(txn.createdAt);
    if (createdAt < start || createdAt > now) continue;

    const event = txn.eventId ? eventMap.get(txn.eventId) : undefined;
    if (!matchesFilters(event, category, organizerId)) continue;
    if (txn.status === 'failed' || txn.status === 'pending') continue;

    const key = dayKey(createdAt);
    if (!pointsMap.has(key)) {
      pointsMap.set(key, { gross: 0, refunds: 0 });
    }
    const bucket = pointsMap.get(key)!;

    if (txn.status === 'succeeded') {
      bucket.gross += txn.amount;
      totalGross += txn.amount;
    } else if (txn.status === 'refunded') {
      bucket.refunds += txn.amount;
      totalRefunds += txn.amount;
    }
  }

  const points: RevenueTrendPoint[] = Array.from(pointsMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({
      date,
      gross: Number(values.gross.toFixed(2)),
      refunds: Number(values.refunds.toFixed(2)),
      net: Number((values.gross - values.refunds).toFixed(2)),
    }));

  const response: RevenueTrendResponse = {
    points,
    summary: {
      totalGross: Number(totalGross.toFixed(2)),
      totalRefunds: Number(totalRefunds.toFixed(2)),
      totalNet: Number((totalGross - totalRefunds).toFixed(2)),
    },
  };

  return jsonResponse(response);
}

export async function handleAdminGetFunnelMetrics(req: AdminRequest) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const range = parseRange(req.query?.range);
  const category = req.query?.category;
  const organizerId = req.query?.organizerId;

  const events = db.events.findAll();
  const eventMap = new Map(events.map((event) => [event.id, event]));
  const filteredEvents = events.filter((event) => matchesFilters(event, category, organizerId));
  const transactions = db.gatewayTransactions.findAll().filter((txn) => {
    if (txn.status !== 'succeeded') return false;
    const ev = txn.eventId ? eventMap.get(txn.eventId) : undefined;
    return matchesFilters(ev, category, organizerId);
  });

  const days = RANGE_TO_DAYS[range];
  const publishedEvents = filteredEvents.filter((event) => event.status === 'published');
  const eventCount = Math.max(publishedEvents.length, 1);
  const successfulPurchases = transactions.length;

  const pageViews = eventCount * 600 + days * 25;
  const detailViews = Math.floor(pageViews * 0.6 + successfulPurchases * 15);
  const addToCart = Math.floor(detailViews * 0.4 + successfulPurchases * 8);
  const ticketsPurchased = successfulPurchases;
  const conversionRate = pageViews === 0 ? 0 : Number(((ticketsPurchased / pageViews) * 100).toFixed(2));
  const dropOffRate = Number((100 - conversionRate).toFixed(2));

  const funnel: FunnelMetrics = {
    pageViews,
    eventDetailViews: detailViews,
    addToCart,
    ticketsPurchased,
    conversionRate,
    dropOffRate,
  };

  return jsonResponse(funnel);
}

export async function handleAdminGetRefundCases(req: AdminRequest) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const status = req.query?.status as RefundStatus | 'all' | undefined;
  let cases = db.refundCases.findAll();
  if (status && status !== 'all') {
    cases = cases.filter((refundCase) => refundCase.status === status);
  }

  return jsonResponse({ data: cases });
}

export async function handleAdminUpdateRefundCase(
  req: AdminRequest<{ caseId: string; status: RefundStatus; note?: string }>
) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const { caseId, status, note } = req.body ?? {};
  if (!caseId || !status) {
    return jsonResponse({ message: 'caseId and status are required.' }, 400);
  }

  const updated = db.refundCases.updateStatus(caseId, status, note ? {
    authorId: req.user!.id,
    message: note,
  } : undefined);

  if (!updated) {
    return jsonResponse({ message: 'Refund case not found.' }, 404);
  }

  db.auditLogs.create({
    actorId: req.user!.id,
    targetUserId: req.user!.id,
    action: 'refund_case_update',
    details: `Updated refund case ${caseId} to ${status}`,
  });

  return jsonResponse(updated);
}
