import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { MOCK_USERS } from '../../constants';
import type { AuthProvider, User, UserRole, UserStatus } from '../../types';

type StoredUser = Omit<User, 'authProviders'> & {
  authProviders: AuthProvider[];
  passwordHash: string;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'users.json');

interface PersistedUsers {
  users: StoredUser[];
}

const DEFAULT_PASSWORD = 'Password99!!';
const DEFAULT_HASH_ROUNDS = 10;

const seedUsers = (): StoredUser[] =>
  Object.values(MOCK_USERS).map((user) => ({
    ...user,
    passwordHash: bcrypt.hashSync(DEFAULT_PASSWORD, DEFAULT_HASH_ROUNDS),
    subscriptionTier: user.subscriptionTier ?? 'Regular',
    authProviders: ['local'],
  }));

let cache: StoredUser[] | null = null;

const ensureDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const loadFromDisk = (): StoredUser[] => {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    const seeded = seedUsers();
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ users: seeded }, null, 2),
      'utf8'
    );
    return seeded;
  }

  try {
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(content) as PersistedUsers;
    if (!Array.isArray(parsed.users)) {
      throw new Error('Invalid users file');
    }
    return parsed.users.map((user) => ({
      ...user,
      passwordHash: user.passwordHash ?? bcrypt.hashSync(DEFAULT_PASSWORD, DEFAULT_HASH_ROUNDS),
      subscriptionTier: user.subscriptionTier ?? 'Regular',
      authProviders: user.authProviders && user.authProviders.length > 0 ? user.authProviders : ['local'],
    }));
  } catch (err) {
    console.error('Failed to load users.json, recreating from seed.', err);
    const seeded = seedUsers();
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ users: seeded }, null, 2),
      'utf8'
    );
    return seeded;
  }
};

const persist = (users: StoredUser[]) => {
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify({ users }, null, 2), 'utf8');
};

const getCache = (): StoredUser[] => {
  if (!cache) {
    cache = loadFromDisk();
  }
  return cache;
};

const setCache = (users: StoredUser[]) => {
  cache = users;
  persist(users);
};

const sanitize = (user: StoredUser): User => {
  const { passwordHash, ...rest } = user;
  return rest;
};

const toPublic = (user: StoredUser | null): User | null =>
  user ? sanitize(user) : null;

export const usersStore = {
  findByEmail(email: string): StoredUser | null {
    const normalized = normalizeEmail(email);
    return getCache().find((user) => normalizeEmail(user.email) === normalized) ?? null;
  },

  findById(id: string): StoredUser | null {
    return getCache().find((user) => user.id === id) ?? null;
  },

  getAll(): StoredUser[] {
    return [...getCache()];
  },

  findAll(): StoredUser[] {
    return [...getCache()];
  },

  create(data: {
    id: string;
    name: string;
    email: string;
    passwordHash: string;
    role: UserRole;
    status: UserStatus;
    interests?: User['interests'];
    attendedEvents?: User['attendedEvents'];
    subscriptionTier?: User['subscriptionTier'];
    subscriptionExpiresAt?: string;
    authProviders?: AuthProvider[];
  }): StoredUser {
    const normalized = normalizeEmail(data.email);
    const existing = this.findByEmail(normalized);
    if (existing) {
      throw new Error('User already exists');
    }

    const newUser: StoredUser = {
      id: data.id,
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      role: data.role,
      status: data.status,
      interests: data.interests ?? [],
      attendedEvents: data.attendedEvents ?? [],
      subscriptionTier: data.subscriptionTier ?? 'Regular',
      subscriptionExpiresAt: data.subscriptionExpiresAt,
      authProviders: data.authProviders && data.authProviders.length > 0 ? data.authProviders : ['local'],
    };

    const users = getCache();
    users.push(newUser);
    setCache(users);
    return newUser;
  },

  upsert(user: StoredUser): StoredUser {
    const users = getCache();
    const index = users.findIndex((u) => u.id === user.id);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    setCache(users);
    return user;
  },

  update(id: string, updates: Partial<Omit<StoredUser, 'id' | 'email'>>): StoredUser | null {
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

  addAuthProvider(id: string, provider: AuthProvider): StoredUser | null {
    const user = this.findById(id);
    if (!user) return null;
    if (user.authProviders.includes(provider)) {
      return user;
    }
    return this.update(id, {
      authProviders: [...user.authProviders, provider],
    });
  },

  updateRole(id: string, role: UserRole): User | null {
    const updated = this.update(id, { role });
    return toPublic(updated);
  },

  updateStatus(id: string, status: UserStatus): User | null {
    const updated = this.update(id, { status });
    return toPublic(updated);
  },

  resetPassword(id: string): User | null {
    const users = getCache();
    const index = users.findIndex((user) => user.id === id);
    if (index === -1) return null;

    const providers = users[index].authProviders.includes('local')
      ? users[index].authProviders
      : [...users[index].authProviders, 'local'];

    const updated = this.update(id, {
      passwordHash: this.hashPassword(DEFAULT_PASSWORD),
      authProviders: providers,
    });

    return toPublic(updated);
  },

  updateSubscription(
    id: string,
    tier: User['subscriptionTier'],
    expiresAt?: string
  ): User | null {
    const updated = this.update(id, {
      subscriptionTier: tier,
      subscriptionExpiresAt: expiresAt,
    });

    return toPublic(updated);
  },

  toPublicUser(user: StoredUser | null): User | null {
    return user ? sanitize(user) : null;
  },

  verifyPassword(user: StoredUser, plainPassword: string): boolean {
    return bcrypt.compareSync(plainPassword, user.passwordHash);
  },

  hashPassword(plainPassword: string): string {
    return bcrypt.hashSync(plainPassword, DEFAULT_HASH_ROUNDS);
  },
};
