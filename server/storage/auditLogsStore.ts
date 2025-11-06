import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import type { AdminAuditLogEntry } from '../../types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'auditLogs.json');

interface PersistedAuditLogs {
  logs: AdminAuditLogEntry[];
}

const ensureDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const loadFromDisk = (): AdminAuditLogEntry[] => {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ logs: [] }, null, 2),
      'utf8'
    );
    return [];
  }

  try {
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(content) as PersistedAuditLogs;
    if (!Array.isArray(parsed.logs)) {
      throw new Error('Invalid audit logs file');
    }
    return parsed.logs;
  } catch (err) {
    console.error('Failed to load auditLogs.json, resetting to empty array.', err);
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ logs: [] }, null, 2),
      'utf8'
    );
    return [];
  }
};

const persist = (logs: AdminAuditLogEntry[]) => {
  ensureDir();
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify({ logs }, null, 2),
    'utf8'
  );
};

let cache: AdminAuditLogEntry[] | null = null;

const getCache = (): AdminAuditLogEntry[] => {
  if (!cache) {
    cache = loadFromDisk();
  }
  return cache;
};

const setCache = (logs: AdminAuditLogEntry[]) => {
  cache = logs;
  persist(logs);
};

const nowIso = () => new Date().toISOString();

export const auditLogsStore = {
  findAll(): AdminAuditLogEntry[] {
    return [...getCache()].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  },

  create(
    data: Omit<AdminAuditLogEntry, 'id' | 'timestamp'>
  ): AdminAuditLogEntry {
    const logs = getCache();
    const entry: AdminAuditLogEntry = {
      ...data,
      id: `audit_${randomUUID()}`,
      timestamp: nowIso(),
    };

    logs.unshift(entry);
    setCache(logs);
    return entry;
  },
};
