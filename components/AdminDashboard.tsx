import React, { useState } from 'react';
import { AdminStats, Event, User, SubscriptionTier } from '../types';
import UsersIcon from './icons/UsersIcon';
import ListIcon from './icons/ListIcon';
import TicketIcon from './icons/TicketIcon';
import WalletIcon from './icons/WalletIcon';
import CalendarIcon from './icons/CalendarIcon';
import PaymentsAdminDashboard from './admin/payments/PaymentsAdminDashboard';
import UserManagementPanel from './admin/users/UserManagementPanel';
import AdminCommunicationsPanel from './admin/communications/AdminCommunicationsPanel';
import AdminSettingsPanel from './admin/settings/AdminSettingsPanel';
import OperationalMetricsPanel from './admin/operations/OperationalMetricsPanel';
import ChartBarIcon from './icons/ChartBarIcon';
import SubscriptionManager from './SubscriptionManager';

interface AdminDashboardProps {
  user: User;
  stats: AdminStats | null;
  recentEvents: Event[];
  events: Event[];
  isLoading: boolean;
  updatingEventId: string | null;
  onRefresh: () => void;
  onLogout: () => void;
  onUpdateEventStatus: (eventId: string, status: string) => void;
  onToggleEventFeatured: (eventId: string, isFeatured: boolean) => void;
  onNavigateHome?: () => void;
}

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string; accent: string }> = ({
  icon,
  label,
  value,
  accent,
}) => (
  <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
    <div className="flex items-center gap-4">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-xl ${accent}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  </div>
);

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  user,
  stats,
  recentEvents,
  events,
  isLoading,
  updatingEventId,
  onRefresh,
  onLogout,
  onUpdateEventStatus,
  onToggleEventFeatured,
  onNavigateHome,
}) => {
  const [activeSection, setActiveSection] = useState<'overview' | 'payments' | 'operations' | 'users' | 'communications' | 'settings' | 'subscriptions'>('overview');
  const navigationItems: {
    key: 'overview' | 'payments' | 'operations' | 'users' | 'communications' | 'settings' | 'subscriptions';
    label: string;
    description: string;
  }[] = [
    { key: 'overview', label: 'Overview', description: 'Metrics & moderation' },
    { key: 'payments', label: 'Payments', description: 'Gateway operations' },
    { key: 'operations', label: 'Operations', description: 'Revenue & refunds' },
    { key: 'settings', label: 'Settings', description: 'Fees, integrations & exports' },
    { key: 'users', label: 'Users', description: 'Roles & access control' },
    { key: 'communications', label: 'Communications', description: 'Messaging & notifications' },
    { key: 'subscriptions', label: 'Subscriptions', description: 'Manage tiers & pricing' },
  ];
  const firstName = user.name.split(' ')[0] ?? user.name;
  const formatZMW = (value: number) =>
    `K${value.toLocaleString(undefined, { minimumFractionDigits: value % 1 === 0 ? 0 : 2 })}`;
  const flaggedEvents = events.filter((evt) => (evt.flagCount ?? 0) > 0).length;
  const revenueHighlight = stats ? formatZMW(stats.totalRevenue) : '\u2014';
  const avgTicket = stats ? formatZMW(stats.averageTicketPrice) : '\u2014';
  const activeEventsRatio = stats ? `${stats.upcomingEvents}/${stats.totalEvents}` : '0/0';

  return (
    <div className="min-h-screen bg-slate-100 pb-16 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-purple-400">Control Center</p>
            <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Vibely Admin</h1>
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
                onClick={onRefresh}
                className="rounded-full border border-purple-300 bg-purple-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-purple-700 transition hover:border-purple-400 hover:bg-purple-200"
              >
                Refresh
              </button>
              <button
                onClick={onLogout}
                className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 transition hover:border-slate-500"
              >
                Log out
              </button>
          </div>
        </div>
      </header>

      <main className="mx-auto mt-12 max-w-7xl px-4 sm:px-8 lg:px-12">
        <section className="mb-10 overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-r from-purple-100 to-indigo-100 p-8 shadow-lg">
          <div className="grid gap-6 lg:grid-cols-[1.6fr,1fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-purple-500">Admin briefing</p>
              <h2 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
                Morning, {firstName}. Here&apos;s how Vibely is performing.
              </h2>
              <p className="mt-4 max-w-2xl text-sm text-slate-600">
                Keep an eye on revenue, monitor flagged events, and dive into the areas that need the most attention
                today.
              </p>
              <div className="mt-6 flex flex-wrap gap-4">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm">
                  {revenueHighlight} revenue
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                  {flaggedEvents} events flagged
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                  {activeEventsRatio} live / scheduled
                </div>
              </div>
            </div>
            <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-purple-500">
                Quick checkpoints
              </p>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between text-slate-700">
                  <span>Average ticket price</span>
                  <span className="font-semibold text-slate-900">{avgTicket}</span>
                </div>
                <div className="flex items-center justify-between text-slate-700">
                  <span>Flagged events</span>
                  <span className="font-semibold text-orange-600">{flaggedEvents}</span>
                </div>
                <div className="flex items-center justify-between text-slate-700">
                  <span>Upcoming vs total</span>
                  <span className="font-semibold text-slate-900">{activeEventsRatio}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="lg:flex lg:gap-8">
          <aside className="mb-8 w-full lg:mb-0 lg:w-72">
            <div className="sticky top-28 space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-purple-500">Admin Navigation</p>
                <p className="mt-2 text-sm text-slate-600">
                  Switch between operational zones to keep the marketplace sharp.
                </p>
              </div>
              {navigationItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActiveSection(item.key)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                    activeSection === item.key
                      ? 'border-purple-400 bg-purple-50 text-purple-700 shadow-md'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="block text-sm font-semibold uppercase tracking-[0.2em]">{item.label}</span>
                  <span className="block text-xs text-slate-500">{item.description}</span>
                </button>
              ))}
            </div>
          </aside>
          <section className="flex-1 space-y-8">
            {activeSection === 'payments' ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
                <PaymentsAdminDashboard user={user} />
              </div>
            ) : activeSection === 'operations' ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
                <OperationalMetricsPanel currentUser={user} events={events} />
              </div>
            ) : activeSection === 'settings' ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
                <AdminSettingsPanel currentUser={user} />
              </div>
            ) : activeSection === 'users' ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
                <UserManagementPanel currentUser={user} />
              </div>
            ) : activeSection === 'communications' ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
                <AdminCommunicationsPanel currentUser={user} />
              </div>
            ) : activeSection === 'subscriptions' ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
                <SubscriptionManager 
                  user={user}
                />
              </div>
            ) : isLoading ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-600 shadow-md">
                Loading platform insights...
              </div>
            ) : stats ? (
              <>
              <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  icon={<UsersIcon className="w-6 h-6 text-purple-600" />}
                  label="Total Users"
                  value={stats.totalUsers.toLocaleString()}
                  accent="text-purple-600"
                />
                <StatCard
                  icon={<ListIcon className="w-6 h-6 text-blue-600" />}
                  label="Active Events"
                  value={`${stats.upcomingEvents}/${stats.totalEvents}`}
                  accent="text-blue-600"
                />
                <StatCard
                  icon={<TicketIcon className="w-6 h-6 text-emerald-600" />}
                  label="Tickets Issued"
                  value={stats.totalTickets.toLocaleString()}
                  accent="text-emerald-600"
                />
                <StatCard
                  icon={<WalletIcon className="w-6 h-6 text-amber-600" />}
                  label="Gross Revenue"
                  value={`K${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0 })}`}
                  accent="text-amber-600"
                />
              </section>

              <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md lg:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-slate-900">User Breakdown</h2>
                    <ChartBarIcon className="w-6 h-6 text-purple-500" />
                  </div>
                  <div className="space-y-3">
                    {Object.entries(stats.usersByRole).map(([role, count]) => (
                      <div key={role} className="flex items-center justify-between">
                        <span className="text-sm capitalize text-slate-600">{role}</span>
                        <span className="text-sm font-semibold text-slate-900">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
                  <h2 className="mb-4 text-lg font-bold text-slate-900">Top Categories</h2>
                  <div className="space-y-3">
                    {stats.topCategories.length === 0 ? (
                      <p className="text-sm text-slate-500">No category data available.</p>
                    ) : (
                      stats.topCategories.map(({ category, count }) => (
                        <div key={category} className="flex items-center justify-between">
                          <span className="text-sm text-slate-600">{category}</span>
                          <span className="text-sm font-semibold text-slate-900">{count}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-slate-900">Event Oversight</h2>
                  <span className="text-xs font-medium text-slate-500">
                    Manage statuses, investigate flags, and keep the marketplace healthy.
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider">
                          Event
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider">
                          Flags
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider">
                          Tickets
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {events.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                            No events found.
                          </td>
                        </tr>
                      ) : (
                        events.map((evt) => {
                          const statusColor =
                            evt.status === 'published'
                              ? 'bg-green-100 text-green-700'
                              : evt.status === 'flagged'
                              ? 'bg-red-100 text-red-700'
                              : evt.status === 'draft'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-slate-100 text-slate-700';

                          return (
                            <tr key={evt.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3">
                                <p className="font-semibold text-slate-900">{evt.title}</p>
                                <p className="text-xs text-slate-500">
                                  {new Intl.DateTimeFormat('en-US', {
                                    dateStyle: 'medium',
                                    timeStyle: 'short',
                                  }).format(new Date(evt.date))}
                                </p>
                                <p className="text-xs text-slate-400">Organizer: {evt.organizer.name}</p>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
                                  {evt.status ?? 'published'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`text-sm font-semibold ${
                                    (evt.flagCount ?? 0) > 0 ? 'text-red-600' : 'text-slate-600'
                                  }`}
                                >
                                  {evt.flagCount ?? 0}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {(evt.ticketsSold ?? 0).toLocaleString()}/{evt.ticketQuantity.toLocaleString()}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    disabled={evt.status === 'published' || updatingEventId === evt.id}
                                    onClick={() => onUpdateEventStatus(evt.id, 'published')}
                                    className="px-3 py-1.5 text-xs font-semibold rounded-md bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50"
                                  >
                                    Publish
                                  </button>
                                  <button
                                    type="button"
                                    disabled={evt.status === 'draft' || updatingEventId === evt.id}
                                    onClick={() => onUpdateEventStatus(evt.id, 'draft')}
                                    className="px-3 py-1.5 text-xs font-semibold rounded-md bg-yellow-100 text-yellow-700 hover:bg-yellow-200 disabled:opacity-50"
                                  >
                                    Mark Draft
                                  </button>
                                <button
                                  type="button"
                                  disabled={evt.status === 'archived' || updatingEventId === evt.id}
                                  onClick={() => onUpdateEventStatus(evt.id, 'archived')}
                                  className="px-3 py-1.5 text-xs font-semibold rounded-md bg-slate-200 text-slate-700 hover:bg-slate-300 disabled:opacity-50"
                                >
                                  Archive
                                </button>
                                <button
                                  type="button"
                                  disabled={updatingEventId === evt.id}
                                  onClick={() => onToggleEventFeatured(evt.id, !evt.isFeatured)}
                                  className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
                                    evt.isFeatured
                                      ? 'bg-purple-600 text-white hover:bg-purple-700'
                                      : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                  }`}
                                >
                                  {evt.isFeatured ? 'Unfeature' : 'Feature'}
                                </button>
                                {evt.status === 'flagged' && (
                                  <button
                                    type="button"
                                    disabled={updatingEventId === evt.id}
                                    onClick={() => onUpdateEventStatus(evt.id, 'published')}
                                      className="px-3 py-1.5 text-xs font-semibold rounded-md bg-purple-100 text-purple-700 hover:bg-purple-200 disabled:opacity-50"
                                    >
                                      Resolve Flags
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-slate-900">Recent & Upcoming Events</h2>
                  <CalendarIcon className="w-6 h-6 text-purple-500" />
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider">
                          Event
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider">
                          Category
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider">
                          Tickets Sold
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recentEvents.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                            No events to display.
                          </td>
                        </tr>
                      ) : (
                        recentEvents.map((evt) => (
                          <tr key={evt.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-semibold text-slate-800">{evt.title}</td>
                            <td className="px-4 py-3 text-slate-600">
                              {new Intl.DateTimeFormat('en-US', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              }).format(new Date(evt.date))}
                            </td>
                            <td className="px-4 py-3 text-slate-600">{evt.category}</td>
                            <td className="px-4 py-3 text-slate-600">
                              {evt.ticketsSold ?? 0}/{evt.ticketQuantity}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
              </>
            ) : (
              <div className="rounded-3xl border border-red-200 bg-red-50 p-10 text-center text-red-700 shadow-md">
                Unable to load platform statistics.
              </div>
            )}
          </section>
        </div>
      </main>

    </div>
  );
};

export default AdminDashboard;
