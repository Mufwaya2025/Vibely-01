import React, { useEffect, useState } from 'react';
import { User, Event, SubscriptionTier } from '../types';
import { getSubscriptionTiers, cancelSubscription } from '../services/subscriptionService';
import {
  fetchSubscriptionTransactions,
  SubscriptionTransactionSummary,
  verifyPaymentReference,
  ProcessPaymentResult,
} from '../services/paymentService';

import CreateEventModal from './CreateEventModal';
import EditEventModal from './EditEventModal';
import ManageEventView from './ManageEventView';
import AnalysisDashboard from './AnalysisDashboard';
import RevenueDashboard from './RevenueDashboard';
import SettingsDashboard from './SettingsDashboard';
import SubscriptionModal from './SubscriptionModal';
import ListIcon from './icons/ListIcon';
import ChartBarIcon from './icons/ChartBarIcon';
import WalletIcon from './icons/WalletIcon';
import CreditCardIcon from './icons/CreditCardIcon';
import CogIcon from './icons/CogIcon';
import PlusCircleIcon from './icons/PlusCircleIcon';

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

type Tab = 'events' | 'analytics' | 'revenue' | 'subscriptions' | 'settings';

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
          {events.map((event) => (
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
              </div>
            </div>
          ))}
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
                tab="subscriptions"
                icon={<CreditCardIcon className="w-5 h-5" />}
                label="Subs"
                description="History"
              />
              <NavItem tab="settings" icon={<CogIcon className="w-5 h-5" />} label="Settings" description="Plan" />
            </div>
          </aside>

          <main className="flex-1 space-y-6">{renderContent()}</main>
        </div>
      </div>

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
    </div>
  );
};

export default ManagerDashboard;
