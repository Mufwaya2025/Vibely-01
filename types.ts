export type EventCategory = 'Music' | 'Art' | 'Food' | 'Tech' | 'Sports' | 'Community';
export type EventStatus =
  | 'draft'
  | 'pending_approval'
  | 'published'
  | 'suspended'
  | 'rejected'
  | 'archived'
  | 'flagged';
export type UserRole = 'attendee' | 'manager' | 'admin';
export type UserStatus = 'active' | 'suspended' | 'onboarding';
export type AuthProvider = 'local' | 'google';
export type PaymentMethod = 'CreditCard' | 'MobileMoney';
export type TicketStatus = 'UNUSED' | 'USED' | 'BLOCKED';
export type TicketScanResult = 'VALID' | 'ALREADY_USED' | 'BLOCKED' | 'NOT_FOUND' | 'WRONG_EVENT' | 'EXPIRED';
export type PayoutAccountType = 'Bank' | 'MobileMoney';
export type TransactionType = 'Sale' | 'Payout' | 'Fee' | 'Refund';
export type PayoutStatus = 'Pending' | 'Completed' | 'Failed';
export type GatewayTransactionStatus = 'succeeded' | 'failed' | 'refunded' | 'pending';
export type RevenueRange = '7d' | '30d' | '90d' | '365d';
export type NotificationChannel = 'email' | 'push';
export type NotificationStatus = 'queued' | 'sent' | 'failed';
export type RefundStatus = 'open' | 'in_review' | 'resolved' | 'escalated';
export type ApiKeyStatus = 'active' | 'revoked';
export type DataExportStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type OrganizerType = 'individual' | 'company';
export type OrganizerPayoutMethod = 'bank' | 'mobile_money';
export type KycStatus =
  | 'not_started'
  | 'draft'
  | 'pending_review'
  | 'verified'
  | 'limited'
  | 'rejected';

export interface PayoutFeeTier {
  minAmount: number;
  maxAmount: number | null;
  fee: number;
}

export interface PayoutFeeSettings {
  bankAccount: PayoutFeeTier[];
  mobileMoney: PayoutFeeTier[];
}

export interface SubscriptionTier {
  id: string;
  name: string;
  description?: string;
  price: number; // 0 for free tiers
  currency: string;
  billingPeriod: 'monthly' | 'yearly' | 'one-time';
  features: Record<string, string | boolean>; // feature name -> value (boolean for yes/no, string for specific values)
  isActive: boolean;
  maxEvents?: number; // null or undefined means unlimited
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  // Optional bearer token for authenticated API requests
  authToken?: string;
  interests: EventCategory[];
  attendedEvents: string[]; // array of event IDs
  subscriptionTier?: 'Regular' | 'Pro';
  subscriptionExpiresAt?: string;
  authProviders?: AuthProvider[];
}

export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  latitude: number;
  longitude: number;
  price: number;
  category: EventCategory;
  imageUrl: string;
  organizer: {
    id: string;
    name: string;
  };
  reviewCount?: number;
  averageRating?: number;
  ticketQuantity: number;
  ticketsSold?: number;
  status?: EventStatus;
  flagCount?: number;
  isFeatured?: boolean;
  ticketTiers?: TicketTier[];
}

export interface Ticket {
  ticketId: string;
  id?: string;
  eventId: string;
  code: string;
  status: TicketStatus;
  holderName: string;
  holderEmail?: string;
  createdAt: string;
  usedAt?: string;
  tierId?: string;
  tierName?: string;
}

export interface StaffUser {
  id: string;
  email: string;
  passwordHash: string;
  name?: string;
  organizerId?: string;
  active: boolean;
  createdAt: string;
}

export interface OrganizerKycContacts {
  legalName: string;
  tradingName?: string;
  email: string;
  phone: string;
  nationalityOrRegistrationCountry: string;
  physicalAddress: string;
  eventCategory: string;
  attendanceRange: string;
  ticketPriceRange: string;
  revenueRange: string;
}

