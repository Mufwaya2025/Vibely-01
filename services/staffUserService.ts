import { apiFetch } from '../utils/apiClient';
import type { StaffUser } from '../types';

const parseJson = async <T>(response: Response, fallbackMessage: string): Promise<T> => {
  if (!response.ok) {
    const message = await response.text().catch(() => fallbackMessage);
    throw new Error(message || fallbackMessage);
  }
  return response.json() as Promise<T>;
};

export const listStaffUsers = async (user?: any) =>
  parseJson<{ staffUsers: StaffUser[] }>(
    await apiFetch('/api/manager/staff-users', { user }),
    'Failed to load staff users.'
  );

export const createStaffUser = async (
  data: { name?: string; email: string; password: string },
  user?: any
) =>
  parseJson<{ staffUser: StaffUser }>(
    await apiFetch('/api/manager/staff-users', {
      method: 'POST',
      user,
      body: data,
    }),
    'Failed to create staff user.'
  );
