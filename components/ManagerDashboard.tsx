import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  User,
  Event,
  SubscriptionTier,
  OrganizerKycProfile,
  OrganizerKycRequestPayload,
} from '../types';
import { getSubscriptionTiers, cancelSubscription } from '../services/subscriptionService';
import {
  fetchSubscriptionTransactions,
  SubscriptionTransactionSummary,
  verifyPaymentReference,
  ProcessPaymentResult,
} from '../services/paymentService';
import {
  getOrganizerKycProfile,
  requestOrganizerEmailOtp,
  submitOrganizerKycProfile,
  verifyOrganizerEmailOtp,
} from '../services/kycService';

import CreateEventModal from './CreateEventModal';
import EditEventModal from './EditEventModal';
import ManageEventView from './ManageEventView';
import OrganizerKycModal from './OrganizerKycModal';

const formatEventStatusLabel = (status: Event['status']) => {
  if (!status) return 'Published';
  return status
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
};

const getStatusBadgeClass = (status: Event['status']) => {
  switch (status) {
    case 'published':
      return 'bg-emerald-100 text-emerald-700';
    case 'pending_approval':
    case 'draft':
      return 'bg-amber-100 text-amber-700';
    case 'rejected':
      return 'bg-red-100 text-red-700';
    case 'suspended':
      return 'bg-slate-200 text-slate-700';
    case 'archived':
      return 'bg-slate-300 text-slate-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
};

const getStatusHelperText = (status: Event['status']) => {
  switch (status) {
    case 'pending_approval':
      return 'Awaiting admin approval before going live.';
    case 'rejected':
      return 'Rejected — review and update details before resubmitting.';
    case 'suspended':
      return 'Suspended by the admin team. Check your inbox for next steps.';
    case 'draft':
      return 'Draft — finish editing and request approval when ready.';
    case 'archived':
      return 'Archived — no longer available to attendees.';
    default:
      return null;
  }
};

const getKycStatusLabel = (status: OrganizerKycProfile['status']) => {
  switch (status) {
    case 'verified':
      return 'Verified';
    case 'pending_review':
      return 'Pending Review';
    case 'limited':
      return 'Limited';
    case 'rejected':
      return 'Rejected';
    case 'draft':
      return 'Draft';
    case 'not_started':
    default:
      return 'Not Started';
  }
};

const getKycStatusColor = (status: OrganizerKycProfile['status']) => {
  switch (status) {
    case 'verified':
      return 'bg-emerald-100 text-emerald-700';
    case 'pending_review':
      return 'bg-amber-100 text-amber-700';
    case 'limited':
    case 'draft':
      return 'bg-slate-200 text-slate-800';
    case 'rejected':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
};

const getKycStatusDescription = (status: OrganizerKycProfile['status']) => {
  switch (status) {
    case 'verified':
      return 'Your payouts and high-value events are fully enabled.';
    case 'pending_review':
      return 'Our compliance team is reviewing your submission.';
    case 'limited':
      return 'Some features remain limited until we receive the requested documents.';
    case 'rejected':
      return 'We need updated information before you can publish large events.';
    case 'draft':
    case 'not_started':
    default:
      return 'Complete organizer KYC to unlock higher payout limits and faster approvals.';
  }
};

import AnalysisDashboard from './AnalysisDashboard';
import RevenueDashboard from './RevenueDashboard';
import SettingsDashboard from './SettingsDashboard';
import SubscriptionModal from './SubscriptionModal';
import ManagerMessaging from './ManagerMessaging';
import TransactionHistoryPanel from './TransactionHistoryPanel';
import ListIcon from './icons/ListIcon';
import ChartBarIcon from './icons/ChartBarIcon';
import WalletIcon from './icons/WalletIcon';
import CreditCardIcon from './icons/CreditCardIcon';
import BankIcon from './icons/BankIcon';
import CogIcon from './icons/CogIcon';
import PlusCircleIcon from './icons/PlusCircleIcon';
import QrCodeIcon from './icons/QrCodeIcon';
import TicketScanner from './TicketScanner';

interface ManagerDashboardProps {
  user: User;
  events: Event[];
  onCreateEvent: (eventData: Omit<Event, 'id' | 'organizer'>) => Promise<void>;
  onEditEvent: (eventData: Event) => Promise<void>;
  onSubscriptionUpgrade: (updatedUser: User) => void;
  onSubscriptionDowngrade: (updatedUser: User) => void;
  onLogout: () => void;
  onNavigateHome?: () => void;
}

type Tab =
  | 'events'
  | 'analytics'
  | 'revenue'
  | 'transactions'
  | 'subscriptions'
  | 'settings'
  | 'scanner'
  | 'messages';

const ManagerDashboard: React.FC<ManagerDashboardProps> = ({
  user,
  events,
  onCreateEvent,
  onEditEvent,
  onSubscriptionUpgrade,
  onSubscriptionDowngrade,
  onLogout,
  onNavigateHome,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('events');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [subscriptionTiers, setSubscriptionTiers] = useState<SubscriptionTier[]>([]);
  const [isLoadingSubscriptionTiers, setIsLoadingSubscriptionTiers] = useState<boolean>(false);
  const [subscriptionTiersError, setSubscriptionTiersError] = useState<string | null>(null);
  const [isDowngrading, setIsDowngrading] = useState(false);
  const [downgradeError, setDowngradeError] = useState<string | null>(null);
  const [subscriptionTransactions, setSubscriptionTransactions] = useState<SubscriptionTransactionSummary[]>([]);
  const [isLoadingSubscriptionTransactions, setIsLoadingSubscriptionTransactions] = useState(false);
  const [subscriptionTransactionsError, setSubscriptionTransactionsError] = useState<string | null>(null);
  const [subscriptionTransactionsNotice, setSubscriptionTransactionsNotice] = useState<string | null>(null);
  const [verifyingReference, setVerifyingReference] = useState<string | null>(null);
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [scannerEventId, setScannerEventId] = useState<string | null>(null);
  // Messaging state
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversation, setActiveConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const defaultKycProfile: OrganizerKycProfile = {
    organizerId: user.id,
    organizerType: 'individual',
    status: 'not_started',
    contacts: {
      legalName: user.name,
      tradingName: '',
      email: user.email,
      phone: '',
      nationalityOrRegistrationCountry: '',
      physicalAddress: '',
      eventCategory: '',
      attendanceRange: '',
      ticketPriceRange: '',
      revenueRange: '',
    },
    payoutDetails: {
      method: 'bank',
      bankName: '',
      branch: '',
      accountName: '',
      accountNumber: '',
      confirmationLetter: '',
    },
    individualDocs: {
      idType: 'nrc',
      idNumber: '',
      idFront: '',
      idBack: '',
      selfieWithId: '',
      proofOfAddress: '',
    },
    eventDocumentation: {
      eventDescription: '',
      eventPoster: '',
      venueName: '',
      venueLocation: '',
      venueBookingConfirmation: '',
      hostLetter: '',
      policePermit: '',
      securityPlan: '',
      emergencyPlan: '',
    },
    verification: {
      emailVerified: false,
    },
  };

  const [kycProfile, setKycProfile] = useState<OrganizerKycProfile>(defaultKycProfile);
  const [isKycModalOpen, setIsKycModalOpen] = useState(false);
  const [isLoadingKyc, setIsLoadingKyc] = useState(false);
  const [isSubmittingKyc, setIsSubmittingKyc] = useState(false);
  const [isSendingKycOtp, setIsSendingKycOtp] = useState(false);
  const [isVerifyingKycOtp, setIsVerifyingKycOtp] = useState(false);
  const [kycBanner, setKycBanner] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const loadKycProfile = useCallback(async () => {
    if (user.role !== 'manager') return;
    setIsLoadingKyc(true);
    try {
      const profile = await getOrganizerKycProfile(user);
      setKycProfile(profile);
    } catch (err) {
      console.error('Failed to load KYC profile', err);
      setKycProfile(defaultKycProfile);
      setKycBanner({
        type: 'error',
        message:
          err instanceof Error ? err.message : 'Unable to load your organizer verification info.',
      });
    } finally {
      setIsLoadingKyc(false);
    }
  }, [user]);

  useEffect(() => {
    if (user.role === 'manager') {
      void loadKycProfile();
    }
  }, [user.id, user.role, loadKycProfile]);

  const handleSubmitKycProfile = async (payload: OrganizerKycRequestPayload) => {
    setIsSubmittingKyc(true);
    setKycBanner(null);
    try {
      const profile = await submitOrganizerKycProfile(user, payload);
      setKycProfile(profile);
      setKycBanner({
        type: 'success',
        message: 'KYC details submitted. We will notify you once the review is complete.',
      });
      setIsKycModalOpen(false);
    } catch (err) {
      setKycBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to submit KYC details.',
      });
      throw (err instanceof Error ? err : new Error('Failed to submit KYC details.'));
    } finally {
      setIsSubmittingKyc(false);
    }
  };

  const handleRequestKycOtp = async (email?: string) => {
    setIsSendingKycOtp(true);
    setKycBanner(null);
    try {
      await requestOrganizerEmailOtp(user, email);
      setKycBanner({
        type: 'info',
        message: 'Verification code sent to your email inbox. It expires in 10 minutes.',
      });
    } catch (err) {
      setKycBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to send verification code.',
      });
      throw (err instanceof Error ? err : new Error('Unable to send verification code.'));
    } finally {
      setIsSendingKycOtp(false);
    }
  };

  const handleVerifyKycOtp = async (code: string) => {
    setIsVerifyingKycOtp(true);
    setKycBanner(null);
    try {
      const result = await verifyOrganizerEmailOtp(user, code);
      setKycProfile(result.profile);
      setKycBanner({
        type: 'success',
        message: 'Your contact email has been verified.',
      });
    } catch (err) {
      setKycBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Invalid verification code.',
      });
      throw (err instanceof Error ? err : new Error('Invalid verification code.'));
    } finally {
      setIsVerifyingKycOtp(false);
    }
  };

  const kycStatus = (kycProfile?.status ?? 'not_started') as OrganizerKycProfile['status'];
  const kycStatusLabel = getKycStatusLabel(kycStatus);
  const kycStatusColor = getKycStatusColor(kycStatus);
  const kycStatusDescription = getKycStatusDescription(kycStatus);
  const kycEmailVerified = kycProfile?.verification?.emailVerified ?? false;

  const loadSubscriptionTransactions = async (options?: { isCancelled?: () => boolean }) => {
    const isCancelled = options?.isCancelled ?? (() => false);
    setIsLoadingSubscriptionTransactions(true);
    setSubscriptionTransactionsError(null);
    setSubscriptionTransactionsNotice(null);
    try {
      const data = await fetchSubscriptionTransactions(user);
      if (!isCancelled()) {
        setSubscriptionTransactions(data);
      }
    } catch (err) {
      if (!isCancelled()) {
        setSubscriptionTransactionsError(
          err instanceof Error ? err.message : 'Failed to load subscription transactions.'
        );
        setSubscriptionTransactionsNotice(null);
      }
    } finally {
      if (!isCancelled()) {
        setIsLoadingSubscriptionTransactions(false);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;

    const fetchSubscriptionTiers = async () => {
      setIsLoadingSubscriptionTiers(true);
      setSubscriptionTiersError(null);
      try {
        const tiers = await getSubscriptionTiers();
        if (isMounted) {
          setSubscriptionTiers(tiers);
        }
      } catch (err) {
        if (isMounted) {
          setSubscriptionTiersError(err instanceof Error ? err.message : 'Failed to load subscription tiers');
        }
      } finally {
        if (isMounted) {
          setIsLoadingSubscriptionTiers(false);
        }
      }
    };

    fetchSubscriptionTiers();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
      setDowngradeError(null);
      setIsDowngrading(false);
    }, [user.subscriptionTier]);

  useEffect(() => {
    if (activeTab !== 'subscriptions') {
      return;
    }

    let cancelled = false;
    void loadSubscriptionTransactions({ isCancelled: () => cancelled });
    return () => {
      cancelled = true;
    };
  }, [activeTab, user]);

  const handleVerifyTransaction = async (reference: string) => {
    if (!reference || verifyingReference) {
      return;
    }
    setVerifyingReference(reference);
    setSubscriptionTransactionsError(null);
    setSubscriptionTransactionsNotice(null);
    try {
      const verification: ProcessPaymentResult = await verifyPaymentReference(reference);
      await loadSubscriptionTransactions();
      if (verification.success) {
        setSubscriptionTransactionsNotice(`Payment confirmed for ${reference}.`);
        if (verification.updatedUser) {
          onSubscriptionUpgrade(verification.updatedUser);
        }
      } else if (verification.status === 'pending') {
        setSubscriptionTransactionsNotice(`Payment is still pending for ${reference}. Please try again later.`);
      } else {
        setSubscriptionTransactionsError(
          `Payment status for ${reference}: ${verification.status}. Please contact support if this is unexpected.`
        );
      }
    } catch (err) {
      setSubscriptionTransactionsError(
        err instanceof Error
          ? err.message
          : `Failed to verify payment status for ${reference}. Please try again later.`
      );
    } finally {
      setVerifyingReference(null);
    }
  };

  const handleOpenScanner = (eventId: string) => {
    setScannerEventId(eventId);
    setIsScannerModalOpen(true);
  };

  const handleTicketScanned = (ticketId: string) => {
    // Optionally update UI to show that a ticket was scanned
    console.log(`Ticket ${ticketId} scanned successfully`);
  };
  
  const handleShareEvent = (event: Event) => {
    // Create the share URL (using VITE_API_BASE_URL from environment)
    const shareUrl = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'}/events/${event.id}`;
    
    // Try to use the Web Share API if available (for mobile devices)
    if (navigator.share) {
      navigator.share({
        title: event.title,
        text: `Check out this event: ${event.title} on ${new Date(event.date).toLocaleDateString()}`,
        url: shareUrl,
      })
      .catch(console.error);
    } else {
      // Fallback: Copy to clipboard
      navigator.clipboard.writeText(shareUrl)
        .then(() => {
          // You could show a toast notification here
          alert(`Event link copied to clipboard:\n${shareUrl}`);
        })
        .catch(err => {
          console.error('Failed to copy link: ', err);
          // Fallback: Show the link in an alert
          alert(`Share this link:\n${shareUrl}`);
        });
    }
  };

  const handleDowngrade = async () => {
    if (isDowngrading) return;
    setDowngradeError(null);
    setIsDowngrading(true);
    try {
      const updatedUser = await cancelSubscription(user.id);
      onSubscriptionDowngrade(updatedUser);
    } catch (err) {
      setDowngradeError(
        err instanceof Error ? err.message : 'Failed to downgrade subscription. Please try again.'
      );
    } finally {
      setIsDowngrading(false);
    }
  };

  const handleTabChange = (tab: Tab) => {
    setSelectedEvent(null);
    setActiveTab(tab);
  };

  const EventsList: React.FC<{ events: Event[]; onSelectEvent: (event: Event) => void }> = ({
    events,
    onSelectEvent,
  }) => (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">My Events</h2>
        <div className="flex space-x-2">
          {user.subscriptionTier === 'Regular' && (
            <button
              onClick={() => setIsSubscriptionModalOpen(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-yellow-500 rounded-lg hover:bg-yellow-600 transition-colors shadow-sm"
            >
              Upgrade to Pro
            </button>
          )}
          <button
            onClick={() => {
              if (user.subscriptionTier === 'Regular' && events.length >= 3) {
                setIsSubscriptionModalOpen(true);
              } else {
                setIsCreateModalOpen(true);
              }
            }}
            disabled={user.subscriptionTier === 'Regular' && events.length >= 3}
            className={`flex items-center justify-center px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors shadow-sm ${
              user.subscriptionTier === 'Regular' && events.length >= 3
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            <PlusCircleIcon className="w-5 h-5 mr-2" />
            {user.subscriptionTier === 'Regular' && events.length >= 3 
              ? 'Event Limit Reached' 
              : 'Create Event'}
          </button>
        </div>
      </div>
      {events.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => {
            const statusHint = getStatusHelperText(event.status);
            return (
              <div
                key={event.id}
                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
              >
                <div className="relative">
                  <img src={event.imageUrl} alt={event.title} className="w-full h-40 object-cover" />
                  <div className="absolute top-2 right-2 flex space-x-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShareEvent(event);
                      }}
                      className="bg-white rounded-full p-1.5 shadow-md hover:bg-gray-100 transition-colors"
                      aria-label="Share event"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEvent(event);
                        setIsEditModalOpen(true);
                      }}
                      className="bg-white rounded-full p-1.5 shadow-md hover:bg-gray-100 transition-colors"
                      aria-label="Edit event"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div 
                  onClick={() => onSelectEvent(event)}
                  className="p-4"
                >
                  <h3 className="font-bold truncate">{event.title}</h3>
                  <p className="text-sm text-gray-500">{new Date(event.date).toLocaleDateString()}</p>
                  <div className="mt-2 text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-1 rounded-full inline-block">
                    {event.category}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 items-center">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(event.status)}`}
                    >
                      {formatEventStatusLabel(event.status)}
                    </span>
                  </div>
                  {statusHint && (
                    <p className="mt-2 text-xs text-gray-500">
                      {statusHint}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 border-2 border-dashed border-gray-300 rounded-lg">
          <h3 className="text-xl font-semibold text-gray-800">
            You haven't created any events yet.
          </h3>
          <p className="text-gray-500 mt-2">
            {user.subscriptionTier === 'Regular' 
              ? 'Upgrade to Pro for unlimited events!' 
              : 'Click "Create Event" to get started!'}
          </p>
          {user.subscriptionTier === 'Regular' && (
            <button
              onClick={() => setIsSubscriptionModalOpen(true)}
              className="mt-4 px-4 py-2 text-sm font-medium text-white bg-yellow-500 rounded-lg hover:bg-yellow-600 transition-colors shadow-sm"
            >
              Upgrade to Pro
            </button>
          )}
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    if (selectedEvent) {
      return <ManageEventView 
        event={selectedEvent} 
        onBack={() => setSelectedEvent(null)} 
        onEdit={(event) => {
          setSelectedEvent(event);
          setIsEditModalOpen(true);
        }} 
      />;
    }

    switch (activeTab) {
      case 'events':
        return <EventsList events={events} onSelectEvent={setSelectedEvent} />;
      case 'analytics':
        return <AnalysisDashboard user={user} events={events} />;
      case 'revenue':
        return <RevenueDashboard user={user} />;
      case 'transactions':
        return (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Attendee Transactions</h2>
                <p className="text-sm text-slate-600">
                  Review your personal ticket purchases and keep pending payments in sync.
                </p>
              </div>
            </div>
            <TransactionHistoryPanel user={user} variant="full" />
          </div>
        );
      case 'subscriptions':
        return (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Subscription Transactions</h2>
                <p className="text-sm text-slate-600">
                  Track your Vibely plan payments and their latest status.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadSubscriptionTransactions()}
                disabled={isLoadingSubscriptionTransactions}
                className="inline-flex items-center px-4 py-2 rounded-md border border-purple-200 text-sm font-medium text-purple-600 hover:bg-purple-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoadingSubscriptionTransactions ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>

            {subscriptionTransactionsError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {subscriptionTransactionsError}
              </div>
            )}
            {subscriptionTransactionsNotice && !subscriptionTransactionsError && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-600">
                {subscriptionTransactionsNotice}
              </div>
            )}

            {isLoadingSubscriptionTransactions ? (
              <div className="flex items-center justify-center py-12 text-sm text-slate-500">
                Loading transactions…
              </div>
            ) : subscriptionTransactions.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl">
                <h3 className="text-lg font-semibold text-slate-900">No subscription payments yet.</h3>
                <p className="text-sm text-slate-600 mt-2">
                  Upgrade to Pro to see your subscription payment history here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Reference
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Provider
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Updated
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {subscriptionTransactions.map((txn) => (
                      <tr key={txn.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">
                          {txn.reference ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {new Intl.NumberFormat('en-ZM', {
                            style: 'currency',
                            currency: txn.currency,
                            minimumFractionDigits: txn.amount % 1 === 0 ? 0 : 2,
                          }).format(txn.amount)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              txn.status === 'succeeded'
                                ? 'bg-green-100 text-green-800'
                                : txn.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {txn.status.charAt(0).toUpperCase() + txn.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {txn.provider}
                          {txn.paymentMethod && (
                            <span className="ml-2 text-xs text-slate-500 uppercase">
                              {txn.paymentMethod}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {new Date(txn.updatedAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {txn.status === 'pending' ? (
                            <button
                              type="button"
                              onClick={() => void handleVerifyTransaction(txn.reference ?? '')}
                              disabled={verifyingReference === txn.reference || !txn.reference}
                              className="inline-flex items-center rounded-full border border-purple-200 px-3 py-1.5 text-xs font-semibold text-purple-600 hover:bg-purple-50 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {verifyingReference === txn.reference ? (
                                <>
                                  <svg
                                    className="mr-2 h-4 w-4 animate-spin text-purple-600"
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                  >
                                    <circle
                                      className="opacity-25"
                                      cx="12"
                                      cy="12"
                                      r="10"
                                      stroke="currentColor"
                                      strokeWidth="4"
                                    ></circle>
                                    <path
                                      className="opacity-75"
                                      fill="currentColor"
                                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    ></path>
                                  </svg>
                                  Checking…
                                </>
                              ) : (
                                'Check status'
                              )}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      case 'settings':
        return (
          <SettingsDashboard
            user={user}
            onUpgradeClick={() => setIsSubscriptionModalOpen(true)}
            onDowngradeClick={handleDowngrade}
            subscriptionTiers={subscriptionTiers}
            isLoadingTiers={isLoadingSubscriptionTiers}
            tiersError={subscriptionTiersError}
            isDowngrading={isDowngrading}
            downgradeError={downgradeError}
          />
        );
      case 'scanner':
        return (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md space-y-6">          
            <div>
              <h2 className="text-xl font-bold text-slate-900">Ticket Scanner</h2>
              <p className="text-sm text-slate-600">Scan attendee tickets at your events</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.map((event) => (
                <div key={event.id} className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors">
                  <h3 className="font-semibold text-slate-800">{event.title}</h3>
                  <p className="text-sm text-slate-600">{new Date(event.date).toLocaleDateString()}</p>
                  <button
                    type="button"
                    onClick={() => handleOpenScanner(event.id)}
                    className="mt-3 inline-flex items-center px-3 py-1.5 text-sm font-semibold text-white bg-purple-600 rounded-md hover:bg-purple-700"
                  >
                    <QrCodeIcon className="w-4 h-4 mr-1" />
                    Scan Tickets
                  </button>
                </div>
              ))}
            </div>
            
            {events.length === 0 && (
              <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl">
                <h3 className="text-lg font-semibold text-slate-900">No events available</h3>
                <p className="text-sm text-slate-600 mt-2">Create an event to start scanning tickets.</p>
              </div>
            )}
          </div>
        );
      case 'messages':
        return (
          <ManagerMessaging 
            user={user} 
            onClose={() => handleTabChange('events')} 
          />
        );
      default:
        return null;
    }
  };

  const NavItem: React.FC<{ tab: Tab; icon: React.ReactNode; label: string; description: string }> = ({
    tab,
    icon,
    label,
    description,
  }) => (
    <button
      onClick={() => handleTabChange(tab)}
      className={`w-full rounded-xl border px-3 py-3 sm:px-4 sm:py-3 text-left transition-all flex items-center gap-3 ${
        activeTab === tab
          ? 'border-purple-400 bg-purple-50 text-purple-700 shadow-sm'
          : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className="flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{label}</div>
        <div className="text-xs text-slate-500 truncate">{description}</div>
      </div>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-100 pb-16 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-purple-400">Manager Center</p>
            <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Vibely Manager</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm font-medium text-slate-700 sm:inline-flex">
              Hello, {user.name.split(' ')[0]}
            </span>
              {onNavigateHome && (
                <button
                  type="button"
                  onClick={onNavigateHome}
                  className="rounded-full border border-purple-300 bg-purple-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-purple-700 transition hover:border-purple-400 hover:bg-purple-200"
                >
                  Back to Marketplace
                </button>
              )}
              <button
                onClick={onLogout}
                className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 transition hover:border-slate-500"
              >
                Log out
              </button>
          </div>
        </div>
      </header>

    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {user.role === 'manager' && (
        <section className="mb-6 rounded-3xl border border-slate-200 bg-white/80 px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <div>
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-purple-400">
                  Organizer KYC
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${kycStatusColor}`}
                  >
                    {kycStatusLabel}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                      kycEmailVerified
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {kycEmailVerified ? 'Email verified via OTP' : 'Email verification required'}
                  </span>
                </div>
              </div>
              <p className="text-sm text-slate-600">{kycStatusDescription}</p>
              <p className="text-xs text-slate-500">
                We only verify organizers through document references and email OTP. Bank statements or
                attendee NRC uploads are not required.
              </p>
            </div>
            <div className="flex flex-col gap-3 md:items-end">
              {kycBanner && (
                <div
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    kycBanner.type === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : kycBanner.type === 'error'
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-amber-200 bg-amber-50 text-amber-800'
                  }`}
                >
                  {kycBanner.message}
                </div>
              )}
              <div className="flex flex-col gap-2 md:items-end">
                <button
                  type="button"
                  onClick={() => setIsKycModalOpen(true)}
                  disabled={isLoadingKyc}
                  className="inline-flex items-center justify-center rounded-full border border-purple-200 bg-purple-600 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-purple-300"
                >
                  {isLoadingKyc
                    ? 'Loading...'
                    : kycStatus === 'verified'
                    ? 'View submission'
                    : 'Complete verification'}
                </button>
                <button
                  type="button"
                  onClick={() => void loadKycProfile()}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                  disabled={isLoadingKyc}
                >
                  Refresh status
                </button>
              </div>
            </div>
          </div>
        </section>
      )}
      <div className="lg:flex lg:gap-6">
          <aside className="mb-8 w-full lg:mb-0 lg:w-56">
            <div className="sticky top-28 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-md">
              <div>
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-purple-500">NAVIGATION</p>
              </div>
              <NavItem tab="events" icon={<ListIcon className="w-5 h-5" />} label="Events" description="Manage" />
              <NavItem tab="analytics" icon={<ChartBarIcon className="w-5 h-5" />} label="Analytics" description="Track" />
              <NavItem tab="revenue" icon={<WalletIcon className="w-5 h-5" />} label="Revenue" description="Finance" />
              <NavItem
                tab="transactions"
                icon={<CreditCardIcon className="w-5 h-5" />}
                label="Transactions"
                description="Receipts"
              />
              <NavItem
                tab="subscriptions"
                icon={<BankIcon className="w-5 h-5" />}
                label="Subs"
                description="History"
              />
              <NavItem tab="scanner" icon={<QrCodeIcon className="w-5 h-5" />} label="Scanner" description="Tickets" />
              <NavItem tab="messages" icon={<svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>} label="Messages" description="Inbox" />
              <NavItem tab="settings" icon={<CogIcon className="w-5 h-5" />} label="Settings" description="Plan" />
            </div>
          </aside>

          <main className="flex-1 space-y-6">{renderContent()}</main>
        </div>
      </div>

      {isKycModalOpen && kycProfile && (
        <OrganizerKycModal
          user={user}
          profile={kycProfile}
          onClose={() => setIsKycModalOpen(false)}
          onSubmit={handleSubmitKycProfile}
          onRequestOtp={handleRequestKycOtp}
          onVerifyOtp={handleVerifyKycOtp}
          isSubmitting={isSubmittingKyc}
          isRequestingOtp={isSendingKycOtp}
          isVerifyingOtp={isVerifyingKycOtp}
        />
      )}

      {isCreateModalOpen && (
        <CreateEventModal
          user={user}
          onClose={() => setIsCreateModalOpen(false)}
          onCreateEvent={onCreateEvent}
        />
      )}

      {isEditModalOpen && selectedEvent && (
        <EditEventModal
          user={user}
          event={selectedEvent}
          onClose={() => setIsEditModalOpen(false)}
          onEditEvent={onEditEvent}
        />
      )}

      {isSubscriptionModalOpen && (
        <SubscriptionModal
          user={user}
          onClose={() => setIsSubscriptionModalOpen(false)}
          onSuccess={onSubscriptionUpgrade}
          subscriptionTiers={subscriptionTiers}
          isLoadingTiers={isLoadingSubscriptionTiers}
          tiersError={subscriptionTiersError}
        />
      )}
      
      {isScannerModalOpen && scannerEventId && (
        <TicketScanner
          eventId={scannerEventId}
          onClose={() => setIsScannerModalOpen(false)}
          onTicketScanned={handleTicketScanned}
        />
      )}
    </div>
  );
};

export default ManagerDashboard;
