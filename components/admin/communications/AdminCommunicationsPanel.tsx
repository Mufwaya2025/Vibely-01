import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  NotificationChannel,
  NotificationQueueEntry,
  NotificationTemplate,
  User,
} from '../../../types';
import {
  getNotificationTemplates,
  createNotificationTemplate,
  updateNotificationTemplate,
  deleteNotificationTemplate,
  sendNotificationTemplate,
  getNotificationQueue,
  resendNotification,
} from '../../../services/adminService';

interface AdminCommunicationsPanelProps {
  currentUser: User;
}

type TemplateFormState = {
  id?: string;
  name: string;
  channel: NotificationChannel;
  audienceDescription: string;
  subject: string;
  body: string;
};

type QueueFilter = 'all' | 'queued' | 'sent' | 'failed';

const DEFAULT_TEMPLATE_FORM: TemplateFormState = {
  name: '',
  channel: 'email',
  audienceDescription: '',
  subject: '',
  body: '',
};

const AUDIENCE_PRESETS: { label: string; description: string }[] = [
  {
    label: 'Managers hosting events this month',
    description: 'Managers with published events happening in the next 30 days',
  },
  {
    label: 'Attendees near Lusaka',
    description: 'Attendees within 20km of Lusaka CBD',
  },
  {
    label: 'VIP ticket holders',
    description: 'Attendees who purchased VIP tickets in the last 90 days',
  },
];

const CHANNEL_OPTIONS: { value: NotificationChannel; label: string }[] = [
  { value: 'email', label: 'Email' },
  { value: 'push', label: 'Push Notification' },
];

