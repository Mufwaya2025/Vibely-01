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

const buildConversationKey = (a: string, b: string): string =>
  [a, b].sort((left, right) => left.localeCompare(right)).join('::');

export class MessageStore {
  private messages = new Map<string, StoredMessage>();
  private conversations = new Map<string, StoredMessage[]>();

  addMessage(input: Omit<StoredMessage, 'id' | 'timestamp' | 'read'>): StoredMessage {
    const record: StoredMessage = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      read: false,
      ...input,
    };

    const key = buildConversationKey(record.senderId, record.receiverId);
    const existing = this.conversations.get(key) ?? [];
    existing.push(record);
    this.conversations.set(key, existing);
    this.messages.set(record.id, record);

    return record;
  }

  markAsRead(messageId: string, readerId: string): StoredMessage | null {
    const record = this.messages.get(messageId);
    if (!record) return null;
    if (record.receiverId !== readerId) return null;
    if (record.read) return record;

    record.read = true;
    return record;
  }

  getConversation(userA: string, userB: string): StoredMessage[] {
    const key = buildConversationKey(userA, userB);
    return this.conversations.get(key) ?? [];
  }
}

export const messageStore = new MessageStore();
