import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import type { OrganizerKycProfile, OrganizerKycRequestPayload } from '../../types';

interface EmailOtpRecord {
  codeHash: string;
  expiresAt: string;
  attempts: number;
}

interface OrganizerKycRecord {
  organizerId: string;
  profile: OrganizerKycProfile;
  emailOtp?: EmailOtpRecord | null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'organizerKyc.json');

const ensureDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const defaultProfile = (organizerId: string): OrganizerKycProfile => ({
  organizerId,
  organizerType: 'individual',
  status: 'not_started',
  contacts: {
    legalName: '',
    tradingName: '',
    email: '',
    phone: '',
    nationalityOrRegistrationCountry: '',
    physicalAddress: '',
    eventCategory: '',
    attendanceRange: '',
    ticketPriceRange: '',
    revenueRange: '',
  },
  payoutDetails: {
    method: 'bank',
    bankName: '',
    branch: '',
    accountName: '',
    accountNumber: '',
    confirmationLetter: '',
  },
  individualDocs: {
    idType: 'nrc',
    idNumber: '',
    idFront: '',
    idBack: '',
    selfieWithId: '',
    proofOfAddress: '',
  },
  eventDocumentation: {
    eventDescription: '',
    eventPoster: '',
    venueName: '',
    venueLocation: '',
    venueBookingConfirmation: '',
    hostLetter: '',
    policePermit: '',
    securityPlan: '',
    emergencyPlan: '',
  },
  verification: {
    emailVerified: false,
  },
});

let cache: OrganizerKycRecord[] | null = null;

const loadFromDisk = (): OrganizerKycRecord[] => {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    const seeded: OrganizerKycRecord[] = [];
    fs.writeFileSync(DATA_FILE, JSON.stringify({ profiles: seeded }, null, 2), 'utf8');
    return seeded;
  }

  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw) as { profiles: OrganizerKycRecord[] };
    if (!Array.isArray(parsed.profiles)) {
      throw new Error('Invalid KYC payload');
    }
    return parsed.profiles.map((record) => ({
      ...record,
      profile: {
        ...defaultProfile(record.organizerId),
        ...record.profile,
        verification: {
          emailVerified: record.profile?.verification?.emailVerified ?? false,
          verifiedAt: record.profile?.verification?.verifiedAt,
          lastOtpSentAt: record.profile?.verification?.lastOtpSentAt,
        },
      },
    }));
  } catch (error) {
    console.error('Failed to load organizer KYC data. Resetting to empty set.', error);
    const empty: OrganizerKycRecord[] = [];
    fs.writeFileSync(DATA_FILE, JSON.stringify({ profiles: empty }, null, 2), 'utf8');
    return empty;
  }
};

const persist = (records: OrganizerKycRecord[]) => {
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify({ profiles: records }, null, 2), 'utf8');
};

const getCache = (): OrganizerKycRecord[] => {
  if (!cache) {
    cache = loadFromDisk();
  }
  return cache;
};

const setCache = (records: OrganizerKycRecord[]) => {
  cache = records;
  persist(records);
};

const sanitizeProfile = (profile: OrganizerKycProfile): OrganizerKycProfile => ({
  ...profile,
  individualDocs: profile.individualDocs
    ? { ...profile.individualDocs }
    : undefined,
  companyDocs: profile.companyDocs ? { ...profile.companyDocs } : undefined,
  payoutDetails: { ...profile.payoutDetails },
  eventDocumentation: { ...profile.eventDocumentation },
});

const hashCode = (code: string) => createHash('sha256').update(code).digest('hex');

