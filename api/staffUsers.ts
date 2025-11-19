import type { User } from '../types';
import { db } from './db';

const sanitizeStaffUser = (user: any) => {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
};

export async function handleManagerListStaffUsers(req: { user: User | null }) {
  if (!req.user || req.user.role !== 'manager') {
    return new Response(JSON.stringify({ message: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const all = db.staffUsers.getAll ? db.staffUsers.getAll() : [];

    const staffUsers = all
      .filter((u: any) => u.organizerId === req.user.id)
      .map(sanitizeStaffUser);

    return new Response(JSON.stringify({ staffUsers }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error in handleManagerListStaffUsers:', err);
    return new Response(JSON.stringify({ message: 'Failed to load staff users' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function handleManagerCreateStaffUser(req: {
  user: User | null;
  body?: { name?: string; email?: string; password?: string };
}) {
  if (!req.user || req.user.role !== 'manager') {
    return new Response(JSON.stringify({ message: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const name = req.body?.name?.trim() || '';
  const email = req.body?.email?.trim().toLowerCase() || '';
  const password = req.body?.password || '';

  if (!email || !password) {
    return new Response(JSON.stringify({ message: 'Email and password are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (password.length < 6) {
    return new Response(JSON.stringify({ message: 'Password must be at least 6 characters' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const created = db.staffUsers.create({
      id: `staff-${Date.now()}`,
      name,
      email,
      password,
      organizerId: req.user.id,
    });

    return new Response(JSON.stringify({ staffUser: sanitizeStaffUser(created) }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error creating staff user:', error);
    const message = error instanceof Error ? error.message : 'Failed to create staff user';
    return new Response(JSON.stringify({ message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
