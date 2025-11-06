import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import type { RefundCase, RefundCaseNote, RefundStatus } from '../../types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'refundCases.json');

interface PersistedRefundCases {
  cases: RefundCase[];
}

const ensureDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const loadFromDisk = (): RefundCase[] => {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ cases: [] }, null, 2),
      'utf8'
    );
    return [];
  }

  try {
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(content) as PersistedRefundCases;
    if (!Array.isArray(parsed.cases)) {
      throw new Error('Invalid refund cases file');
    }
    return parsed.cases;
  } catch (err) {
    console.error('Failed to load refundCases.json, resetting to empty array.', err);
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ cases: [] }, null, 2),
      'utf8'
    );
    return [];
  }
};

const persist = (cases: RefundCase[]) => {
  ensureDir();
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify({ cases }, null, 2),
    'utf8'
  );
};

let cache: RefundCase[] | null = null;

const getCache = (): RefundCase[] => {
  if (!cache) {
    cache = loadFromDisk();
  }
  return cache;
};

const setCache = (cases: RefundCase[]) => {
  cache = cases;
  persist(cases);
};

const nowIso = () => new Date().toISOString();

const createNote = (note: Omit<RefundCaseNote, 'id' | 'createdAt'>): RefundCaseNote => ({
  ...note,
  id: `note_${randomUUID()}`,
  createdAt: nowIso(),
});

export const refundCasesStore = {
  findAll(): RefundCase[] {
    return [...getCache()].sort(
      (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime()
    );
  },

  findById(id: string): RefundCase | null {
    return getCache().find((refundCase) => refundCase.id === id) ?? null;
  },

  updateStatus(
    id: string,
    status: RefundStatus,
    note?: Omit<RefundCaseNote, 'id' | 'createdAt'>
  ): RefundCase | null {
    const cases = getCache();
    const index = cases.findIndex((refundCase) => refundCase.id === id);
    if (index === -1) return null;

    const timestamp = nowIso();
    const updated: RefundCase = {
      ...cases[index],
      status,
      lastUpdatedAt: timestamp,
      notes: note
        ? [...cases[index].notes, createNote(note)]
        : cases[index].notes,
    };

    cases[index] = updated;
    setCache(cases);
    return updated;
  },
};
