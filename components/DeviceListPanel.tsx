import React from 'react';
import { User } from '../types';

interface Device {
  id: string;
  name?: string;
  organizerId?: string;
  staffUserId: string;
  eventId?: string;
  devicePublicId: string;
  isActive: boolean;
  lastIp?: string;
  lastSeenAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface DeviceListPanelProps {
  user: User;
  devices: Device[];
  isLoading: boolean;
  onRefresh: () => void;
  staffUsers: { id: string; name?: string; email: string }[];
  onCreate: (
    name: string,
    eventId: string | null,
    staffUserId: string | null
  ) => Promise<{ publicId: string; secret: string } | void> | void;
  events: { id: string; title: string }[];
  onAssign: (
    deviceId: string,
    updates: { eventId: string | null; staffUserId: string | null }
  ) => Promise<void> | void;
  onToggleActive: (deviceId: string, isActive: boolean) => Promise<void> | void;
  onDelete: (deviceId: string) => Promise<void> | void;
  onRegenerate: (deviceId: string) => Promise<{ secret: string }>;
}

const DeviceListPanel: React.FC<DeviceListPanelProps> = ({
  user,
  devices,
  isLoading,
  onRefresh,
  staffUsers,
  onCreate,
  events,
  onAssign,
  onToggleActive,
  onDelete,
  onRegenerate,
}) => {
  const [name, setName] = React.useState('');
  const [posting, setPosting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [createdSecret, setCreatedSecret] = React.useState<{ publicId: string; secret: string } | null>(null);
  const [createEventId, setCreateEventId] = React.useState<string | null>(null);
  const [createStaffUserId, setCreateStaffUserId] = React.useState<string | null>(null);
  const [latestSecrets, setLatestSecrets] = React.useState<Record<string, string>>({});

  const staffOptions = React.useMemo(() => {
    const base = [
      {
        id: user.id,
        label: `${user.name || 'Organizer'} (you)`,
      },
    ];
    const uniqueStaff = staffUsers.filter((s) => s.id !== user.id);
    return [
      ...base,
      ...uniqueStaff.map((s) => ({
        id: s.id,
        label: s.name ? `${s.name} (${s.email})` : s.email,
      })),
    ];
  }, [staffUsers, user]);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setPosting(true);
    setError(null);
    setCreatedSecret(null);
    try {
      const res = await onCreate(name.trim(), createEventId, createStaffUserId);
      if (res && res.publicId && res.secret) {
        setCreatedSecret({ publicId: res.publicId, secret: res.secret });
      }
      setName('');
      setCreateEventId(null);
      setCreateStaffUserId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create device.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-purple-500">Devices</p>
          <h2 className="text-xl font-bold text-slate-900">Scanning devices</h2>
          <p className="text-sm text-slate-600">Generate device IDs and share secrets with your staff.</p>
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
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
          <input
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            placeholder="Device name (e.g., Gate A Scanner)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={posting}
          />
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            value={createEventId ?? ''}
            onChange={(e) => setCreateEventId(e.target.value || null)}
            disabled={posting}
          >
            <option value="">Attach to event (optional)</option>
            {events.map((evt) => (
              <option key={evt.id} value={evt.id}>
                {evt.title}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            value={createStaffUserId ?? ''}
            onChange={(e) => setCreateStaffUserId(e.target.value || null)}
            disabled={posting}
          >
            <option value="">Assign to (uses organizer if blank)</option>
            {staffOptions.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleCreate}
            disabled={posting}
            className="rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {posting ? 'Creating...' : 'Create device'}
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {createdSecret && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
            <p className="font-semibold">Device created</p>
            <p>Public ID: {createdSecret.publicId}</p>
            <p>Secret: {createdSecret.secret}</p>
            <p className="mt-1 text-[0.7rem] text-emerald-700">
              Copy and share this secret securely with the device operator.
            </p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold text-slate-800">Registered devices</p>
        </div>
        <div className="divide-y divide-slate-100">
          {isLoading ? (
            <div className="px-4 py-6 text-center text-sm text-slate-500">Loading devices...</div>
          ) : devices.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-500">No devices yet. Create one above.</div>
          ) : (
            devices.map((d) => (
              <div key={d.id} className="px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <p className="font-semibold text-slate-900">{d.name || 'Device'}</p>
                  <p className="text-xs text-slate-600">Public ID: {d.devicePublicId}</p>
                  <p className="text-xs text-slate-600 break-all">
                    {latestSecrets[d.id]
                      ? (
                        <>
                          <span className="font-semibold">Latest secret:</span> {latestSecrets[d.id]}
                        </>
                      )
                      : 'Secret only shown right after creation or regeneration.'}
                  </p>
                  <p className="text-xs text-slate-500">
                    Staff: {staffOptions.find((s) => s.id === d.staffUserId)?.label ?? d.staffUserId}
                  </p>
                  <div className="flex flex-col gap-1">
                    <label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Event
                    </label>
                    <select
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      value={d.eventId ?? ''}
                      onChange={(e) => {
                        const val = e.target.value || null;
                        void onAssign(d.id, { eventId: val, staffUserId: d.staffUserId ?? null });
                      }}
                    >
                      <option value="">Unassigned</option>
                      {events.map((evt) => (
                        <option key={evt.id} value={evt.id}>
                          {evt.title}
                        </option>
                      ))}
                    </select>
                    <label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Staff
                    </label>
                    <select
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      value={d.staffUserId ?? user.id}
                      onChange={(e) => {
                        const val = e.target.value || null;
                        void onAssign(d.id, { eventId: d.eventId ?? null, staffUserId: val });
                      }}
                    >
                      {staffOptions.map((staff) => (
                        <option key={staff.id} value={staff.id}>
                          {staff.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <div className="mb-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.7rem] font-semibold">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        d.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}
                    />
                    {d.isActive ? 'Active' : 'Inactive'}
                  </div>
                  {d.lastSeenAt && <div>Last seen: {new Date(d.lastSeenAt).toLocaleString()}</div>}
                  {d.lastIp && <div>IP: {d.lastIp}</div>}
                  <div className="mt-2 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-slate-200 px-3 py-1 text-[0.75rem] font-semibold text-slate-700 hover:bg-slate-100"
                      onClick={() => onToggleActive(d.id, !d.isActive)}
                    >
                      {d.isActive ? 'Suspend' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-purple-200 px-3 py-1 text-[0.75rem] font-semibold text-purple-700 hover:bg-purple-50"
                      onClick={async () => {
                        try {
                          const res = await onRegenerate(d.id);
                          setLatestSecrets((prev) => ({ ...prev, [d.id]: res.secret }));
                          setError(null);
                        } catch (err) {
                          console.error(err);
                          setError('Failed to regenerate secret.');
                        }
                      }}
                    >
                      Regenerate secret
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-red-200 px-3 py-1 text-[0.75rem] font-semibold text-red-700 hover:bg-red-50"
                      onClick={() => {
                        if (window.confirm('Delete this device? Active tokens will be revoked.')) {
                          void onDelete(d.id);
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DeviceListPanel;
