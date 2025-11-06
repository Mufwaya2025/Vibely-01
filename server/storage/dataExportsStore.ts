import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import type { DataExportJob, DataExportStatus } from '../../types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'dataExports.json');

interface PersistedDataExports {
  jobs: DataExportJob[];
}

const ensureDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const loadFromDisk = (): DataExportJob[] => {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ jobs: [] }, null, 2),
      'utf8'
    );
    return [];
  }

  try {
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(content) as PersistedDataExports;
    if (!Array.isArray(parsed.jobs)) {
      throw new Error('Invalid data exports file');
    }
    return parsed.jobs;
  } catch (err) {
    console.error('Failed to load dataExports.json, resetting to empty array.', err);
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ jobs: [] }, null, 2),
      'utf8'
    );
    return [];
  }
};

const persist = (jobs: DataExportJob[]) => {
  ensureDir();
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify({ jobs }, null, 2),
    'utf8'
  );
};

let cache: DataExportJob[] | null = null;

const getCache = (): DataExportJob[] => {
  if (!cache) {
    cache = loadFromDisk();
  }
  return cache;
};

const setCache = (jobs: DataExportJob[]) => {
  cache = jobs;
  persist(jobs);
};

const nowIso = () => new Date().toISOString();

export const dataExportsStore = {
  findAll(): DataExportJob[] {
    return [...getCache()].sort(
      (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
    );
  },

  create(data: { type: DataExportJob['type']; requestedBy: string }): DataExportJob {
    const jobs = getCache();
    const timestamp = nowIso();
    const job: DataExportJob = {
      id: `export_${randomUUID()}`,
      type: data.type,
      status: 'pending',
      requestedBy: data.requestedBy,
      requestedAt: timestamp,
    };

    jobs.unshift(job);
    setCache(jobs);
    return job;
  },

  updateStatus(
    id: string,
    status: DataExportStatus,
    updates?: { downloadUrl?: string; errorMessage?: string }
  ): DataExportJob | null {
    const jobs = getCache();
    const index = jobs.findIndex((job) => job.id === id);
    if (index === -1) return null;

    const timestamp = nowIso();
    const updated: DataExportJob = {
      ...jobs[index],
      status,
      completedAt: status === 'completed' || status === 'failed' ? timestamp : jobs[index].completedAt,
      downloadUrl: updates?.downloadUrl ?? jobs[index].downloadUrl,
      errorMessage: updates?.errorMessage ?? (status === 'failed' ? jobs[index].errorMessage : undefined),
    };

    jobs[index] = updated;
    setCache(jobs);
    return updated;
  },
};