const AdminCommunicationsPanel: React.FC<AdminCommunicationsPanelProps> = ({ currentUser }) => {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [queueEntries, setQueueEntries] = useState<NotificationQueueEntry[]>([]);
  const [templateForm, setTemplateForm] = useState<TemplateFormState>(DEFAULT_TEMPLATE_FORM);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('all');
  const [sendingTemplateId, setSendingTemplateId] = useState<string>('');
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [customAudience, setCustomAudience] = useState<string>('');
  const [sendStatusMessage, setSendStatusMessage] = useState<string | null>(null);
  const [templateMessage, setTemplateMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const resetTemplateForm = () => {
    setTemplateForm(DEFAULT_TEMPLATE_FORM);
    setIsEditingTemplate(false);
  };

  const showPositive = (message: string) => {
    setTemplateMessage(message);
    setErrorMessage(null);
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setTemplateMessage(null);
  };

  const fetchTemplates = useCallback(async () => {
    try {
      setLoadingTemplates(true);
      const result = await getNotificationTemplates(currentUser);
      setTemplates(result.data ?? []);
    } catch (err) {
      console.error('Failed to load templates', err);
      showError('Unable to load messaging templates.');
    } finally {
      setLoadingTemplates(false);
    }
  }, [currentUser]);

  const fetchQueue = useCallback(
    async (filter: QueueFilter = queueFilter) => {
      try {
        setLoadingQueue(true);
        const query = filter === 'all' ? undefined : { status: filter };
        const result = await getNotificationQueue(currentUser, query);
        setQueueEntries(result.data ?? []);
      } catch (err) {
        console.error('Failed to load notification queue', err);
        showError('Unable to load notification queue.');
      } finally {
        setLoadingQueue(false);
      }
    },
    [currentUser, queueFilter]
  );

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    fetchQueue(queueFilter);
  }, [fetchQueue, queueFilter]);

  const templateIdMap = useMemo(() => {
    const map = new Map<string, NotificationTemplate>();
    templates.forEach((tpl) => map.set(tpl.id, tpl));
    return map;
  }, [templates]);

  const handleTemplateSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!templateForm.name || !templateForm.audienceDescription || !templateForm.subject || !templateForm.body) {
      showError('Please complete all template fields before saving.');
      return;
    }

    try {
      setIsSavingTemplate(true);
      if (templateForm.id) {
        await updateNotificationTemplate(currentUser, templateForm);
        showPositive('Template updated successfully.');
      } else {
        await createNotificationTemplate(currentUser, templateForm);
        showPositive('Template created successfully.');
      }
      resetTemplateForm();
      await fetchTemplates();
    } catch (err) {
      console.error('Failed to save template', err);
      showError('Unable to save template.');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleTemplateEdit = (template: NotificationTemplate) => {
    setTemplateForm({ ...template });
    setIsEditingTemplate(true);
    setTemplateMessage(null);
    setErrorMessage(null);
  };

  const handleTemplateDelete = async (id: string) => {
    if (!window.confirm('Delete this template? This action cannot be undone.')) return;
    try {
      await deleteNotificationTemplate(currentUser, id);
      showPositive('Template deleted.');
      if (templateForm.id === id) {
        resetTemplateForm();
      }
      await fetchTemplates();
    } catch (err) {
      console.error('Failed to delete template', err);
      showError('Unable to delete template.');
    }
  };

  const handleSendTemplate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!sendingTemplateId) {
      setSendStatusMessage('Select a template before sending.');
      return;
    }
    try {
      const audienceDescription = customAudience.trim() || selectedPreset || undefined;
      const result = await sendNotificationTemplate(currentUser, {
        templateId: sendingTemplateId,
        audienceDescription,
      });
      setSendStatusMessage(
        result.status === 'failed'
          ? `Delivery failed: ${result.errorMessage ?? 'unknown reason'}`
          : 'Notification sent successfully.'
      );
      if (result.status !== 'failed') {
        setSelectedPreset('');
        setCustomAudience('');
      }
      await fetchQueue(queueFilter);
    } catch (err) {
      console.error('Failed to send notification', err);
      setSendStatusMessage('Unable to send notification.');
    }
  };

  const handleResendNotification = async (id: string) => {
    try {
      setResendingId(id);
      await resendNotification(currentUser, id);
      await fetchQueue(queueFilter);
    } catch (err) {
      console.error('Failed to resend notification', err);
      showError('Unable to resend notification.');
    } finally {
      setResendingId(null);
    }
  };

  const queueToDisplay = useMemo(
    () =>
      queueEntries.map((entry) => ({
        ...entry,
        templateName: entry.templateName || templateIdMap.get(entry.templateId)?.name || 'Unknown template',
      })),
    [queueEntries, templateIdMap]
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-md border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Messaging Templates</h3>
            <p className="text-xs text-gray-500">Create reusable email or push templates for targeted campaigns.</p>
          </div>
          <button
            onClick={resetTemplateForm}
            className="px-3 py-1.5 rounded-md text-sm font-semibold text-purple-700 border border-purple-200 hover:bg-purple-50 transition-colors"
          >
            New Template
          </button>
        </div>
        <div className="px-6 py-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form onSubmit={handleTemplateSubmit} className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-900">
                {isEditingTemplate ? 'Edit template' : 'Create template'}
              </h4>
              {isEditingTemplate && (
                <button
                  type="button"
                  className="text-xs font-semibold text-gray-500 hover:text-gray-700"
                  onClick={resetTemplateForm}
                >
                  Cancel edit
                </button>
              )}
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">Name</label>
              <input
                type="text"
                value={templateForm.name}
                onChange={(event) => setTemplateForm((prev) => ({ ...prev, name: event.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="e.g., Lusaka weekly digest"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">Channel</label>
                <select
                  value={templateForm.channel}
                  onChange={(event) =>
                    setTemplateForm((prev) => ({ ...prev, channel: event.target.value as NotificationChannel }))
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {CHANNEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">
                  Audience slice
                </label>
                <input
                  type="text"
                  value={templateForm.audienceDescription}
                  onChange={(event) =>
                    setTemplateForm((prev) => ({ ...prev, audienceDescription: event.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., Attendees near Lusaka"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">Subject</label>
              <input
                type="text"
                value={templateForm.subject}
                onChange={(event) => setTemplateForm((prev) => ({ ...prev, subject: event.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="e.g., Vibes happening near you"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">Message body</label>
              <textarea
                value={templateForm.body}
                onChange={(event) => setTemplateForm((prev) => ({ ...prev, body: event.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                rows={6}
                placeholder="Write a friendly, actionable message for your recipients."
              />
            </div>
            <button
              type="submit"
              disabled={isSavingTemplate}
              className={`px-4 py-2 rounded-md text-sm font-semibold text-white transition-colors ${
                isSavingTemplate ? 'bg-purple-300 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              {isSavingTemplate ? 'Saving…' : isEditingTemplate ? 'Update template' : 'Create template'}
            </button>
          </form>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-900">Saved templates</h4>
              <button
                onClick={fetchTemplates}
                className="text-xs font-semibold text-gray-500 hover:text-gray-700"
              >
                Refresh
              </button>
            </div>
            {loadingTemplates ? (
              <div className="p-6 text-center text-gray-500">Loading templates…</div>
            ) : templates.length === 0 ? (
              <div className="p-6 text-center text-gray-500">No templates yet. Create one to get started.</div>
            ) : (
              <div className="space-y-2">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="border border-gray-200 rounded-xl px-4 py-3 flex items-start justify-between hover:border-purple-200 transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">{template.name}</p>
                      <p className="text-xs text-gray-500">
                        {template.channel.toUpperCase()} · {template.audienceDescription}
                      </p>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{template.subject}</p>
                    </div>
                    <div className="flex space-x-3">
                      <button
                        className="text-xs font-semibold text-purple-600 hover:text-purple-800"
                        onClick={() => handleTemplateEdit(template)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-xs font-semibold text-rose-600 hover:text-rose-800"
                        onClick={() => handleTemplateDelete(template.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {(templateMessage || errorMessage) && (
          <div
            className={`px-6 pb-6 ${
              templateMessage
                ? 'text-emerald-700 bg-emerald-50 border-t border-emerald-100'
                : 'text-rose-700 bg-rose-50 border-t border-rose-100'
            }`}
          >
            {templateMessage ?? errorMessage}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-md border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Send bulk notification</h3>
            <p className="text-xs text-gray-500">Target a specific audience with a saved template.</p>
          </div>
          <button
            onClick={() => {
              setSendingTemplateId('');
              setSelectedPreset('');
              setCustomAudience('');
              setSendStatusMessage(null);
            }}
            className="px-3 py-1.5 rounded-md text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors"
          >
            Clear
          </button>
        </div>
        <form onSubmit={handleSendTemplate} className="px-6 py-6 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1">
              <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">
                Template
              </label>
              <select
                value={sendingTemplateId}
                onChange={(event) => {
                  setSendingTemplateId(event.target.value);
                  setSendStatusMessage(null);
                }}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-1">
              <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">
                Audience preset
              </label>
              <select
                value={selectedPreset}
                onChange={(event) => {
                  setSelectedPreset(event.target.value);
                  setSendStatusMessage(null);
                }}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Use template default</option>
                {AUDIENCE_PRESETS.map((preset) => (
                  <option key={preset.label} value={preset.description}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-1">
              <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">
                Custom audience note
              </label>
              <input
                type="text"
                value={customAudience}
                onChange={(event) => {
                  setCustomAudience(event.target.value);
                  setSendStatusMessage(null);
                }}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Optional audience override"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Tip: refine targeting presets in the marketing playbook for higher engagement.
            </span>
            <button
              type="submit"
              className="px-5 py-2 rounded-md text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-colors"
            >
              Send broadcast
            </button>
          </div>
          {sendStatusMessage && (
            <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
              {sendStatusMessage}
            </p>
          )}
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-md border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Notification queue</h3>
            <p className="text-xs text-gray-500">Review recent deliveries and retry failed messages.</p>
          </div>
          <div className="flex items-center space-x-3">
            <select
              value={queueFilter}
              onChange={(event) => setQueueFilter(event.target.value as QueueFilter)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All statuses</option>
              <option value="queued">Queued</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
            </select>
            <button
              onClick={() => fetchQueue(queueFilter)}
              className="px-3 py-1.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
        {loadingQueue ? (
          <div className="p-10 text-center text-gray-500">Loading notifications…</div>
        ) : queueToDisplay.length === 0 ? (
          <div className="p-10 text-center text-gray-500">No notifications in the queue yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Sent</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Template</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Channel</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Audience</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {queueToDisplay.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600">
                      {new Intl.DateTimeFormat('en-US', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(entry.createdAt))}
                    </td>
                    <td className="px-4 py-3 text-gray-900">{entry.templateName}</td>
                    <td className="px-4 py-3 text-gray-600 uppercase">{entry.channel}</td>
                    <td className="px-4 py-3 text-gray-600">{entry.audienceDescription}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          entry.status === 'sent'
                            ? 'bg-emerald-100 text-emerald-700'
                            : entry.status === 'failed'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {entry.status}
                      </span>
                      {entry.errorMessage && (
                        <p className="text-xs text-rose-600 mt-1">{entry.errorMessage}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleResendNotification(entry.id)}
                        disabled={entry.status !== 'failed' || resendingId === entry.id}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                          entry.status === 'failed'
                            ? 'bg-purple-600 text-white hover:bg-purple-700'
                            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        } ${resendingId === entry.id ? 'opacity-70' : ''}`}
                      >
                        {resendingId === entry.id ? 'Resending…' : 'Resend'}
                      </button>
                    </td>
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

export default AdminCommunicationsPanel;
