import {
  AdminAuditLogEntry,
  AdminStats,
  ApiKeyRecord,
  DataExportJob,
  DataExportStatus,
  Event,
  FunnelMetrics,
  NotificationChannel,
  PlatformSettings,
  GatewayTransaction,
  RefundCase,
  RefundStatus,
  RevenueTrendResponse,
  User,
  UserRole,
  UserStatus,
  OrganizerKycProfile,
  KycStatus,
} from '../types';
import { apiFetch } from '../utils/apiClient';

const parseJson = async <T>(response: Response, fallbackMessage: string): Promise<T> => {
  if (!response.ok) {
    const message = await response.text().catch(() => fallbackMessage);
    throw new Error(message || fallbackMessage);
  }
  return response.json() as Promise<T>;
};

const parseText = async (response: Response, fallbackMessage: string): Promise<string> => {
  if (!response.ok) {
    const message = await response.text().catch(() => fallbackMessage);
    throw new Error(message || fallbackMessage);
  }
  return response.text();
};

export const getPlatformStats = async (user: User): Promise<AdminStats | null> => {
  try {
    return await parseJson<AdminStats>(
      await apiFetch('/api/admin/stats', { user }),
      'Failed to fetch admin stats'
    );
  } catch (err) {
    console.error('Error fetching admin stats', err);
    return null;
  }
};

export const getAdminEvents = async (user: User): Promise<Event[]> => {
  try {
    return await parseJson<Event[]>(
      await apiFetch('/api/admin/events', { user }),
      'Failed to fetch admin events'
    );
  } catch (err) {
    console.error('Error fetching admin events', err);
    return [];
  }
};

export const updateEventStatus = async (
  user: User,
  eventId: string,
  status: string,
  note?: string
): Promise<Event | null> => {
  try {
    return await parseJson<Event>(
      await apiFetch('/api/admin/events/status', {
        method: 'POST',
        user,
        body: { eventId, status, note },
      }),
      'Failed to update event status'
    );
  } catch (err) {
    console.error('Error updating event status', err);
    return null;
  }
};

export const updateEventFeatured = async (
  user: User,
  eventId: string,
  isFeatured: boolean
): Promise<Event | null> => {
  try {
    return await parseJson<Event>(
      await apiFetch('/api/admin/events/featured', {
        method: 'POST',
        user,
        body: { eventId, isFeatured },
      }),
      'Failed to update event feature flag'
    );
  } catch (err) {
    console.error('Error updating event feature flag', err);
    return null;
  }
};

export const getPaymentConfig = async (user: User) =>
  parseJson(
    await apiFetch('/api/admin/payments/config', { user }),
    'Unable to load payment configuration.'
  );

export const upsertPaymentConfig = async (
  user: User,
  body: { provider: string; publicKey: string; secretKey?: string; isLiveMode: boolean }
) =>
  parseJson(
    await apiFetch('/api/admin/payments/config', {
      method: 'POST',
      user,
      body,
    }),
    'Failed to save payment configuration.'
  );

export const testPaymentConfig = async (user: User) =>
  parseJson(
    await apiFetch('/api/admin/payments/test', { method: 'POST', user }),
    'Failed to test payment configuration.'
  );

export const getPaymentTransactions = async (user: User, query?: Record<string, string>) =>
  parseJson(
    await apiFetch('/api/admin/payments/transactions', { user, query }),
    'Failed to load payment transactions.'
  );

export const getPaymentTransactionById = async (user: User, id: string) =>
  parseJson(
    await apiFetch(`/api/admin/payments/transactions/${id}`, { user }),
    'Failed to load payment transaction.'
  );

export const refundTransaction = async (user: User, id: string) =>
  parseJson(
    await apiFetch(`/api/admin/payments/transactions/${id}/refund`, {
      method: 'POST',
      user,
    }),
    'Failed to refund transaction.'
  );

export const getPayoutRequests = async (
  user: User,
  status: 'pending' | 'succeeded' | 'failed' | 'all' = 'pending'
): Promise<{ data: GatewayTransaction[] }> =>
  parseJson(
    await apiFetch('/api/admin/payments/payouts', {
      user,
      query: status ? { status } : undefined,
    }),
    'Failed to load payout requests.'
  );

export const approvePayoutRequest = async (
  user: User,
  id: string,
  body?: { note?: string }
): Promise<{ transaction: GatewayTransaction; success: boolean; message: string }> =>
  parseJson(
    await apiFetch(`/api/admin/payments/payouts/${id}/approve`, {
      method: 'POST',
      user,
      body,
    }),
    'Failed to approve payout request.'
  );