export interface OrganizerPayoutDetails {
  method: OrganizerPayoutMethod;
  bankName?: string;
  branch?: string;
  accountName?: string;
  accountNumber?: string;
  confirmationLetter?: string;
  walletProvider?: string;
  walletNumber?: string;
  walletHolder?: string;
}

export interface OrganizerIndividualDocuments {
  idType?: 'nrc' | 'passport';
  idNumber?: string;
  idFront?: string;
  idBack?: string;
  selfieWithId?: string;
  proofOfAddress?: string;
}

export interface OrganizerCompanyDocuments {
  pacraCertificate?: string;
  incorporationCertificate?: string;
  tpinCertificate?: string;
  authorisedRepId?: string;
  authorisationLetter?: string;
  proofOfAddress?: string;
}

export interface OrganizerEventDocumentation {
  eventDescription: string;
  eventPoster?: string;
  venueName?: string;
  venueLocation?: string;
  venueBookingConfirmation?: string;
  hostLetter?: string;
  policePermit?: string;
  securityPlan?: string;
  emergencyPlan?: string;
}

export interface OrganizerKycProfile {
  organizerId: string;
  organizerType: OrganizerType;
  status: KycStatus;
  contacts: OrganizerKycContacts;
  payoutDetails: OrganizerPayoutDetails;
  individualDocs?: OrganizerIndividualDocuments;
  companyDocs?: OrganizerCompanyDocuments;
  eventDocumentation: OrganizerEventDocumentation;
  verification: {
    emailVerified: boolean;
    verifiedAt?: string;
    lastOtpSentAt?: string;
  };
  submittedAt?: string;
  reviewedAt?: string;
  reviewerNotes?: string;
}

export interface OrganizerKycRequestPayload
  extends Omit<
    OrganizerKycProfile,
    'organizerId' | 'status' | 'verification' | 'submittedAt' | 'reviewedAt' | 'reviewerNotes'
  > {}

export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  latitude: number;
  longitude: number;
  price: number;
  category: EventCategory;
  imageUrl: string;
  organizer: {
    id: string;
    name: string;
  };
  reviewCount?: number;
  averageRating?: number;
  ticketQuantity: number;
  ticketsSold?: number;
  status?: EventStatus;
  flagCount?: number;
  isFeatured?: boolean;
  ticketTiers?: TicketTier[];
}

