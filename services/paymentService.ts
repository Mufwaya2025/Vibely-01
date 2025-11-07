import { PaymentDetails, PaymentMethod, User } from '../types';
import { apiFetch, apiFetchJson } from '../utils/apiClient';
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
}

export const processPayment = async (
  options: ProcessPaymentOptions
): Promise<ProcessPaymentResult> => {
  const session = await apiFetchJson<PaymentSessionResponse>('/api/payments/session', {
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

  addPendingReference(session.reference, options.purpose);

  if (typeof window === 'undefined') {
    throw new Error('Payments can only be processed in a browser environment.');
  }

  const createStatusOverlay = () => {
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'display:none; position:fixed; inset:0; z-index:9999; background:rgba(15,23,42,0.85); color:#fff; font-weight:600; font-size:1rem; align-items:center; justify-content:center;';
    overlay.textContent = 'Confirming payment...';
    document.body.appendChild(overlay);
    return overlay;
  };

  return new Promise((resolve, reject) => {
    let settled = false;
    let verifying = false;
    const statusOverlay = createStatusOverlay();

    const cleanup = () => {
      if (statusOverlay.parentNode) {
        statusOverlay.parentNode.removeChild(statusOverlay);
      }
    };

    const finishSuccess = (payload: Omit<ProcessPaymentResult, 'reference'>) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (payload.success) {
        removePendingReference(session.reference);
      }
      resolve({ ...payload, reference: session.reference });
    };

    const finishError = (message: string, opts?: { removePending?: boolean }) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (opts?.removePending) {
        removePendingReference(session.reference);
      }
      const error = new Error(
        message.includes(session.reference)
          ? message
          : `${message} (Reference: ${session.reference})`
      );
      (error as Error & { reference?: string }).reference = session.reference;
      reject(error);
    };

    const showStatus = (message: string) => {
      statusOverlay.textContent = message;
      statusOverlay.style.display = 'flex';
    };

    const hideStatus = () => {
      statusOverlay.style.display = 'none';
    };

    const handleVerification = async () => {
      if (verifying) return;
      verifying = true;
      showStatus('Confirming payment with Lenco...');
      try {
        const verification = await apiFetchJson<{
          success: boolean;
          status: string;
          transaction?: Record<string, unknown>;
          updatedUser?: User | null;
        }>('/api/payments/verify', {
          method: 'POST',
          body: { reference: session.reference },
        });
        hideStatus();
        finishSuccess({
          success: verification.success,
          status: verification.status,
          transactionId: (verification.transaction as any)?.id ?? '',
          transaction: verification.transaction,
          updatedUser: verification.updatedUser ?? null,
        });
      } catch (error) {
        console.error('Verification failed', error);
        finishError('Payment verification failed. Please contact support.');
      }
    };

    const launchCheckout = async () => {
      try {
        await ensureLencoWidget(session.widgetUrl);
      } catch (err) {
        finishError(err instanceof Error ? err.message : 'Failed to load the Lenco checkout widget.');
        return;
      }

      if (session.mockMode) {
        showStatus('Simulating secure checkout...');
        setTimeout(() => {
          handleVerification();
        }, 1000);
        return;
      }

      const lenco = (window as Window & { LencoPay?: { getPaid: (config: Record<string, unknown>) => void } }).LencoPay;
      if (!lenco || typeof lenco.getPaid !== 'function') {
        finishError('Lenco checkout is not available. Please try again.', { removePending: true });
        return;
      }

      try {
        lenco.getPaid({
          key: session.publicKey,
          reference: session.reference,
          email: session.email,
          amount: session.amount,
          currency: session.currency,
          channels: session.channels.length > 0 ? session.channels : ['card', 'mobile-money'],
          label: session.label,
          customer: session.customer,
          onSuccess: () => {
            handleVerification();
          },
          onConfirmationPending: () => {
            handleVerification();
          },
          onClose: () => {
            finishError('Payment was closed before completion.', { removePending: true });
          },
        });
      } catch (error) {
        finishError(
          error instanceof Error ? error.message : 'Unable to launch Lenco checkout.',
          { removePending: true }
        );
      }
    };

    launchCheckout();
  });
};

export const attachTicketToTransaction = async (
  transactionId: string,
  ticketId: string
): Promise<void> => {
  if (!transactionId || !ticketId) return;
  const response = await apiFetch('/api/payments/attach-ticket', {
    method: 'POST',
    body: { transactionId, ticketId },
  });

  if (!response.ok) {
    console.error('Failed to attach ticket to transaction:', await response.text());
  }
};

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

export const verifyPaymentReference = async (reference: string): Promise<ProcessPaymentResult> => {
  const verification = await apiFetchJson<{
    success: boolean;
    status: string;
    transaction?: Record<string, unknown>;
    updatedUser?: User | null;
  }>('/api/payments/verify', {
    method: 'POST',
    body: { reference },
  });

  const result: ProcessPaymentResult = {
    success: verification.success,
    status: verification.status,
    transactionId: (verification.transaction as any)?.id ?? '',
    transaction: verification.transaction,
    updatedUser: verification.updatedUser ?? null,
    reference,
  };

  if (result.success) {
    removePendingReference(reference);
  }

  return result;
};
export const fetchSubscriptionTransactions = async (
  user: User
): Promise<SubscriptionTransactionSummary[]> => {
  const response = await apiFetchJson<{ data: SubscriptionTransactionSummary[] }>('/api/payments/subscriptions', {
    user,
  });
  return response.data;
};
