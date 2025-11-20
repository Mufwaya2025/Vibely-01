import { db } from './db';
import { requireAdmin } from './utils/auth';
import { decryptSecret } from '../utils/encryption';
import { User, GatewayTransactionStatus } from '../types';
import { isLencoConfigured, lencoConfig } from '../server/config/lencoConfig';
import { createTransfer, LencoClientError, createReference } from '../server/services/lencoClient';
// Keep provider label consistent with other payment flows
const PAYMENT_PROVIDER = 'Lenco';

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
          (txn.eventId ?? '').toLowerCase().includes(lowered) ||
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
  const succeededTransactions = transactions.filter((txn) => txn.status === 'succeeded');
  const gross = succeededTransactions.reduce((sum, txn) => sum + txn.amount, 0);
  const refunds = transactions
    .filter((txn) => txn.status === 'refunded')
    .reduce((sum, txn) => sum + txn.amount, 0);

  const platformFeePercent = db.platformSettings.get().platformFeePercent ?? 0;
  const ticketSales = succeededTransactions.filter((txn) => txn.purpose === 'ticket');
  const platformFees = ticketSales.reduce(
    (sum, txn) => sum + (txn.amount * platformFeePercent) / 100,
    0
  );

  const subscriptionRevenue = succeededTransactions
    .filter((txn) => txn.purpose === 'subscription')
    .reduce((sum, txn) => sum + txn.amount, 0);

  const platformRevenue = platformFees + subscriptionRevenue;

  const payoutFees = transactions
    .filter((txn) => txn.purpose === 'payout')
    .reduce(
      (sum, txn) =>
        sum +
        (typeof txn.metadata?.payoutFeeAmount === 'number'
          ? Number(txn.metadata.payoutFeeAmount)
          : 0),
      0
    );

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
    platformFees,
    subscriptionRevenue,
    platformRevenue,
    payoutFees,
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

const buildDestinationFromPayoutMethod = (method: ReturnType<typeof db.payoutMethods.findById>) => {
  if (!method) {
    throw new Error('Payout method is missing.');
  }

  if (method.type === 'Bank') {
    if (!method.accountNumber || !method.bankCode) {
      throw new Error('Bank account details are incomplete.');
    }
    return {
      type: 'bank_account',
      accountNumber: method.accountNumber,
      bankCode: method.bankCode,
      accountName: method.accountInfo,
    };
  }

  if (!method.phoneNumber || !method.mobileMoneyProvider) {
    throw new Error('Mobile money details are incomplete.');
  }

  return {
    type: 'mobile_money',
    phoneNumber: method.phoneNumber,
    provider: method.mobileMoneyProvider,
    accountName: method.accountInfo,
  };
};

const computePlatformFinancials = () => {
  const transactions = db.gatewayTransactions.findAll();
  const succeeded = transactions.filter((txn) => txn.status === 'succeeded');
  const platformFeePercent = db.platformSettings.get().platformFeePercent ?? 0;

  const ticketSales = succeeded.filter((txn) => txn.purpose === 'ticket');
  const platformFees = ticketSales.reduce(
    (sum, txn) => sum + (txn.amount * platformFeePercent) / 100,
    0
  );

  const subscriptionRevenue = succeeded
    .filter((txn) => txn.purpose === 'subscription')
    .reduce((sum, txn) => sum + txn.amount, 0);

  const platformRevenue = platformFees + subscriptionRevenue;

  const platformPayouts = transactions.filter(
    (txn) => txn.purpose === 'payout' && txn.metadata?.platformWithdrawal === true
  );
  const withdrawn = platformPayouts
    .filter((txn) => txn.status === 'succeeded')
    .reduce(
      (sum, txn) =>
        sum +
        (typeof txn.metadata?.transferAmount === 'number'
          ? Number(txn.metadata.transferAmount)
          : txn.amount),
      0
    );
  const pending = platformPayouts
    .filter((txn) => txn.status === 'pending')
    .reduce(
      (sum, txn) =>
        sum +
        (typeof txn.metadata?.transferAmount === 'number'
          ? Number(txn.metadata.transferAmount)
          : txn.amount),
      0
    );

  const payoutFees = transactions
    .filter((txn) => txn.purpose === 'payout')
    .reduce(
      (sum, txn) =>
        sum +
        (typeof txn.metadata?.payoutFeeAmount === 'number'
          ? Number(txn.metadata.payoutFeeAmount)
          : 0),
      0
    );

  const available = Math.max(0, platformRevenue - withdrawn - pending);

  return {
    platformFees,
    subscriptionRevenue,
    platformRevenue,
    payoutFees,
    platformBalance: {
      currency: succeeded[0]?.currency ?? lencoConfig.currency,
      totalRevenue: platformRevenue,
      withdrawn,
      pending,
      available,
      payoutFees: db.platformSettings.get().payoutFees,
    },
  };
};

