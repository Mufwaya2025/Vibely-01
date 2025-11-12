import fs from 'fs';
import path from 'path';
import { randomUUID, randomBytes, createHash } from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'passwordResets.json');

interface StoredPasswordReset {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string | null;
}

interface PersistedPasswordResets {
  resets: StoredPasswordReset[];
}

const ensureDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const loadFromDisk = (): StoredPasswordReset[] => {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ resets: [] }, null, 2),
      'utf8'
    );
    return [];
  }

  try {
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(content) as PersistedPasswordResets;
    if (!Array.isArray(parsed.resets)) {
      throw new Error('Invalid password reset store.');
    }
    return parsed.resets;
  } catch (err) {
    console.error('Failed to load passwordResets.json, resetting to empty array.', err);
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ resets: [] }, null, 2),
      'utf8'
    );
    return [];
  }
};

const persist = (records: StoredPasswordReset[]) => {
  ensureDir();
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify({ resets: records }, null, 2),
    'utf8'
  );
};

let cache: StoredPasswordReset[] | null = null;

const getCache = (): StoredPasswordReset[] => {
  if (!cache) {
    cache = loadFromDisk();
  }
  return cache;
};

const setCache = (records: StoredPasswordReset[]) => {
  cache = records;
  persist(records);
};

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

const cleanupExpired = () => {
  const now = new Date();
  const resets = getCache();
  const filtered = resets.filter(
    (reset) =>
      new Date(reset.expiresAt) > now ||
      (reset.usedAt && new Date(reset.usedAt) > now) ||
      !reset.usedAt
  );
  if (filtered.length !== resets.length) {
    setCache(filtered);
  }
};

export const passwordResetStore = {
  create(userId: string, expiresInMinutes = 30): { token: string; record: StoredPasswordReset } {
    const resets = getCache().filter(
      (reset) => !(reset.userId === userId && !reset.usedAt)
    );

    const token = randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInMinutes * 60 * 1000);

    const record: StoredPasswordReset = {
      id: randomUUID(),
      userId,
      tokenHash: hashToken(token),
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    resets.push(record);
    setCache(resets);

    return { token, record };
  },

  findValidByToken(token: string): StoredPasswordReset | null {
    const hashed = hashToken(token);
    const now = new Date();
    cleanupExpired();
    return (
      getCache().find(
        (reset) =>
          reset.tokenHash === hashed &&
          !reset.usedAt &&
          new Date(reset.expiresAt) > now
      ) ?? null
    );
  },

  markUsed(id: string): StoredPasswordReset | null {
    const resets = getCache();
    const index = resets.findIndex((reset) => reset.id === id);
    if (index === -1) return null;
    resets[index] = {
      ...resets[index],
      usedAt: new Date().toISOString(),
    };
    setCache(resets);
    return resets[index];
  },
};

