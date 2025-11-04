import { PaymentDetails, PaymentMethod, User } from '../types';
import { apiFetch, apiFetchJson } from '../utils/apiClient';
import { addPendingReference, removePendingReference } from './pendingTransactionService';

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

  const previousOverflow = document.body.style.overflow;
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed; inset:0; background:rgba(15,23,42,0.82); z-index:9999; display:flex; align-items:center; justify-content:center; padding:24px;';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Lenco checkout');

  const dialog = document.createElement('div');
  dialog.style.cssText =
    'position:relative; width:min(460px, 100%); height:min(92vh, 720px); background:#ffffff; border-radius:20px; box-shadow:0 24px 80px rgba(30,41,59,0.2); display:flex; flex-direction:column; overflow:hidden;';
  overlay.appendChild(dialog);

  const header = document.createElement('div');
  header.style.cssText =
    'padding:24px 24px 16px; border-bottom:1px solid #ede9fe; display:flex; align-items:flex-start; justify-content:space-between; gap:12px;';
  dialog.appendChild(header);

  const titleGroup = document.createElement('div');
  titleGroup.style.cssText = 'flex:1;';
  header.appendChild(titleGroup);

  const titleEl = document.createElement('h2');
  titleEl.textContent = 'Complete Your Payment';
  titleEl.style.cssText = 'margin:0; font-size:1.25rem; color:#4c1d95;';
  titleGroup.appendChild(titleEl);

  const statusText = document.createElement('p');
  statusText.textContent = 'Securely pay with Lenco to finish this action.';
  statusText.style.cssText = 'margin:6px 0 0; font-size:0.9rem; color:#6b7280;';
  titleGroup.appendChild(statusText);

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.textContent = 'Cancel';
  closeButton.style.cssText =
    'padding:10px 16px; font-size:0.9rem; font-weight:600; color:#4c1d95; background:#f3e8ff; border:1px solid #d8b4fe; border-radius:9999px; cursor:pointer;';
  closeButton.setAttribute('aria-label', 'Cancel payment');
  header.appendChild(closeButton);

  const frameWrapper = document.createElement('div');
  frameWrapper.style.cssText = 'flex:1; position:relative; background:#f9fafb;';
  dialog.appendChild(frameWrapper);

  const iframe = document.createElement('iframe');
  iframe.title = 'Lenco checkout';
  iframe.style.cssText = 'border:0; width:100%; height:100%;';
  iframe.setAttribute('allow', 'payment *; clipboard-read; clipboard-write; fullscreen');
  frameWrapper.appendChild(iframe);

  const busyOverlay = document.createElement('div');
  busyOverlay.style.cssText =
    'display:none; position:absolute; inset:0; background:rgba(249,250,251,0.94); align-items:center; justify-content:center; flex-direction:column; gap:12px; padding:1.5rem; text-align:center; font-size:0.95rem; color:#4c1d95; font-weight:600;';
  busyOverlay.textContent = 'Confirming payment...';
  frameWrapper.appendChild(busyOverlay);

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const checkoutConfig = {
    key: session.publicKey,
    reference: session.reference,
    email: session.email,
    amount: session.amount,
    currency: session.currency,
    channels: session.channels.length > 0 ? session.channels : ['card', 'mobile-money'],
    label: session.label,
    customer: session.customer,
  };

  const serializedConfig = JSON.stringify(checkoutConfig).replace(/</g, '\\u003c');
  const checkoutHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Secure Lenco Checkout</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; background: #f7f7fb; color: #1f2937; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
      .container { text-align: center; padding: 2.5rem 2rem; background: #fff; border-radius: 16px; box-shadow: 0 20px 45px rgba(15, 23, 42, 0.08); max-width: 420px; width: 100%; }
      h1 { font-size: 1.5rem; margin-bottom: 0.75rem; color: #6d28d9; }
      p { font-size: 0.95rem; line-height: 1.5; margin: 0.25rem 0; }
      .spinner { margin: 1.5rem auto; width: 42px; height: 42px; border: 4px solid #e9d5ff; border-top-color: #6d28d9; border-radius: 50%; animation: spin 0.9s linear infinite; }
      small { display: block; margin-top: 1.5rem; color: #9ca3af; font-size: 0.75rem; }
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Preparing Secure Checkout</h1>
      <div class="spinner"></div>
      <p>We are opening the Lenco payment experience.</p>
      <p>Please keep this window visible until your payment completes.</p>
      <small>Powered by Lenco</small>
    </div>
    <script>
      (function () {
        var config = ${serializedConfig};
        function resolveTargetOrigin() {
          try {
            var origin = window.parent && window.parent.location ? window.parent.location.origin : null;
            if (!origin || origin === 'null') {
              return '*';
            }
            return origin;
          } catch (err) {
            return '*';
          }
        }
        var targetOrigin = resolveTargetOrigin();

        function postToParent(type, payload) {
          if (window.parent && typeof window.parent.postMessage === 'function') {
            window.parent.postMessage({ source: 'vibely-lenco-checkout', type: type, payload: payload || null }, targetOrigin);
          }
        }
        function handleError(message) {
          postToParent('error', { message: message });
        }
        function launchCheckout() {
          if (!window.LencoPay || typeof window.LencoPay.getPaid !== 'function') {
            handleError('Lenco checkout is not available. Please try again.');
            return;
          }
          try {
            window.LencoPay.getPaid({
              key: config.key,
              reference: config.reference,
              email: config.email,
              amount: config.amount,
              currency: config.currency,
              channels: config.channels,
              label: config.label,
              customer: config.customer,
              onSuccess: function (response) {
                postToParent('success', { reference: response && response.reference ? response.reference : config.reference });
              },
              onClose: function () {
                postToParent('closed', { reference: config.reference });
              },
              onConfirmationPending: function () {
                postToParent('pending', { reference: config.reference });
              }
            });
          } catch (error) {
            handleError(error && error.message ? error.message : 'Unable to launch Lenco checkout.');
          }
        }
        var script = document.createElement('script');
        script.src = '${session.widgetUrl}';
        script.onload = launchCheckout;
        script.onerror = function () {
          handleError('Failed to load the Lenco checkout widget.');
        };
        document.body.appendChild(script);
      })();
    <\/script>
  </body>
</html>`;

  const setStatusMessage = (message: string) => {
    statusText.textContent = message;
  };

  const setBusyState = (busy: boolean, message?: string) => {
    if (busy) {
      if (message) {
        busyOverlay.textContent = message;
      }
      busyOverlay.style.display = 'flex';
      closeButton.disabled = true;
      closeButton.setAttribute('aria-disabled', 'true');
      closeButton.style.cursor = 'not-allowed';
      closeButton.style.opacity = '0.65';
    } else {
      busyOverlay.style.display = 'none';
      closeButton.disabled = false;
      closeButton.removeAttribute('aria-disabled');
      closeButton.style.cursor = 'pointer';
      closeButton.style.opacity = '1';
      if (message) {
        setStatusMessage(message);
      }
    }
  };

  return new Promise((resolve, reject) => {
    let settled = false;
    let verifying = false;

    function cleanup() {
      window.removeEventListener('message', messageHandler);
      overlay.removeEventListener('click', overlayClickHandler);
      document.removeEventListener('keydown', keydownHandler);
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      document.body.style.overflow = previousOverflow;
    }

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

    const handleVerification = async () => {
      if (verifying) return;
      verifying = true;
      setStatusMessage('Confirming payment with Lenco...');
      setBusyState(true, 'Confirming payment with Lenco...');
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

    const messageHandler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.source !== 'vibely-lenco-checkout') {
        return;
      }

      switch (data.type) {
        case 'success':
        case 'pending':
          handleVerification();
          break;
        case 'closed':
          finishError('Payment was closed before completion.', { removePending: true });
          break;
        case 'error':
          finishError(data.payload?.message ?? 'An unexpected payment error occurred.');
          break;
        default:
          break;
      }
    };

    const overlayClickHandler = (event: MouseEvent) => {
      if (event.target === overlay && !closeButton.disabled) {
        finishError('Payment cancelled by user.');
      }
    };

    const keydownHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!closeButton.disabled) {
          finishError('Payment cancelled by user.');
        }
      }
    };

    window.addEventListener('message', messageHandler);
    overlay.addEventListener('click', overlayClickHandler);
    document.addEventListener('keydown', keydownHandler);
    closeButton.addEventListener('click', (event) => {
      event.preventDefault();
      if (!closeButton.disabled) {
        finishError('Payment cancelled by user.', { removePending: true });
      }
    });

    const frameWindow = iframe.contentWindow;
    const frameDoc = frameWindow?.document;
    if (!frameDoc) {
      finishError('Unable to initialize payment frame.', { removePending: true });
      return;
    }
    frameDoc.open();
    frameDoc.write(checkoutHtml);
    frameDoc.close();
    closeButton.focus();
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

