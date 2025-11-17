import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const LOG_FILE = path.join(DATA_DIR, 'emailLog.json');

interface EmailLogEntry {
  id: string;
  to: string;
  subject: string;
  bodyPreview: string;
  createdAt: string;
}

const ensureDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const appendLog = (entry: EmailLogEntry) => {
  ensureDir();
  let entries: EmailLogEntry[] = [];
  if (fs.existsSync(LOG_FILE)) {
    try {
      const raw = fs.readFileSync(LOG_FILE, 'utf8');
      entries = JSON.parse(raw) as EmailLogEntry[];
    } catch {
      entries = [];
    }
  }
  entries.unshift(entry);
  if (entries.length > 200) {
    entries = entries.slice(0, 200);
  }
  fs.writeFileSync(LOG_FILE, JSON.stringify(entries, null, 2), 'utf8');
};

const generateId = () => Math.random().toString(36).slice(2, 10);

export const emailService = {
  async send(to: string, subject: string, body: string) {
    console.log(`[email] -> ${to} :: ${subject}\n${body}`);
    appendLog({
      id: generateId(),
      to,
      subject,
      bodyPreview: body.slice(0, 200),
      createdAt: new Date().toISOString(),
    });
  },
};
