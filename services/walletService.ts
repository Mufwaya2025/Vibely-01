import { PayoutMethod } from "../types";
import { apiFetchJson } from "../utils/apiClient";

export interface CreatePayoutMethodInput {
  type: PayoutMethod['type'];
  accountInfo: string;
  bankName?: string;
  bankCode?: string;
  accountNumber?: string;
  mobileMoneyProvider?: string;
  phoneNumber?: string;
  isDefault?: boolean;
}

export const getPayoutMethods = async (userId: string): Promise<PayoutMethod[]> => {
  const response = await apiFetchJson<{ data: PayoutMethod[] }>('/api/wallet/payout-methods', {
    query: { userId },
  });
  return response.data;
};

export const addPayoutMethod = async (
  userId: string,
  newMethod: CreatePayoutMethodInput
): Promise<PayoutMethod> => {
  const response = await apiFetchJson<{ data: PayoutMethod }>('/api/wallet/payout-methods', {
    method: 'POST',
    body: {
      userId,
      ...newMethod,
    },
  });
  return response.data;
};

export interface PayoutRequestResult {
  success: boolean;
  message: string;
  availableBalance?: number;
  feeAmount?: number;
  netAmount?: number;
}

export const requestPayout = async (
  userId: string,
  amount: number,
  method: PayoutMethod
): Promise<PayoutRequestResult> => {
  if (method.type === 'Bank') {
    if (!method.accountNumber || !method.bankCode) {
      throw new Error('Selected bank account is missing required details.');
    }
  } else if (!method.phoneNumber || !method.mobileMoneyProvider) {
    throw new Error('Selected mobile money account is missing required details.');
  }

  const payload = await apiFetchJson<{
    status: string;
    message: string;
    availableBalance: number;
    feeAmount: number;
    netAmount: number;
  }>('/api/payments/payouts', {
    method: 'POST',
    body: {
      organizerId: userId,
      amount,
      payoutMethodId: method.id,
      narration: `Payout to ${method.details}`,
    },
  });

  return {
    success: payload.status !== 'failed',
    message: payload.message,
    availableBalance: payload.availableBalance,
    feeAmount: payload.feeAmount,
    netAmount: payload.netAmount,
  };
};
