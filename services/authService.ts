import { User } from '../types';
import { apiFetch } from '../utils/apiClient';

type SignupRole = 'attendee' | 'manager';

/**
 * Logs in a user by calling the backend API.
 * @param email The user's email.
 * @param password The user's password.
 * @returns A promise that resolves to the User object or null.
 */
export const login = async (email: string, password: string): Promise<User> => {
  try {
    const response = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });

    if (!response.ok) {
      const rawMessage = await response.text().catch(() => '');
      let message = rawMessage || 'Failed to sign in.';
      try {
        const parsed = JSON.parse(rawMessage);
        if (parsed?.message) {
          message = parsed.message;
        }
      } catch {
        // ignore JSON parse errors
      }
      throw new Error(message || 'Failed to sign in.');
    }
    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to sign in.');
  }
};

/**
 * Registers a new user account.
 * @param input Signup payload containing name, email, and optional role.
 * @returns Promise resolving to the newly created user.
 */
export const signup = async (input: {
  name: string;
  email: string;
  password: string;
  role?: SignupRole;
}): Promise<User> => {
  const payload = {
    name: input.name.trim(),
    email: input.email.trim(),
    password: input.password,
    role: input.role ?? 'attendee',
  };

  const response = await apiFetch('/api/auth/signup', {
    method: 'POST',
    body: payload,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => 'Signup failed.');
    throw new Error(message || 'Signup failed.');
  }

  return response.json();
};

export const loginWithGoogle = async (credential: string): Promise<User> => {
  if (!credential) {
    throw new Error('Missing Google credential.');
  }
  const response = await apiFetch('/api/auth/google', {
    method: 'POST',
    body: { credential },
  });

  if (!response.ok) {
    const message = await response.text().catch(() => 'Google login failed.');
    throw new Error(message || 'Google login failed.');
  }

  return response.json();
};

export const requestPasswordReset = async (
  email: string
): Promise<{ message: string; resetToken?: string; expiresAt?: string }> => {
  const response = await apiFetch('/api/auth/password-reset/request', {
    method: 'POST',
    body: { email },
  });

  if (!response.ok) {
    const message = await response.text().catch(() => 'Unable to request password reset.');
    throw new Error(message || 'Unable to request password reset.');
  }

  return response.json();
};

export const confirmPasswordReset = async (
  token: string,
  password: string
): Promise<{ message: string }> => {
  const response = await apiFetch('/api/auth/password-reset/confirm', {
    method: 'POST',
    body: { token, password },
  });

  if (!response.ok) {
    const message = await response.text().catch(() => 'Unable to reset password.');
    throw new Error(message || 'Unable to reset password.');
  }

  return response.json();
};
