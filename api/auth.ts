import { randomUUID } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { UserRole, UserStatus } from '../types';
import { usersStore } from '../server/storage/usersStore';
import { db } from './db';

const googleClientId = process.env.GOOGLE_CLIENT_ID ?? '';
const googleClient = googleClientId ? new OAuth2Client(googleClientId) : null;

// This file simulates API endpoints, e.g., /api/auth/login or /api/auth/signup.
// In a real backend, these would be Express.js route handlers.

const STATUS_MESSAGES: Record<Exclude<UserStatus, 'active'>, string> = {
  suspended: 'Your account has been suspended. Please contact support for assistance.',
  onboarding: 'Your account is still pending activation. Please check back later.',
};

const buildInactiveStatusResponse = (status: UserStatus): Response => {
  const message =
    status === 'active' ? 'Your account is active.' : STATUS_MESSAGES[status] ?? 'Account is not active.';
  const statusCode = status === 'suspended' ? 423 : 403;
  return new Response(JSON.stringify({ message, status }), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json' },
  });
};

export async function handleLogin(req: { body: { email?: string; password?: string } }) {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return new Response(JSON.stringify({ message: 'email and password are required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  const storedUser = usersStore.findByEmail(email);

  if (!storedUser) {
    return new Response(JSON.stringify({ message: 'Invalid email or password.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!storedUser.authProviders.includes('local')) {
    return new Response(JSON.stringify({ message: 'This account uses Google sign-in. Please continue with Google.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!usersStore.verifyPassword(storedUser, password)) {
    return new Response(JSON.stringify({ message: 'Invalid email or password.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (storedUser.status !== 'active') {
    return buildInactiveStatusResponse(storedUser.status);
  }

  const user = usersStore.toPublicUser(storedUser);

  return new Response(JSON.stringify(user), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const allowedSignupRoles: UserRole[] = ['attendee', 'manager'];

const isAllowedSignupRole = (role: string | undefined): role is UserRole =>
  !!role && allowedSignupRoles.includes(role as UserRole);

export async function handleSignup(req: {
  body: { name?: string; email?: string; password?: string; role?: UserRole };
}) {
  const { name, email, password, role } = req.body ?? {};

  if (!name || !email || !password) {
    return new Response(JSON.stringify({ message: 'name, email, and password are required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const trimmedEmail = email.trim();
  const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  if (!emailPattern.test(trimmedEmail)) {
    return new Response(JSON.stringify({ message: 'A valid email address is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (password.length < 8) {
    return new Response(JSON.stringify({ message: 'Password must be at least 8 characters.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (usersStore.findByEmail(trimmedEmail)) {
    return new Response(JSON.stringify({ message: 'An account with that email already exists.' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  const resolvedRole: UserRole = isAllowedSignupRole(role) ? role : 'attendee';
  try {
    const newUser = usersStore.create({
      id: randomUUID(),
      name: name.trim(),
      email: trimmedEmail,
      role: resolvedRole,
      status: 'active',
      passwordHash: usersStore.hashPassword(password),
    });

    return new Response(JSON.stringify(usersStore.toPublicUser(newUser)), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Failed to create user', err);
    return new Response(JSON.stringify({ message: 'Unable to create user.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function handleGoogleLogin(req: { body: { credential?: string } }) {
  if (!googleClient || !googleClientId) {
    return new Response(JSON.stringify({ message: 'Google login not configured.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { credential } = req.body ?? {};
  if (!credential) {
    return new Response(JSON.stringify({ message: 'Missing Google credential.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: googleClientId,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return new Response(JSON.stringify({ message: 'Unable to retrieve Google account information.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const email = payload.email;
    const name = payload.name ?? email.split('@')[0];

    let storedUser = usersStore.findByEmail(email);

    if (storedUser) {
      storedUser = usersStore.addAuthProvider(storedUser.id, 'google') ?? storedUser;
    } else {
      storedUser = usersStore.create({
        id: randomUUID(),
        name,
        email,
        role: 'attendee',
        status: 'active',
        passwordHash: usersStore.hashPassword(randomUUID()),
        authProviders: ['google'],
      });
    }

    if (storedUser.status !== 'active') {
      return buildInactiveStatusResponse(storedUser.status);
    }

    const user = usersStore.toPublicUser(storedUser);
    return new Response(JSON.stringify(user), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Failed to verify Google credential', err);
    return new Response(JSON.stringify({ message: 'Google authentication failed.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function handleRequestPasswordReset(req: { body: { email?: string } }) {
  const email = req.body?.email?.trim().toLowerCase();
  if (!email) {
    return new Response(JSON.stringify({ message: 'Email is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const genericMessage =
    'If an account exists for that email, we sent password reset instructions.';

  const user = usersStore.findByEmail(email);
  if (!user || !user.authProviders.includes('local')) {
    return new Response(JSON.stringify({ message: genericMessage }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { token, record } = db.passwordResets.create(user.id, 30);

  return new Response(
    JSON.stringify({
      message: genericMessage,
      resetToken: token,
      expiresAt: record.expiresAt,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

export async function handleConfirmPasswordReset(req: {
  body: { token?: string; password?: string };
}) {
  const { token, password } = req.body ?? {};
  if (!token || !password) {
    return new Response(JSON.stringify({ message: 'Token and new password are required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (password.length < 8) {
    return new Response(JSON.stringify({ message: 'Password must be at least 8 characters.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const resetRecord = db.passwordResets.findValidByToken(token);
  if (!resetRecord) {
    return new Response(JSON.stringify({ message: 'Invalid or expired reset token.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = usersStore.findById(resetRecord.userId);
  if (!user) {
    return new Response(JSON.stringify({ message: 'User account not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  usersStore.update(user.id, {
    passwordHash: usersStore.hashPassword(password),
    authProviders: user.authProviders.includes('local')
      ? user.authProviders
      : [...user.authProviders, 'local'],
  });

  db.passwordResets.markUsed(resetRecord.id);

  return new Response(JSON.stringify({ message: 'Password updated successfully.' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
