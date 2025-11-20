import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import type { WebhookLog } from '../../types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'webhookLogs.json');

interface PersistedWebhookLogs {
  logs: WebhookLog[];
}

const ensureDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const loadFromDisk = (): WebhookLog[] => {
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
    const parsed = JSON.parse(content) as PersistedWebhookLogs;
    if (!Array.isArray(parsed.logs)) {
      throw new Error('Invalid webhook logs file');
    }
    return parsed.logs;
  } catch (err) {
    console.error('Failed to load webhookLogs.json, resetting to empty array.', err);
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ logs: [] }, null, 2),
      'utf8'
    );
    return [];
  }
};

const persist = (logs: WebhookLog[]) => {
  ensureDir();
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify({ logs }, null, 2),
    'utf8'
  );
};

let cache: WebhookLog[] | null = null;

const getCache = (): WebhookLog[] => {
  if (!cache) {
    cache = loadFromDisk();
  }
  return cache;
};

const setCache = (logs: WebhookLog[]) => {
  cache = logs;
  persist(logs);
};

const nowIso = () => new Date().toISOString();

export const webhookLogsStore = {
  findAll(): WebhookLog[] {
    return [...getCache()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  findById(id: string): WebhookLog | null {
    return getCache().find((log) => log.id === id) ?? null;
  },

  create(data: Omit<WebhookLog, 'id' | 'createdAt' | 'updatedAt'>): WebhookLog {
    const logs = getCache();
    const timestamp = nowIso();
    const log: WebhookLog = {
      ...data,
      id: `webhook_${randomUUID()}`,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    logs.unshift(log);
    setCache(logs);
    return log;
  },

  updateStatus(
    id: string,
    status: WebhookLog['status'],
    responseMessage?: string
  ): WebhookLog | null {
    const logs = getCache();
    const index = logs.findIndex((log) => log.id === id);
    if (index === -1) return null;

    const updated: WebhookLog = {
      ...logs[index],
      status,
      responseMessage,
      updatedAt: nowIso(),
    };

    logs[index] = updated;
    setCache(logs);
    return updated;
  },

  hasProcessedReference(provider: string, reference: string): boolean {
    const logs = getCache();
    for (const log of logs) {
      if (log.provider !== provider) continue;
      if (log.status !== 'processed') continue;
      const payload: any = log.payload || {};
      const ref = (payload?.data && (payload.data as any).reference) || payload?.reference;
      if (typeof ref === 'string' && ref === reference) return true;
    }
    return false;
  },
};
