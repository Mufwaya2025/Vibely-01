import { User } from '../types';
import { apiFetch } from '../utils/apiClient';

type SignupRole = 'attendee' | 'manager';

/**
 * Logs in a user by calling the backend API.
 * @param email The user's email.
 * @param password The user's password.
 * @returns A promise that resolves to the User object or null.
 */
export const login = async (email: string, password: string): Promise<User | null> => {
  try {
    const response = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });

    if (!response.ok) {
      console.error('Login failed:', await response.text());
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error('Error during login:', error);
    return null;
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