export const organizerKycStore = {
  listProfiles(): OrganizerKycProfile[] {
    return getCache()
      .map((record) => sanitizeProfile(record.profile))
      .sort((a, b) => {
        const aDate = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const bDate = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        return bDate - aDate;
      });
  },

  getProfile(organizerId: string): OrganizerKycProfile {
    const existing = getCache().find((record) => record.organizerId === organizerId);
    if (!existing) {
      return defaultProfile(organizerId);
    }
    return sanitizeProfile(existing.profile);
  },

  upsertProfile(
    organizerId: string,
    payload: OrganizerKycRequestPayload,
    status: OrganizerKycProfile['status']
  ): OrganizerKycProfile {
    const records = getCache();
    const index = records.findIndex((record) => record.organizerId === organizerId);
    const nextProfile: OrganizerKycProfile = {
      organizerId,
      organizerType: payload.organizerType,
      status,
      contacts: { ...payload.contacts },
      payoutDetails: { ...payload.payoutDetails },
      individualDocs: payload.individualDocs ? { ...payload.individualDocs } : undefined,
      companyDocs: payload.companyDocs ? { ...payload.companyDocs } : undefined,
      eventDocumentation: { ...payload.eventDocumentation },
      verification: {
        emailVerified: records[index]?.profile?.verification?.emailVerified ?? false,
        verifiedAt: records[index]?.profile?.verification?.verifiedAt,
        lastOtpSentAt: records[index]?.profile?.verification?.lastOtpSentAt,
      },
      submittedAt: new Date().toISOString(),
    };

    if (index >= 0) {
      records[index] = {
        ...records[index],
        profile: {
          ...records[index].profile,
          ...nextProfile,
        },
      };
    } else {
      records.push({
        organizerId,
        profile: nextProfile,
        emailOtp: null,
      });
    }

    setCache(records);
    const saved = records.find((record) => record.organizerId === organizerId);
    return sanitizeProfile(saved ? saved.profile : nextProfile);
  },

  updateStatus(
    organizerId: string,
    status: OrganizerKycProfile['status'],
    reviewerNotes?: string
  ): OrganizerKycProfile | null {
    const records = getCache();
    const index = records.findIndex((record) => record.organizerId === organizerId);
    if (index === -1) {
      return null;
    }
    const updated: OrganizerKycProfile = {
      ...records[index].profile,
      status,
      reviewerNotes: reviewerNotes ?? records[index].profile.reviewerNotes,
      reviewedAt: new Date().toISOString(),
    };
    records[index] = {
      ...records[index],
      profile: updated,
    };
    setCache(records);
    return sanitizeProfile(updated);
  },

  setEmailOtp(organizerId: string, code: string, expiresAt: string) {
    const records = getCache();
    const index = records.findIndex((record) => record.organizerId === organizerId);
    const otpRecord: EmailOtpRecord = {
      codeHash: hashCode(code),
      expiresAt,
      attempts: 0,
    };
    if (index >= 0) {
      records[index] = {
        ...records[index],
        emailOtp: otpRecord,
        profile: {
          ...records[index].profile,
          verification: {
            ...records[index].profile.verification,
            lastOtpSentAt: new Date().toISOString(),
          },
        },
      };
    } else {
      records.push({
        organizerId,
        profile: defaultProfile(organizerId),
        emailOtp: otpRecord,
      });
    }
    setCache(records);
  },

  getEmailOtp(organizerId: string): EmailOtpRecord | null {
    return getCache().find((record) => record.organizerId === organizerId)?.emailOtp ?? null;
  },

  clearEmailOtp(organizerId: string) {
    const records = getCache();
    const index = records.findIndex((record) => record.organizerId === organizerId);
    if (index === -1) return;
    records[index] = {
      ...records[index],
      emailOtp: null,
    };
    setCache(records);
  },

  incrementOtpAttempts(organizerId: string): EmailOtpRecord | null {
    const records = getCache();
    const index = records.findIndex((record) => record.organizerId === organizerId);
    if (index === -1 || !records[index].emailOtp) return null;
    const updated: EmailOtpRecord = {
      ...records[index].emailOtp,
      attempts: records[index].emailOtp!.attempts + 1,
    };
    records[index] = {
      ...records[index],
      emailOtp: updated,
    };
    setCache(records);
    return updated;
  },

  isOtpMatch(organizerId: string, code: string): boolean {
    const record = getCache().find((entry) => entry.organizerId === organizerId);
    if (!record?.emailOtp) return false;
    return record.emailOtp.codeHash === hashCode(code);
  },

  markEmailVerified(organizerId: string) {
    const records = getCache();
    const index = records.findIndex((record) => record.organizerId === organizerId);
    if (index === -1) {
      const profile = defaultProfile(organizerId);
      profile.verification.emailVerified = true;
      profile.verification.verifiedAt = new Date().toISOString();
      records.push({
        organizerId,
        profile,
        emailOtp: null,
      });
    } else {
      records[index] = {
        ...records[index],
        profile: {
          ...records[index].profile,
          verification: {
            emailVerified: true,
            verifiedAt: new Date().toISOString(),
            lastOtpSentAt: records[index].profile.verification.lastOtpSentAt,
          },
        },
        emailOtp: null,
      };
    }
    setCache(records);
  },
};
