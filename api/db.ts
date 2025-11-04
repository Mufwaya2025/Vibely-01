import {
  Event,
  User,
  Ticket,
  PayoutMethod,
  Transaction,
  Payout,
  PaymentConfiguration,
  GatewayTransaction,
  GatewayTransactionStatus,
  WebhookLog,
  AdminAuditLogEntry,
  UserRole,
  UserStatus,
  NotificationTemplate,
  NotificationQueueEntry,
  NotificationStatus,
  RefundCase,
  RefundStatus,
  RefundCaseNote,
  PaymentMethod,
  PlatformSettings,
  ApiKeyRecord,
  ApiKeyStatus,
  DataExportJob,
  DataExportStatus,
  SubscriptionTier,
} from '../types';
import { MOCK_EVENTS } from '../constants';
import { encryptSecret, decryptSecret } from '../utils/encryption';
import { usersStore } from '../server/storage/usersStore';

// --- This file simulates a simple in-memory database ---

let events: Event[] = [...MOCK_EVENTS];
let tickets: Ticket[] = [];
let paymentConfigurations: PaymentConfiguration[] = [
  {
    id: 'conf-initial',
    provider: 'MockPay',
    publicKey: 'pk_test_mockpay',
    secretKeyEncrypted: encryptSecret('sk_test_mockpay'),
    isLiveMode: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];
let gatewayTransactions: GatewayTransaction[] = [
  {
    id: 'gtxn-1001',
    externalId: 'live_1001',
    reference: 'ref-initial-1001',
    purpose: 'ticket',
    eventId: 'evt-001',
    userId: 'user-001',
    organizerId: 'user-002',
    amount: 350,
    currency: 'ZMW',
    status: 'succeeded',
    provider: 'MockPay',
    paymentMethod: 'CreditCard',
    metadata: { source: 'landing_page' },
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'gtxn-1002',
    externalId: 'live_1002',
    reference: 'ref-initial-1002',
    purpose: 'ticket',
    eventId: 'evt-003',
    userId: 'user-001',
    organizerId: 'user-002',
    amount: 50,
    currency: 'ZMW',
    status: 'succeeded',
    provider: 'MockPay',
    paymentMethod: 'MobileMoney',
    metadata: { source: 'map_view' },
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'gtxn-1003',
    externalId: 'live_1003',
    reference: 'ref-initial-1003',
    purpose: 'ticket',
    eventId: 'evt-006',
    userId: 'user-001',
    organizerId: 'user-002',
    amount: 100,
    currency: 'ZMW',
    status: 'refunded',
    provider: 'MockPay',
    paymentMethod: 'CreditCard',
    metadata: { source: 'email_campaign' },
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'gtxn-1004',
    externalId: 'live_1004',
    reference: 'ref-initial-1004',
    purpose: 'ticket',
    eventId: 'evt-004',
    userId: 'user-001',
    organizerId: 'user-002',
    amount: 500,
    currency: 'ZMW',
    status: 'succeeded',
    provider: 'MockPay',
    paymentMethod: 'CreditCard',
    metadata: { source: 'recommendation_engine' },
    createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
  },
];
let webhookLogs: WebhookLog[] = [];
let auditLogs: AdminAuditLogEntry[] = [];
let notificationTemplates: NotificationTemplate[] = [
  {
    id: 'tmpl-welcome-managers',
    name: 'Monthly Manager Digest',
    channel: 'email',
    audienceDescription: 'Managers hosting events this month',
    subject: 'Keep your events thriving this month',
    body:
      'Hi there! Here are quick tips and reminders to maximize your upcoming events. Reply if you need support.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tmpl-attendees-lusaka',
    name: 'Lusaka Event Highlights',
    channel: 'push',
    audienceDescription: 'Attendees within 20km of Lusaka CBD',
    subject: 'Vibes near you this week',
    body: 'Discover fresh vibes happening near Lusaka. Tap to RSVP before spots sell out!',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let notificationQueue: NotificationQueueEntry[] = [
  {
    id: 'notif-001',
    templateId: 'tmpl-welcome-managers',
    templateName: 'Monthly Manager Digest',
    channel: 'email',
    audienceDescription: 'Managers with published events happening in the next 30 days',
    status: 'sent',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'notif-002',
    templateId: 'tmpl-attendees-lusaka',
    templateName: 'Lusaka Event Highlights',
    channel: 'push',
    audienceDescription: 'Attendees within 20km of Lusaka CBD',
    status: 'failed',
    errorMessage: 'Provider timeout. Try again shortly.',
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
  },
];
let refundCases: RefundCase[] = [
  {
    id: 'rc-001',
    transactionId: 'gtxn-1003',
    eventId: 'evt-006',
    customerName: 'Jane Doe',
    amount: 100,
    currency: 'ZMW',
    status: 'in_review',
    reason: 'Event postponed due to weather',
    openedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    slaDueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    assignedTo: 'ops@vibely.com',
    notes: [
      {
        id: 'note-rc-001-1',
        message: 'Customer submitted official complaint via email.',
        authorId: 'user-003',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    id: 'rc-002',
    transactionId: 'gtxn-1002',
    eventId: 'evt-003',
    customerName: 'Emily Chipo',
    amount: 50,
    currency: 'ZMW',
    status: 'open',
    reason: 'Duplicate charge detected',
    openedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    slaDueAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    notes: [],
  },
  {
    id: 'rc-003',
    transactionId: 'gtxn-1001',
    eventId: 'evt-001',
    customerName: 'Michael Banda',
    amount: 350,
    currency: 'ZMW',
    status: 'resolved',
    reason: 'Customer purchased wrong ticket tier',
    openedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    slaDueAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdatedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    assignedTo: 'claims@vibely.com',
    notes: [
      {
        id: 'note-rc-003-1',
        message: 'Issued partial refund after confirming duplicate purchase.',
        authorId: 'user-003',
        createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  },
];
let platformSettings: PlatformSettings = {
  platformFeePercent: 7.5,
  payoutCurrency: 'ZMW',
  autoPayoutsEnabled: true,
  updatedAt: new Date().toISOString(),
  updatedBy: 'user-003',
};

let subscriptionTiers: SubscriptionTier[] = [
  {
    id: 'tier-regular',
    name: 'Regular',
    description: 'Free tier for basic event management',
    price: 0,
    currency: 'ZMW',
    billingPeriod: 'monthly',
    features: {
      'Event Creation': 'Up to 3 events',
      'Ticket Sales': true,
      'Basic Analytics': true,
      'Email Support': false,
      'Custom Branding': false,
    },
    isActive: true,
    maxEvents: 3,
    sortOrder: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tier-pro',
    name: 'Pro',
    description: 'Premium tier with advanced features',
    price: 500,
    currency: 'ZMW',
    billingPeriod: 'monthly',
    features: {
      'Event Creation': 'Unlimited events',
      'Ticket Sales': true,
      'Basic Analytics': true,
      'Email Support': true,
      'Custom Branding': true,
    },
    isActive: true,
    maxEvents: undefined, // unlimited
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let apiKeys: ApiKeyRecord[] = [
  {
    id: 'key-001',
    name: 'Zapier Integration',
    description: 'Automated workflows for organizer onboarding',
    scopes: ['events:read', 'events:write'],
    status: 'active',
    lastUsedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
    maskedKey: 'sk_live_f3c2****1ab8',
  },
  {
    id: 'key-002',
    name: 'Analytics Warehouse',
    description: 'Internal pipeline pushing metrics to BigQuery',
    scopes: ['transactions:read', 'users:read'],
    status: 'active',
    lastUsedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
    maskedKey: 'sk_live_92af****9c51',
  },
  {
    id: 'key-003',
    name: 'Legacy CRM',
    description: 'Deprecated CRM sync',
    scopes: ['events:read'],
    status: 'revoked',
    lastUsedAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
    maskedKey: 'sk_live_1d34****7e20',
  },
];

let dataExports: DataExportJob[] = [
  {
    id: 'export-001',
    type: 'events',
    status: 'completed',
    requestedBy: 'user-003',
    requestedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000).toISOString(),
    downloadUrl: '/downloads/export-001-events.csv',
  },
  {
    id: 'export-002',
    type: 'transactions',
    status: 'processing',
    requestedBy: 'user-003',
    requestedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'export-003',
    type: 'users',
    status: 'failed',
    requestedBy: 'user-003',
    requestedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
    errorMessage: 'S3 upload failed. Please retry.',
  },
];

// Initialize the super admin user 
const superAdminUser = usersStore.findByEmail('admin@vibely.com');
if (superAdminUser) {
  // For the update, we need to use the internal stored user type that has passwordHash
  const internalUser = usersStore.findById(superAdminUser.id);
  if (internalUser) {
    // Check if the user has the old default password hash and update if needed
    // The bcrypt hash for 'password' with default salt would be different from 'Password99!!'
    
    // Update the user with correct settings, with special handling for password
    const updates: Partial<User> = {
      subscriptionTier: superAdminUser.subscriptionTier ?? 'Pro',
      subscriptionExpiresAt: null, // No expiration for super admin
    };
    
    // Since we can't easily compare bcrypt hashes directly,
    // we'll just make sure the user has the correct password hash set
    // This will ensure they can log in with 'Password99!!' 
    usersStore.update(superAdminUser.id, {
      ...updates,
      passwordHash: usersStore.hashPassword('Password99!!'), // Always set the correct password
    });
  }
}

const db = {
  events: {
    findAll: () => events,
    findById: (id: string) => events.find(e => e.id === id),
    findByOrganizer: (organizerId: string) => events.filter(e => e.organizer.id === organizerId),
    create: (eventData: Omit<Event, 'id'>) => {
      const totalTierQuantity = (eventData.ticketTiers ?? []).reduce(
        (sum, tier) => sum + (tier.quantity ?? 0),
        0
      );
      const lowestTierPrice =
        eventData.ticketTiers && eventData.ticketTiers.length > 0
          ? Math.min(...eventData.ticketTiers.map((tier) => tier.price))
          : undefined;
      const newEvent: Event = {
        ...eventData,
        id: `evt-${Date.now()}`,
        status: eventData.status ?? 'published',
        flagCount: eventData.flagCount ?? 0,
        ticketsSold: eventData.ticketsSold ?? 0,
        isFeatured: eventData.isFeatured ?? false,
        ticketQuantity:
          totalTierQuantity > 0 ? totalTierQuantity : eventData.ticketQuantity,
        price:
          lowestTierPrice !== undefined ? lowestTierPrice : eventData.price,
      };
      events.push(newEvent);
      return newEvent;
    },
    update: (id: string, updates: Partial<Event>) => {
      const index = events.findIndex(e => e.id === id);
      if (index === -1) return null;
      events[index] = { ...events[index], ...updates };
      return events[index];
    },
  },
  users: {
    findByEmail: (email: string) => usersStore.toPublicUser(usersStore.findByEmail(email)),
    findById: (id: string) => usersStore.toPublicUser(usersStore.findById(id)),
    findAll: () =>
      usersStore
        .getAll()
        .map((user) => usersStore.toPublicUser(user))
        .filter((user): user is User => !!user),
    findByStatus: (status: UserStatus) =>
      usersStore
        .getAll()
        .filter((user) => user.status === status)
        .map((user) => usersStore.toPublicUser(user))
        .filter((user): user is User => !!user),
    updateRole: (userId: string, role: UserRole) => {
      const updated = usersStore.update(userId, { role });
      return usersStore.toPublicUser(updated);
    },
    updateStatus: (userId: string, status: UserStatus) => {
      const updated = usersStore.update(userId, { status });
      return usersStore.toPublicUser(updated);
    },
    resetPassword: (userId: string) => {
      const updated = usersStore.update(userId, { passwordHash: usersStore.hashPassword('password') });
      return usersStore.toPublicUser(updated);
    },
    updateSubscription: (userId: string, tier: 'Pro' | 'Regular', expiresAt?: string | null) => {
      const updated = usersStore.update(userId, {
        subscriptionTier: tier,
        subscriptionExpiresAt: tier === 'Pro' ? expiresAt ?? null : undefined,
      });
      return usersStore.toPublicUser(updated);
    },
  },
  tickets: {
    findAll: () => tickets,
    findByUser: (userId: string) => tickets.filter(t => t.userId === userId),
    findByEvent: (eventId: string) => tickets.filter(t => t.eventId === eventId),
    findById: (id: string) => tickets.find(t => t.ticketId === id),
    create: (ticket: Ticket) => {
      tickets.push(ticket);
      return ticket;
    },
    update: (id: string, updates: Partial<Ticket>) => {
      const index = tickets.findIndex(t => t.ticketId === id);
      if (index > -1) {
        tickets[index] = { ...tickets[index], ...updates };
        return tickets[index];
      }
      return null;
    },
  },
  paymentConfigurations: {
    getLatest: () => paymentConfigurations[paymentConfigurations.length - 1] ?? null,
    upsert: (config: {
      provider: string;
      publicKey: string;
      secretKey?: string;
      isLiveMode: boolean;
    }) => {
      const existing = paymentConfigurations[paymentConfigurations.length - 1] ?? null;
      const newConfig: PaymentConfiguration = {
        id: `conf-${Date.now()}`,
        provider: config.provider,
        publicKey: config.publicKey,
        secretKeyEncrypted: config.secretKey
          ? encryptSecret(config.secretKey)
          : existing
          ? existing.secretKeyEncrypted
          : encryptSecret(''),
        isLiveMode: config.isLiveMode,
        createdAt: existing ? existing.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      paymentConfigurations.push(newConfig);
      return newConfig;
    },
    decryptSecret: (encrypted: string) => decryptSecret(encrypted),
  },
  gatewayTransactions: {
    findAll: () => gatewayTransactions,
    findById: (id: string) => gatewayTransactions.find((t) => t.id === id) || null,
    findByReference: (reference: string) =>
      gatewayTransactions.find((t) => t.reference === reference) || null,
    create: (data: Omit<GatewayTransaction, 'id' | 'createdAt' | 'updatedAt'>) => {
      const generatedId = ['gtxn', Date.now().toString(), Math.floor(Math.random() * 1000).toString()].join('-');
      const newTxn: GatewayTransaction = {
        ...data,
        id: generatedId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      gatewayTransactions.push(newTxn);
      return newTxn;
    },
    updateById: (id: string, updates: Partial<GatewayTransaction>) => {
      const idx = gatewayTransactions.findIndex((t) => t.id === id);
      if (idx === -1) return null;
      gatewayTransactions[idx] = {
        ...gatewayTransactions[idx],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      return gatewayTransactions[idx];
    },
    updateByReference: (reference: string, updates: Partial<GatewayTransaction>) => {
      const txn = gatewayTransactions.find((t) => t.reference === reference);
      if (!txn) return null;
      return db.gatewayTransactions.updateById(txn.id, updates);
    },
    updateStatus: (id: string, status: GatewayTransactionStatus) =>
      db.gatewayTransactions.updateById(id, { status }),
    attachTicket: (id: string, ticketId: string) =>
      db.gatewayTransactions.updateById(id, { ticketId }),
    deleteById: (id: string) => {
      const initialLength = gatewayTransactions.length;
      gatewayTransactions = gatewayTransactions.filter((txn) => txn.id !== id);
      return initialLength !== gatewayTransactions.length;
    },
    deleteWhere: (predicate: (txn: GatewayTransaction) => boolean) => {
      const initialLength = gatewayTransactions.length;
      gatewayTransactions = gatewayTransactions.filter((txn) => !predicate(txn));
      return initialLength - gatewayTransactions.length;
    },
  },
  webhookLogs: {
    findAll: () => webhookLogs,
    findById: (id: string) => webhookLogs.find((log) => log.id === id) || null,
    create: (log: Omit<WebhookLog, 'id' | 'createdAt' | 'updatedAt'>) => {
      const entry: WebhookLog = {
        ...log,
        id: `wh-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      webhookLogs.push(entry);
      return entry;
    },
    updateStatus: (id: string, status: WebhookLog['status'], responseMessage?: string) => {
      const idx = webhookLogs.findIndex((log) => log.id === id);
      if (idx === -1) return null;
      webhookLogs[idx] = {
        ...webhookLogs[idx],
        status,
        responseMessage,
        updatedAt: new Date().toISOString(),
      };
      return webhookLogs[idx];
    },
  },
  notificationTemplates: {
    findAll: () => notificationTemplates,
    findById: (id: string) => notificationTemplates.find((tpl) => tpl.id === id) || null,
    create: (data: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
      const template: NotificationTemplate = {
        ...data,
        id: `tmpl-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      notificationTemplates.push(template);
      return template;
    },
    update: (id: string, updates: Partial<NotificationTemplate>) => {
      const idx = notificationTemplates.findIndex((tpl) => tpl.id === id);
      if (idx === -1) return null;
      notificationTemplates[idx] = {
        ...notificationTemplates[idx],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      return notificationTemplates[idx];
    },
    delete: (id: string) => {
      const idx = notificationTemplates.findIndex((tpl) => tpl.id === id);
      if (idx === -1) return false;
      notificationTemplates.splice(idx, 1);
      return true;
    },
  },
  notificationQueue: {
    findAll: () =>
      [...notificationQueue].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    findById: (id: string) => notificationQueue.find((entry) => entry.id === id) || null,
    create: (
      data: Omit<NotificationQueueEntry, 'id' | 'createdAt' | 'updatedAt'> & {
        status?: NotificationStatus;
        errorMessage?: string;
      }
    ) => {
      const entry: NotificationQueueEntry = {
        ...data,
        status: data.status ?? 'queued',
        errorMessage: data.errorMessage,
        id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      notificationQueue.push(entry);
      return entry;
    },
    updateStatus: (
      id: string,
      status: NotificationStatus,
      errorMessage?: string
    ) => {
      const idx = notificationQueue.findIndex((entry) => entry.id === id);
      if (idx === -1) return null;
      notificationQueue[idx] = {
        ...notificationQueue[idx],
        status,
        errorMessage,
        updatedAt: new Date().toISOString(),
      };
      return notificationQueue[idx];
    },
  },
  refundCases: {
    findAll: () =>
      [...refundCases].sort(
        (a, b) => new Date(a.slaDueAt).getTime() - new Date(b.slaDueAt).getTime()
      ),
    findById: (id: string) => refundCases.find((rc) => rc.id === id) || null,
    updateStatus: (id: string, status: RefundStatus, note?: Omit<RefundCaseNote, 'id' | 'createdAt'>) => {
      const idx = refundCases.findIndex((rc) => rc.id === id);
      if (idx === -1) return null;
      const notes = [...refundCases[idx].notes];
      if (note) {
        notes.push({
          ...note,
          id: `note-${id}-${Date.now()}`,
          createdAt: new Date().toISOString(),
        });
      }
      refundCases[idx] = {
        ...refundCases[idx],
        status,
        notes,
        lastUpdatedAt: new Date().toISOString(),
      };
      return refundCases[idx];
    },
    addNote: (id: string, note: Omit<RefundCaseNote, 'id' | 'createdAt'>) => {
      const idx = refundCases.findIndex((rc) => rc.id === id);
      if (idx === -1) return null;
      const newNote: RefundCaseNote = {
        ...note,
        id: `note-${id}-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      refundCases[idx] = {
        ...refundCases[idx],
        notes: [...refundCases[idx].notes, newNote],
        lastUpdatedAt: new Date().toISOString(),
      };
      return newNote;
    },
  },
  platformSettings: {
    get: () => platformSettings,
    update: (updates: Partial<PlatformSettings> & { updatedBy: string }) => {
      platformSettings = {
        ...platformSettings,
        ...updates,
        updatedAt: new Date().toISOString(),
        updatedBy: updates.updatedBy,
      };
      return platformSettings;
    },
  },
  apiKeys: {
    findAll: () => apiKeys,
    create: (data: { name: string; description?: string; scopes: string[] }) => {
      const rawKey = `sk_live_${Math.random().toString(36).slice(2, 10)}${Date.now()
        .toString(36)
        .slice(-4)}`;
      const maskedKey = `${rawKey.slice(0, 8)}****${rawKey.slice(-4)}`;
      const record: ApiKeyRecord = {
        id: `key-${Date.now()}`,
        name: data.name,
        description: data.description,
        scopes: data.scopes,
        status: 'active',
        lastUsedAt: undefined,
        createdAt: new Date().toISOString(),
        maskedKey,
      };
      apiKeys.push(record);
      return { record, rawKey };
    },
    revoke: (id: string) => {
      const idx = apiKeys.findIndex((key) => key.id === id);
      if (idx === -1) return null;
      apiKeys[idx] = { ...apiKeys[idx], status: 'revoked' };
      return apiKeys[idx];
    },
    rotate: (id: string) => {
      const idx = apiKeys.findIndex((key) => key.id === id);
      if (idx === -1) return null;
      const rawKey = `sk_live_${Math.random().toString(36).slice(2, 10)}${Date.now()
        .toString(36)
        .slice(-4)}`;
      const maskedKey = `${rawKey.slice(0, 8)}****${rawKey.slice(-4)}`;
      apiKeys[idx] = {
        ...apiKeys[idx],
        maskedKey,
        status: 'active',
        lastUsedAt: undefined,
      };
      return { record: apiKeys[idx], rawKey };
    },
  },
  dataExports: {
    findAll: () =>
      [...dataExports].sort(
        (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
      ),
    create: (data: { type: DataExportJob['type']; requestedBy: string }) => {
      const job: DataExportJob = {
        id: `export-${Date.now()}`,
        type: data.type,
        status: 'pending',
        requestedBy: data.requestedBy,
        requestedAt: new Date().toISOString(),
      };
      dataExports.push(job);
      return job;
    },
    updateStatus: (
      id: string,
      status: DataExportStatus,
      updates?: Partial<DataExportJob>
    ) => {
      const idx = dataExports.findIndex((job) => job.id === id);
      if (idx === -1) return null;
      dataExports[idx] = {
        ...dataExports[idx],
        status,
        ...updates,
        completedAt:
          status === 'completed' || status === 'failed'
            ? updates?.completedAt ?? new Date().toISOString()
            : dataExports[idx].completedAt,
      };
      return dataExports[idx];
    },
  },
  auditLogs: {
    findAll: () =>
      [...auditLogs].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ),
    create: (log: Omit<AdminAuditLogEntry, 'id' | 'timestamp'>) => {
      const entry: AdminAuditLogEntry = {
        ...log,
        id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
      };
      auditLogs.push(entry);
      return entry;
    },
  },
  subscriptionTiers: {
    findAll: () => [...subscriptionTiers].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
    findById: (id: string) => subscriptionTiers.find((tier) => tier.id === id) || null,
    create: (data: Omit<SubscriptionTier, 'id' | 'createdAt' | 'updatedAt'>) => {
      const newTier: SubscriptionTier = {
        ...data,
        id: `tier-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      subscriptionTiers.push(newTier);
      return newTier;
    },
    update: (id: string, updates: Partial<SubscriptionTier>) => {
      const idx = subscriptionTiers.findIndex((tier) => tier.id === id);
      if (idx === -1) return null;
      subscriptionTiers[idx] = {
        ...subscriptionTiers[idx],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      return subscriptionTiers[idx];
    },
    delete: (id: string) => {
      const initialLength = subscriptionTiers.length;
      subscriptionTiers = subscriptionTiers.filter((tier) => tier.id !== id);
      return subscriptionTiers.length !== initialLength;
    },
  },
};

export { db };
