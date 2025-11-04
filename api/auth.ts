import { randomUUID } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { UserRole } from '../types';
import { usersStore } from '../server/storage/usersStore';

const googleClientId = process.env.GOOGLE_CLIENT_ID ?? '';
const googleClient = googleClientId ? new OAuth2Client(googleClientId) : null;

// This file simulates API endpoints, e.g., /api/auth/login or /api/auth/signup.
// In a real backend, these would be Express.js route handlers.

/**
 * Handles a user login request.
 * @param {Request} req - The incoming request object, containing email in the body.
 * @returns {Response} A response object with the user data or an error.
 */
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
