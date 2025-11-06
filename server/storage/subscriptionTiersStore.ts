import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import type { SubscriptionTier } from '../../types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'subscriptionTiers.json');

interface PersistedSubscriptionTiers {
  tiers: SubscriptionTier[];
}

const ensureDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const createDefaultTiers = (): SubscriptionTier[] => [];

const loadFromDisk = (): SubscriptionTier[] => {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    const defaults = createDefaultTiers();
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ tiers: defaults }, null, 2),
      'utf8'
    );
    return defaults;
  }

  try {
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(content) as PersistedSubscriptionTiers;
    if (!Array.isArray(parsed.tiers)) {
      throw new Error('Invalid subscription tiers file');
    }
    return parsed.tiers;
  } catch (err) {
    console.error('Failed to load subscriptionTiers.json, recreating defaults.', err);
    const defaults = createDefaultTiers();
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ tiers: defaults }, null, 2),
      'utf8'
    );
    return defaults;
  }
};

const persist = (tiers: SubscriptionTier[]) => {
  ensureDir();
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify({ tiers }, null, 2),
    'utf8'
  );
};

let cache: SubscriptionTier[] | null = null;

const getCache = (): SubscriptionTier[] => {
  if (!cache) {
    cache = loadFromDisk();
  }
  return cache;
};

const setCache = (tiers: SubscriptionTier[]) => {
  cache = tiers;
  persist(tiers);
};

const nowIso = () => new Date().toISOString();
const generateId = () => `tier_${randomUUID()}`;

export const subscriptionTiersStore = {
  findAll(): SubscriptionTier[] {
    return [...getCache()].sort((a, b) => a.sortOrder - b.sortOrder);
  },

  findById(id: string): SubscriptionTier | null {
    return getCache().find((tier) => tier.id === id) ?? null;
  },

  create(
    data: Omit<SubscriptionTier, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): SubscriptionTier {
    const tiers = getCache();
    const timestamp = nowIso();
    const newTier: SubscriptionTier = {
      ...data,
      id: data.id ?? generateId(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    tiers.push(newTier);
    setCache(tiers);
    return newTier;
  },

  update(
    id: string,
    updates: Partial<Omit<SubscriptionTier, 'id' | 'createdAt'>>
  ): SubscriptionTier | null {
    const tiers = getCache();
    const index = tiers.findIndex((tier) => tier.id === id);
    if (index === -1) return null;

    const updated: SubscriptionTier = {
      ...tiers[index],
      ...updates,
      updatedAt: nowIso(),
    };

    tiers[index] = updated;
    setCache(tiers);
    return updated;
  },

  delete(id: string): boolean {
    const tiers = getCache();
    const index = tiers.findIndex((tier) => tier.id === id);
    if (index === -1) return false;

    tiers.splice(index, 1);
    setCache(tiers);
    return true;
  },
};
