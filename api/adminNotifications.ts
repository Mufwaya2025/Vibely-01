import { db } from './db';
import { requireAdmin } from './utils/auth';
import { NotificationChannel, NotificationStatus, User } from '../types';

interface AdminRequest<T = any> {
  user: User | null;
  body?: T;
  query?: Record<string, string | undefined>;
  params?: Record<string, string>;
}

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const isChannel = (value: string): value is NotificationChannel =>
  value === 'email' || value === 'push';

const simulateDelivery = (): { status: NotificationStatus; error?: string } => {
  const fail = Math.random() < 0.2;
  if (fail) {
    const reasons = [
      'Provider timeout. Try again shortly.',
      'Audience segment returned zero recipients.',
      'Temporary delivery outage from provider.',
      'Invalid template payload for selected channel.',
    ];
    return {
      status: 'failed',
      error: reasons[Math.floor(Math.random() * reasons.length)],
    };
  }
  return { status: 'sent' };
};

export async function handleAdminGetNotificationTemplates(req: AdminRequest) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const templates = db.notificationTemplates.findAll();
  return jsonResponse({ data: templates });
}

export async function handleAdminCreateNotificationTemplate(
  req: AdminRequest<{
    name?: string;
    channel?: NotificationChannel;
    audienceDescription?: string;
    subject?: string;
    body?: string;
  }>
) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const { name, channel, audienceDescription, subject, body } = req.body ?? {};
  if (!name || !channel || !audienceDescription || !subject || !body) {
    return jsonResponse({ message: 'All template fields are required.' }, 400);
  }

  if (!isChannel(channel)) {
    return jsonResponse({ message: 'Invalid channel.' }, 400);
  }

  const template = db.notificationTemplates.create({
    name,
    channel,
    audienceDescription,
    subject,
    body,
  });

  db.auditLogs.create({
    actorId: req.user!.id,
    targetUserId: req.user!.id,
    action: 'notification_template_create',
    details: `Created template "${template.name}"`,
  });

  return jsonResponse(template, 201);
}

export async function handleAdminUpdateNotificationTemplate(
  req: AdminRequest<{
    id: string;
    name?: string;
    channel?: NotificationChannel;
    audienceDescription?: string;
    subject?: string;
    body?: string;
  }>
) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const { id, name, channel, audienceDescription, subject, body } = req.body ?? {};
  if (!id) {
    return jsonResponse({ message: 'Template id is required.' }, 400);
  }

  if (channel && !isChannel(channel)) {
    return jsonResponse({ message: 'Invalid channel.' }, 400);
  }

  const updated = db.notificationTemplates.update(id, {
    ...(name ? { name } : {}),
    ...(channel ? { channel } : {}),
    ...(audienceDescription ? { audienceDescription } : {}),
    ...(subject ? { subject } : {}),
    ...(body ? { body } : {}),
  });

  if (!updated) {
    return jsonResponse({ message: 'Template not found.' }, 404);
  }

  db.auditLogs.create({
    actorId: req.user!.id,
    targetUserId: req.user!.id,
    action: 'notification_template_update',
    details: `Updated template "${updated.name}"`,
  });

  return jsonResponse(updated);
}

export async function handleAdminDeleteNotificationTemplate(req: AdminRequest) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const id = req.params?.id;
  if (!id) {
    return jsonResponse({ message: 'Template id is required.' }, 400);
  }

  const deleted = db.notificationTemplates.delete(id);
  if (!deleted) {
    return jsonResponse({ message: 'Template not found.' }, 404);
  }

  db.auditLogs.create({
    actorId: req.user!.id,
    targetUserId: req.user!.id,
    action: 'notification_template_delete',
    details: `Deleted template ${id}`,
  });

  return jsonResponse({ success: true });
}

export async function handleAdminSendNotification(
  req: AdminRequest<{ templateId: string; audienceDescription?: string }>
) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const { templateId, audienceDescription } = req.body ?? {};
  if (!templateId) {
    return jsonResponse({ message: 'templateId is required.' }, 400);
  }

  const template = db.notificationTemplates.findById(templateId);
  if (!template) {
    return jsonResponse({ message: 'Template not found.' }, 404);
  }

  const { status, error } = simulateDelivery();
  const entry = db.notificationQueue.create({
    templateId: template.id,
    templateName: template.name,
    channel: template.channel,
    audienceDescription: audienceDescription ?? template.audienceDescription,
    status,
    errorMessage: error,
  });

  const auditDetails =
    status === 'sent'
      ? `Sent template "${template.name}" to ${entry.audienceDescription}`
      : `Attempted to send template "${template.name}" (${error})`;

  db.auditLogs.create({
    actorId: req.user!.id,
    targetUserId: req.user!.id,
    action: 'notification_send',
    details: auditDetails,
  });

  return jsonResponse(entry, status === 'failed' ? 207 : 201);
}

export async function handleAdminGetNotificationQueue(req: AdminRequest) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const { status } = req.query ?? {};
  let entries = db.notificationQueue.findAll();

  if (status && status !== 'all') {
    entries = entries.filter((entry) => entry.status === status);
  }

  return jsonResponse({ data: entries });
}

export async function handleAdminResendNotification(req: AdminRequest) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const id = req.params?.id;
  if (!id) {
    return jsonResponse({ message: 'Notification id is required.' }, 400);
  }

  const entry = db.notificationQueue.findById(id);
  if (!entry) {
    return jsonResponse({ message: 'Notification not found.' }, 404);
  }

  const { status, error } = simulateDelivery();
  const updated = db.notificationQueue.updateStatus(id, status, error);

  db.auditLogs.create({
    actorId: req.user!.id,
    targetUserId: req.user!.id,
    action: 'notification_resend',
    details:
      status === 'sent'
        ? `Resent notification ${id} successfully`
        : `Resend failed for notification ${id} (${error})`,
  });

  return jsonResponse(updated);
}
