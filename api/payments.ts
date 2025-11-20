import { db } from "./db";
import crypto from "crypto";
import { GatewayTransaction, GatewayTransactionStatus, PaymentMethod, Ticket, User, Event } from "../types";
import { isLencoConfigured, lencoConfig } from "../server/config/lencoConfig";
import {
  createReference,
  verifyCollection,
  computeWebhookSignature,
  LencoClientError,
} from "../server/services/lencoClient";

const PAYMENT_PROVIDER = "Lenco";

type PaymentPurpose = "ticket" | "subscription";
type PaymentChannel = "card" | "mobile-money";

interface PaymentSessionBody {
  userId: string;
  purpose: PaymentPurpose;
  amount: number;
  currency?: string;
  eventId?: string;
  metadata?: Record<string, unknown>;
  channels?: PaymentMethod[];
  customer?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
  label?: string;
}

const mapMethodsToChannels = (methods?: PaymentMethod[]): PaymentChannel[] => {
  if (!methods || methods.length === 0) {
    return ["card", "mobile-money"];
  }
  const set = new Set<PaymentChannel>();
  methods.forEach((method) => {
    if (method === "MobileMoney") {
      set.add("mobile-money");
    }
    if (method === "CreditCard") {
      set.add("card");
    }
  });
  const channels = Array.from(set);
  return channels.length > 0 ? channels : ["card", "mobile-money"];
};

const resolveUserNames = (user: User) => {
  const parts = user.name.split(" ");
  const firstName = parts[0] ?? user.name;
  const lastName = parts.slice(1).join(" ");
  return { firstName, lastName };
};

