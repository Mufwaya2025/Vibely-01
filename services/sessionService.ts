import { User } from '../types';

const STORAGE_KEY = 'vibely:session:user';

export const loadStoredUser = (): User | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch (error) {
    console.error('Failed to load stored session', error);
    return null;
  }
};

export const storeUserSession = (user: User): void => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('Failed to persist session', error);
  }
};

export const clearStoredSession = (): void => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear stored session', error);
  }
};
