import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'tickets.json');

// Using the original ticket interface from types.ts (with ticketId) 
// while adding fields needed for device scanning
interface Ticket {
  ticketId: string; // Original API uses ticketId
  eventId: string;
  userId: string; // Needed for findByUser
  purchaseDate: string; // Needed for original functionality
  status: 'valid' | 'scanned' | 'unused' | 'used' | 'blocked'; // Original status types
  scanTimestamp?: string;
  rating?: number;
  reviewText?: string;
  code?: string;  // QR/Barcode payload (needed for device scanning)
  holderName?: string; // For device scanning compatibility
  holderEmail?: string; // For device scanning compatibility
}

interface PersistedTickets {
  tickets: Ticket[];
}

const ensureDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const loadFromDisk = (): Ticket[] => {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ tickets: [] }, null, 2),
      'utf8'
    );
    return [];
  }

  try {
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(content) as PersistedTickets;
    if (!Array.isArray(parsed.tickets)) {
      throw new Error('Invalid tickets file');
    }
    return parsed.tickets;
  } catch (err) {
    console.error('Failed to load tickets.json, returning empty array.', err);
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ tickets: [] }, null, 2),
      'utf8'
    );
    return [];
  }
};

const persist = (tickets: Ticket[]) => {
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify({ tickets }, null, 2), 'utf8');
};

let cache: Ticket[] | null = null;

const getCache = (): Ticket[] => {
  if (!cache) {
    cache = loadFromDisk();
  }
  return cache;
};

const setCache = (tickets: Ticket[]) => {
  cache = tickets;
  persist(tickets);
};

export const ticketsStore = {
  findById(ticketId: string): Ticket | null {
    return getCache().find((ticket) => ticket.ticketId === ticketId) ?? null;
  },

  findByUser(userId: string): Ticket[] {
    return getCache().filter((ticket) => ticket.userId === userId);
  },

  findByEvent(eventId: string): Ticket[] {
    return getCache().filter((ticket) => ticket.eventId === eventId);
  },
  
  findByCode(ticketCode: string): Ticket | null {
    // Support both QR-specific codes and legacy ticket IDs.
    return (
      getCache().find(
        (ticket) => ticket.code === ticketCode || ticket.ticketId === ticketCode
      ) ?? null
    );
  },

  findAll(): Ticket[] {
    return [...getCache()];
  },

  create(newTicket: Omit<Ticket, 'ticketId'> & { ticketId: string }): Ticket {
    // Check for duplicate code if provided (for device scanning)
    if (newTicket.code) {
      const existingByCode = this.findByCode(newTicket.code);
      if (existingByCode) {
        throw new Error('Ticket with this code already exists');
      }
    }

    const resolvedCode = newTicket.code ?? newTicket.ticketId;

    const ticket: Ticket = {
      ...newTicket,
      code: resolvedCode,
      purchaseDate: newTicket.purchaseDate || new Date().toISOString(),
      status: newTicket.status || 'valid',
    };

    const tickets = getCache();
    tickets.push(ticket);
    setCache(tickets);
    return ticket;
  },

  update(ticketId: string, updates: Partial<Ticket>): Ticket | null {
    const tickets = getCache();
    const index = tickets.findIndex((ticket) => ticket.ticketId === ticketId);
    if (index === -1) return null;

    tickets[index] = {
      ...tickets[index],
      ...updates,
    };

    setCache(tickets);
    return tickets[index];
  },

  markAsUsed(ticketId: string): Ticket | null {
    // Normalize to used status and capture timestamp
    return this.update(ticketId, {
      status: 'used',
      scanTimestamp: new Date().toISOString(),
    });
  },
};
