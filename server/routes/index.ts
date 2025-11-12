import type { Express } from 'express';
import { Router } from 'express';
import { createHandler, createTicketScanRateLimitedHandler, createDeviceAuthRateLimitedHandler } from '../utils/createHandler';

import {
  handleLogin,
  handleSignup,
  handleGoogleLogin,
  handleRequestPasswordReset,
  handleConfirmPasswordReset,
} from '../../api/auth';
import { handleGetAllEvents, handleCreateEvent, handleUpdateEvent, handleDeleteEvent } from '../../api/events';
import {
  handleGetTicketsForUser,
  handleGetReviewsForEvent,
  handleGetTicketsForEvent,
  handleCreateTicket,
  handleSubmitReview,
  handleScanTicket,
} from '../../api/tickets';
import { handleDeviceAuthorization, handleDeviceLogout } from '../../api/devices';
import { handleTicketScan } from '../../api/ticketScan';
import {
  handleCreatePaymentSession,
  handleVerifyPayment,
  handleAttachTicketToTransaction,
  handlePublicWebhook,
  handleInitiatePayout,
  handleGetOrganizerBalance,
  handleGetOrganizerTransactions,
  handleGetSubscriptionTransactions,
  handleGetUserTransactions,
} from '../../api/payments';
import {
  handleUpgradeSubscription,
  handleCancelSubscription,
  handleGetPublicSubscriptionTiers,
} from '../../api/subscriptions';
import {
  handleGetPlatformStats,
  handleGetAllEventsForAdmin,
  handleUpdateEventStatus,
  handleUpdateEventFeatured,
} from '../../api/admin';
import {
  handleAdminGetPaymentConfig,
  handleAdminUpsertPaymentConfig,
  handleAdminTestPaymentConfig,
  handleAdminGetTransactions,
  handleAdminGetTransactionById,
  handleAdminRefundTransaction,
  handleAdminGetWebhookLogs,
  handleAdminReplayWebhook,
  handleAdminGetPaymentSummary,
  handleAdminExportPayments,
  handleAdminGetPayoutRequests,
  handleAdminApprovePayoutRequest,
  handleAdminRejectPayoutRequest,
  handleAdminGetPlatformBalance,
  handleAdminCreatePlatformPayout,
} from '../../api/adminPayments';
import {
  handleAdminGetUsers,
  handleAdminUpdateUserRole,
  handleAdminUpdateUserStatus,
  handleAdminResetUserPassword,
  handleAdminGetAuditLogs,
} from '../../api/adminUsers';
import {
  handleAdminGetNotificationTemplates,
  handleAdminCreateNotificationTemplate,
  handleAdminUpdateNotificationTemplate,
  handleAdminDeleteNotificationTemplate,
  handleAdminSendNotification,
  handleAdminGetNotificationQueue,
  handleAdminResendNotification,
} from '../../api/adminNotifications';
import {
  handleAdminGetRevenueTrends,
  handleAdminGetFunnelMetrics,
  handleAdminGetRefundCases,
  handleAdminUpdateRefundCase,
} from '../../api/adminOperations';
import {
  handleAdminGetPlatformSettings,
  handleAdminUpdatePlatformSettings,
  handleAdminGetApiKeys,
  handleAdminCreateApiKey,
  handleAdminRotateApiKey,
  handleAdminRevokeApiKey,
  handleAdminGetDataExports,
  handleAdminRequestDataExport,
  handleAdminUpdateExportStatus,
} from '../../api/adminSettings';
import { handleSearchLocation, handleGetAddressFromCoordinates } from '../../api/location';
import { handleGetAIRecommendations } from '../../api/recommendations';
import { handleGetAnalysisData } from '../../api/analysis';
import {
  handleGetSubscriptionTiers,
  handleCreateSubscriptionTier,
  handleUpdateSubscriptionTier,
  handleDeleteSubscriptionTier,
} from '../../api/adminSubscriptions';
import {
  handleGetPayoutMethods,
  handleCreatePayoutMethod,
  handleUpdatePayoutMethod,
  handleDeletePayoutMethod,
} from '../../api/payoutMethods';

