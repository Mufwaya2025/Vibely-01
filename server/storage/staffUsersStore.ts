import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'staffUsers.json');

interface StaffUser {
  id: string;
  email: string;
  passwordHash: string;
  name?: string;
  active: boolean;
  createdAt: string;
}

interface PersistedStaffUsers {
  staffUsers: StaffUser[];
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const DEFAULT_HASH_ROUNDS = 10;

const ensureDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const loadFromDisk = (): StaffUser[] => {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ staffUsers: [] }, null, 2),
      'utf8'
    );
    return [];
  }

  try {
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(content) as PersistedStaffUsers;
    if (!Array.isArray(parsed.staffUsers)) {
      throw new Error('Invalid staff users file');
    }
    return parsed.staffUsers;
  } catch (err) {
    console.error('Failed to load staffUsers.json, returning empty array.', err);
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ staffUsers: [] }, null, 2),
      'utf8'
    );
    return [];
  }
};

const persist = (staffUsers: StaffUser[]) => {
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify({ staffUsers }, null, 2), 'utf8');
};

let cache: StaffUser[] | null = null;

const getCache = (): StaffUser[] => {
  if (!cache) {
    cache = loadFromDisk();
  }
  return cache;
};

const setCache = (staffUsers: StaffUser[]) => {
  cache = staffUsers;
  persist(staffUsers);
};

export const staffUsersStore = {
  findByEmail(email: string): StaffUser | null {
    const normalized = normalizeEmail(email);
    return getCache().find((user) => normalizeEmail(user.email) === normalized) ?? null;
  },

  findById(id: string): StaffUser | null {
    return getCache().find((user) => user.id === id) ?? null;
  },

  getAll(): StaffUser[] {
    return [...getCache()];
  },

  create(data: {
    id: string;
    name?: string;
    email: string;
    password: string;
  }): StaffUser {
    const normalized = normalizeEmail(data.email);
    const existing = this.findByEmail(normalized);
    if (existing) {
      throw new Error('Staff user already exists');
    }

    const newUser: StaffUser = {
      id: data.id,
      name: data.name,
      email: data.email,
      passwordHash: bcrypt.hashSync(data.password, DEFAULT_HASH_ROUNDS),
      active: true,
      createdAt: new Date().toISOString(),
    };

    const users = getCache();
    users.push(newUser);
    setCache(users);
    return newUser;
  },

  update(id: string, updates: Partial<Omit<StaffUser, 'id' | 'email' | 'createdAt'>>): StaffUser | null {
    const users = getCache();
    const index = users.findIndex((user) => user.id === id);
    if (index === -1) return null;

    users[index] = {
      ...users[index],
      ...updates,
    };

    setCache(users);
    return users[index];
  },

  verifyPassword(user: StaffUser, plainPassword: string): boolean {
    return bcrypt.compareSync(plainPassword, user.passwordHash);
  },

  hashPassword(plainPassword: string): string {
    return bcrypt.hashSync(plainPassword, DEFAULT_HASH_ROUNDS);
  },
};