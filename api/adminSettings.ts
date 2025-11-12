import { db } from './db';
import { requireAdmin } from './utils/auth';
import {
  ApiKeyRecord,
  DataExportJob,
  DataExportStatus,
  PlatformSettings,
  User,
} from '../types';

interface AdminRequest<T = any> {
  user: User | null;
  body?: T;
  params?: Record<string, string>;
}

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export async function handleAdminGetPlatformSettings(req: AdminRequest) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const settings = db.platformSettings.get();
  return jsonResponse(settings);
}

const normalizeTierValue = (value: unknown) => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error('All payout fee fields must be numeric.');
  }
  return parsed;
};

const normalizePayoutFeeChannel = (
  label: string,
  tiers: unknown,
  fallback: PlatformSettings['payoutFees'][keyof PlatformSettings['payoutFees']]
) => {
  if (!tiers) return fallback;
  if (!Array.isArray(tiers) || tiers.length === 0) {
    throw new Error(`${label} payout fees require at least one tier.`);
  }
  return tiers
    .map((tier, index) => {
      const minAmount = normalizeTierValue((tier as any)?.minAmount);
      const maxAmountRaw = normalizeTierValue((tier as any)?.maxAmount);
      const fee = normalizeTierValue((tier as any)?.fee);

      if (typeof minAmount !== 'number' || minAmount < 0) {
        throw new Error(`${label} tier ${index + 1}: minAmount must be a positive number.`);
      }
      if (fee === null || typeof fee !== 'number' || fee < 0) {
        throw new Error(`${label} tier ${index + 1}: fee must be a positive number.`);
      }
      const maxAmount =
        maxAmountRaw === null ? null : (typeof maxAmountRaw === 'number' ? maxAmountRaw : null);
      if (maxAmount !== null && maxAmount <= minAmount) {
        throw new Error(`${label} tier ${index + 1}: maxAmount must be greater than minAmount.`);
      }

      return {
        minAmount,
        maxAmount,
        fee,
      };
    })
    .sort((a, b) => a.minAmount - b.minAmount);
};

const normalizePayoutFeesPayload = (
  incoming: any,
  current: PlatformSettings['payoutFees']
): PlatformSettings['payoutFees'] => {
  if (!incoming) {
    return current;
  }

  const mobileMoney = normalizePayoutFeeChannel('Mobile money', incoming.mobileMoney, current.mobileMoney);
  const bankAccount = normalizePayoutFeeChannel('Bank account', incoming.bankAccount, current.bankAccount);

  return {
    mobileMoney,
    bankAccount,
  };
};

export async function handleAdminUpdatePlatformSettings(
  req: AdminRequest<
    Partial<Pick<PlatformSettings, 'platformFeePercent' | 'payoutCurrency' | 'autoPayoutsEnabled' | 'payoutFees'>>
  >
) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const { platformFeePercent, payoutCurrency, autoPayoutsEnabled, payoutFees } = req.body ?? {};
  if (
    typeof platformFeePercent !== 'number' ||
    platformFeePercent < 0 ||
    platformFeePercent > 25
  ) {
    return jsonResponse({ message: 'platformFeePercent must be between 0 and 25.' }, 400);
  }

  const currentSettings = db.platformSettings.get();
  let normalizedPayoutFees = currentSettings.payoutFees;
  if (payoutFees) {
    try {
      normalizedPayoutFees = normalizePayoutFeesPayload(payoutFees, currentSettings.payoutFees);
    } catch (err) {
      return jsonResponse(
        { message: err instanceof Error ? err.message : 'Invalid payout fee configuration.' },
        400
      );
    }
  }

  const updated = db.platformSettings.update({
    platformFeePercent,
    payoutCurrency: payoutCurrency ?? currentSettings.payoutCurrency,
    autoPayoutsEnabled: autoPayoutsEnabled ?? currentSettings.autoPayoutsEnabled,
    payoutFees: normalizedPayoutFees,
    updatedBy: req.user!.id,
  });

  db.auditLogs.create({
    actorId: req.user!.id,
    targetUserId: req.user!.id,
    action: 'platform_settings_update',
    details: `Platform fee set to ${platformFeePercent}%`,
  });

  return jsonResponse(updated);
}

