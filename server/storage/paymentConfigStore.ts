import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { PaymentConfiguration } from '../../types';
import { encryptSecret } from '../../utils/encryption';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../../data');
const DATA_FILE = path.join(DATA_DIR, 'paymentConfig.json');

interface PersistedPaymentConfig {
  config: PaymentConfiguration;
}

const DEFAULT_CONFIG: PaymentConfiguration = {
  id: 'default',
  provider: 'lenco',
  publicKey: process.env.LENCO_PUBLIC_KEY || '',
  secretKeyEncrypted: process.env.LENCO_SECRET_KEY
    ? encryptSecret(process.env.LENCO_SECRET_KEY)
    : '',
  isLiveMode: process.env.LENCO_ENV !== 'sandbox',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const ensureDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const loadFromDisk = (): PaymentConfiguration => {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ config: DEFAULT_CONFIG }, null, 2),
      'utf8'
    );
    return DEFAULT_CONFIG;
  }

  try {
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(content) as PersistedPaymentConfig;
    return parsed.config;
  } catch (err) {
    console.error('Failed to load paymentConfig.json, using default config.', err);
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ config: DEFAULT_CONFIG }, null, 2),
      'utf8'
    );
    return DEFAULT_CONFIG;
  }
};

const persist = (config: PaymentConfiguration) => {
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify({ config }, null, 2), 'utf8');
};

let cache: PaymentConfiguration | null = null;

const getCache = (): PaymentConfiguration => {
  if (!cache) {
    cache = loadFromDisk();
  }
  return cache;
};

const setCache = (config: PaymentConfiguration) => {
  cache = config;
  persist(config);
};

export const paymentConfigStore = {
  getLatest(): PaymentConfiguration {
    return getCache();
  },

  get(id: string): PaymentConfiguration | null {
    const config = getCache();
    return config.id === id ? config : null;
  },

  upsert(data: {
    provider: string;
    publicKey: string;
    secretKey?: string;
    isLiveMode: boolean;
  }): PaymentConfiguration {
    const existing = getCache();
    const now = new Date().toISOString();

    const config: PaymentConfiguration = {
      id: existing.id || `pc-${Date.now()}`,
      provider: data.provider,
      publicKey: data.publicKey,
      secretKeyEncrypted: data.secretKey
        ? encryptSecret(data.secretKey)
        : existing.secretKeyEncrypted,
      isLiveMode: data.isLiveMode,
      createdAt: existing.createdAt || now,
      updatedAt: now,
    };

    setCache(config);
    return config;
  },
};