export const registerRoutes = (app: Express) => {
  const router = Router();

  // Auth
  router.post('/auth/signup', createHandler(handleSignup));
  router.post('/auth/login', createHandler(handleLogin));
  router.post('/auth/google', createHandler(handleGoogleLogin));
  router.post('/auth/password-reset/request', createHandler(handleRequestPasswordReset));
  router.post('/auth/password-reset/confirm', createHandler(handleConfirmPasswordReset));

  // Events
  router.get('/events', createHandler(handleGetAllEvents));
  router.post('/events', createHandler(handleCreateEvent));
  router.put('/events/:id', createHandler(handleUpdateEvent));
  router.delete('/events/:id', createHandler(handleDeleteEvent));

  // Tickets
  router.get('/tickets', createHandler(handleGetTicketsForUser));
  router.get('/tickets/event/:eventId', createHandler((req) =>
    handleGetTicketsForEvent({ query: { eventId: req.params?.eventId ?? '' } })
  ));
  router.get('/reviews', createHandler(handleGetReviewsForEvent));
  router.post('/tickets', createHandler(handleCreateTicket));
  router.post('/tickets/review', createHandler(handleSubmitReview));
  router.post('/tickets/scan', createHandler(handleScanTicket)); // Legacy endpoint for non-device scan
  
  // Device authorization and ticket scanning (secure endpoints)
  router.post('/devices/authorize', createDeviceAuthRateLimitedHandler(handleDeviceAuthorization));
  router.post('/devices/logout', createHandler(handleDeviceLogout));
  router.post('/tickets/scan-secure', createTicketScanRateLimitedHandler(handleTicketScan)); // Device-based scan

  // Payments
  router.post('/payments/session', createHandler(handleCreatePaymentSession));
  router.post('/payments/verify', createHandler(handleVerifyPayment));
  router.post('/payments/attach-ticket', createHandler(handleAttachTicketToTransaction));
  router.get('/payments/user-transactions', createHandler(handleGetUserTransactions));
  router.get('/payments/organizers/:organizerId/balance', createHandler(handleGetOrganizerBalance));
  router.get('/payments/organizers/:organizerId/transactions', createHandler(handleGetOrganizerTransactions));
  router.get('/payments/subscriptions', createHandler(handleGetSubscriptionTransactions));
  router.post('/payments/payouts', createHandler(handleInitiatePayout));

  // Wallet / payouts
  router.get('/wallet/payout-methods', createHandler(handleGetPayoutMethods));
  router.post('/wallet/payout-methods', createHandler(handleCreatePayoutMethod));
  router.patch('/wallet/payout-methods/:id', createHandler(handleUpdatePayoutMethod));
  router.delete('/wallet/payout-methods/:id', createHandler(handleDeletePayoutMethod));
  router.post('/webhooks/:provider', createHandler(handlePublicWebhook));

  // Subscriptions
  router.get('/subscriptions/tiers', createHandler(handleGetPublicSubscriptionTiers));
  router.post('/subscriptions/upgrade', createHandler(handleUpgradeSubscription));
  router.delete('/subscriptions', createHandler(handleCancelSubscription));

  // Admin core
  router.get('/admin/stats', createHandler(handleGetPlatformStats));
  router.get('/admin/events', createHandler(handleGetAllEventsForAdmin));
  router.post('/admin/events/status', createHandler(handleUpdateEventStatus));
  router.post('/admin/events/featured', createHandler(handleUpdateEventFeatured));

  // Admin payments
  router.get('/admin/payments/config', createHandler(handleAdminGetPaymentConfig));
  router.post('/admin/payments/config', createHandler(handleAdminUpsertPaymentConfig));
  router.post('/admin/payments/test', createHandler(handleAdminTestPaymentConfig));
  router.get('/admin/payments/transactions', createHandler(handleAdminGetTransactions));
  router.get('/admin/payments/transactions/:id', createHandler(handleAdminGetTransactionById));
  router.post('/admin/payments/transactions/:id/refund', createHandler(handleAdminRefundTransaction));
  router.get('/admin/payments/webhook-logs', createHandler(handleAdminGetWebhookLogs));
  router.post('/admin/payments/webhook-logs/:id/replay', createHandler(handleAdminReplayWebhook));
  router.get('/admin/payments/summary', createHandler(handleAdminGetPaymentSummary));
  router.get('/admin/payments/export', createHandler(handleAdminExportPayments));
  router.get('/admin/payments/payouts', createHandler(handleAdminGetPayoutRequests));
  router.post('/admin/payments/payouts/:id/approve', createHandler(handleAdminApprovePayoutRequest));
  router.post('/admin/payments/payouts/:id/reject', createHandler(handleAdminRejectPayoutRequest));
  router.get('/admin/payments/platform-balance', createHandler(handleAdminGetPlatformBalance));
  router.post('/admin/payments/platform-payouts', createHandler(handleAdminCreatePlatformPayout));

  // Admin users
  router.get('/admin/users', createHandler(handleAdminGetUsers));
  router.post('/admin/users/:id/role', createHandler(handleAdminUpdateUserRole));
  router.post('/admin/users/:id/status', createHandler(handleAdminUpdateUserStatus));
  router.post('/admin/users/:id/reset-password', createHandler(handleAdminResetUserPassword));
  router.get('/admin/users/audit-logs', createHandler(handleAdminGetAuditLogs));

  // Admin notifications
  router.get('/admin/notifications/templates', createHandler(handleAdminGetNotificationTemplates));
  router.post('/admin/notifications/templates', createHandler(handleAdminCreateNotificationTemplate));
  router.put('/admin/notifications/templates/:id', createHandler(handleAdminUpdateNotificationTemplate));
  router.delete('/admin/notifications/templates/:id', createHandler(handleAdminDeleteNotificationTemplate));
  router.post('/admin/notifications/send', createHandler(handleAdminSendNotification));
  router.get('/admin/notifications/queue', createHandler(handleAdminGetNotificationQueue));
  router.post('/admin/notifications/queue/:id/resend', createHandler(handleAdminResendNotification));

  // Admin operations
  router.get('/admin/operations/revenue-trends', createHandler(handleAdminGetRevenueTrends));
  router.get('/admin/operations/funnel', createHandler(handleAdminGetFunnelMetrics));
  router.get('/admin/operations/refund-cases', createHandler(handleAdminGetRefundCases));
  router.post('/admin/operations/refund-cases/:id', createHandler(handleAdminUpdateRefundCase));

  // Admin settings
  router.get('/admin/settings/platform', createHandler(handleAdminGetPlatformSettings));
  router.put('/admin/settings/platform', createHandler(handleAdminUpdatePlatformSettings));
  router.get('/admin/settings/api-keys', createHandler(handleAdminGetApiKeys));
  router.post('/admin/settings/api-keys', createHandler(handleAdminCreateApiKey));
  router.post('/admin/settings/api-keys/:id/rotate', createHandler(handleAdminRotateApiKey));
  router.post('/admin/settings/api-keys/:id/revoke', createHandler(handleAdminRevokeApiKey));
  router.get('/admin/settings/data-exports', createHandler(handleAdminGetDataExports));
  router.post('/admin/settings/data-exports', createHandler(handleAdminRequestDataExport));
  router.post('/admin/settings/data-exports/:id/status', createHandler(handleAdminUpdateExportStatus));

  // Location + recommendations
  router.get('/location/search', createHandler(handleSearchLocation));
  router.get('/location/reverse', createHandler(handleGetAddressFromCoordinates));
  router.post('/recommendations', createHandler(handleGetAIRecommendations));
  
  // Analytics
  router.get('/analysis', createHandler(handleGetAnalysisData));

  // Admin subscriptions
  router.get('/admin/subscriptions/tiers', createHandler(handleGetSubscriptionTiers));
  router.post('/admin/subscriptions/tiers', createHandler(handleCreateSubscriptionTier));
  router.put('/admin/subscriptions/tiers', createHandler(handleUpdateSubscriptionTier));
  router.delete('/admin/subscriptions/tiers', createHandler(handleDeleteSubscriptionTier));

  app.use('/api', router);
};