export const rejectPayoutRequest = async (
  user: User,
  id: string,
  reason?: string
): Promise<{ transaction: GatewayTransaction; success: boolean; message: string }> =>
  parseJson(
    await apiFetch(`/api/admin/payments/payouts/${id}/reject`, {
      method: 'POST',
      user,
      body: { reason },
    }),
    'Failed to reject payout request.'
  );

export const getWebhookLogs = async (user: User, query?: Record<string, string>) =>
  parseJson(
    await apiFetch('/api/admin/payments/webhook-logs', { user, query }),
    'Failed to load webhook logs.'
  );

export const replayWebhook = async (user: User, id: string) =>
  parseJson(
    await apiFetch(`/api/admin/payments/webhook-logs/${id}/replay`, {
      method: 'POST',
      user,
    }),
    'Failed to replay webhook.'
  );

export const getOrganizerKycProfiles = async (user: User): Promise<OrganizerKycProfile[]> =>
  parseJson(
    await apiFetch('/api/admin/kyc/organizers', { user }),
    'Failed to load organizer KYC profiles.'
  ).then((res: { profiles: OrganizerKycProfile[] }) => res.profiles);

export const updateOrganizerKycStatus = async (
  user: User,
  organizerId: string,
  status: KycStatus,
  reviewerNotes?: string
): Promise<OrganizerKycProfile> =>
  parseJson(
    await apiFetch(`/api/admin/kyc/organizers/${organizerId}/status`, {
      method: 'POST',
      user,
      body: { status, reviewerNotes },
    }),
    'Failed to update organizer KYC status.'
  ).then((res: { profile: OrganizerKycProfile }) => res.profile);

export const getPaymentSummary = async (user: User) =>
  parseJson(
    await apiFetch('/api/admin/payments/summary', { user }),
    'Failed to load payment summary.'
  );

export const getPlatformBalance = async (user: User) =>
  parseJson(
    await apiFetch('/api/admin/payments/platform-balance', { user }),
    'Failed to load platform balance.'
  );

export const requestPlatformPayout = async (
  user: User,
  body: { amount: number; destination: Record<string, unknown>; narration?: string }
) =>
  parseJson(
    await apiFetch('/api/admin/payments/platform-payouts', {
      method: 'POST',
      user,
      body,
    }),
    'Failed to withdraw platform revenue.'
  );

export const exportPayments = async (user: User) =>
  parseText(
    await apiFetch('/api/admin/payments/export', { user }),
    'Failed to export payments.'
  );

export const getAdminUsers = async (user: User, query?: Record<string, string>) =>
  parseJson(
    await apiFetch('/api/admin/users', { user, query }),
    'Failed to load users.'
  );

export const updateUserRole = async (user: User, userId: string, role: UserRole) =>
  parseJson(
    await apiFetch(`/api/admin/users/${userId}/role`, {
      method: 'POST',
      user,
      body: { userId, role },
    }),
    'Failed to update user role.'
  );

export const updateUserStatus = async (user: User, userId: string, status: UserStatus) =>
  parseJson(
    await apiFetch(`/api/admin/users/${userId}/status`, {
      method: 'POST',
      user,
      body: { userId, status },
    }),
    'Failed to update user status.'
  );

export const resetUserPassword = async (user: User, userId: string) =>
  parseJson(
    await apiFetch(`/api/admin/users/${userId}/reset-password`, {
      method: 'POST',
      user,
      body: { userId },
    }),
    'Failed to reset user password.'
  );

export const getAuditLogs = async (
  user: User,
  limit?: number
): Promise<{ data: AdminAuditLogEntry[] }> => {
  const query = limit ? { limit: String(limit) } : undefined;
  return parseJson(
    await apiFetch('/api/admin/users/audit-logs', { user, query }),
    'Failed to load audit logs.'
  );
};

export const getNotificationTemplates = async (user: User) =>
  parseJson(
    await apiFetch('/api/admin/notifications/templates', { user }),
    'Failed to load notification templates.'
  );

export const createNotificationTemplate = async (
  user: User,
  body: {
    name: string;
    channel: NotificationChannel;
    audienceDescription: string;
    subject: string;
    body: string;
  }
) =>
  parseJson(
    await apiFetch('/api/admin/notifications/templates', {
      method: 'POST',
      user,
      body,
    }),
    'Failed to create notification template.'
  );

export const updateNotificationTemplate = async (
  user: User,
  body: {
    id: string;
    name?: string;
    channel?: NotificationChannel;
    audienceDescription?: string;
    subject?: string;
    body?: string;
  }
) =>
  parseJson(
    await apiFetch(`/api/admin/notifications/templates/${body.id}`, {
      method: 'PUT',
      user,
      body,
    }),
    'Failed to update notification template.'
  );

