// Wallet service now talks to the backend payment endpoints where available.
import { PayoutMethod } from "../types";
import { apiFetchJson } from "../utils/apiClient";

let mockPayoutMethods: PayoutMethod[] = [
  { id: "pm-001", type: "Bank", details: "ABSA Bank - **** 4321", accountInfo: "John Smith", isDefault: true },
  { id: "pm-002", type: "MobileMoney", details: "MTN Mobile Money - 09...56", accountInfo: "John Smith", isDefault: false },
];

export const getPayoutMethods = async (userId: string): Promise<PayoutMethod[]> => {
  console.log(`Fetching payout methods for user ${userId} from API`);
  await new Promise((resolve) => setTimeout(resolve, 200));
  return [...mockPayoutMethods];
};

export const addPayoutMethod = async (
  userId: string,
  newMethod: Omit<PayoutMethod, "id" | "isDefault">
): Promise<PayoutMethod> => {
  console.log(`Adding payout method for user ${userId} via API`);
  await new Promise((resolve) => setTimeout(resolve, 200));
  const createdMethod: PayoutMethod = {
    ...newMethod,
    id: `pm-${Date.now()}`,
    isDefault: mockPayoutMethods.length === 0,
  };
  mockPayoutMethods.push(createdMethod);
  return createdMethod;
};

export const requestPayout = async (
  userId: string,
  amount: number,
  methodId: string
): Promise<{ success: boolean; message: string; availableBalance?: number }> => {
  const method = mockPayoutMethods.find((m) => m.id === methodId);
  if (!method) {
    return { success: false, message: 'Payout method not found.' };
  }

  const destination = {
    type: method.type === 'MobileMoney' ? 'mobile-money' : 'bank-account',
    label: method.details,
    accountName: method.accountInfo,
  };

  const response = await apiFetchJson<{
    status: string;
    transaction: Record<string, unknown>;
    availableBalance: number;
  }>('/api/payments/payouts', {
    method: 'POST',
    body: {
      organizerId: userId,
      amount,
      destination,
      narration: `Payout to ${method.details}`,
    },
  });

  const success = response.status === 'succeeded';
  return {
    success,
    message: success
      ? `Payout of K${amount} to ${method.details} is being processed.`
      : 'Payout request failed. Please try again.',
    availableBalance: response.availableBalance,
  };
};
