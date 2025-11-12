import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ApiKeyRecord,
  DataExportJob,
  DataExportStatus,
  PlatformSettings,
  User,
} from '../../../types';
import {
  getPlatformSettings,
  updatePlatformSettings,
  getApiKeys,
  createApiKey,
  rotateApiKey,
  revokeApiKey,
  getDataExports,
  requestDataExport,
} from '../../../services/adminService';

interface AdminSettingsPanelProps {
  currentUser: User;
}

const EXPORT_OPTIONS: { label: string; value: DataExportJob['type'] }[] = [
  { label: 'Events', value: 'events' },
  { label: 'Transactions', value: 'transactions' },
  { label: 'Users', value: 'users' },
];

const DEFAULT_PAYOUT_FEES: PlatformSettings['payoutFees'] = {
  mobileMoney: [
    { minAmount: 5, maxAmount: 1000, fee: 11 },
    { minAmount: 1001, maxAmount: 50000, fee: 15 },
    { minAmount: 50001, maxAmount: 100000, fee: 20 },
  ],
  bankAccount: [{ minAmount: 0, maxAmount: null, fee: 15 }],
};

const AdminSettingsPanel: React.FC<AdminSettingsPanelProps> = ({ currentUser }) => {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [feeDraft, setFeeDraft] = useState<number>(7.5);
  const [autoPayouts, setAutoPayouts] = useState<boolean>(false);
  const [payoutCurrency, setPayoutCurrency] = useState<string>('ZMW');
  const [payoutFeeDraft, setPayoutFeeDraft] = useState<PlatformSettings['payoutFees']>(DEFAULT_PAYOUT_FEES);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyDescription, setNewKeyDescription] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string>('events:read');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [apiKeyMessage, setApiKeyMessage] = useState<string | null>(null);
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [actionKeyId, setActionKeyId] = useState<string | null>(null);

  const [exports, setExports] = useState<DataExportJob[]>([]);
  const [exportType, setExportType] = useState<DataExportJob['type']>('events');
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  const cloneFees = (fees: PlatformSettings['payoutFees']) =>
    JSON.parse(JSON.stringify(fees)) as PlatformSettings['payoutFees'];

  const resetMessages = () => {
    setSettingsMessage(null);
    setApiKeyMessage(null);
    setExportMessage(null);
  };

  type FeeChannel = keyof PlatformSettings['payoutFees'];

  const handleFeeTierChange = (
    channel: FeeChannel,
    index: number,
    field: 'minAmount' | 'maxAmount' | 'fee',
    rawValue: string
  ) => {
    setPayoutFeeDraft((prev) => {
      const tiers = prev[channel] ?? [];
      const value = rawValue === '' ? (field === 'maxAmount' ? null : 0) : Number(rawValue);
      const updated = tiers.map((tier, i) => {
        if (i !== index) return tier;
        if (field === 'maxAmount') {
          return { ...tier, maxAmount: value === null ? null : Number(value) };
        }
        return { ...tier, [field]: typeof value === 'number' ? value : 0 };
      });
      return { ...prev, [channel]: updated };
    });
  };

  const handleAddFeeTier = (channel: FeeChannel) => {
    setPayoutFeeDraft((prev) => {
      const tiers = prev[channel] ?? [];
      const last = tiers[tiers.length - 1];
      const nextTier: PayoutFeeTier = {
        minAmount: last?.maxAmount ?? last?.minAmount ?? 0,
        maxAmount: null,
        fee: last?.fee ?? 0,
      };
      return { ...prev, [channel]: [...tiers, nextTier] };
    });
  };

  const handleRemoveFeeTier = (channel: FeeChannel, index: number) => {
    setPayoutFeeDraft((prev) => {
      const tiers = prev[channel] ?? [];
      if (tiers.length <= 1) {
        return prev;
      }
      return { ...prev, [channel]: tiers.filter((_, i) => i !== index) };
    });
  };

  const renderFeeChannel = (channel: FeeChannel, label: string) => {
    const tiers = payoutFeeDraft[channel] ?? [];
    return (
      <div className="space-y-3 rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-800">{label}</h4>
          <button
            type="button"
            onClick={() => handleAddFeeTier(channel)}
            className="text-xs font-semibold text-purple-600 hover:text-purple-800"
          >
            + Add tier
          </button>
        </div>
        {tiers.length === 0 && <p className="text-xs text-slate-500">No fee tiers configured.</p>}
        {tiers.map((tier, index) => (
          <div key={`${channel}-${index}`} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-500">Min (K)</label>
              <input
                type="number"
                min={0}
                value={tier.minAmount}
                onChange={(e) => handleFeeTierChange(channel, index, 'minAmount', e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-purple-500 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500">Max (K)</label>
              <input
                type="number"
                min={0}
                value={tier.maxAmount ?? ''}
                placeholder="No max"
                onChange={(e) => handleFeeTierChange(channel, index, 'maxAmount', e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-purple-500 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500">Fee (K)</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={tier.fee}
                  onChange={(e) => handleFeeTierChange(channel, index, 'fee', e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-purple-500 focus:ring-purple-500"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveFeeTier(channel, index)}
                  disabled={(payoutFeeDraft[channel] ?? []).length <= 1}
                  className="text-xs font-semibold text-rose-600 disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const loadSettings = useCallback(async () => {
    try {
      const result = await getPlatformSettings(currentUser);
      setSettings(result);
      setFeeDraft(result.platformFeePercent);
      setAutoPayouts(result.autoPayoutsEnabled);
      setPayoutCurrency(result.payoutCurrency);
      setPayoutFeeDraft(cloneFees(result.payoutFees ?? DEFAULT_PAYOUT_FEES));
    } catch (err) {
      console.error('Failed to load platform settings', err);
    }
  }, [currentUser]);

  const loadKeys = useCallback(async () => {
    try {
      setApiKeyLoading(true);
      const response = await getApiKeys(currentUser);
      setApiKeys(response.data ?? []);
    } catch (err) {
      console.error('Failed to load API keys', err);
    } finally {
      setApiKeyLoading(false);
    }
  }, [currentUser]);

  const loadExports = useCallback(async () => {
    try {
      const response = await getDataExports(currentUser);
      setExports(response.data ?? []);
    } catch (err) {
      console.error('Failed to load exports', err);
    }
  }, [currentUser]);

  useEffect(() => {
    loadSettings();
    loadKeys();
    loadExports();
  }, [loadSettings, loadKeys, loadExports]);

  const handleSettingsSave = async (event: React.FormEvent) => {
    event.preventDefault();
    resetMessages();
    try {
      setIsSavingSettings(true);
      const updated = await updatePlatformSettings(currentUser, {
        platformFeePercent: feeDraft,
        payoutCurrency,
        autoPayoutsEnabled: autoPayouts,
        payoutFees: payoutFeeDraft,
      });
      setSettings(updated);
      setPayoutFeeDraft(cloneFees(updated.payoutFees));
      setSettingsMessage('Platform settings updated successfully.');
    } catch (err) {
      console.error('Failed to update platform settings', err);
      setSettingsMessage('Unable to save settings.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleCreateApiKey = async (event: React.FormEvent) => {
    event.preventDefault();
    resetMessages();
    if (!newKeyName.trim()) {
      setApiKeyMessage('Provide a descriptive key name.');
      return;
    }
    const scopes = newKeyScopes
      .split(',')
      .map((scope) => scope.trim())
      .filter(Boolean);
    if (scopes.length === 0) {
      setApiKeyMessage('Enter at least one scope.');
      return;
    }
    try {
      setActionKeyId('create');
      const result = await createApiKey(currentUser, {
        name: newKeyName.trim(),
        description: newKeyDescription.trim() || undefined,
        scopes,
      });
      setGeneratedKey(result.rawKey);
      setApiKeyMessage('API key created. Copy the secret now; it will only be shown once.');
      setNewKeyName('');
      setNewKeyDescription('');
      setNewKeyScopes('events:read');
      await loadKeys();
    } catch (err) {
      console.error('Failed to create API key', err);
      setApiKeyMessage('Unable to create API key.');
    } finally {
      setActionKeyId(null);
    }
  };

  const handleRotateKey = async (id: string) => {
    resetMessages();
    try {
      setActionKeyId(id);
      const result = await rotateApiKey(currentUser, id);
      setGeneratedKey(result.rawKey);
      setApiKeyMessage('Key rotated. Copy the new secret before closing.');
      await loadKeys();
    } catch (err) {
      console.error('Failed to rotate key', err);
      setApiKeyMessage('Unable to rotate API key.');
    } finally {
      setActionKeyId(null);
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!window.confirm('Revoke this API key? Integrations using it will stop working.')) return;
    resetMessages();
    try {
      setActionKeyId(id);
      await revokeApiKey(currentUser, id);
      setApiKeyMessage('API key revoked.');
      await loadKeys();
    } catch (err) {
      console.error('Failed to revoke key', err);
      setApiKeyMessage('Unable to revoke API key.');
    } finally {
      setActionKeyId(null);
    }
  };

  const handleRequestExport = async (event: React.FormEvent) => {
    event.preventDefault();
    resetMessages();
    try {
      setExportLoading(true);
      const job = await requestDataExport(currentUser, { type: exportType });
      setExportMessage(`Export ${job.id} queued. We\'ll email you when it\'s ready.`);
      await loadExports();
    } catch (err) {
      console.error('Failed to request export', err);
      setExportMessage('Unable to request export.');
    } finally {
      setExportLoading(false);
    }
  };

  const scopesForDisplay = useMemo(() =>
    Array.from(new Set(apiKeys.flatMap((key) => key.scopes))).sort(),
  [apiKeys]);

  return (
    <div className="space-y-6">
      <form onSubmit={handleSettingsSave} className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Platform fees</h3>
            <p className="text-xs text-gray-500">Control platform commissions and payout preferences.</p>
          </div>
          <button
            type="submit"
            disabled={isSavingSettings}
            className={`px-4 py-2 rounded-md text-sm font-semibold text-white ${
              isSavingSettings ? 'bg-purple-300 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {isSavingSettings ? 'Saving…' : 'Save changes'}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">
              Platform fee percentage
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="range"
                min={0}
                max={20}
                step={0.5}
                value={feeDraft}
                onChange={(event) => setFeeDraft(Number(event.target.value))}
                className="w-full"
              />
              <span className="text-sm font-semibold text-gray-900 w-12 text-right">{feeDraft}%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Applies to ticket revenue before payouts.</p>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">
              Payout currency
            </label>
            <select
              value={payoutCurrency}
              onChange={(event) => setPayoutCurrency(event.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="ZMW">ZMW (Kwacha)</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div className="flex items-center space-x-3">
            <input
              id="auto-payouts"
              type="checkbox"
              checked={autoPayouts}
              onChange={(event) => setAutoPayouts(event.target.checked)}
              className="h-4 w-4 text-purple-600 border-gray-300 rounded"
            />
            <label htmlFor="auto-payouts" className="text-sm text-gray-700">
              Enable automatic weekly payouts
            </label>
          </div>
        </div>
        <div className="border-t border-dashed border-gray-200 pt-4">
          <h4 className="text-sm font-semibold text-gray-900">Manual payout charges</h4>
          <p className="text-xs text-gray-500 mb-4">
            These fees are shown to managers inside the Revenue dashboard before they submit a payout request.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {renderFeeChannel('mobileMoney', 'Mobile money')}
            {renderFeeChannel('bankAccount', 'Bank accounts')}
          </div>
        </div>
        {settingsMessage && (
          <div className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-4 py-2">
            {settingsMessage}
          </div>
        )}
      </form>

      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">API keys & integrations</h3>
            <p className="text-xs text-gray-500">Create keys for partners or rotate existing credentials.</p>
          </div>
        </div>
        <form onSubmit={handleCreateApiKey} className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
          <div className="md:col-span-1">
            <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">Name</label>
            <input
              type="text"
              value={newKeyName}
              onChange={(event) => setNewKeyName(event.target.value)}
              placeholder="e.g., Event Zapier"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">Scopes</label>
            <input
              type="text"
              value={newKeyScopes}
              onChange={(event) => setNewKeyScopes(event.target.value)}
              placeholder="comma separated (events:read,events:write)"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-[11px] text-gray-500 mt-1">Discovered scopes: {scopesForDisplay.join(', ') || 'events:read'}</p>
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">Description</label>
            <input
              type="text"
              value={newKeyDescription}
              onChange={(event) => setNewKeyDescription(event.target.value)}
              placeholder="Optional"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="md:col-span-1 flex items-end">
            <button
              type="submit"
              disabled={actionKeyId === 'create'}
              className={`w-full px-4 py-2 rounded-md text-sm font-semibold text-white ${
                actionKeyId === 'create' ? 'bg-purple-300 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              {actionKeyId === 'create' ? 'Creating…' : 'Create key'}
            </button>
          </div>
        </form>
        {generatedKey && (
          <div className="border border-amber-200 bg-amber-50 text-amber-800 rounded-md px-4 py-3 text-sm">
            Copy this secret key now: <span className="font-mono font-semibold">{generatedKey}</span>
          </div>
        )}
        {apiKeyMessage && (
          <div className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-4 py-2">
            {apiKeyMessage}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Scopes</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Last used</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {apiKeyLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    Loading API keys…
                  </td>
                </tr>
              ) : apiKeys.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    No API keys yet.
                  </td>
                </tr>
              ) : (
                apiKeys.map((key) => (
                  <tr key={key.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{key.name}</p>
                      <p className="text-xs text-gray-500">{key.description || '—'}</p>
                      <p className="text-xs text-gray-400 mt-1 font-mono">{key.maskedKey}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {key.scopes.join(', ')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                        key.status === 'active'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}>
                        {key.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-4 py-3 space-x-2">
                      <button
                        onClick={() => handleRotateKey(key.id)}
                        disabled={actionKeyId === key.id}
                        className="px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-200 text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                      >
                        {actionKeyId === key.id ? 'Rotating…' : 'Rotate'}
                      </button>
                      <button
                        onClick={() => handleRevokeKey(key.id)}
                        disabled={actionKeyId === key.id || key.status === 'revoked'}
                        className="px-3 py-1.5 text-xs font-semibold rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                      >
                        {key.status === 'revoked' ? 'Revoked' : 'Revoke'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Data exports</h3>
            <p className="text-xs text-gray-500">Generate CSV downloads for downstream analytics.</p>
          </div>
        </div>
        <form onSubmit={handleRequestExport} className="flex flex-col md:flex-row md:items-end md:space-x-4 space-y-3 md:space-y-0">
          <div className="md:flex-1">
            <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">
              Export type
            </label>
            <select
              value={exportType}
              onChange={(event) => setExportType(event.target.value as DataExportJob['type'])}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {EXPORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={exportLoading}
            className={`px-4 py-2 rounded-md text-sm font-semibold text-white ${
              exportLoading ? 'bg-purple-300 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {exportLoading ? 'Requesting…' : 'Request export'}
          </button>
        </form>
        {exportMessage && (
          <div className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-4 py-2">
            {exportMessage}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Export</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Requested</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Completed</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {exports.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    No export history yet.
                  </td>
                </tr>
              ) : (
                exports.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{job.type.toUpperCase()}</p>
                      <p className="text-xs text-gray-500">{job.id}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                        job.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : job.status === 'failed'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {job.status}
                      </span>
                      {job.errorMessage && (
                        <p className="text-xs text-rose-600 mt-1">{job.errorMessage}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(job.requestedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {job.completedAt ? new Date(job.completedAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {job.downloadUrl && job.status === 'completed' ? (
                        <a
                          href={job.downloadUrl}
                          className="text-xs font-semibold text-purple-600 hover:text-purple-800"
                        >
                          Download CSV
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminSettingsPanel;
