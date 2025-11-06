import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import type { NotificationQueueEntry, NotificationStatus } from '../../types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'notificationQueue.json');

interface PersistedNotificationQueue {
  entries: NotificationQueueEntry[];
}

const ensureDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const loadFromDisk = (): NotificationQueueEntry[] => {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ entries: [] }, null, 2),
      'utf8'
    );
    return [];
  }

  try {
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(content) as PersistedNotificationQueue;
    if (!Array.isArray(parsed.entries)) {
      throw new Error('Invalid notification queue file');
    }
    return parsed.entries;
  } catch (err) {
    console.error('Failed to load notificationQueue.json, resetting to empty array.', err);
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ entries: [] }, null, 2),
      'utf8'
    );
    return [];
  }
};

const persist = (entries: NotificationQueueEntry[]) => {
  ensureDir();
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify({ entries }, null, 2),
    'utf8'
  );
};

let cache: NotificationQueueEntry[] | null = null;

const getCache = (): NotificationQueueEntry[] => {
  if (!cache) {
    cache = loadFromDisk();
  }
  return cache;
};

const setCache = (entries: NotificationQueueEntry[]) => {
  cache = entries;
  persist(entries);
};

const nowIso = () => new Date().toISOString();

export const notificationQueueStore = {
  findAll(): NotificationQueueEntry[] {
    return [...getCache()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  findById(id: string): NotificationQueueEntry | null {
    return getCache().find((entry) => entry.id === id) ?? null;
  },

  create(data: {
    templateId: string;
    templateName: string;
    channel: NotificationQueueEntry['channel'];
    audienceDescription: string;
    status?: NotificationStatus;
    errorMessage?: string;
  }): NotificationQueueEntry {
    const entries = getCache();
    const timestamp = nowIso();
    const entry: NotificationQueueEntry = {
      id: `queue_${randomUUID()}`,
      templateId: data.templateId,
      templateName: data.templateName,
      channel: data.channel,
      audienceDescription: data.audienceDescription,
      status: data.status ?? 'queued',
      errorMessage: data.errorMessage,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    entries.unshift(entry);
    setCache(entries);
    return entry;
  },

  updateStatus(
    id: string,
    status: NotificationStatus,
    errorMessage?: string
  ): NotificationQueueEntry | null {
    const entries = getCache();
    const index = entries.findIndex((entry) => entry.id === id);
    if (index === -1) return null;

    const updated: NotificationQueueEntry = {
      ...entries[index],
      status,
      errorMessage,
      updatedAt: nowIso(),
    };

    entries[index] = updated;
    setCache(entries);
    return updated;
  },
};
