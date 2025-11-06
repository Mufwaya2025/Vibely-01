import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import type { NotificationTemplate } from '../../types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'notificationTemplates.json');

interface PersistedNotificationTemplates {
  templates: NotificationTemplate[];
}

const ensureDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const createDefaults = (): NotificationTemplate[] => {
  const timestamp = new Date().toISOString();
  return [
    {
      id: 'tmpl-ticket-confirmation',
      name: 'Ticket Purchase Confirmation',
      channel: 'email',
      audienceDescription: 'Attendees who successfully purchase tickets',
      subject: 'Your Vibely ticket is confirmed!',
      body: 'Hi {{name}}, thanks for purchasing tickets. We will see you at {{eventName}}.',
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: 'tmpl-pro-upgrade',
      name: 'Organizer Pro Upgrade',
      channel: 'email',
      audienceDescription: 'Organizers upgrading to Pro',
      subject: 'Welcome to Vibely Pro 🎉',
      body: 'Hi {{name}}, Pro unlocks analytics, payouts, and more. Let us know how we can help.',
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
};

const loadFromDisk = (): NotificationTemplate[] => {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    const defaults = createDefaults();
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ templates: defaults }, null, 2),
      'utf8'
    );
    return defaults;
  }

  try {
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(content) as PersistedNotificationTemplates;
    if (!Array.isArray(parsed.templates)) {
      throw new Error('Invalid notification templates file');
    }
    return parsed.templates;
  } catch (err) {
    console.error('Failed to load notificationTemplates.json, recreating defaults.', err);
    const defaults = createDefaults();
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ templates: defaults }, null, 2),
      'utf8'
    );
    return defaults;
  }
};

const persist = (templates: NotificationTemplate[]) => {
  ensureDir();
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify({ templates }, null, 2),
    'utf8'
  );
};

let cache: NotificationTemplate[] | null = null;

const getCache = (): NotificationTemplate[] => {
  if (!cache) {
    cache = loadFromDisk();
  }
  return cache;
};

const setCache = (templates: NotificationTemplate[]) => {
  cache = templates;
  persist(templates);
};

const nowIso = () => new Date().toISOString();
const generateId = () => `tmpl_${randomUUID()}`;

export const notificationTemplatesStore = {
  findAll(): NotificationTemplate[] {
    return [...getCache()].sort((a, b) => a.name.localeCompare(b.name));
  },

  findById(id: string): NotificationTemplate | null {
    return getCache().find((template) => template.id === id) ?? null;
  },

  create(
    data: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): NotificationTemplate {
    const templates = getCache();
    const timestamp = nowIso();
    const template: NotificationTemplate = {
      ...data,
      id: data.id ?? generateId(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    templates.push(template);
    setCache(templates);
    return template;
  },

  update(
    id: string,
    updates: Partial<Omit<NotificationTemplate, 'id' | 'createdAt'>>
  ): NotificationTemplate | null {
    const templates = getCache();
    const index = templates.findIndex((template) => template.id === id);
    if (index === -1) return null;

    const updated: NotificationTemplate = {
      ...templates[index],
      ...updates,
      updatedAt: nowIso(),
    };

    templates[index] = updated;
    setCache(templates);
    return updated;
  },

  delete(id: string): boolean {
    const templates = getCache();
    const index = templates.findIndex((template) => template.id === id);
    if (index === -1) return false;

    templates.splice(index, 1);
    setCache(templates);
    return true;
  },
};
