import React from 'react';
import type { StaffUser } from '../types';

interface StaffManagementPanelProps {
  staffUsers: StaffUser[];
  isLoading: boolean;
  onRefresh: () => void;
  onCreate: (data: { name?: string; email: string; password: string }) => Promise<void> | void;
  error?: string | null;
}

const StaffManagementPanel: React.FC<StaffManagementPanelProps> = ({
  staffUsers,
  isLoading,
  onRefresh,
  onCreate,
  error,
}) => {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [posting, setPosting] = React.useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setLocalError('Email and password are required');
      return;
    }
    setLocalError(null);
    setPosting(true);
    try {
      await onCreate({
        name: name.trim() || undefined,
        email: email.trim(),
        password: password.trim(),
      });
      setName('');
      setEmail('');
      setPassword('');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Could not create staff user.');
    } finally {
      setPosting(false);
    }
  };

  const displayError = localError || error;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-purple-500">Staff</p>
          <h2 className="text-xl font-bold text-slate-900">Scanner staff accounts</h2>
          <p className="text-sm text-slate-600">
            Create staff logins for your on-site team. These accounts are tied to your organization and used
            when authorizing scanner devices.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-md border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-50"
          disabled={isLoading}
        >
          Refresh
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            placeholder="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={posting}
          />
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={posting}
          />
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={posting}
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={posting}
            className="rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {posting ? 'Creating...' : 'Create staff user'}
          </button>
          <p className="text-xs text-slate-500">
            Staff users can authorize scanners for events you assign to them.
          </p>
        </div>
        {displayError && <p className="text-xs text-red-600">{displayError}</p>}
      </div>

      <div className="rounded-2xl border border-slate-200">
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-800">Team members</p>
          {isLoading && <span className="text-xs text-slate-500">Loading...</span>}
        </div>
        <div className="divide-y divide-slate-100">
          {isLoading ? (
            <div className="px-4 py-6 text-center text-sm text-slate-500">Loading staff users...</div>
          ) : staffUsers.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-500">
              No staff users yet. Create one above to get started.
            </div>
          ) : (
            staffUsers.map((staff) => (
              <div key={staff.id} className="px-4 py-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div className="space-y-0.5">
                  <p className="font-semibold text-slate-900">{staff.name || staff.email}</p>
                  <p className="text-xs text-slate-600">{staff.email}</p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">
                    Active
                  </span>
                  {staff.createdAt && (
                    <div className="mt-1">
                      Added {new Date(staff.createdAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffManagementPanel;