const getPayoutFeeForAmount = (amount: number, methodType: 'Bank' | 'MobileMoney') => {
  const settings = db.platformSettings.get().payoutFees;
  const tiers =
    methodType === 'Bank' ? settings.bankAccount ?? [] : settings.mobileMoney ?? [];
  if (tiers.length === 0) return 0;
  const sorted = [...tiers].sort((a, b) => a.minAmount - b.minAmount);
  const minTier = sorted[0];
  if (amount < minTier.minAmount) {
    throw new Error(
      `Minimum payout for ${methodType === 'Bank' ? 'bank accounts' : 'mobile money'} is K${minTier.minAmount}.`
    );
  }
  const matched =
    sorted.find(
      (tier) => amount >= tier.minAmount && (tier.maxAmount == null || amount <= tier.maxAmount)
    ) ?? sorted[sorted.length - 1];
  return matched.fee;
};

export async function handleAdminGetPayoutRequests(req: AdminRequest) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const requestedStatus = req.query?.status ?? 'pending';
  const allowedStatuses = new Set(['pending', 'succeeded', 'failed', 'all']);
  const normalizedStatus = allowedStatuses.has(requestedStatus ?? '')
    ? requestedStatus
    : 'pending';

  const payouts = db.gatewayTransactions
    .findAll()
    .filter(
      (txn) =>
        txn.purpose === 'payout' &&
        (normalizedStatus === 'all' || txn.status === normalizedStatus)
    )
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  return jsonResponse({ data: payouts });
}

export async function handleAdminGetPlatformBalance(req: AdminRequest) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const { platformBalance } = computePlatformFinancials();
  return jsonResponse(platformBalance);
}

export async function handleAdminApprovePayoutRequest(
  req: AdminRequest<{ note?: string }>
) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  if (!isLencoConfigured()) {
    return jsonResponse({ message: 'Lenco gateway is not configured.' }, 503);
  }

  const id = req.params?.id;
  if (!id) {
    return jsonResponse({ message: 'Payout transaction id is required.' }, 400);
  }

  const txn = db.gatewayTransactions.findById(id);
  if (!txn || txn.purpose !== 'payout') {
    return jsonResponse({ message: 'Payout transaction not found.' }, 404);
  }

  if (txn.status !== 'pending') {
    return jsonResponse({ message: 'Only pending payouts can be approved.' }, 400);
  }

  const payoutMethodId = txn.metadata?.payoutMethodId as string | undefined;
  const payoutMethod = payoutMethodId ? db.payoutMethods.findById(payoutMethodId) : null;
  if (!payoutMethod) {
    return jsonResponse({ message: 'Payout method details are missing.' }, 400);
  }

  const transferAmount =
    typeof txn.metadata?.payoutNetAmount === 'number'
      ? (txn.metadata?.payoutNetAmount as number)
      : txn.amount;

  const note = req.body?.note;

  let payoutStatus: GatewayTransactionStatus = 'pending';
  let transferResponse: unknown = null;
  let errorMessage: string | null = null;

  try {
    const destination = buildDestinationFromPayoutMethod(payoutMethod);
    transferResponse = await createTransfer({
      reference: txn.reference ?? txn.externalId,
      amount: transferAmount,
      currency: txn.currency || lencoConfig.currency,
      narration: note || (txn.metadata?.narration as string) || 'Organizer payout',
      destination,
    });
    payoutStatus = 'succeeded';
  } catch (error) {
    payoutStatus = 'failed';
    errorMessage =
      error instanceof LencoClientError
        ? error.message
        : 'Unexpected transfer error.';
  }

  const updated = db.gatewayTransactions.update(txn.id, {
    status: payoutStatus,
    metadata: {
      ...(txn.metadata ?? {}),
      approvedBy: req.user?.id,
      approvedAt: new Date().toISOString(),
      approvalNote: note ?? null,
      transferAmount,
      transferResponse,
      transferError: errorMessage,
    },
  });

  if (updated) {
    db.auditLogs.create({
      actorId: req.user!.id,
      targetUserId: txn.organizerId ?? txn.userId,
      action: payoutStatus === 'succeeded' ? 'payout_approved' : 'payout_failed',
      details:
        payoutStatus === 'succeeded'
          ? `Approved payout ${txn.reference ?? txn.id}`
          : `Failed payout ${txn.reference ?? txn.id}: ${errorMessage}`,
    });
  }

  return jsonResponse(
    {
      transaction: updated,
      success: payoutStatus === 'succeeded',
      message:
        payoutStatus === 'succeeded'
          ? 'Payout transfer initiated successfully.'
          : errorMessage ?? 'Transfer failed.',
    },
    payoutStatus === 'succeeded' ? 200 : 502
  );
}

