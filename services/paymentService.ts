import { GatewayTransactionStatus, PaymentDetails, PaymentMethod, Ticket, User } from '../types';
import { apiFetchJson } from '../utils/apiClient';
import { addPendingReference, removePendingReference } from './pendingTransactionService';
import { ensureLencoWidget } from '../utils/lenco';

const PAYMENT_DETAILS_KEY = 'vibely_payment_details';

export type PaymentPurpose = 'ticket' | 'subscription';

type PaymentChannel = 'card' | 'mobile-money';

interface PaymentSessionResponse {
  reference: string;
  publicKey: string;
  amount: number;
  currency: string;
  email: string;
  label: string;
  channels: PaymentChannel[];
  customer?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
  widgetUrl: string;
  mockMode?: boolean;
}

interface ProcessPaymentOptions {
  purpose: PaymentPurpose;
  userId: string;
  amount: number;
  currency?: string;
  eventId?: string;
  metadata?: Record<string, unknown>;
  paymentMethods?: PaymentMethod[];
  customer?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
  label?: string;
}

export const savePaymentDetails = (details: PaymentDetails): void => {
  try {
    localStorage.setItem(PAYMENT_DETAILS_KEY, JSON.stringify(details));
  } catch (error) {
    console.error('Failed to save payment details', error);
  }
};

export const getPaymentDetails = (): PaymentDetails | null => {
  try {
    const detailsJson = localStorage.getItem(PAYMENT_DETAILS_KEY);
    return detailsJson ? JSON.parse(detailsJson) : null;
  } catch (error) {
    console.error('Failed to parse payment details', error);
    return null;
  }
};

export interface ProcessPaymentResult {
  success: boolean;
  transactionId: string;
  status: string;
  reference: string;
  transaction?: Record<string, unknown>;
  updatedUser?: User | null;
  issuedTicket?: Ticket | null;
}

const fetchPaymentSession = async (options: ProcessPaymentOptions): Promise<PaymentSessionResponse> =>
  apiFetchJson<PaymentSessionResponse>('/api/payments/session', {
    method: 'POST',
    body: {
      purpose: options.purpose,
      userId: options.userId,
      amount: options.amount,
      currency: options.currency,
      eventId: options.eventId,
      metadata: options.metadata,
      channels: options.paymentMethods,
      customer: options.customer,
      label: options.label,
    },
  });

const verifyPayment = async (reference: string): Promise<ProcessPaymentResult> => {
  const response = await apiFetchJson<{
    success: boolean;
    status: string;
    transaction?: Record<string, unknown>;
    updatedUser?: User | null;
    issuedTicket?: Ticket | null;
  }>('/api/payments/verify', {
    method: 'POST',
    body: { reference },
  });

  return {
    success: response.success,
    status: response.status,
    transactionId: (response.transaction as any)?.id ?? '',
    transaction: response.transaction,
    updatedUser: response.updatedUser ?? null,
    issuedTicket: response.issuedTicket ?? null,
    reference,
  };
};

const createOverlay = () => {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'display:none; position:fixed; inset:0; z-index:9999; background:rgba(15,23,42,0.85); color:#fff; font-weight:600; font-size:1rem; align-items:center; justify-content:center;';
  overlay.textContent = 'Confirming payment...';
  document.body.appendChild(overlay);
  return overlay;
};

const toggleOverlay = (overlay: HTMLDivElement, show: boolean, text?: string) => {
  overlay.textContent = text ?? overlay.textContent;
  overlay.style.display = show ? 'flex' : 'none';
};

const launchLencoWidget = (
  session: PaymentSessionResponse
): Promise<'success' | 'confirmation' | 'closed'> => {
  const payload = {
    key: session.publicKey,
    reference: session.reference,
    email: session.email,
    amount: session.amount,
    currency: session.currency,
    channels: session.channels.length > 0 ? session.channels : ['card', 'mobile-money'],
    label: session.label,
    customer: session.customer,
  };

  return new Promise((resolve, reject) => {
    const lenco = (window as Window & { LencoPay?: { getPaid: (config: Record<string, unknown>) => void } }).LencoPay;
    if (!lenco || typeof lenco.getPaid !== 'function') {
      reject(new Error('Lenco widget was not detected on this page.'));
      return;
    }

    try {
      lenco.getPaid({
        ...payload,
        onSuccess: () => resolve('success'),
        onConfirmationPending: () => resolve('confirmation'),
        onClose: () => resolve('closed'),
      });
    } catch (error) {
      reject(new Error('Failed to open the secure Lenco checkout.'));
    }
  });
};

export const processPayment = async (
  options: ProcessPaymentOptions
): Promise<ProcessPaymentResult> => {
  const session = await fetchPaymentSession(options);
  addPendingReference(session.reference, options.purpose);

  if (typeof window === 'undefined') {
    throw new Error('Payments can only be processed in a browser environment.');
  }

  const overlay = createOverlay();

  try {
    await ensureLencoWidget(session.widgetUrl);

    toggleOverlay(overlay, true, 'Opening secure checkout...');

    const result = await launchLencoWidget(session);
    toggleOverlay(overlay, true, 'Confirming payment with Lenco...');

    if (result === 'closed') {
      throw new Error('Payment was closed before completion.');
    }

    const verification = await verifyPayment(session.reference);

    if (verification.success) {
      removePendingReference(session.reference);
    }

    return verification;
  } catch (error) {
    removePendingReference(session.reference);
    throw error;
  } finally {
    toggleOverlay(overlay, false);
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }
};

export const attachTicketToTransaction = async (
  transactionId: string,
  ticketId: string
): Promise<void> => {
  if (!transactionId || !ticketId) return;
  const response = await apiFetchJson<{ success: boolean }>(`/api/payments/attach-ticket`, {
    method: 'POST',
    body: { transactionId, ticketId },
  });

  if (!response.success) {
    console.warn('Failed to attach ticket to transaction', transactionId, ticketId);
  }
};

export const verifyPaymentReference = (reference: string): Promise<ProcessPaymentResult> =>
  verifyPayment(reference);

export interface SubscriptionTransactionSummary {
  id: string;
  reference: string | null;
  status: string;
  amount: number;
  currency: string;
  provider: string;
  paymentMethod: string | null;
  channel: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown> | null;
}

export interface UserTransactionSummary {
  id: string;
  reference: string | null;
  status: GatewayTransactionStatus;
  purpose: string;
  amount: number;
  currency: string;
  provider: string;
  paymentMethod: string | null;
  channel: string | null;
  label: string;
  ticketId: string | null;
  eventId: string | null;
  eventTitle: string | null;
  createdAt: string;
  updatedAt: string;
}

export const fetchSubscriptionTransactions = async (
  user: User
): Promise<SubscriptionTransactionSummary[]> => {
  const response = await apiFetchJson<{ data: SubscriptionTransactionSummary[] }>('/api/payments/subscriptions', {
    user,
  });
  return response.data;
};

export const fetchUserTransactions = async (
  userId: string
): Promise<UserTransactionSummary[]> => {
  const response = await apiFetchJson<{ data: UserTransactionSummary[] }>('/api/payments/user-transactions', {
    query: { userId },
  });
  return response.data;
};
