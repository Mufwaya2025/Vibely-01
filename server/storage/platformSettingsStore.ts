import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { PlatformSettings } from '../../types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../../data');
const DATA_FILE = path.join(DATA_DIR, 'platformSettings.json');

const DEFAULT_SETTINGS: PlatformSettings = {
  platformFeePercent: 3.5,
  payoutCurrency: 'ZMW',
  autoPayoutsEnabled: false,
  payoutFees: {
    mobileMoney: [
      { minAmount: 5, maxAmount: 1000, fee: 11 },
      { minAmount: 1001, maxAmount: 50000, fee: 15 },
      { minAmount: 50001, maxAmount: 100000, fee: 20 },
    ],
    bankAccount: [{ minAmount: 0, maxAmount: null, fee: 15 }],
  },
  updatedAt: new Date().toISOString(),
  updatedBy: undefined,
};

const ensureDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const normalizePayoutFees = (
  fees?: PlatformSettings['payoutFees']
): PlatformSettings['payoutFees'] => {
  const fallback = DEFAULT_SETTINGS.payoutFees;
  if (!fees) {
    return fallback;
  }

  const ensureTiers = (
    tiers?: PlatformSettings['payoutFees'][keyof PlatformSettings['payoutFees']]
  ) =>
    Array.isArray(tiers) && tiers.length > 0 ? tiers : [];

  return {
    bankAccount: ensureTiers(fees.bankAccount).length > 0
      ? fees.bankAccount!
      : fallback.bankAccount,
    mobileMoney: ensureTiers(fees.mobileMoney).length > 0
      ? fees.mobileMoney!
      : fallback.mobileMoney,
  };
};

const mergeWithDefaults = (settings: Partial<PlatformSettings> | null | undefined): PlatformSettings => {
  if (!settings) {
    return { ...DEFAULT_SETTINGS, updatedAt: new Date().toISOString() };
  }

  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    payoutFees: normalizePayoutFees(settings.payoutFees),
    platformFeePercent:
      typeof settings.platformFeePercent === 'number'
        ? settings.platformFeePercent
        : DEFAULT_SETTINGS.platformFeePercent,
    payoutCurrency: settings.payoutCurrency ?? DEFAULT_SETTINGS.payoutCurrency,
    autoPayoutsEnabled:
      typeof settings.autoPayoutsEnabled === 'boolean'
        ? settings.autoPayoutsEnabled
        : DEFAULT_SETTINGS.autoPayoutsEnabled,
    updatedAt: settings.updatedAt ?? DEFAULT_SETTINGS.updatedAt,
  };
};

const loadFromDisk = (): PlatformSettings => {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(DEFAULT_SETTINGS, null, 2),
      'utf8'
    );
    return DEFAULT_SETTINGS;
  }

  try {
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(content) as PlatformSettings | Partial<PlatformSettings>;
    const normalized = mergeWithDefaults(parsed);
    if (!parsed?.payoutFees) {
      persist(normalized);
    }
    return normalized;
  } catch (err) {
    console.error('Failed to load platformSettings.json, using default settings.', err);
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(DEFAULT_SETTINGS, null, 2),
      'utf8'
    );
    return DEFAULT_SETTINGS;
  }
};

const persist = (settings: PlatformSettings) => {
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(settings, null, 2), 'utf8');
};

let cache: PlatformSettings | null = null;

const getCache = (): PlatformSettings => {
  if (!cache) {
    cache = loadFromDisk();
  }
  return cache;
};

const setCache = (settings: PlatformSettings) => {
  cache = settings;
  persist(settings);
};

export const platformSettingsStore = {
  get(): PlatformSettings {
    return getCache();
  },

  update(updates: Partial<Omit<PlatformSettings, 'updatedAt'>>): PlatformSettings {
    const currentSettings = getCache();
    const newSettings = {
      ...currentSettings,
      ...updates,
      updatedBy: updates.updatedBy ?? currentSettings.updatedBy,
      updatedAt: new Date().toISOString(),
    };

    setCache(newSettings);
    return newSettings;
  },
};
