import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import type { GatewayTransaction, GatewayTransactionStatus } from '../../types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'gatewayTransactions.json');

interface PersistedGatewayTransactions {
  transactions: GatewayTransaction[];
}

const ensureDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const loadFromDisk = (): GatewayTransaction[] => {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ transactions: [] }, null, 2),
      'utf8'
    );
    return [];
  }

  try {
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(content) as PersistedGatewayTransactions;
    if (!Array.isArray(parsed.transactions)) {
      throw new Error('Invalid gateway transactions file');
    }
    return parsed.transactions;
  } catch (err) {
    console.error('Failed to load gatewayTransactions.json, resetting to empty array.', err);
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ transactions: [] }, null, 2),
      'utf8'
    );
    return [];
  }
};

const persist = (transactions: GatewayTransaction[]) => {
  ensureDir();
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify({ transactions }, null, 2),
    'utf8'
  );
};

let cache: GatewayTransaction[] | null = null;

const getCache = (): GatewayTransaction[] => {
  if (!cache) {
    cache = loadFromDisk();
  }
  return cache;
};

const setCache = (transactions: GatewayTransaction[]) => {
  cache = transactions;
  persist(transactions);
};

const nowIso = () => new Date().toISOString();
const generateId = () => `txn_${randomUUID()}`;

const sanitizeTransactions = (transactions: GatewayTransaction[]): GatewayTransaction[] =>
  [...transactions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

export const gatewayTransactionsStore = {
  findAll(): GatewayTransaction[] {
    return sanitizeTransactions(getCache());
  },

  findById(id: string): GatewayTransaction | null {
    return getCache().find((txn) => txn.id === id) ?? null;
  },

  findByReference(reference: string): GatewayTransaction | null {
    return getCache().find((txn) => txn.reference === reference) ?? null;
  },

  create(
    data: Omit<GatewayTransaction, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string;
    }
  ): GatewayTransaction {
    const transactions = getCache();
    const timestamp = nowIso();
    const transaction: GatewayTransaction = {
      ...data,
      id: data.id ?? generateId(),
      createdAt: timestamp,
      updatedAt: timestamp,
      metadata: data.metadata ?? {},
    };

    transactions.push(transaction);
    setCache(transactions);
    return transaction;
  },

  update(
    id: string,
    updates: Partial<Omit<GatewayTransaction, 'id' | 'createdAt'>>
  ): GatewayTransaction | null {
    const transactions = getCache();
    const index = transactions.findIndex((txn) => txn.id === id);
    if (index === -1) return null;

    const merged: GatewayTransaction = {
      ...transactions[index],
      ...updates,
      metadata: {
        ...transactions[index].metadata,
        ...(updates.metadata ?? {}),
      },
      updatedAt: nowIso(),
    };

    transactions[index] = merged;
    setCache(transactions);
    return merged;
  },

  updateByReference(
    reference: string,
    updates: Partial<Omit<GatewayTransaction, 'id' | 'createdAt'>>
  ): GatewayTransaction | null {
    const txn = this.findByReference(reference);
    if (!txn) return null;
    return this.update(txn.id, updates);
  },

  updateStatus(
    id: string,
    status: GatewayTransactionStatus
  ): GatewayTransaction | null {
    return this.update(id, { status });
  },

  attachTicket(
    id: string,
    ticketId: string
  ): GatewayTransaction | null {
    return this.update(id, { ticketId });
  },

  deleteWhere(predicate: (txn: GatewayTransaction) => boolean): number {
    const transactions = getCache();
    const remaining = transactions.filter((txn) => !predicate(txn));
    const deleted = transactions.length - remaining.length;
    if (deleted > 0) {
      setCache(remaining);
    }
    return deleted;
  },
};
