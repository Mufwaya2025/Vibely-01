import type { PaymentPurpose } from './paymentService';

interface PendingTransaction {
  reference: string;
  purpose: PaymentPurpose;
  createdAt: string;
}

const STORAGE_KEY = 'vibely:pending-transactions';

const readList = (): PendingTransaction[] => {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as PendingTransaction[];
  } catch (error) {
    console.error('Failed to read pending transactions', error);
    return [];
  }
};

const writeList = (items: PendingTransaction[]) => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.error('Failed to persist pending transactions', error);
  }
};

export const addPendingReference = (reference: string, purpose: PaymentPurpose) => {
  if (!reference) return;
  const items = readList();
  if (items.some((item) => item.reference === reference)) {
    return;
  }
  items.push({
    reference,
    purpose,
    createdAt: new Date().toISOString(),
  });
  writeList(items);
};

export const removePendingReference = (reference: string) => {
  if (!reference) return;
  const items = readList().filter((item) => item.reference !== reference);
  writeList(items);
};

export const listPendingReferences = (): PendingTransaction[] => readList();
