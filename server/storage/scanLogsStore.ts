import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'scanLogs.json');

type ScanResult = 'VALID' | 'ALREADY_USED' | 'BLOCKED' | 'NOT_FOUND' | 'WRONG_EVENT' | 'EXPIRED';

interface ScanLog {
  id: string;
  ticketId: string;
  eventId: string;
  deviceId: string;
  staffUserId: string;
  scanResult: ScanResult;
  message: string;
  scannedAt: string;
  lat?: number;
  lon?: number;
  ip?: string;
  createdAt: string;
}

interface PersistedScanLogs {
  scanLogs: ScanLog[];
}

const ensureDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const loadFromDisk = (): ScanLog[] => {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ scanLogs: [] }, null, 2),
      'utf8'
    );
    return [];
  }

  try {
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(content) as PersistedScanLogs;
    if (!Array.isArray(parsed.scanLogs)) {
      throw new Error('Invalid scan logs file');
    }
    return parsed.scanLogs;
  } catch (err) {
    console.error('Failed to load scanLogs.json, returning empty array.', err);
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ scanLogs: [] }, null, 2),
      'utf8'
    );
    return [];
  }
};

const persist = (scanLogs: ScanLog[]) => {
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify({ scanLogs }, null, 2), 'utf8');
};

let cache: ScanLog[] | null = null;

const getCache = (): ScanLog[] => {
  if (!cache) {
    cache = loadFromDisk();
  }
  return cache;
};

const setCache = (scanLogs: ScanLog[]) => {
  cache = scanLogs;
  persist(scanLogs);
};

export const scanLogsStore = {
  findById(id: string): ScanLog | null {
    return getCache().find((log) => log.id === id) ?? null;
  },

  findByTicketId(ticketId: string): ScanLog[] {
    return getCache().filter((log) => log.ticketId === ticketId);
  },

  findByDeviceId(deviceId: string): ScanLog[] {
    return getCache().filter((log) => log.deviceId === deviceId);
  },

  findByEventId(eventId: string): ScanLog[] {
    return getCache().filter((log) => log.eventId === eventId);
  },

  create(data: {
    id: string;
    ticketId: string;
    eventId: string;
    deviceId: string;
    staffUserId: string;
    scanResult: ScanResult;
    message: string;
    lat?: number;
    lon?: number;
    ip?: string;
  }): ScanLog {
    const newLog: ScanLog = {
      id: data.id,
      ticketId: data.ticketId,
      eventId: data.eventId,
      deviceId: data.deviceId,
      staffUserId: data.staffUserId,
      scanResult: data.scanResult,
      message: data.message,
      scannedAt: new Date().toISOString(),
      lat: data.lat,
      lon: data.lon,
      ip: data.ip,
      createdAt: new Date().toISOString(),
    };

    const logs = getCache();
    logs.push(newLog);
    setCache(logs);
    return newLog;
  },
};