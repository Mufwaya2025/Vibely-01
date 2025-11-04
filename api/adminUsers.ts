import { db } from './db';
import { requireAdmin } from './utils/auth';
import { User, UserRole, UserStatus } from '../types';

interface AdminRequest<T = any> {
  user: User | null;
  body?: T;
  query?: Record<string, string | undefined>;
}

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const isUserRole = (value: string): value is UserRole =>
  value === 'attendee' || value === 'manager' || value === 'admin';

const isUserStatus = (value: string): value is UserStatus =>
  value === 'active' || value === 'suspended' || value === 'onboarding';

export async function handleAdminGetUsers(req: AdminRequest) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const { status, role, q } = req.query ?? {};
  let users = db.users.findAll();

  if (status && status !== 'all' && isUserStatus(status)) {
    users = users.filter((user) => user.status === status);
  }

  if (role && role !== 'all' && isUserRole(role)) {
    users = users.filter((user) => user.role === role);
  }

  if (q) {
    const needle = q.toLowerCase();
    users = users.filter(
      (user) =>
        user.name.toLowerCase().includes(needle) ||
        user.email.toLowerCase().includes(needle)
    );
  }

  return jsonResponse({ data: users });
}

export async function handleAdminUpdateUserRole(
  req: AdminRequest<{ userId: string; role: UserRole }>
) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const { userId, role } = req.body ?? {};
  if (!userId || !role || !isUserRole(role)) {
    return jsonResponse({ message: 'userId and valid role are required.' }, 400);
  }

  if (req.user && req.user.id === userId && role !== 'admin') {
    return jsonResponse({ message: 'You cannot change your own role.' }, 400);
  }

  const updated = db.users.updateRole(userId, role);
  if (!updated) {
    return jsonResponse({ message: 'User not found.' }, 404);
  }

  db.auditLogs.create({
    actorId: req.user!.id,
    targetUserId: userId,
    action: 'role_change',
    details: `Role updated to ${role}`,
  });

  return jsonResponse(updated);
}

export async function handleAdminUpdateUserStatus(
  req: AdminRequest<{ userId: string; status: UserStatus }>
) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const { userId, status } = req.body ?? {};
  if (!userId || !status || !isUserStatus(status)) {
    return jsonResponse({ message: 'userId and valid status are required.' }, 400);
  }

  if (req.user && req.user.id === userId && status !== 'active') {
    return jsonResponse({ message: 'You cannot deactivate your own account.' }, 400);
  }

  const updated = db.users.updateStatus(userId, status);
  if (!updated) {
    return jsonResponse({ message: 'User not found.' }, 404);
  }

  db.auditLogs.create({
    actorId: req.user!.id,
    targetUserId: userId,
    action: 'status_change',
    details: `Status updated to ${status}`,
  });

  return jsonResponse(updated);
}

export async function handleAdminResetUserPassword(
  req: AdminRequest<{ userId: string }>
) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const { userId } = req.body ?? {};
  if (!userId) {
    return jsonResponse({ message: 'userId is required.' }, 400);
  }

  const user = db.users.resetPassword(userId);
  if (!user) {
    return jsonResponse({ message: 'User not found.' }, 404);
  }

  db.auditLogs.create({
    actorId: req.user!.id,
    targetUserId: userId,
    action: 'password_reset',
    details: 'Password reset initiated by admin',
  });

  return jsonResponse({ success: true, message: 'Password reset instructions sent.' });
}

export async function handleAdminGetAuditLogs(req: AdminRequest) {
  const auth = requireAdmin(req.user);
  if (auth) return auth;

  const { limit } = req.query ?? {};
  let logs = db.auditLogs.findAll();

  const parsedLimit = limit ? parseInt(limit, 10) : 0;
  if (!Number.isNaN(parsedLimit) && parsedLimit > 0) {
    logs = logs.slice(0, parsedLimit);
  }

  return jsonResponse({ data: logs });
}
