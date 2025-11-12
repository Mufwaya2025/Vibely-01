import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

export interface StoredMessage {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  content: string;
  timestamp: string;
  read: boolean;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'messages.json');

interface PersistedMessages {
  messages: StoredMessage[];
}

const ensureStorage = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    const initial: PersistedMessages = { messages: [] };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf8');
  }
};

const loadFromDisk = (): StoredMessage[] => {
  try {
    ensureStorage();
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw) as PersistedMessages;
    if (!Array.isArray(parsed.messages)) {
      throw new Error('Invalid messages payload');
    }
    return parsed.messages.map((msg) => ({
      ...msg,
      timestamp: msg.timestamp ?? new Date().toISOString(),
      read: Boolean(msg.read),
    }));
  } catch (error) {
    console.error('Failed to load messages from disk, resetting store.', error);
    const fallback: PersistedMessages = { messages: [] };
    fs.writeFileSync(DATA_FILE, JSON.stringify(fallback, null, 2), 'utf8');
    return [];
  }
};

const persist = (records: StoredMessage[]) => {
  ensureStorage();
  const payload: PersistedMessages = { messages: records };
  fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), 'utf8');
};

const buildConversationKey = (a: string, b: string): string =>
  [a, b].sort((left, right) => left.localeCompare(right)).join('::');

export class MessageStore {
  private records: StoredMessage[] = [];
  private messages = new Map<string, StoredMessage>();
  private conversations = new Map<string, StoredMessage[]>();

  constructor() {
    this.records = loadFromDisk();
    this.rebuildIndexes();
  }

  private rebuildIndexes() {
    this.messages.clear();
    this.conversations.clear();
    this.records.forEach((record) => {
      this.messages.set(record.id, record);
      const key = buildConversationKey(record.senderId, record.receiverId);
      const convo = this.conversations.get(key) ?? [];
      convo.push(record);
      this.conversations.set(key, convo);
    });
  }

  private persistAll() {
    persist(this.records);
  }

  addMessage(input: Omit<StoredMessage, 'id' | 'timestamp' | 'read'>): StoredMessage {
    const record: StoredMessage = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      read: false,
      ...input,
    };

    this.records.push(record);
    const key = buildConversationKey(record.senderId, record.receiverId);
    const convo = this.conversations.get(key) ?? [];
    convo.push(record);
    this.conversations.set(key, convo);
    this.messages.set(record.id, record);
    this.persistAll();

    return record;
  }

  markAsRead(messageId: string, readerId: string): StoredMessage | null {
    const record = this.messages.get(messageId);
    if (!record) return null;
    if (record.receiverId !== readerId) return null;
    if (record.read) return record;

    record.read = true;
    this.persistAll();
    return record;
  }

  getConversation(userA: string, userB: string): StoredMessage[] {
    const key = buildConversationKey(userA, userB);
    const convo = this.conversations.get(key) ?? [];
    return [...convo];
  }
}

export const messageStore = new MessageStore();
