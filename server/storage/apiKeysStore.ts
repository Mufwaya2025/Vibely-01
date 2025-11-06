import fs from 'fs';
import path from 'path';
import { randomUUID, randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import type { ApiKeyRecord, ApiKeyStatus } from '../../types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'apiKeys.json');

type StoredApiKey = ApiKeyRecord & { rawKey: string };

interface PersistedApiKeys {
  keys: StoredApiKey[];
}

const ensureDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const maskKey = (rawKey: string) => {
  const trimmed = rawKey.replace(/\s+/g, '');
  if (trimmed.length <= 8) return trimmed;
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
};

const generateRawKey = () => {
  const random = randomBytes(16).toString('hex');
  return `vbl_${randomUUID().replace(/-/g, '')}_${random}`;
};

const toPublic = (key: StoredApiKey): ApiKeyRecord => {
  const { rawKey, ...rest } = key;
  return rest;
};

const loadFromDisk = (): StoredApiKey[] => {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ keys: [] }, null, 2),
      'utf8'
    );
    return [];
  }

  try {
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(content) as PersistedApiKeys;
    if (!Array.isArray(parsed.keys)) {
      throw new Error('Invalid api keys file');
    }
    return parsed.keys;
  } catch (err) {
    console.error('Failed to load apiKeys.json, resetting to empty array.', err);
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ keys: [] }, null, 2),
      'utf8'
    );
    return [];
  }
};

const persist = (keys: StoredApiKey[]) => {
  ensureDir();
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify({ keys }, null, 2),
    'utf8'
  );
};

let cache: StoredApiKey[] | null = null;

const getCache = (): StoredApiKey[] => {
  if (!cache) {
    cache = loadFromDisk();
  }
  return cache;
};

const setCache = (keys: StoredApiKey[]) => {
  cache = keys;
  persist(keys);
};

const nowIso = () => new Date().toISOString();

const updateStatus = (
  key: StoredApiKey,
  status: ApiKeyStatus
): StoredApiKey => ({
  ...key,
  status,
});

export const apiKeysStore = {
  findAll(): ApiKeyRecord[] {
    return [...getCache()]
      .sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .map(toPublic);
  },

  create(data: { name: string; description?: string; scopes: string[] }) {
    const keys = getCache();
    const rawKey = generateRawKey();
    const timestamp = nowIso();
    const stored: StoredApiKey = {
      id: `key_${randomUUID()}`,
      name: data.name,
      description: data.description,
      scopes: [...data.scopes],
      status: 'active',
      lastUsedAt: undefined,
      createdAt: timestamp,
      maskedKey: maskKey(rawKey),
      rawKey,
    };

    keys.unshift(stored);
    setCache(keys);
    return { record: toPublic(stored), rawKey };
  },

  rotate(id: string) {
    const keys = getCache();
    const index = keys.findIndex((key) => key.id === id);
    if (index === -1) return null;

    const rawKey = generateRawKey();
    const updated: StoredApiKey = {
      ...keys[index],
      rawKey,
      maskedKey: maskKey(rawKey),
      status: 'active',
    };

    keys[index] = updated;
    setCache(keys);
    return { record: toPublic(updated), rawKey };
  },

  revoke(id: string): ApiKeyRecord | null {
    const keys = getCache();
    const index = keys.findIndex((key) => key.id === id);
    if (index === -1) return null;

    const updated = updateStatus(keys[index], 'revoked');
    keys[index] = updated;
    setCache(keys);
    return toPublic(updated);
  },
};
