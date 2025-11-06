import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'devices.json');

interface Device {
  id: string;
  name?: string;
  staffUserId: string;
  devicePublicId: string;
  deviceSecret: string; // This will be hashed
  lastIp?: string;
  lastSeenAt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PersistedDevices {
  devices: Device[];
}

const DEFAULT_HASH_ROUNDS = 10;

const ensureDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const loadFromDisk = (): Device[] => {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ devices: [] }, null, 2),
      'utf8'
    );
    return [];
  }

  try {
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(content) as PersistedDevices;
    if (!Array.isArray(parsed.devices)) {
      throw new Error('Invalid devices file');
    }
    return parsed.devices;
  } catch (err) {
    console.error('Failed to load devices.json, returning empty array.', err);
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ devices: [] }, null, 2),
      'utf8'
    );
    return [];
  }
};

const persist = (devices: Device[]) => {
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify({ devices }, null, 2), 'utf8');
};

let cache: Device[] | null = null;

const getCache = (): Device[] => {
  if (!cache) {
    cache = loadFromDisk();
  }
  return cache;
};

const setCache = (devices: Device[]) => {
  cache = devices;
  persist(devices);
};

export const devicesStore = {
  findById(id: string): Device | null {
    return getCache().find((device) => device.id === id) ?? null;
  },

  findByPublicId(devicePublicId: string): Device | null {
    return getCache().find((device) => device.devicePublicId === devicePublicId) ?? null;
  },

  create(data: {
    id: string;
    name?: string;
    staffUserId: string;
    devicePublicId: string;
    deviceSecret: string;
  }): Device {
    const existing = this.findByPublicId(data.devicePublicId);
    if (existing) {
      throw new Error('Device with this public ID already exists');
    }

    const now = new Date().toISOString();
    const newDevice: Device = {
      id: data.id,
      name: data.name,
      staffUserId: data.staffUserId,
      devicePublicId: data.devicePublicId,
      deviceSecret: bcrypt.hashSync(data.deviceSecret, DEFAULT_HASH_ROUNDS), // Hash the device secret
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    const devices = getCache();
    devices.push(newDevice);
    setCache(devices);
    return newDevice;
  },

  update(id: string, updates: Partial<Omit<Device, 'id' | 'devicePublicId' | 'createdAt'>>): Device | null {
    const devices = getCache();
    const index = devices.findIndex((device) => device.id === id);
    if (index === -1) return null;

    const updatedDevice = {
      ...devices[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    devices[index] = updatedDevice;
    setCache(devices);
    return updatedDevice;
  },

  verifyDeviceSecret(device: Device, plainSecret: string): boolean {
    return bcrypt.compareSync(plainSecret, device.deviceSecret);
  },
};