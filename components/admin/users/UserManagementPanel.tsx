import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminAuditLogEntry, User, UserRole, UserStatus } from '../../../types';
import {
  getAdminUsers,
  updateUserRole,
  updateUserStatus,
  resetUserPassword,
  getAuditLogs,
} from '../../../services/adminService';

interface UserManagementPanelProps {
  currentUser: User;
}

type FilterState = {
  status: 'all' | UserStatus;
  role: 'all' | UserRole;
  search: string;
};

const roleOptions: { value: UserRole; label: string }[] = [
  { value: 'attendee', label: 'Attendee' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
];

const statusOptions: { value: UserStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'onboarding', label: 'Onboarding' },
];

const UserManagementPanel: React.FC<UserManagementPanelProps> = ({ currentUser }) => {
  const [filters, setFilters] = useState<FilterState>({ status: 'all', role: 'all', search: '' });
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogsState] = useState<AdminAuditLogEntry[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [mutatingUserId, setMutatingUserId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoadingUsers(true);
      setError(null);
      const query: Record<string, string> = {};
      if (filters.status !== 'all') query.status = filters.status;
      if (filters.role !== 'all') query.role = filters.role;
      if (filters.search.trim()) query.q = filters.search.trim();

      const result = await getAdminUsers(currentUser, query);
      setUsers(result.data ?? []);
    } catch (err) {
      console.error('Failed to load users', err);
      setError('Unable to load users.');
    } finally {
      setIsLoadingUsers(false);
    }
  }, [currentUser, filters]);

  const fetchAuditLogs = useCallback(async () => {
    try {
      setIsLoadingLogs(true);
      const result = await getAuditLogs(currentUser, 20);
      setAuditLogsState(result.data ?? []);
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setIsLoadingLogs(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const userDirectory = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach((user) => map.set(user.id, user));
    return map;
  }, [users]);

  const handleRoleChange = async (userId: string, role: UserRole) => {
    if (mutatingUserId) return;
    try {
      setMutatingUserId(userId);
      await updateUserRole(currentUser, userId, role);
      setFeedback('Role updated successfully.');
      await Promise.all([fetchUsers(), fetchAuditLogs()]);
    } catch (err) {
      console.error('Failed to update role', err);
      setError('Unable to update user role.');
    } finally {
      setMutatingUserId(null);
    }
  };

  const handleStatusChange = async (userId: string, status: UserStatus) => {
    if (mutatingUserId) return;
    try {
      setMutatingUserId(userId);
      await updateUserStatus(currentUser, userId, status);
      setFeedback('Status updated successfully.');
      await Promise.all([fetchUsers(), fetchAuditLogs()]);
    } catch (err) {
      console.error('Failed to update status', err);
      setError('Unable to update user status.');
    } finally {
      setMutatingUserId(null);
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (mutatingUserId) return;
    try {
      setMutatingUserId(userId);
      const result = await resetUserPassword(currentUser, userId);
      setFeedback(result.message ?? 'Password reset initiated.');
      await fetchAuditLogs();
    } catch (err) {
      console.error('Failed to reset password', err);
      setError('Unable to reset password.');
    } finally {
      setMutatingUserId(null);
    }
  };

  const clearFeedback = () => {
    setFeedback(null);
    setError(null);
  };

  const renderRoleSelect = (user: User) => (
    <select
      value={user.role}
      disabled={mutatingUserId === user.id || currentUser.id === user.id}
      onChange={(event) => handleRoleChange(user.id, event.target.value as UserRole)}
      className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 disabled:text-gray-500"
    >
      {roleOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );

  const renderStatusSelect = (user: User) => (
    <select
      value={user.status}
      disabled={mutatingUserId === user.id}
      onChange={(event) => handleStatusChange(user.id, event.target.value as UserStatus)}
      className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 disabled:text-gray-500"
    >
      {statusOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );

  const getUserDisplayName = (userId: string) => {
    const user = userDirectory.get(userId);
    return user ? `${user.name} (${user.email})` : userId;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
        <div className="flex flex-col lg:flex-row lg:items-end lg:space-x-4 space-y-4 lg:space-y-0">
          <div className="flex-1">
            <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">
              Search
            </label>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">
              Role
            </label>
            <select
              value={filters.role}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, role: event.target.value as FilterState['role'] }))
              }
              className="w-full lg:w-40 rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All roles</option>
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  status: event.target.value as FilterState['status'],
                }))
              }
              className="w-full lg:w-40 rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All statuses</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={fetchUsers}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={fetchAuditLogs}
              className="px-4 py-2 rounded-lg border border-purple-200 text-sm font-semibold text-purple-700 hover:bg-purple-50 transition-colors"
            >
              Refresh Audit
            </button>
          </div>
        </div>

        {(feedback || error) && (
          <div
            className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
              feedback
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            <div className="flex items-start justify-between">
              <span>{feedback ?? error}</span>
              <button
                onClick={clearFeedback}
                className="ml-4 text-xs uppercase tracking-wide text-gray-500 hover:text-gray-700"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-md border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Users</h3>
            <p className="text-xs text-gray-500">
              Manage account roles, onboarding status, and security operations.
            </p>
          </div>
          <span className="text-sm text-gray-500">{users.length} results</span>
        </div>

        {isLoadingUsers ? (
          <div className="p-10 text-center text-gray-500">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="p-10 text-center text-gray-500">No users match your filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{user.name}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </td>
                    <td className="px-4 py-3">{renderRoleSelect(user)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            user.status === 'active'
                              ? 'bg-emerald-100 text-emerald-700'
                              : user.status === 'suspended'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {user.status}
                        </span>
                        <div className="w-40">{renderStatusSelect(user)}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleResetPassword(user.id)}
                          disabled={mutatingUserId === user.id}
                          className="px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
                        >
                          Reset Password
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-md border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Audit Trail</h3>
            <p className="text-xs text-gray-500">Recent administrative changes across accounts.</p>
          </div>
          <span className="text-sm text-gray-500">
            {isLoadingLogs ? 'Loading…' : `${auditLogs.length} entries`}
          </span>
        </div>
        {auditLogs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No audit entries recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">
                    When
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">
                    Actor
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">
                    Target
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {auditLogs.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600">
                      {new Intl.DateTimeFormat('en-US', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(entry.timestamp))}
                    </td>
                    <td className="px-4 py-3 text-gray-900">{getUserDisplayName(entry.actorId)}</td>
                    <td className="px-4 py-3 text-gray-900">{getUserDisplayName(entry.targetUserId)}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{entry.action.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-gray-600">{entry.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagementPanel;
