import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { PlatformSettings } from '../../types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../../data');
const DATA_FILE = path.join(DATA_DIR, 'platformSettings.json');

const DEFAULT_SETTINGS: PlatformSettings = {
  platformFeePercent: 3.5,
  payoutCurrency: 'ZMW',
  autoPayoutsEnabled: false,
  updatedAt: new Date().toISOString(),
  updatedBy: undefined,
};

const ensureDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const loadFromDisk = (): PlatformSettings => {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(DEFAULT_SETTINGS, null, 2),
      'utf8'
    );
    return DEFAULT_SETTINGS;
  }

  try {
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(content) as PlatformSettings;
  } catch (err) {
    console.error('Failed to load platformSettings.json, using default settings.', err);
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(DEFAULT_SETTINGS, null, 2),
      'utf8'
    );
    return DEFAULT_SETTINGS;
  }
};

const persist = (settings: PlatformSettings) => {
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(settings, null, 2), 'utf8');
};

let cache: PlatformSettings | null = null;

const getCache = (): PlatformSettings => {
  if (!cache) {
    cache = loadFromDisk();
  }
  return cache;
};

const setCache = (settings: PlatformSettings) => {
  cache = settings;
  persist(settings);
};

export const platformSettingsStore = {
  get(): PlatformSettings {
    return getCache();
  },

  update(updates: Partial<Omit<PlatformSettings, 'updatedAt'>>): PlatformSettings {
    const currentSettings = getCache();
    const newSettings = {
      ...currentSettings,
      ...updates,
      updatedBy: updates.updatedBy ?? currentSettings.updatedBy,
      updatedAt: new Date().toISOString(),
    };

    setCache(newSettings);
    return newSettings;
  },
};
