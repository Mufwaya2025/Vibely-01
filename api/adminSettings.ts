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

export async function handleAdminUpdatePlatformSettings(
  req: AdminRequest<Partial<Pick<PlatformSettings, 'platformFeePercent' | 'payoutCurrency' | 'autoPayoutsEnabled'>>>
) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const { platformFeePercent, payoutCurrency, autoPayoutsEnabled } = req.body ?? {};
  if (
    typeof platformFeePercent !== 'number' ||
    platformFeePercent < 0 ||
    platformFeePercent > 25
  ) {
    return jsonResponse({ message: 'platformFeePercent must be between 0 and 25.' }, 400);
  }

  const updated = db.platformSettings.update({
    platformFeePercent,
    payoutCurrency: payoutCurrency ?? db.platformSettings.get().payoutCurrency,
    autoPayoutsEnabled: autoPayoutsEnabled ?? db.platformSettings.get().autoPayoutsEnabled,
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
