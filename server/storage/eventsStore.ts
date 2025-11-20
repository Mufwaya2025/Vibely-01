import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { MOCK_EVENTS } from '../../constants';
import type { Event } from '../../types';

type StoredEvent = Event;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'events.json');

interface PersistedEvents {
  events: StoredEvent[];
}

const ensureDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const normalizeEvents = (
  events: StoredEvent[]
): { events: StoredEvent[]; changed: boolean } => {
  let changed = false;
  const normalized = events.map((event) => {
    if (
      event.id &&
      event.ticketsSold !== undefined &&
      event.reviewCount !== undefined &&
      event.averageRating !== undefined
    ) {
      return event;
    }

    changed = true;
    return {
      ...event,
      id: event.id ?? `evt-${randomUUID()}`,
      ticketsSold: event.ticketsSold ?? 0,
      reviewCount: event.reviewCount ?? 0,
      averageRating: event.averageRating ?? 0,
    };
  });

  return { events: normalized, changed };
};

const loadFromDisk = (): StoredEvent[] => {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    // Seed with mock events if file doesn't exist
    const seeded = MOCK_EVENTS.map(event => ({ ...event }));
    const { events } = normalizeEvents(seeded);
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ events }, null, 2),
      'utf8'
    );
    return events;
  }

  try {
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(content) as PersistedEvents;
    if (!Array.isArray(parsed.events)) {
      throw new Error('Invalid events file');
    }
    const { events, changed } = normalizeEvents(parsed.events as StoredEvent[]);
    if (changed) {
      persist(events);
    }
    return events;
  } catch (err) {
    console.error('Failed to load events.json, recreating from mock data.', err);
    const seeded = MOCK_EVENTS.map(event => ({ ...event }));
    const { events } = normalizeEvents(seeded);
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ events }, null, 2),
      'utf8'
    );
    return events;
  }
};

const persist = (events: StoredEvent[]) => {
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify({ events }, null, 2), 'utf8');
};

let cache: StoredEvent[] | null = null;

const getCache = (): StoredEvent[] => {
  if (!cache) {
    cache = loadFromDisk();
  }
  return cache;
};

const setCache = (events: StoredEvent[]) => {
  const { events: normalized } = normalizeEvents(events);
  cache = normalized;
  persist(normalized);
};

export const eventsStore = {
  findByOrganizer(organizerId: string): StoredEvent[] {
    return getCache().filter((event) => event.organizer.id === organizerId);
  },

  findById(id: string): StoredEvent | null {
    return getCache().find((event) => event.id === id) ?? null;
  },

  findAll(): StoredEvent[] {
    return [...getCache()];
  },

  create(
    data: Omit<StoredEvent, 'id' | 'ticketsSold' | 'reviewCount' | 'averageRating'> & { id?: string }
  ): StoredEvent {
    const newEvent: StoredEvent = {
      ...data,
      id: data.id ?? `evt-${randomUUID()}`,
      ticketsSold: 0,
      reviewCount: 0,
      averageRating: 0,
    };

    const events = getCache();
    events.push(newEvent);
    setCache(events);
    return newEvent;
  },

  update(id: string, updates: Partial<Omit<StoredEvent, 'id' | 'organizer'>>): StoredEvent | null {
    const events = getCache();
    const index = events.findIndex((event) => event.id === id);
    if (index === -1) return null;

    const updatedEvent = {
      ...events[index],
      ...updates,
    };

    events[index] = updatedEvent;
    setCache(events);
    return updatedEvent;
  },

  delete(id: string): boolean {
    const events = getCache();
    const index = events.findIndex((event) => event.id === id);
    
    if (index === -1) return false;

    events.splice(index, 1);
    setCache(events);
    return true;
  },
};

