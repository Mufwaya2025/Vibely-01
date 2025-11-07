import crypto from "crypto";
import { lencoConfig } from "../config/lencoConfig";

interface VerifyCollectionResponse {
  status: boolean;
  message: string;
  data?: {
    id: string;
    initiatedAt: string;
    completedAt?: string;
    amount: string;
    fee?: string;
    bearer?: 'merchant' | 'customer';
    currency: string;
    reference: string;
    lencoReference?: string;
    type?: string;
    status: string;
    source?: string;
    reasonForFailure?: string | null;
    settlementStatus?: string;
    settlement?: Record<string, unknown> | null;
    mobileMoneyDetails?: Record<string, unknown> | null;
    bankAccountDetails?: Record<string, unknown> | null;
    cardDetails?: Record<string, unknown> | null;
  };
}

export class LencoClientError extends Error {
  public status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "LencoClientError";
    this.status = status;
  }
}

const delay = (ms = 750) => new Promise((resolve) => setTimeout(resolve, ms));

const authHeader = () => ({
  Authorization: `Bearer ${lencoConfig.secretKey}`,
});

export const verifyCollection = async (reference: string): Promise<VerifyCollectionResponse> => {
  if (lencoConfig.mockMode) {
    await delay();
    const now = new Date().toISOString();
    return {
      status: true,
      message: 'Mock verification succeeded',
      data: {
        id: `mock-${reference}`,
        initiatedAt: now,
        completedAt: now,
        amount: '0',
        currency: lencoConfig.currency,
        reference,
        status: 'successful',
        bearer: 'merchant',
      },
    };
  }

  if (!lencoConfig.secretKey) {
    throw new LencoClientError('Lenco secret key is not configured.');
  }

  const url = `${lencoConfig.apiBase}/collections/status/${encodeURIComponent(reference)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      ...authHeader(),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new LencoClientError(text || 'Failed to verify collection.', response.status);
  }

  return (await response.json()) as VerifyCollectionResponse;
};

interface CreateTransferPayload {
  reference: string;
  amount: number;
  currency?: string;
  narration?: string;
  destination: Record<string, unknown>;
  sourceAccountId?: string;
}

export const createTransfer = async (payload: CreateTransferPayload) => {
  if (lencoConfig.mockMode) {
    await delay();
    return {
      status: true,
      message: 'Mock transfer initiated',
      data: {
        reference: payload.reference,
        amount: payload.amount,
        currency: payload.currency || lencoConfig.currency,
        status: 'successful',
      },
    };
  }

  if (!lencoConfig.secretKey) {
    throw new LencoClientError('Lenco secret key is not configured.');
  }

  const body = {
    reference: payload.reference,
    amount: payload.amount,
    currency: payload.currency || lencoConfig.currency,
    narration: payload.narration,
    destination: payload.destination,
    sourceAccountId: payload.sourceAccountId || lencoConfig.withdrawSourceAccountId || undefined,
  };

  const response = await fetch(`${lencoConfig.apiBase}/transfers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeader(),
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new LencoClientError(text || 'Failed to initiate transfer.', response.status);
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    return text;
  }
};

export const createReference = (prefix: string) => {
  const safePrefix = prefix.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) || 'ref';
  return `${safePrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

export const computeWebhookSignature = (payload: string) => {
  if (!lencoConfig.secretKey) {
    return '';
  }
  const webhookHashKey = crypto
    .createHash('sha256')
    .update(lencoConfig.secretKey)
    .digest('hex');

  return crypto.createHmac('sha512', webhookHashKey).update(payload).digest('hex');
};
