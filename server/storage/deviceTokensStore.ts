import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'deviceTokens.json');

interface DeviceToken {
  id: string;
  deviceId: string;
  token: string; // This will be hashed
  expiresAt?: string;
  revokedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

interface PersistedDeviceTokens {
  deviceTokens: DeviceToken[];
}

const ensureDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const loadFromDisk = (): DeviceToken[] => {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ deviceTokens: [] }, null, 2),
      'utf8'
    );
    return [];
  }

  try {
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(content) as PersistedDeviceTokens;
    if (!Array.isArray(parsed.deviceTokens)) {
      throw new Error('Invalid device tokens file');
    }
    return parsed.deviceTokens;
  } catch (err) {
    console.error('Failed to load deviceTokens.json, returning empty array.', err);
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ deviceTokens: [] }, null, 2),
      'utf8'
    );
    return [];
  }
};

const persist = (deviceTokens: DeviceToken[]) => {
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify({ deviceTokens }, null, 2), 'utf8');
};

let cache: DeviceToken[] | null = null;

const getCache = (): DeviceToken[] => {
  if (!cache) {
    cache = loadFromDisk();
  }
  return cache;
};

const setCache = (deviceTokens: DeviceToken[]) => {
  cache = deviceTokens;
  persist(deviceTokens);
};

export const deviceTokensStore = {
  findById(id: string): DeviceToken | null {
    return getCache().find((token) => token.id === id) ?? null;
  },

  findByToken(token: string): DeviceToken | null {
    // In a real implementation, we'd hash the token and compare
    return getCache().find((t) => t.token === token) ?? null;
  },

  findByDeviceId(deviceId: string): DeviceToken[] {
    return getCache().filter((token) => token.deviceId === deviceId);
  },

  create(data: {
    id: string;
    deviceId: string;
    token: string;
    expiresAt?: string;
  }): DeviceToken {
    const newToken: DeviceToken = {
      id: data.id,
      deviceId: data.deviceId,
      token: data.token, // Should be hashed in a real implementation
      expiresAt: data.expiresAt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const tokens = getCache();
    tokens.push(newToken);
    setCache(tokens);
    return newToken;
  },

  update(id: string, updates: Partial<Omit<DeviceToken, 'id' | 'deviceId' | 'createdAt'>>): DeviceToken | null {
    const tokens = getCache();
    const index = tokens.findIndex((token) => token.id === id);
    if (index === -1) return null;

    tokens[index] = {
      ...tokens[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    setCache(tokens);
    return tokens[index];
  },

  revoke(id: string): DeviceToken | null {
    return this.update(id, { revokedAt: new Date().toISOString() });
  },

  deleteByDeviceId(deviceId: string): void {
    const tokens = getCache().filter((token) => token.deviceId !== deviceId);
    setCache(tokens);
  },
};
