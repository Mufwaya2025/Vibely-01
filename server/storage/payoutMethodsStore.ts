import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import type { PayoutAccountType, PayoutMethod } from '../../types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'payoutMethods.json');

type StoredPayoutMethod = PayoutMethod;

interface PersistedPayoutMethods {
  payoutMethods: StoredPayoutMethod[];
}

const ensureDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const loadFromDisk = (): StoredPayoutMethod[] => {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ payoutMethods: [] }, null, 2),
      'utf8'
    );
    return [];
  }

  try {
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(content) as PersistedPayoutMethods;
    if (!Array.isArray(parsed.payoutMethods)) {
      throw new Error('Invalid payout methods file');
    }
    return parsed.payoutMethods;
  } catch (err) {
    console.error('Failed to load payoutMethods.json, resetting to empty array.', err);
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ payoutMethods: [] }, null, 2),
      'utf8'
    );
    return [];
  }
};

const persist = (records: StoredPayoutMethod[]) => {
  ensureDir();
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify({ payoutMethods: records }, null, 2),
    'utf8'
  );
};

let cache: StoredPayoutMethod[] | null = null;

const getCache = (): StoredPayoutMethod[] => {
  if (!cache) {
    cache = loadFromDisk();
  }
  return cache;
};

const setCache = (records: StoredPayoutMethod[]) => {
  cache = records;
  persist(records);
};

const nowIso = () => new Date().toISOString();
const generateId = () => `pm_${randomUUID()}`;

const maskDigits = (value?: string, visible = 4) => {
  if (!value || value.length <= visible) {
    return value ?? '••••';
  }
  const visiblePart = value.slice(-visible);
  return `••••${visiblePart}`;
};

const maskPhone = (phone?: string) => {
  if (!phone) return '••••••••';
  if (phone.length <= 5) return `${phone[0] ?? ''}•••${phone.slice(-2)}`;
  return `${phone.slice(0, 3)}•••${phone.slice(-2)}`;
};

const buildDetails = (record: {
  type: PayoutAccountType;
  bankName?: string;
  accountNumber?: string;
  mobileMoneyProvider?: string;
  phoneNumber?: string;
}) => {
  if (record.type === 'Bank') {
    const bankLabel = record.bankName?.trim() || 'Bank';
    return `${bankLabel} ${maskDigits(record.accountNumber)}`;
  }
  const provider = record.mobileMoneyProvider?.trim() || 'Mobile Money';
  return `${provider} ${maskPhone(record.phoneNumber)}`;
};

const sanitizeOutput = (records: StoredPayoutMethod[]) =>
  [...records].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

const ensureSingleDefault = (records: StoredPayoutMethod[], userId: string) => {
  const userRecords = records.filter((method) => method.userId === userId);
  const hasDefault = userRecords.some((method) => method.isDefault);
  if (!hasDefault && userRecords.length > 0) {
    const fallback = userRecords[0];
    fallback.isDefault = true;
    fallback.updatedAt = nowIso();
  }
};

export const payoutMethodsStore = {
  findByUserId(userId: string): StoredPayoutMethod[] {
    return sanitizeOutput(getCache().filter((method) => method.userId === userId));
  },

  findById(id: string): StoredPayoutMethod | null {
    return getCache().find((method) => method.id === id) ?? null;
  },

  create(
    data: {
      userId: string;
      type: PayoutAccountType;
      accountInfo: string;
      bankName?: string;
      bankCode?: string;
      accountNumber?: string;
      mobileMoneyProvider?: string;
      phoneNumber?: string;
      isDefault?: boolean;
    }
  ): StoredPayoutMethod {
    const records = getCache();
    const timestamp = nowIso();
    const shouldBeDefault =
      data.isDefault ??
      !records.some((method) => method.userId === data.userId && method.isDefault);

    const record: StoredPayoutMethod = {
      id: generateId(),
      userId: data.userId,
      type: data.type,
      accountInfo: data.accountInfo,
      details: buildDetails(data),
      bankName: data.bankName,
      bankCode: data.bankCode,
      accountNumber: data.accountNumber,
      mobileMoneyProvider: data.mobileMoneyProvider,
      phoneNumber: data.phoneNumber,
      isDefault: shouldBeDefault,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    records.push(record);
    if (shouldBeDefault) {
      this.setDefault(data.userId, record.id, records);
    } else {
      setCache(records);
    }

    return record;
  },

  update(
    id: string,
    updates: Partial<
      Omit<PayoutMethod, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'details'>
    > & { makeDefault?: boolean }
  ): StoredPayoutMethod | null {
    const records = getCache();
    const index = records.findIndex((method) => method.id === id);
    if (index === -1) return null;

    const current = records[index];
    const { makeDefault, ...safeUpdates } = updates;
    const merged: StoredPayoutMethod = {
      ...current,
      ...safeUpdates,
      details: buildDetails({
        type: safeUpdates.type ?? current.type,
        bankName: safeUpdates.bankName ?? current.bankName,
        accountNumber: safeUpdates.accountNumber ?? current.accountNumber,
        mobileMoneyProvider: safeUpdates.mobileMoneyProvider ?? current.mobileMoneyProvider,
        phoneNumber: safeUpdates.phoneNumber ?? current.phoneNumber,
      }),
      updatedAt: nowIso(),
    };

    records[index] = merged;

    if (makeDefault || merged.isDefault) {
      this.setDefault(merged.userId, merged.id, records);
    } else {
      ensureSingleDefault(records, merged.userId);
      setCache(records);
    }

    return merged;
  },

  setDefault(userId: string, methodId: string, existing?: StoredPayoutMethod[]) {
    const records = existing ?? getCache();
    let updated = false;

    records.forEach((method) => {
      if (method.userId !== userId) return;
      const shouldBeDefault = method.id === methodId;
      if (method.isDefault !== shouldBeDefault) {
        method.isDefault = shouldBeDefault;
        method.updatedAt = nowIso();
        updated = true;
      }
    });

    if (updated || !existing) {
      setCache(records);
    }
  },

  delete(id: string): boolean {
    const records = getCache();
    const index = records.findIndex((method) => method.id === id);
    if (index === -1) return false;

    const [removed] = records.splice(index, 1);
    ensureSingleDefault(records, removed.userId);
    setCache(records);
    return true;
  },
};
