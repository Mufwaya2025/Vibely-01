import {
  OrganizerKycProfile,
  OrganizerKycRequestPayload,
  User,
} from '../types';
import { apiFetch } from '../utils/apiClient';

const parseJson = async <T>(response: Response, fallback: string): Promise<T> => {
  if (!response.ok) {
    const message = await response.text().catch(() => fallback);
    throw new Error(message || fallback);
  }
  return response.json() as Promise<T>;
};

export const getOrganizerKycProfile = async (user: User): Promise<OrganizerKycProfile> =>
  parseJson<OrganizerKycProfile>(
    await apiFetch('/api/kyc/organizer/profile', { user }),
    'Failed to load KYC profile.'
  );

export const submitOrganizerKycProfile = async (
  user: User,
  profile: OrganizerKycRequestPayload
): Promise<OrganizerKycProfile> =>
  parseJson<OrganizerKycProfile>(
    await apiFetch('/api/kyc/organizer/profile', {
      method: 'POST',
      user,
      body: { profile },
    }),
    'Failed to submit KYC profile.'
  );

export const requestOrganizerEmailOtp = async (user: User, email?: string) =>
  parseJson<{ message: string }>(
    await apiFetch('/api/kyc/organizer/email-otp/request', {
      method: 'POST',
      user,
      body: { email },
    }),
    'Unable to send verification code.'
  );

export const verifyOrganizerEmailOtp = async (user: User, code: string) =>
  parseJson<{ message: string; profile: OrganizerKycProfile }>(
    await apiFetch('/api/kyc/organizer/email-otp/verify', {
      method: 'POST',
      user,
      body: { code },
    }),
    'Unable to verify contact email.'
  );
