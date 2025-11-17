import { db } from './db';
import { emailService } from '../server/services/emailService';
import { KycStatus, OrganizerKycRequestPayload, User } from '../types';
import { requireAdmin } from './utils/auth';

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const requireManager = (user: User | null | undefined): Response | null => {
  if (!user || user.role !== 'manager') {
    return json({ message: 'Forbidden' }, 403);
  }
  return null;
};

const requireAdminGuard = (user: User | null | undefined): Response | null => {
  const guard = requireAdmin(user);
  if (guard) return guard;
  return null;
};

export async function handleGetOrganizerKycProfile(req: { user: User | null }) {
  const guard = requireManager(req.user);
  if (guard) return guard;

  const profile = db.organizerKyc.getProfile(req.user!.id);
  return json(profile);
}

const normalizePayload = (payload: OrganizerKycRequestPayload): OrganizerKycRequestPayload => {
  const contacts = payload.contacts ?? ({} as OrganizerKycRequestPayload['contacts']);
  const payoutDetails = payload.payoutDetails ?? { method: 'bank' };
  const individualDocs = payload.individualDocs;
  const companyDocs = payload.companyDocs;
  const eventDocs = payload.eventDocumentation ?? { eventDescription: '' };

  return {
    ...payload,
    organizerType: payload.organizerType ?? 'individual',
    contacts: {
      ...contacts,
      legalName: contacts.legalName?.trim() ?? '',
      tradingName: contacts.tradingName?.trim() || '',
      email: contacts.email?.trim() ?? '',
      phone: contacts.phone?.trim() ?? '',
      nationalityOrRegistrationCountry:
        contacts.nationalityOrRegistrationCountry?.trim() ?? '',
      physicalAddress: contacts.physicalAddress?.trim() ?? '',
      eventCategory: contacts.eventCategory?.trim() ?? '',
      attendanceRange: contacts.attendanceRange?.trim() ?? '',
      ticketPriceRange: contacts.ticketPriceRange?.trim() ?? '',
      revenueRange: contacts.revenueRange?.trim() ?? '',
    },
    payoutDetails: {
      ...payoutDetails,
      method: payoutDetails.method ?? 'bank',
    },
    individualDocs: individualDocs ? { ...individualDocs } : undefined,
    companyDocs: companyDocs ? { ...companyDocs } : undefined,
    eventDocumentation: {
      ...eventDocs,
      eventDescription: eventDocs.eventDescription ?? '',
    },
  };
};

export async function handleSubmitOrganizerKycProfile(req: {
  user: User | null;
  body: { profile: OrganizerKycRequestPayload | null };
}) {
  const guard = requireManager(req.user);
  if (guard) return guard;

  const payload = req.body?.profile;
  if (!payload) {
    return json({ message: 'Invalid submission payload.' }, 400);
  }

  if (!payload.contacts?.legalName || !payload.contacts?.phone || !payload.contacts?.email) {
    return json({ message: 'Legal name, email, and phone are required.' }, 400);
  }

  const normalized = normalizePayload(payload);
  const profile = db.organizerKyc.upsertProfile(
    req.user!.id,
    normalized,
    'pending_review'
  );

  return json(profile, 201);
}

export async function handleRequestOrganizerKycEmailOtp(req: {
  user: User | null;
  body?: { email?: string };
}) {
  const guard = requireManager(req.user);
  if (guard) return guard;

  const targetEmail = (req.body?.email || req.user!.email).trim();
  if (!targetEmail) {
    return json({ message: 'Email is required to send OTP.' }, 400);
  }

  const code = (Math.floor(100000 + Math.random() * 900000)).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  db.organizerKyc.setEmailOtp(req.user!.id, code, expiresAt);

  await emailService.send(
    targetEmail,
    'Vibely Organizer Verification Code',
    `Your Vibely verification code is ${code}. It expires in 10 minutes.`
  );

  return json({ message: 'Verification code sent to your email.' });
}

export async function handleVerifyOrganizerKycEmailOtp(req: {
  user: User | null;
  body?: { code?: string };
}) {
  const guard = requireManager(req.user);
  if (guard) return guard;

  const submittedCode = req.body?.code?.trim();
  if (!submittedCode) {
    return json({ message: 'Verification code is required.' }, 400);
  }

  const record = db.organizerKyc.getEmailOtp(req.user!.id);
  if (!record) {
    return json({ message: 'No verification request found. Please request a new code.' }, 400);
  }

  const now = new Date();
  if (new Date(record.expiresAt) < now) {
    db.organizerKyc.clearEmailOtp(req.user!.id);
    return json({ message: 'Verification code has expired. Request a new one.' }, 400);
  }

  if (record.attempts >= 10) {
    db.organizerKyc.clearEmailOtp(req.user!.id);
    return json({ message: 'Too many attempts. Request a new code.' }, 429);
  }

  const matches = db.organizerKyc.isOtpMatch(req.user!.id, submittedCode);
  if (!matches) {
    const attempts = db.organizerKyc.incrementOtpAttempts(req.user!.id);
    if (attempts && attempts.attempts >= 10) {
      db.organizerKyc.clearEmailOtp(req.user!.id);
      return json({ message: 'Too many attempts. Request a new code.' }, 429);
    }
    return json({ message: 'Invalid verification code.' }, 400);
  }

  db.organizerKyc.markEmailVerified(req.user!.id);
  db.organizerKyc.clearEmailOtp(req.user!.id);
  const profile = db.organizerKyc.getProfile(req.user!.id);
  return json({ message: 'Contact email verified.', profile });
}

export async function handleAdminListOrganizerKycProfiles(req: { user: User | null }) {
  const guard = requireAdminGuard(req.user);
  if (guard) return guard;
  const profiles = db.organizerKyc.listProfiles();
  return json({ profiles });
}

export async function handleAdminUpdateOrganizerKycStatus(req: {
  user: User | null;
  params?: { id?: string };
  body?: { status?: KycStatus; reviewerNotes?: string };
}) {
  const guard = requireAdminGuard(req.user);
  if (guard) return guard;

  const organizerId = req.params?.id;
  const status = req.body?.status;
  const reviewerNotes = req.body?.reviewerNotes;

  if (!organizerId || !status) {
    return json({ message: 'Organizer ID and status are required.' }, 400);
  }

  if (!['verified', 'rejected', 'limited', 'pending_review', 'draft'].includes(status)) {
    return json({ message: 'Unsupported KYC status.' }, 400);
  }

  const updated = db.organizerKyc.updateStatus(organizerId, status, reviewerNotes);
  if (!updated) {
    return json({ message: 'KYC profile not found.' }, 404);
  }

  return json({ profile: updated });
}