const issueTicketForTransaction = (txn: GatewayTransaction): Ticket | null => {
  if (txn.purpose !== "ticket") {
    return null;
  }
  if (txn.ticketId) {
    return null;
  }
  if (!txn.eventId) {
    return null;
  }

  const event = db.events.findById(txn.eventId);
  const user = db.users.findById(txn.userId);
  if (!event || !user) {
    return null;
  }

  const ticketId = `tkt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  const ticketRecord = db.tickets.create({
    ticketId,
    eventId: event.id,
    userId: user.id,
    purchaseDate: now,
    status: "valid",
    code: ticketId,
    holderName: user.name,
    holderEmail: user.email,
  } as any);

  db.gatewayTransactions.attachTicket(txn.id, ticketId);
  db.events.update(event.id, {
    ticketsSold: (event.ticketsSold ?? 0) + 1,
  });

  const issuedTicket: Ticket = {
    ticketId: ticketRecord.ticketId,
    eventId: ticketRecord.eventId,
    code: ticketRecord.code ?? ticketRecord.ticketId,
    status: ticketRecord.status as Ticket["status"],
    holderName: ticketRecord.holderName ?? user.name,
    holderEmail: ticketRecord.holderEmail ?? user.email,
    createdAt: ticketRecord.purchaseDate ?? now,
  };

  return issuedTicket;
};

export async function handleCreatePaymentSession(req: { body: PaymentSessionBody }) {
  if (!isLencoConfigured()) {
    return new Response(JSON.stringify({ message: "Lenco gateway is not configured." }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { userId, purpose, amount, currency, eventId, metadata, channels, customer, label } = req.body ?? {};

  if (!userId || !purpose || !amount) {
    return new Response(JSON.stringify({ message: "userId, purpose, and amount are required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const user = db.users.findById(userId);
  if (!user) {
    return new Response(JSON.stringify({ message: "User not found." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const resolvedCurrency = currency || lencoConfig.currency;
  const reference = createReference(purpose === "ticket" ? "ticket" : "sub");
  const resolvedChannels = mapMethodsToChannels(channels);

  let event: Event | null = null;
  if (purpose === "ticket") {
    if (!eventId) {
      return new Response(JSON.stringify({ message: "eventId is required for ticket payments." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    event = db.events.findById(eventId);
    if (!event) {
      return new Response(JSON.stringify({ message: "Event not found." }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  if (purpose === "subscription") {
    db.gatewayTransactions.deleteWhere(
      (txn) => txn.userId === userId && txn.purpose === "subscription" && txn.status !== "succeeded"
    );
  }

  db.gatewayTransactions.create({
    externalId: "pending",
    reference,
    purpose,
    eventId: event?.id,
    userId,
    organizerId: event?.organizer.id,
    amount,
    currency: resolvedCurrency,
    status: "pending",
    provider: PAYMENT_PROVIDER,
    metadata: {
      ...metadata,
      channels: resolvedChannels,
      label,
    },
  });

  const { firstName, lastName } = resolveUserNames(user);

  return new Response(
    JSON.stringify({
      reference,
      publicKey: lencoConfig.publicKey,
      amount,
      currency: resolvedCurrency,
      email: user.email,
      channels: resolvedChannels,
      label:
        label ||
        (purpose === "ticket" && event
          ? `Ticket purchase - ${event.title}`
          : "Vibely Subscription"),
      customer: {
        firstName: customer?.firstName ?? firstName,
        lastName: customer?.lastName ?? lastName,
        phone: customer?.phone,
      },
      widgetUrl: lencoConfig.widgetUrl,
      mockMode: lencoConfig.mockMode,
    }),
    {
      status: 201,
      headers: { "Content-Type": "application/json" },
    }
  );
}

interface VerifyPaymentBody {
  reference: string;
}

const mapCollectionStatus = (status: string): GatewayTransactionStatus => {
  switch (status.toLowerCase()) {
    case "successful":
      return "succeeded";
    case "failed":
      return "failed";
    case "pending":
    default:
      return "pending";
  }
};

export async function handleVerifyPayment(req: { body: VerifyPaymentBody }) {
  const { reference } = req.body ?? {};
  if (!reference) {
    return new Response(JSON.stringify({ message: "reference is required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const existing = db.gatewayTransactions.findByReference(reference);
  if (!existing) {
    return new Response(JSON.stringify({ message: "Transaction not found." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const verification = await verifyCollection(reference);
    const data = verification.data;
    const mappedStatus: GatewayTransactionStatus = data ? mapCollectionStatus(data.status) : "pending";

    const updated =
      db.gatewayTransactions.updateByReference(reference, {
        status: mappedStatus,
        externalId: data?.id || existing.externalId,
        lencoReference: data?.lencoReference || existing.lencoReference,
        fee: data?.fee ? parseFloat(data.fee) : existing.fee,
        bearer: data?.bearer === "customer" ? "customer" : "merchant",
        channel: data?.type || existing.channel,
        rawResponse: data ? { ...data } : existing.rawResponse,
      }) ?? existing;

    let issuedTicket: Ticket | null = null;
    if (mappedStatus === "succeeded" && updated.purpose === "ticket" && !updated.ticketId) {
      issuedTicket = issueTicketForTransaction(updated);
      if (issuedTicket) {
        const refreshed = db.gatewayTransactions.findByReference(reference);
        if (refreshed) {
          Object.assign(updated, refreshed);
        }
      }
    }

    let updatedUser: User | null = null;
    if (mappedStatus === "succeeded" && updated.purpose === "subscription") {
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      updatedUser = db.users.updateSubscription(updated.userId, "Pro", expiresAt.toISOString());
    }

    return new Response(
      JSON.stringify({
        success: mappedStatus === "succeeded",
        status: mappedStatus,
        transaction: updated,
        updatedUser,
        issuedTicket,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    if (error instanceof LencoClientError) {
      return new Response(JSON.stringify({ message: error.message }), {
        status: error.status ?? 502,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.error('Failed to verify payment', error);
    return new Response(JSON.stringify({ message: 'Failed to verify payment.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function handleAttachTicketToTransaction(req: {
  body: { transactionId: string; ticketId: string };
}) {
  const { transactionId, ticketId } = req.body;
  if (!transactionId || !ticketId) {
    return new Response(JSON.stringify({ message: 'transactionId and ticketId required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const updated = db.gatewayTransactions.attachTicket(transactionId, ticketId);
  if (!updated) {
    return new Response(JSON.stringify({ message: 'Transaction not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(updated), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface PayoutRequestBody {
  organizerId: string;
  amount?: number;
  payoutMethodId: string;
  narration?: string;
  currency?: string;
}

const getPlatformFeePercent = () => db.platformSettings.get().platformFeePercent ?? 0;
const getPayoutFeeSettings = () => db.platformSettings.get().payoutFees;

const resolvePayoutFee = (amount: number, methodType: 'Bank' | 'MobileMoney') => {
  const settings = getPayoutFeeSettings();
  const tiers =
    methodType === 'Bank'
      ? settings.bankAccount ?? []
      : settings.mobileMoney ?? [];

  if (!Array.isArray(tiers) || tiers.length === 0) {
    return 0;
  }

  const sorted = [...tiers].sort((a, b) => a.minAmount - b.minAmount);
  const firstTier = sorted[0];
  if (amount < firstTier.minAmount) {
    throw new Error(
      `Minimum payout for ${methodType === 'Bank' ? 'bank accounts' : 'mobile money'} is ${firstTier.minAmount}.`
    );
  }

  const matched =
    sorted.find((tier) => {
      const maxMatch = tier.maxAmount == null || amount <= tier.maxAmount;
      return amount >= tier.minAmount && maxMatch;
    }) ?? sorted[sorted.length - 1];

  return matched.fee;
};

const calculateOrganizerFinancials = (organizerId: string) => {
  const transactions = db.gatewayTransactions.findAll();
  const successfulSales = transactions.filter(
    (txn) => txn.purpose === 'ticket' && txn.organizerId === organizerId && txn.status === 'succeeded'
  );
  const payouts = transactions.filter((txn) => txn.purpose === 'payout' && txn.organizerId === organizerId);

  const gross = successfulSales.reduce((sum, txn) => sum + txn.amount, 0);
  const lencoFees = successfulSales.reduce((sum, txn) => sum + (txn.fee ?? 0), 0);
  const platformFeePercent = getPlatformFeePercent();
  const platformFees = successfulSales.reduce((sum, txn) => sum + (txn.amount * platformFeePercent) / 100, 0);
  const successfulPayouts = payouts.filter((txn) => txn.status === 'succeeded');
  const pendingPayouts = payouts.filter((txn) => txn.status === 'pending');
  const paidOut = successfulPayouts.reduce((sum, txn) => sum + txn.amount, 0);
  const pendingAmount = pendingPayouts.reduce((sum, txn) => sum + txn.amount, 0);
  const available = gross - lencoFees - platformFees - paidOut - pendingAmount;

  return {
    gross,
    lencoFees,
    platformFees,
    paidOut,
    pendingPayouts: pendingAmount,
    available,
    currency: lencoConfig.currency,
  };
};

const calculateAvailableBalance = (organizerId: string) => calculateOrganizerFinancials(organizerId).available;

export async function handleInitiatePayout(req: { body: PayoutRequestBody }) {
  const { organizerId, amount, payoutMethodId, narration, currency } = req.body ?? {};
  if (!organizerId || !payoutMethodId) {
    return new Response(
      JSON.stringify({ message: 'organizerId and payoutMethodId are required.' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const payoutMethod = db.payoutMethods.findById(payoutMethodId);
  if (!payoutMethod || payoutMethod.userId !== organizerId) {
    return new Response(JSON.stringify({ message: 'Payout method not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const available = calculateAvailableBalance(organizerId);
  const payoutAmount = typeof amount === 'number' ? amount : available;

  if (payoutAmount <= 0) {
    return new Response(JSON.stringify({ message: 'No balance available for payout.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (payoutAmount > available) {
    return new Response(JSON.stringify({ message: 'Requested amount exceeds available balance.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let feeAmount = 0;
  try {
    feeAmount = resolvePayoutFee(payoutAmount, payoutMethod.type);
  } catch (err) {
    return new Response(
      JSON.stringify({ message: err instanceof Error ? err.message : 'Unable to calculate payout fee.' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  if (payoutAmount <= feeAmount) {
    return new Response(
      JSON.stringify({ message: 'Payout amount must be greater than the payout fee.' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const netAmount = payoutAmount - feeAmount;
  const reference = createReference('payout');

  const metadata = {
    payoutMethodId,
    payoutMethodType: payoutMethod.type,
    payoutAccountLabel: payoutMethod.details,
    payoutAccountHolder: payoutMethod.accountInfo,
    payoutFeeAmount: feeAmount,
    payoutNetAmount: netAmount,
    narration: narration || 'Manual payout request',
    requiresManualApproval: true,
  };

  const payoutTxn = db.gatewayTransactions.create({
    externalId: reference,
    reference,
    purpose: 'payout',
    userId: organizerId,
    organizerId,
    amount: payoutAmount,
    currency: currency || lencoConfig.currency,
    status: 'pending',
    provider: PAYMENT_PROVIDER,
    metadata,
  });

  return new Response(
    JSON.stringify({
      status: 'pending' as GatewayTransactionStatus,
      transaction: payoutTxn,
      feeAmount,
      netAmount,
      availableBalance: calculateAvailableBalance(organizerId),
      message: `Payout request submitted. Once approved you'll receive ${netAmount.toFixed(
        2
      )} after a ${feeAmount.toFixed(2)} payout fee.`,
    }),
    {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

export async function handleGetOrganizerBalance(req: { params?: { organizerId?: string }; query?: { organizerId?: string } }) {
  const organizerId = req.params?.organizerId || req.query?.organizerId;
  if (!organizerId) {
    return new Response(JSON.stringify({ message: 'organizerId is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const financials = calculateOrganizerFinancials(organizerId);

  return new Response(JSON.stringify({
    organizerId,
    currency: financials.currency,
    totals: {
      gross: financials.gross,
      lencoFees: financials.lencoFees,
      platformFees: financials.platformFees,
      paidOut: financials.paidOut,
      pendingPayouts: financials.pendingPayouts,
    },
    payoutFees: db.platformSettings.get().payoutFees,
    availableBalance: financials.available,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleGetOrganizerTransactions(req: {
  params?: { organizerId?: string };
  query?: { organizerId?: string; limit?: string };
}) {
  const organizerId = req.params?.organizerId || req.query?.organizerId;
  if (!organizerId) {
    return new Response(JSON.stringify({ message: 'organizerId is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const limit = req.query?.limit ? parseInt(req.query.limit, 10) : undefined;

  const transactions = db.gatewayTransactions
    .findAll()
    .filter((txn) => txn.organizerId === organizerId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const sliced = typeof limit === 'number' && !Number.isNaN(limit) ? transactions.slice(0, limit) : transactions;

  const mapped = sliced.map((txn) => {
    const event = txn.eventId ? db.events.findById(txn.eventId) : null;
    let type: 'Sale' | 'Payout' | 'Fee' | 'Refund' = 'Sale';
    let amount = txn.amount;
    let description = '';

    if (txn.purpose === 'payout') {
      type = 'Payout';
      amount = -Math.abs(txn.amount);
      const fee = typeof txn.metadata?.payoutFeeAmount === 'number' ? txn.metadata.payoutFeeAmount : null;
      const net = typeof txn.metadata?.payoutNetAmount === 'number' ? txn.metadata.payoutNetAmount : null;
      const label = txn.metadata?.payoutAccountLabel ? ` → ${String(txn.metadata.payoutAccountLabel)}` : '';
      description =
        fee !== null && net !== null
          ? `Payout request${label}. Net ${net.toFixed(2)} after fee ${fee.toFixed(2)}.`
          : `Payout request${label}`;
    } else if (txn.status === 'refunded') {
      type = 'Refund';
      amount = -Math.abs(txn.amount);
      description = 'Ticket refund';
    } else {
      type = 'Sale';
      description = txn.metadata?.label ? String(txn.metadata.label) : 'Ticket sale';
    }

    return {
      id: txn.id,
      type,
      amount,
      date: txn.updatedAt,
      description,
      eventTitle: event?.title,
    };
  });

  return new Response(JSON.stringify({ data: mapped }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleGetSubscriptionTransactions(req: {
  user?: User | null;
  query?: { userId?: string };
}) {
  const requester = req.user ?? null;
  const targetUserId = req.query?.userId ?? requester?.id;

  if (!targetUserId) {
    return new Response(JSON.stringify({ message: 'userId is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (requester && requester.role !== 'admin' && requester.id !== targetUserId) {
    return new Response(JSON.stringify({ message: 'Not authorized to view these transactions.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const transactions = db.gatewayTransactions
    .findAll()
    .filter((txn) => txn.userId === targetUserId && txn.purpose === 'subscription')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map((txn) => ({
      id: txn.id,
      reference: txn.reference ?? txn.lencoReference ?? txn.externalId,
      status: txn.status,
      amount: txn.amount,
      currency: txn.currency,
      provider: txn.provider,
      paymentMethod: txn.paymentMethod ?? null,
      channel: txn.channel ?? null,
      createdAt: txn.createdAt,
      updatedAt: txn.updatedAt,
      metadata: txn.metadata ?? null,
    }));

  return new Response(JSON.stringify({ data: transactions }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleGetUserTransactions(req: {
  user?: User | null;
  query?: { userId?: string };
}) {
  const requester = req.user ?? null;
  const targetUserId = req.query?.userId ?? requester?.id;

  if (!targetUserId) {
    return new Response(JSON.stringify({ message: 'userId is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (requester && requester.role !== 'admin' && requester.id !== targetUserId) {
    return new Response(JSON.stringify({ message: 'Not authorized to view these transactions.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const transactions = db.gatewayTransactions
    .findAll()
    .filter((txn) => txn.userId === targetUserId && txn.purpose !== 'payout')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map((txn) => {
      const event = txn.eventId ? db.events.findById(txn.eventId) : null;
      const reference = txn.reference ?? txn.lencoReference ?? txn.externalId;
      return {
        id: txn.id,
        reference,
        status: txn.status,
        purpose: txn.purpose ?? 'ticket',
        amount: txn.amount,
        currency: txn.currency,
        provider: txn.provider,
        paymentMethod: txn.paymentMethod ?? null,
        channel: txn.channel ?? null,
        ticketId: txn.ticketId ?? null,
        eventId: txn.eventId ?? null,
        eventTitle: event?.title ?? null,
        label:
          (typeof txn.metadata?.label === 'string' && txn.metadata.label) ||
          (txn.purpose === 'subscription' ? 'Subscription payment' : event?.title ?? 'Ticket purchase'),
        createdAt: txn.createdAt,
        updatedAt: txn.updatedAt,
      };
    });

  return new Response(JSON.stringify({ data: transactions }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface WebhookRequest {
  params: { provider: string };
  headers: Record<string, string | undefined>;
  body: any; // may be Buffer when using express.raw
}

export async function handlePublicWebhook(req: WebhookRequest) {
  if (req.params.provider.toLowerCase() !== 'lenco') {
    return new Response(JSON.stringify({ message: 'Unknown provider.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const isBuffer = typeof Buffer !== 'undefined' && Buffer.isBuffer(req.body);
  const payload = isBuffer ? (req.body as Buffer).toString('utf8') : JSON.stringify(req.body);
  const signatureHeader = req.headers['x-lenco-signature'];
  const expectedSignature = computeWebhookSignature(payload);

  const provided = Buffer.from(String(signatureHeader || ''), 'utf8');
  const expected = Buffer.from(expectedSignature, 'utf8');
  const validSig = provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
  if (!signatureHeader || !validSig) {
    db.webhookLogs.create({
      provider: PAYMENT_PROVIDER,
      eventType: (req.body.event as string) ?? 'unknown',
      payload: req.body,
      status: 'failed',
      responseMessage: 'Invalid signature',
    });
    return new Response(JSON.stringify({ message: 'Invalid signature.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const parsed = isBuffer ? (JSON.parse(payload) as Record<string, unknown>) : (req.body as Record<string, unknown>);
  const eventType = (parsed.event as string) ?? 'unknown';
  
  // Create log entry and check idempotency by reference
  const log = db.webhookLogs.create({
    provider: PAYMENT_PROVIDER,
    eventType,
    payload: parsed,
    status: 'received',
  });

  try {
    if (eventType === 'collection.successful') {
      const reference = (parsed.data as Record<string, unknown>)?.reference as string | undefined;
      if (reference) {
        // Idempotency: skip if we have already processed this reference
        if (db.webhookLogs.hasProcessedReference(PAYMENT_PROVIDER, reference)) {
          db.webhookLogs.updateStatus(log.id, 'processed', 'Duplicate');
          return new Response(JSON.stringify({ received: true, duplicate: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        await handleVerifyPayment({ body: { reference } });
        db.webhookLogs.updateStatus(log.id, 'processed', 'OK');
      }
    }
  } catch (error) {
    console.error('Failed to process webhook event', error);
    db.webhookLogs.updateStatus(log.id, 'failed', 'Processing error');
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
