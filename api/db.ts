// Import the essential storage modules
import { usersStore } from '../server/storage/usersStore';
import { eventsStore } from '../server/storage/eventsStore';
import { ticketsStore } from '../server/storage/ticketsStore';

// Import new modules for device authentication
import { devicesStore } from '../server/storage/devicesStore';
import { deviceTokensStore } from '../server/storage/deviceTokensStore';
import { scanLogsStore } from '../server/storage/scanLogsStore';
import { staffUsersStore } from '../server/storage/staffUsersStore';

import { paymentConfigStore } from '../server/storage/paymentConfigStore';
import { platformSettingsStore } from '../server/storage/platformSettingsStore';
import { gatewayTransactionsStore } from '../server/storage/gatewayTransactionsStore';
import { subscriptionTiersStore } from '../server/storage/subscriptionTiersStore';
import { auditLogsStore } from '../server/storage/auditLogsStore';
import { refundCasesStore } from '../server/storage/refundCasesStore';
import { apiKeysStore } from '../server/storage/apiKeysStore';
import { dataExportsStore } from '../server/storage/dataExportsStore';
import { notificationTemplatesStore } from '../server/storage/notificationTemplatesStore';
import { notificationQueueStore } from '../server/storage/notificationQueueStore';
import { webhookLogsStore } from '../server/storage/webhookLogsStore';
import { payoutMethodsStore } from '../server/storage/payoutMethodsStore';
import { passwordResetStore } from '../server/storage/passwordResetStore';
import { organizerKycStore } from '../server/storage/organizerKycStore';

// Combine all storage modules into a single db object
export const db = {
  users: usersStore,
  events: eventsStore,
  tickets: ticketsStore,
  // New modules for device authentication:
  devices: devicesStore,
  deviceTokens: deviceTokensStore,
  scanLogs: scanLogsStore,
  staffUsers: staffUsersStore,
  // Properly implemented modules:
  paymentConfigurations: paymentConfigStore,
  platformSettings: platformSettingsStore,
  gatewayTransactions: gatewayTransactionsStore,
  subscriptionTiers: subscriptionTiersStore,
  auditLogs: auditLogsStore,
  refundCases: refundCasesStore,
  apiKeys: apiKeysStore,
  dataExports: dataExportsStore,
  notificationTemplates: notificationTemplatesStore,
  notificationQueue: notificationQueueStore,
  webhookLogs: webhookLogsStore,
  payoutMethods: payoutMethodsStore,
  passwordResets: passwordResetStore,
  organizerKyc: organizerKycStore,
};