export async function handleAdminGetApiKeys(req: AdminRequest) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const keys = db.apiKeys.findAll();
  return jsonResponse({ data: keys });
}

export async function handleAdminCreateApiKey(
  req: AdminRequest<{ name: string; description?: string; scopes: string[] }>
) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const { name, description, scopes } = req.body ?? {};
  if (!name || !Array.isArray(scopes) || scopes.length === 0) {
    return jsonResponse({ message: 'name and at least one scope are required.' }, 400);
  }

  const result = db.apiKeys.create({ name, description, scopes });

  db.auditLogs.create({
    actorId: req.user!.id,
    targetUserId: req.user!.id,
    action: 'api_key_create',
    details: `Created API key "${name}"`,
  });

  return jsonResponse({ record: result.record, rawKey: result.rawKey }, 201);
}

export async function handleAdminRotateApiKey(req: AdminRequest) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const id = req.params?.id;
  if (!id) {
    return jsonResponse({ message: 'Key id is required.' }, 400);
  }

  const result = db.apiKeys.rotate(id);
  if (!result) {
    return jsonResponse({ message: 'API key not found.' }, 404);
  }

  db.auditLogs.create({
    actorId: req.user!.id,
    targetUserId: req.user!.id,
    action: 'api_key_rotate',
    details: `Rotated API key ${id}`,
  });

  return jsonResponse(result);
}

export async function handleAdminRevokeApiKey(req: AdminRequest) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const id = req.params?.id;
  if (!id) {
    return jsonResponse({ message: 'Key id is required.' }, 400);
  }

  const revoked = db.apiKeys.revoke(id);
  if (!revoked) {
    return jsonResponse({ message: 'API key not found.' }, 404);
  }

  db.auditLogs.create({
    actorId: req.user!.id,
    targetUserId: req.user!.id,
    action: 'api_key_revoke',
    details: `Revoked API key ${id}`,
  });

  return jsonResponse(revoked);
}

export async function handleAdminGetDataExports(req: AdminRequest) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const exports = db.dataExports.findAll();
  return jsonResponse({ data: exports });
}

export async function handleAdminRequestDataExport(
  req: AdminRequest<{ type: DataExportJob['type'] }>
) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const { type } = req.body ?? {};
  if (!type || !['events', 'transactions', 'users'].includes(type)) {
    return jsonResponse({ message: 'Valid export type is required.' }, 400);
  }

  const job = db.dataExports.create({ type, requestedBy: req.user!.id });

  db.auditLogs.create({
    actorId: req.user!.id,
    targetUserId: req.user!.id,
    action: 'data_export_request',
    details: `Requested ${type} export (${job.id})`,
  });

  return jsonResponse(job, 201);
}

export async function handleAdminUpdateExportStatus(
  req: AdminRequest<{ status: DataExportStatus; downloadUrl?: string; errorMessage?: string }>
) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const id = req.params?.id;
  if (!id) {
    return jsonResponse({ message: 'Export id is required.' }, 400);
  }
  const { status, downloadUrl, errorMessage } = req.body ?? {};
  if (!status) {
    return jsonResponse({ message: 'Status is required.' }, 400);
  }

  const updated = db.dataExports.updateStatus(id, status, {
    downloadUrl,
    errorMessage,
  });
  if (!updated) {
    return jsonResponse({ message: 'Export job not found.' }, 404);
  }

  db.auditLogs.create({
    actorId: req.user!.id,
    targetUserId: req.user!.id,
    action: 'data_export_update',
    details: `Updated export ${id} to ${status}`,
  });

  return jsonResponse(updated);
}
