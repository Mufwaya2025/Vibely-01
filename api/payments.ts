import { db } from "./db";
import { GatewayTransactionStatus, PaymentMethod, User } from "../types";
import { isLencoConfigured, lencoConfig } from "../server/config/lencoConfig";
import {
  createReference,
  verifyCollection,
  computeWebhookSignature,
  createTransfer,
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

  let event = null;
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

interface PayoutDestination {
  type: 'bank_account';
  accountNumber: string;
  bankCode: string;
  accountName: string;
}

interface PayoutRequestBody {
  organizerId: string;
  amount?: number;
  destination: PayoutDestination;
  narration?: string;
  currency?: string;
}

const getPlatformFeePercent = () => db.platformSettings.get().platformFeePercent ?? 0;

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
  if (!isLencoConfigured()) {
    return new Response(JSON.stringify({ message: 'Lenco gateway is not configured.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { organizerId, amount, destination, narration, currency } = req.body ?? {};
  if (!organizerId || !destination) {
    return new Response(JSON.stringify({ message: 'organizerId and destination are required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (destination.type !== 'bank_account' || !destination.accountNumber || !destination.bankCode || !destination.accountName) {
    return new Response(JSON.stringify({ message: 'Invalid destination object. It must include type, accountNumber, bankCode, and accountName.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
    });
  }

  const available = calculateAvailableBalance(organizerId);
  const payoutAmount = amount ?? available;

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

  const reference = createReference('payout');

  let transferResponse: unknown = null;
  let payoutStatus: GatewayTransactionStatus = 'pending';

  try {
    transferResponse = await createTransfer({
      reference,
      amount: payoutAmount,
      currency: currency || lencoConfig.currency,
      narration: narration || 'Event organizer payout',
      destination,
    });
    payoutStatus = 'succeeded';
  } catch (error) {
    if (error instanceof LencoClientError) {
      console.error('Failed to initiate transfer', error.message);
      payoutStatus = 'failed';
    } else {
      console.error('Unexpected transfer error', error);
      payoutStatus = 'failed';
    }
  }

  const payoutTxn = db.gatewayTransactions.create({
    externalId: reference,
    reference,
    purpose: 'payout',
    userId: organizerId,
    organizerId,
    amount: payoutAmount,
    currency: currency || lencoConfig.currency,
    status: payoutStatus,
    provider: PAYMENT_PROVIDER,
    metadata: { destination, narration, response: transferResponse },
  });

  const responseStatus = payoutStatus === 'failed' ? 502 : 201;

  return new Response(JSON.stringify({
    status: payoutStatus,
    transaction: payoutTxn,
    availableBalance: calculateAvailableBalance(organizerId),
  }), {
    status: responseStatus,
    headers: { 'Content-Type': 'application/json' },
  });
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
      description = 'Organizer payout';
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

interface WebhookRequest {
  params: { provider: string };
  headers: Record<string, string | undefined>;
  body: Record<string, unknown>;
}

export async function handlePublicWebhook(req: WebhookRequest) {
  if (req.params.provider.toLowerCase() !== 'lenco') {
    return new Response(JSON.stringify({ message: 'Unknown provider.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const payload = JSON.stringify(req.body);
  const signatureHeader = req.headers['x-lenco-signature'];
  const expectedSignature = computeWebhookSignature(payload);

  if (!signatureHeader || signatureHeader !== expectedSignature) {
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

  const eventType = (req.body.event as string) ?? 'unknown';

  db.webhookLogs.create({
    provider: PAYMENT_PROVIDER,
    eventType,
    payload: req.body,
    status: 'received',
  });

  try {
    if (eventType === 'collection.successful') {
      const reference = (req.body.data as Record<string, unknown>)?.reference as string | undefined;
      if (reference) {
        await handleVerifyPayment({ body: { reference } });
      }
    }
  } catch (error) {
    console.error('Failed to process webhook event', error);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