export const deleteNotificationTemplate = async (user: User, id: string) =>
  parseJson(
    await apiFetch(`/api/admin/notifications/templates/${id}`, {
      method: 'DELETE',
      user,
    }),
    'Failed to delete notification template.'
  );

export const sendNotificationTemplate = async (
  user: User,
  body: { templateId: string; audienceDescription?: string }
) =>
  parseJson(
    await apiFetch('/api/admin/notifications/send', {
      method: 'POST',
      user,
      body,
    }),
    'Failed to send notification.'
  );

export const getNotificationQueue = async (user: User, query?: Record<string, string>) =>
  parseJson(
    await apiFetch('/api/admin/notifications/queue', { user, query }),
    'Failed to load notification queue.'
  );

export const resendNotification = async (user: User, id: string) =>
  parseJson(
    await apiFetch(`/api/admin/notifications/queue/${id}/resend`, {
      method: 'POST',
      user,
    }),
    'Failed to resend notification.'
  );

export const getRevenueTrends = async (
  user: User,
  query?: Record<string, string>
): Promise<RevenueTrendResponse> =>
  parseJson(
    await apiFetch('/api/admin/operations/revenue-trends', { user, query }),
    'Failed to load revenue trends.'
  );

export const getFunnelMetrics = async (
  user: User,
  query?: Record<string, string>
): Promise<FunnelMetrics> =>
  parseJson(
    await apiFetch('/api/admin/operations/funnel', { user, query }),
    'Failed to load funnel metrics.'
  );

export const getRefundCases = async (
  user: User,
  status?: RefundStatus | 'all'
): Promise<{ data: RefundCase[] }> => {
  const query = status && status !== 'all' ? { status } : undefined;
  return parseJson(
    await apiFetch('/api/admin/operations/refund-cases', { user, query }),
    'Failed to load refund cases.'
  );
};

export const updateRefundCase = async (
  user: User,
  body: { caseId: string; status: RefundStatus; note?: string }
): Promise<RefundCase> =>
  parseJson(
    await apiFetch(`/api/admin/operations/refund-cases/${body.caseId}`, {
      method: 'POST',
      user,
      body,
    }),
    'Failed to update refund case.'
  );

export const getPlatformSettings = async (user: User): Promise<PlatformSettings> =>
  parseJson(
    await apiFetch('/api/admin/settings/platform', { user }),
    'Failed to load platform settings.'
  );

export const updatePlatformSettings = async (
  user: User,
  settings: Partial<
    Pick<PlatformSettings, 'platformFeePercent' | 'payoutCurrency' | 'autoPayoutsEnabled' | 'payoutFees'>
  >
): Promise<PlatformSettings> =>
  parseJson(
    await apiFetch('/api/admin/settings/platform', {
      method: 'PUT',
      user,
      body: settings,
    }),
    'Failed to update platform settings.'
  );

export const getApiKeys = async (user: User): Promise<{ data: ApiKeyRecord[] }> =>
  parseJson(
    await apiFetch('/api/admin/settings/api-keys', { user }),
    'Failed to load API keys.'
  );

export const createApiKey = async (
  user: User,
  body: { name: string; description?: string; scopes: string[] }
) =>
  parseJson(
    await apiFetch('/api/admin/settings/api-keys', {
      method: 'POST',
      user,
      body,
    }),
    'Failed to create API key.'
  );

export const rotateApiKey = async (user: User, id: string) =>
  parseJson(
    await apiFetch(`/api/admin/settings/api-keys/${id}/rotate`, {
      method: 'POST',
      user,
    }),
    'Failed to rotate API key.'
  );

export const revokeApiKey = async (user: User, id: string): Promise<ApiKeyRecord> =>
  parseJson(
    await apiFetch(`/api/admin/settings/api-keys/${id}/revoke`, {
      method: 'POST',
      user,
    }),
    'Failed to revoke API key.'
  );

export const getDataExports = async (user: User): Promise<{ data: DataExportJob[] }> =>
  parseJson(
    await apiFetch('/api/admin/settings/data-exports', { user }),
    'Failed to load data exports.'
  );

export const requestDataExport = async (
  user: User,
  body: { type: DataExportJob['type'] }
): Promise<DataExportJob> =>
  parseJson(
    await apiFetch('/api/admin/settings/data-exports', {
      method: 'POST',
      user,
      body,
    }),
    'Failed to request data export.'
  );

export const updateDataExportStatus = async (
  user: User,
  id: string,
  body: { status: DataExportStatus; downloadUrl?: string; errorMessage?: string }
): Promise<DataExportJob> =>
  parseJson(
    await apiFetch(`/api/admin/settings/data-exports/${id}/status`, {
      method: 'POST',
      user,
      body,
    }),
    'Failed to update data export status.'
  );