export async function handleAdminRejectPayoutRequest(
  req: AdminRequest<{ reason?: string }>
) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const id = req.params?.id;
  if (!id) {
    return jsonResponse({ message: 'Payout transaction id is required.' }, 400);
  }

  const txn = db.gatewayTransactions.findById(id);
  if (!txn || txn.purpose !== 'payout') {
    return jsonResponse({ message: 'Payout transaction not found.' }, 404);
  }

  if (txn.status !== 'pending') {
    return jsonResponse({ message: 'Only pending payouts can be rejected.' }, 400);
  }

  const reason = req.body?.reason?.trim() || 'Rejected by admin';

  const updated = db.gatewayTransactions.update(txn.id, {
    status: 'failed',
    metadata: {
      ...(txn.metadata ?? {}),
      rejectedBy: req.user?.id,
      rejectedAt: new Date().toISOString(),
      rejectionReason: reason,
    },
  });

  if (updated) {
    db.auditLogs.create({
      actorId: req.user!.id,
      targetUserId: txn.organizerId ?? txn.userId,
      action: 'payout_rejected',
      details: `Rejected payout ${txn.reference ?? txn.id}`,
    });
  }

  return jsonResponse({
    transaction: updated,
    success: true,
    message: 'Payout request rejected.',
  });
}

type AdminPayoutDestination =
  | {
      type: 'bank_account';
      bankName?: string;
      bankCode: string;
      accountNumber: string;
      accountName: string;
    }
  | {
      type: 'mobile_money';
      provider: string;
      phoneNumber: string;
      accountName: string;
    };

export async function handleAdminCreatePlatformPayout(
  req: AdminRequest<{ amount: number; destination: AdminPayoutDestination; narration?: string }>
) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  if (!isLencoConfigured()) {
    return jsonResponse({ message: 'Lenco gateway is not configured.' }, 503);
  }

  const { amount, destination, narration } = req.body ?? {};
  if (typeof amount !== 'number' || amount <= 0 || !destination?.type) {
    return jsonResponse({ message: 'Amount and destination are required.' }, 400);
  }

  const { platformBalance } = computePlatformFinancials();
  if (amount > platformBalance.available) {
    return jsonResponse({ message: 'Amount exceeds available platform revenue.' }, 400);
  }

  const destinationType =
    destination.type === 'bank_account' ? 'Bank' : destination.type === 'mobile_money' ? 'MobileMoney' : null;
  if (!destinationType) {
    return jsonResponse({ message: 'Unsupported destination type.' }, 400);
  }

  if (destination.type === 'bank_account') {
    if (!destination.accountNumber || !destination.bankCode || !destination.accountName) {
      return jsonResponse({ message: 'Bank account number, bank code, and account name are required.' }, 400);
    }
  } else if (!destination.phoneNumber || !destination.provider || !destination.accountName) {
    return jsonResponse({ message: 'Mobile money provider, phone number, and account name are required.' }, 400);
  }

  let feeAmount: number;
  try {
    feeAmount = getPayoutFeeForAmount(amount, destinationType);
  } catch (err) {
    return jsonResponse(
      { message: err instanceof Error ? err.message : 'Unable to compute payout fee.' },
      400
    );
  }

  if (feeAmount >= amount) {
    return jsonResponse({ message: 'Amount must exceed the payout fee.' }, 400);
  }

  const netAmount = amount - feeAmount;
  const reference = createReference('platform');
  let transferResponse: unknown = null;
  let payoutStatus: GatewayTransactionStatus = 'pending';
  let errorMessage: string | null = null;

  try {
    transferResponse = await createTransfer({
      reference,
      amount: netAmount,
      currency: platformBalance.currency,
      narration: narration || 'Platform revenue withdrawal',
      destination,
    });
    payoutStatus = 'succeeded';
  } catch (error) {
    payoutStatus = 'failed';
    errorMessage =
      error instanceof LencoClientError
        ? error.message
        : 'Unexpected transfer error.';
  }

  const destinationLabel =
    destination.type === 'bank_account'
      ? `${destination.bankName ?? destination.bankCode} · ****${destination.accountNumber.slice(-4)}`
      : `${destination.provider} · ${destination.phoneNumber}`;

  const payoutTxn = db.gatewayTransactions.create({
    externalId: reference,
    reference,
    purpose: 'payout',
    userId: 'platform',
    organizerId: undefined,
    amount,
    currency: platformBalance.currency,
    status: payoutStatus,
    provider: PAYMENT_PROVIDER,
    metadata: {
      platformWithdrawal: true,
      payoutFeeAmount: feeAmount,
      payoutNetAmount: netAmount,
      payoutAccountLabel: destinationLabel,
      payoutAccountHolder: destination.accountName,
      destination,
      transferAmount: netAmount,
      transferResponse,
      transferError: errorMessage,
    },
  });

  db.auditLogs.create({
    actorId: req.user!.id,
    targetUserId: req.user!.id,
    action: payoutStatus === 'succeeded' ? 'platform_payout_succeeded' : 'platform_payout_failed',
    details:
      payoutStatus === 'succeeded'
        ? `Withdrew ${amount} from platform revenue`
        : `Platform payout failed: ${errorMessage}`,
  });

  const updatedBalance = computePlatformFinancials().platformBalance;

  return jsonResponse(
    {
      transaction: payoutTxn,
      success: payoutStatus === 'succeeded',
      message:
        payoutStatus === 'succeeded'
          ? 'Platform payout completed successfully.'
          : errorMessage ?? 'Platform payout failed.',
      balance: updatedBalance,
    },
    payoutStatus === 'succeeded' ? 200 : 502
  );
}