export interface Device {
  id: string;
  name?: string;
  staffUserId: string;
  organizerId?: string;
  eventId?: string;
  devicePublicId: string;
  deviceSecret: string;
  lastIp?: string;
  lastSeenAt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceToken {
  id: string;
  deviceId: string;
  token: string;
  expiresAt?: string;
  revokedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScanLog {
  id: string;
  ticketId: string;
  eventId: string;
  deviceId: string;
  staffUserId: string;
  scanResult: TicketScanResult;
  message: string;
  scannedAt: string;
  lat?: number;
  lon?: number;
  ip?: string;
  createdAt: string;
}

export interface TicketTier {
  id: string;
  name: string;
  price: number;
  quantity: number;
  benefits?: string;
}

export interface PaymentDetails {
  creditCard?: {
    number: string;
    expiry: string;
    cvc: string;
  };
  mobileMoney?: {
    phone: string;
  };
}

export interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export interface PayoutMethod {
    id: string;
    userId: string;
    type: PayoutAccountType;
    details: string; // Masked label for UI display
    accountInfo: string; // Account holder name
    bankName?: string;
    bankCode?: string;
    accountNumber?: string;
    mobileMoneyProvider?: string;
    phoneNumber?: string;
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface Transaction {
    id: string;
    type: TransactionType;
    amount: number;
    date: string;
    description: string;
    eventTitle?: string;
}

export interface Payout {
    id: string;
    amount: number;
    status: PayoutStatus;
    requestedAt: string;
    completedAt?: string;
    payoutMethodId: string;
}

export interface MonthlyRevenue {
    month: string;
    revenue: number;
}

export interface EventPerformance {
    eventId: string;
    eventName: string;
    ticketsSold: number;
}

export interface AnalysisData {
  topPerformingEvent: Event | null;
  demographics: {
    age: Record<string, number>;
    gender: Record<string, number>;
  };
  salesData: {
    byDay: { date: string; tickets: number }[];
    byCategory: { category: EventCategory; tickets: number }[];
  };
}

export interface AdminStats {
  totalUsers: number;
  usersByRole: Record<UserRole, number>;
  totalEvents: number;
  upcomingEvents: number;
  pastEvents: number;
  totalTickets: number;
  totalRevenue: number;
  averageTicketPrice: number;
  topCategories: { category: EventCategory; count: number }[];
  recentEvents: Event[];
}

export interface PaymentConfiguration {
  id: string;
  provider: string;
  publicKey: string;
  secretKeyEncrypted: string;
  isLiveMode: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GatewayTransaction {
  id: string;
  externalId: string;
  reference?: string;
  lencoReference?: string;
  purpose?: 'ticket' | 'subscription' | 'payout';
  eventId?: string;
  userId: string;
  organizerId?: string;
  ticketId?: string;
  amount: number;
  currency: string;
  fee?: number;
  bearer?: 'merchant' | 'customer';
  status: GatewayTransactionStatus;
  provider: string;
  paymentMethod?: PaymentMethod;
  channel?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  rawResponse?: Record<string, unknown>;
}

export interface WebhookLog {
  id: string;
  provider: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: 'received' | 'processed' | 'failed';
  createdAt: string;
  updatedAt: string;
  responseMessage?: string;
}

export interface AdminAuditLogEntry {
  id: string;
  actorId: string;
  targetUserId: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  channel: NotificationChannel;
  audienceDescription: string;
  subject: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface RevenueTrendPoint {
  date: string;
  gross: number;
  refunds: number;
  net: number;
}

export interface RevenueTrendResponse {
  points: RevenueTrendPoint[];
  summary: {
    totalGross: number;
    totalRefunds: number;
    totalNet: number;
  };
}

export interface FunnelMetrics {
  pageViews: number;
  eventDetailViews: number;
  addToCart: number;
  ticketsPurchased: number;
  conversionRate: number;
  dropOffRate: number;
}

export interface RefundCaseNote {
  id: string;
  message: string;
  authorId: string;
  createdAt: string;
}

export interface RefundCase {
  id: string;
  transactionId: string;
  eventId: string;
  customerName: string;
  amount: number;
  currency: string;
  status: RefundStatus;
  reason: string;
  openedAt: string;
  slaDueAt: string;
  lastUpdatedAt: string;
  assignedTo?: string;
  notes: RefundCaseNote[];
}

export interface PlatformSettings {
  platformFeePercent: number;
  payoutCurrency: string;
  autoPayoutsEnabled: boolean;
  payoutFees: PayoutFeeSettings;
  updatedAt: string;
  updatedBy?: string;
}

export interface ApiKeyRecord {
  id: string;
  name: string;
  description?: string;
  scopes: string[];
  status: ApiKeyStatus;
  lastUsedAt?: string;
  createdAt: string;
  maskedKey: string;
}

export interface DataExportJob {
  id: string;
  type: 'events' | 'transactions' | 'users';
  status: DataExportStatus;
  requestedBy: string;
  requestedAt: string;
  completedAt?: string;
  downloadUrl?: string;
  errorMessage?: string;
}

export interface NotificationQueueEntry {
  id: string;
  templateId: string;
  templateName: string;
  channel: NotificationChannel;
  audienceDescription: string;
  status: NotificationStatus;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  content: string;
  timestamp: string; // ISO date string
  read: boolean;
}
