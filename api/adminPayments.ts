import { db } from './db';
import { requireAdmin } from './utils/auth';
import { decryptSecret } from '../utils/encryption';
import { User } from '../types';

interface AdminRequest<T = any> {
  user: User | null;
  body?: T;
  query?: Record<string, string | undefined>;
  params?: Record<string, string>;
}

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export async function handleAdminGetPaymentConfig(req: AdminRequest) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const config = db.paymentConfigurations.getLatest();
  if (!config) {
    return jsonResponse({ message: 'No configuration found.' }, 404);
  }

  return jsonResponse({
    provider: config.provider,
    publicKey: config.publicKey,
    isLiveMode: config.isLiveMode,
    updatedAt: config.updatedAt,
    secretKeyAvailable: !!decryptSecret(config.secretKeyEncrypted),
  });
}

export async function handleAdminUpsertPaymentConfig(
  req: AdminRequest<{ provider: string; publicKey: string; secretKey?: string; isLiveMode: boolean }>
) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const { provider, publicKey, secretKey, isLiveMode } = req.body ?? {};
  if (!provider || !publicKey || typeof isLiveMode !== 'boolean') {
    return jsonResponse({ message: 'provider, publicKey, and isLiveMode are required.' }, 400);
  }

  const updated = db.paymentConfigurations.upsert({
    provider,
    publicKey,
    secretKey,
    isLiveMode,
  });

  return jsonResponse({
    provider: updated.provider,
    publicKey: updated.publicKey,
    isLiveMode: updated.isLiveMode,
    updatedAt: updated.updatedAt,
    secretKeyAvailable: !!decryptSecret(updated.secretKeyEncrypted),
  }, 201);
}

export async function handleAdminTestPaymentConfig(req: AdminRequest) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  await new Promise((resolve) => setTimeout(resolve, 500));
  return jsonResponse({ success: true, message: 'Connection successful.' });
}

export async function handleAdminGetTransactions(req: AdminRequest) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const { status, provider, q, dateFrom, dateTo } = req.query ?? {};
  const transactions = db.gatewayTransactions.findAll().filter((txn) => {
    let matches = true;

    if (status && status !== 'all') {
      matches = matches && txn.status === status;
    }
    if (provider && provider !== 'all') {
      matches = matches && txn.provider === provider;
    }
    if (q) {
      const lowered = q.toLowerCase();
      matches =
        matches &&
        (txn.externalId.toLowerCase().includes(lowered) ||
          txn.eventId.toLowerCase().includes(lowered) ||
          (txn.paymentMethod ?? '').toLowerCase().includes(lowered));
    }
    if (dateFrom) {
      matches = matches && new Date(txn.createdAt) >= new Date(dateFrom);
    }
    if (dateTo) {
      matches = matches && new Date(txn.createdAt) <= new Date(dateTo);
    }

    return matches;
  });

  return jsonResponse({ data: transactions });
}

export async function handleAdminGetTransactionById(req: AdminRequest) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const id = req.params?.id;
  if (!id) return jsonResponse({ message: 'Transaction id is required.' }, 400);

  const txn = db.gatewayTransactions.findById(id);
  if (!txn) return jsonResponse({ message: 'Transaction not found.' }, 404);

  return jsonResponse(txn);
}

export async function handleAdminRefundTransaction(req: AdminRequest) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const id = req.params?.id;
  if (!id) return jsonResponse({ message: 'Transaction id is required.' }, 400);

  const txn = db.gatewayTransactions.findById(id);
  if (!txn) return jsonResponse({ message: 'Transaction not found.' }, 404);

  if (txn.status === 'refunded') {
    return jsonResponse({ message: 'Transaction already refunded.' }, 400);
  }

  await new Promise((resolve) => setTimeout(resolve, 600));

  const updated = db.gatewayTransactions.updateStatus(id, 'refunded');
  return jsonResponse(updated);
}

export async function handleAdminGetWebhookLogs(req: AdminRequest) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const { status, provider } = req.query ?? {};
  const logs = db.webhookLogs.findAll().filter((log) => {
    let matches = true;
    if (status && status !== 'all') {
      matches = matches && log.status === status;
    }
    if (provider && provider !== 'all') {
      matches = matches && log.provider === provider;
    }
    return matches;
  });

  return jsonResponse({ data: logs });
}

export async function handleAdminReplayWebhook(req: AdminRequest) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const id = req.params?.id;
  if (!id) return jsonResponse({ message: 'Webhook id is required.' }, 400);

  const log = db.webhookLogs.findById(id);
  if (!log) return jsonResponse({ message: 'Webhook not found.' }, 404);

  await new Promise((resolve) => setTimeout(resolve, 400));
  const updated = db.webhookLogs.updateStatus(id, 'processed', 'Replayed successfully');
  return jsonResponse(updated);
}

export async function handleAdminGetPaymentSummary(req: AdminRequest) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const transactions = db.gatewayTransactions.findAll();
  const gross = transactions
    .filter((txn) => txn.status === 'succeeded')
    .reduce((sum, txn) => sum + txn.amount, 0);
  const refunds = transactions
    .filter((txn) => txn.status === 'refunded')
    .reduce((sum, txn) => sum + txn.amount, 0);

  const byProvider = transactions.reduce<Record<string, number>>((acc, txn) => {
    if (!acc[txn.provider]) acc[txn.provider] = 0;
    acc[txn.provider] += txn.amount;
    return acc;
  }, {});

  return jsonResponse({
    grossVolume: gross,
    refunds,
    netRevenue: gross - refunds,
    transactionCount: transactions.length,
    volumeByProvider: byProvider,
  });
}

export async function handleAdminExportPayments(req: AdminRequest) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const transactions = db.gatewayTransactions.findAll();
  const header = 'transactionId,externalId,eventId,userId,amount,currency,status,provider,createdAt\n';
  const rows = transactions
    .map(
      (txn) =>
        `${txn.id},${txn.externalId},${txn.eventId},${txn.userId},${txn.amount},${txn.currency},${txn.status},${txn.provider},${txn.createdAt}`
    )
    .join('\n');

  return new Response(header + rows, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="payments-export.csv"',
    },
  });
}
